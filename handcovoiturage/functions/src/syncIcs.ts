import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from './lib/admin.js'
import { parseIcs, type ParsedIcsEvent } from './lib/icsParser.js'

/** Minuit Europe/Paris du jour de la date (les Functions tournent en UTC). */
function startOfParisDay(d: Date): Date {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  // Minuit Paris = 22:00 ou 23:00 UTC la veille selon l'heure d'été.
  const utcMidnight = Date.UTC(get('year'), get('month') - 1, get('day'))
  const offsetMs = parisOffsetMinutes(new Date(utcMidnight)) * 60_000
  return new Date(utcMidnight - offsetMs)
}

function parisOffsetMinutes(d: Date): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value // "GMT+2"
  const m = /GMT([+-]\d+)/.exec(s ?? '')
  return m ? Number(m[1]) * 60 : 0
}

export interface SyncResult {
  created: number
  updated: number
  cancelled: number
}

/**
 * Réconcilie le flux FFHB avec `events` :
 * - nouveau UID → création ;
 * - UID connu → maj titre/heures/lieu SANS toucher `status` — sauf si c'est
 *   la sync elle-même qui l'avait annulé (`autoCancelled`) et qu'il réapparaît :
 *   il redevient 'scheduled'. Une annulation décidée par l'admin n'est jamais touchée ;
 * - match FUTUR absent du flux → 'cancelled' + `autoCancelled: true` (seulement si le flux n'est pas vide).
 */
export async function reconcileIcs(parsed: ParsedIcsEvent[]): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, cancelled: 0 }
  if (parsed.length === 0) {
    logger.warn('Flux ICS vide : aucune modification')
    return result
  }

  const snap = await db.collection('events').where('source', '==', 'ics_ffhb').get()
  const existingByUid = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  for (const d of snap.docs) {
    const uid = d.get('icsUid') as string | undefined
    if (uid) existingByUid.set(uid, d)
  }

  const seen = new Set<string>()
  for (const ev of parsed) {
    seen.add(ev.icsUid)
    const payload = {
      type: 'match' as const,
      title: ev.title,
      date: Timestamp.fromDate(startOfParisDay(ev.start)),
      departureTime: Timestamp.fromDate(ev.start),
      ...(ev.end ? { returnTime: Timestamp.fromDate(ev.end) } : {}),
      location: { name: ev.locationName, address: ev.locationAddress, city: ev.locationCity },
      source: 'ics_ffhb' as const,
      icsUid: ev.icsUid,
      updatedAt: FieldValue.serverTimestamp(),
    }

    const existing = existingByUid.get(ev.icsUid)
    if (!existing) {
      await db.collection('events').add({
        ...payload,
        status: 'scheduled',
        createdAt: FieldValue.serverTimestamp(),
      })
      result.created++
      continue
    }
    const before = existing.data()
    const reappeared = before.status === 'cancelled' && before.autoCancelled === true
    const changed =
      reappeared ||
      before.title !== payload.title ||
      (before.departureTime as Timestamp)?.toMillis?.() !== payload.departureTime.toMillis() ||
      (before.returnTime as Timestamp | undefined)?.toMillis?.() !== payload.returnTime?.toMillis() ||
      before.location?.name !== payload.location.name ||
      before.location?.address !== payload.location.address ||
      before.location?.city !== payload.location.city
    if (changed) {
      await existing.ref.set(
        reappeared
          ? { ...payload, status: 'scheduled', autoCancelled: FieldValue.delete() }
          : payload,
        { merge: true },
      )
      result.updated++
    }
  }

  const now = Timestamp.now()
  for (const [uid, d] of existingByUid) {
    if (seen.has(uid)) continue
    if (d.get('status') !== 'scheduled') continue
    if ((d.get('departureTime') as Timestamp).toMillis() < now.toMillis()) continue
    await d.ref.set(
      { status: 'cancelled', autoCancelled: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    result.cancelled++
  }
  return result
}

export async function runIcsSync(): Promise<SyncResult> {
  const icsUrl = (await db.doc('config/app').get()).get('icsUrl') as string | undefined
  if (!icsUrl) {
    logger.warn('Aucune URL ICS configurée (config/app.icsUrl)')
    return { created: 0, updated: 0, cancelled: 0 }
  }
  const res = await fetch(icsUrl)
  if (!res.ok) throw new Error(`Échec fetch ICS: ${res.status} ${res.statusText}`)
  const result = await reconcileIcs(parseIcs(await res.text()))
  await db.doc('config/app').set({ icsLastSync: FieldValue.serverTimestamp() }, { merge: true })
  logger.info('Sync ICS terminée', result)
  return result
}

export const syncIcs = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Europe/Paris', region: 'europe-west1', maxInstances: 1 },
  async () => {
    await runIcsSync()
  },
)
