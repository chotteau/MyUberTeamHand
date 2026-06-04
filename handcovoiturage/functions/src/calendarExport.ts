import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { Timestamp } from 'firebase-admin/firestore'
import { db } from './lib/admin.js'
import { getUserName, type EventLite } from './lib/data.js'

interface PassengerLite {
  childId: string
  needId?: string
  pickupAddress?: string
}

interface RideLite {
  id: string
  eventId: string
  driverUid: string
  direction: 'outbound' | 'return'
  passengers: PassengerLite[]
  status: string
}

interface EventFull extends EventLite {
  departureTime: Timestamp
  returnTime?: Timestamp
  location: { name: string; address: string; city: string }
}

/** Échappe les caractères spéciaux ICS dans un texte. */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Formate une date en UTC compacte (YYYYMMDDTHHMMSSZ). */
function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function foldLine(line: string): string {
  // RFC 5545 : lignes ≤ 75 octets, repli avec espace.
  if (line.length <= 75) return line
  const chunks: string[] = []
  let rest = line
  chunks.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    chunks.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) chunks.push(' ' + rest)
  return chunks.join('\r\n')
}

/**
 * HTTP GET /api/calendar/handcovoiturage.ics
 * Génère un calendrier public des trajets confirmés/terminés des 4 prochaines
 * semaines. SÉCURITÉ : aucun email ni téléphone (export public).
 */
export const calendarExport = onRequest(
  { region: 'europe-west1', cors: true },
  async (_req, res) => {
    try {
      const now = new Date()
      const horizon = Timestamp.fromMillis(
        now.getTime() + 28 * 24 * 3600 * 1000,
      )
      const fromTs = Timestamp.fromMillis(now.getTime() - 24 * 3600 * 1000)

      // Événements dans la fenêtre.
      const eventsSnap = await db
        .collection('events')
        .where('date', '>=', fromTs)
        .where('date', '<=', horizon)
        .get()

      const eventMap = new Map<string, EventFull>()
      for (const d of eventsSnap.docs) {
        eventMap.set(d.id, {
          id: d.id,
          title: d.get('title'),
          date: d.get('date'),
          departureTime: d.get('departureTime'),
          returnTime: d.get('returnTime'),
          location: d.get('location') ?? { name: '', address: '', city: '' },
        })
      }

      // Trajets confirmés / terminés rattachés à ces événements.
      const ridesSnap = await db
        .collection('rides')
        .where('status', 'in', ['confirmed', 'completed'])
        .get()
      const rides = ridesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as RideLite)
        .filter((r) => eventMap.has(r.eventId))

      // Résolution des noms (chauffeurs + enfants) en une passe.
      const driverNames = new Map<string, string>()
      const childNames = new Map<string, string>()
      const childIds = new Set<string>()
      for (const r of rides) {
        if (!driverNames.has(r.driverUid)) {
          driverNames.set(r.driverUid, await getUserName(r.driverUid))
        }
        r.passengers.forEach((p) => childIds.add(p.childId))
      }
      await Promise.all(
        [...childIds].map(async (id) => {
          const snap = await db.doc(`children/${id}`).get()
          childNames.set(
            id,
            snap.exists
              ? `${snap.get('firstName') ?? ''} ${snap.get('lastName') ?? ''}`.trim()
              : '—',
          )
        }),
      )

      const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//HandCovoiturage//FR',
        'CALSCALE:GREGORIAN',
        'X-WR-CALNAME:HandCovoiturage',
        'X-WR-TIMEZONE:Europe/Paris',
      ]

      for (const ride of rides) {
        const ev = eventMap.get(ride.eventId)!
        const isOutbound = ride.direction === 'outbound'
        const startTs = isOutbound ? ev.departureTime : ev.returnTime
        if (!startTs) continue
        const start = startTs.toDate()
        const end = new Date(start.getTime() + 45 * 60 * 1000)

        const driverName = driverNames.get(ride.driverUid) ?? 'Chauffeur'
        const passengerNames = ride.passengers
          .map((p) => childNames.get(p.childId) ?? '—')
          .filter(Boolean)
        const dirLabel = isOutbound ? 'Aller' : 'Retour'
        const summary = `🚗 ${dirLabel} — ${driverName} (${passengerNames.join(', ')})`

        const locParts = [ev.location.name, ev.location.address, ev.location.city]
          .filter(Boolean)
          .join(', ')

        const descLines = [
          `Chauffeur: ${driverName}`,
          'Passagers:',
          ...ride.passengers.map(
            (p) =>
              `- ${childNames.get(p.childId) ?? '—'}${
                p.pickupAddress ? ` (${p.pickupAddress})` : ''
              }`,
          ),
        ]

        lines.push(
          'BEGIN:VEVENT',
          `UID:ride-${ride.id}@handcovoiturage`,
          `DTSTAMP:${toIcsUtc(now)}`,
          `DTSTART:${toIcsUtc(start)}`,
          `DTEND:${toIcsUtc(end)}`,
          foldLine(`SUMMARY:${esc(summary)}`),
          foldLine(`LOCATION:${esc(locParts)}`),
          foldLine(`DESCRIPTION:${esc(descLines.join('\n'))}`),
          `STATUS:${ride.status === 'completed' ? 'CONFIRMED' : 'CONFIRMED'}`,
          'END:VEVENT',
        )
      }

      lines.push('END:VCALENDAR')
      const body = lines.join('\r\n')

      res.set('Content-Type', 'text/calendar; charset=utf-8')
      res.set('Content-Disposition', 'inline; filename="handcovoiturage.ics"')
      res.set('Cache-Control', 'public, max-age=300')
      res.status(200).send(body)
    } catch (e) {
      logger.error('Échec export ICS', e)
      res.status(500).send('Erreur génération calendrier')
    }
  },
)
