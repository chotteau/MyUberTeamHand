import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from './lib/admin.js'
import { parseIcs, type ParsedIcsEvent } from './lib/icsParser.js'

/** Met à 00:00 (heure locale serveur) le début de journée. */
function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

interface SyncResult {
  created: number
  updated: number
  cancelled: number
}

/**
 * Réconcilie le flux ICS FFHB avec la collection `events`.
 * - icsUid déjà connu → mise à jour si changement
 * - icsUid nouveau → création
 * - event FFHB en base absent du flux → marqué `cancelled`
 */
export async function reconcileIcs(
  parsed: ParsedIcsEvent[],
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, cancelled: 0 }

  // Index des events FFHB existants par icsUid.
  const snap = await db
    .collection('events')
    .where('source', '==', 'ics_ffhb')
    .get()

  const existingByUid = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  for (const doc of snap.docs) {
    const uid = doc.get('icsUid') as string | undefined
    if (uid) existingByUid.set(uid, doc)
  }

  const seenUids = new Set<string>()

  for (const ev of parsed) {
    seenUids.add(ev.icsUid)
    const day = startOfDay(ev.start)

    const payload = {
      type: 'match' as const,
      title: ev.title,
      date: Timestamp.fromDate(day),
      departureTime: Timestamp.fromDate(ev.start),
      ...(ev.end ? { returnTime: Timestamp.fromDate(ev.end) } : {}),
      location: {
        name: ev.locationName,
        address: ev.locationAddress,
        city: ev.locationCity,
      },
      status: 'scheduled' as const,
      source: 'ics_ffhb' as const,
      icsUid: ev.icsUid,
      updatedAt: FieldValue.serverTimestamp(),
    }

    const existing = existingByUid.get(ev.icsUid)
    if (!existing) {
      await db.collection('events').add({
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      })
      result.created++
    } else {
      // Mise à jour seulement si un champ pertinent a changé.
      const before = existing.data()
      const changed =
        before.title !== payload.title ||
        (before.departureTime as Timestamp)?.toMillis?.() !==
          payload.departureTime.toMillis() ||
        before.location?.name !== payload.location.name ||
        before.status === 'cancelled'
      if (changed) {
        await existing.ref.set(payload, { merge: true })
        result.updated++
      }
    }
  }

  // Events FFHB en base absents du flux → annulés.
  for (const [uid, doc] of existingByUid) {
    if (!seenUids.has(uid) && doc.get('status') !== 'cancelled') {
      await doc.ref.set(
        { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
      result.cancelled++
    }
  }

  return result
}

/** Récupère l'URL ICS depuis config/app, fetch, parse, réconcilie. */
export async function runIcsSync(): Promise<SyncResult> {
  const configSnap = await db.doc('config/app').get()
  const icsUrl = configSnap.get('icsUrl') as string | undefined
  if (!icsUrl) {
    logger.warn('Aucune URL ICS configurée (config/app.icsUrl)')
    return { created: 0, updated: 0, cancelled: 0 }
  }

  const res = await fetch(icsUrl)
  if (!res.ok) {
    throw new Error(`Échec fetch ICS: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  const parsed = parseIcs(text)
  const result = await reconcileIcs(parsed)

  await db.doc('config/app').set(
    { icsLastSync: FieldValue.serverTimestamp() },
    { merge: true },
  )

  logger.info('Sync ICS terminée', { ...result, total: parsed.length })
  return result
}

/** Cron : synchronise le flux ICS FFHB toutes les 24h (03:00 Europe/Paris). */
export const syncIcs = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    await runIcsSync()
  },
)
