import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { Timestamp } from 'firebase-admin/firestore'
import { db } from './lib/admin.js'

type Direction = 'aller' | 'retour'

interface TripAddress {
  kind: 'default' | 'secondary' | 'custom'
  label: string
  street: string
  zipCode: string
  city: string
}
interface Participant {
  childId: string
  childName: string
  aller: TripAddress | null
  retour: TripAddress | null
}
interface Car {
  driverName: string
  aller: boolean
  retour: boolean
  passengersAller: string[]
  passengersRetour: string[]
}
interface EventDoc {
  id: string
  title: string
  type: 'training' | 'match'
  status: 'scheduled' | 'cancelled' | 'vacances'
  departureTime: Timestamp
  returnTime?: Timestamp
  location: { name: string; address: string; city: string }
  updatedAt?: Timestamp
}

const esc = (t: string) =>
  t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const toIcsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** RFC 5545 : repli des lignes > 75 octets (UTF-8). */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const out: string[] = []
  let i = 0
  let first = true
  while (i < bytes.length) {
    let len = first ? 75 : 74
    // Ne pas couper un caractère multi-octets.
    while (i + len < bytes.length && (bytes[i + len] & 0xc0) === 0x80) len--
    out.push((first ? '' : ' ') + bytes.subarray(i, i + len).toString('utf8'))
    i += len
    first = false
  }
  return out.join('\r\n')
}

const fmtTime = (ts: Timestamp) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts.toDate())
const fmtDateTime = (ts: Timestamp) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts.toDate())

function addrText(a: TripAddress | null): string {
  if (!a) return ''
  const full = [a.street, [a.zipCode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return a.kind === 'custom' || !a.label ? full : `${a.label} — ${full}`
}

/** Bloc texte d'une direction : voitures, passagers avec adresse, sans-voiture. */
function directionBlock(
  label: string,
  time: Timestamp,
  direction: Direction,
  participants: Participant[],
  cars: Car[],
): string[] {
  const key = direction === 'aller' ? 'passengersAller' : 'passengersRetour'
  const byId = new Map(participants.map((p) => [p.childId, p]))
  const present = participants.filter((p) => p[direction])
  const lines = [`${label} — départ ${fmtTime(time)}`]
  if (present.length === 0) {
    lines.push('Personne d’inscrit')
    return lines
  }
  const seated = new Set<string>()
  for (const car of cars.filter((c) => c[direction]).sort((a, b) => a.driverName.localeCompare(b.driverName))) {
    const names = car[key]
      .map((id) => byId.get(id))
      .filter((p): p is Participant => !!p)
      .map((p) => {
        seated.add(p.childId)
        const a = addrText(p[direction])
        return a ? `${p.childName} (${a})` : p.childName
      })
    lines.push(`🚗 ${car.driverName} : ${names.join(', ') || '—'}`)
  }
  const without = present.filter((p) => !seated.has(p.childId)).map((p) => p.childName)
  if (cars.filter((c) => c[direction]).length === 0) lines.push('❗ Aucune voiture')
  else if (without.length) lines.push(`❗ Sans voiture : ${without.join(', ')}`)
  else lines.push('✅ Tout le monde a une voiture')
  return lines
}

/**
 * GET /api/calendar/{token}.ics — un VEVENT par événement, l'organisation
 * complète dans la description. Prénoms + adresses de prise en charge,
 * jamais d'email. Protégé par le token de config/app.calendarToken.
 */
export const calendarExport = onRequest({ region: 'europe-west1' }, async (req, res) => {
  try {
    const cfgSnap = await db.doc('config/app').get()
    const token = cfgSnap.get('calendarToken') as string | undefined
    const m = /\/api\/calendar\/([A-Za-z0-9_-]+)\.ics$/.exec(req.path)
    if (!token || !m || m[1] !== token) {
      res.status(404).send('Not found')
      return
    }
    const calendarName = (cfgSnap.get('calendarName') as string) || 'HandCovoiturage'
    const seasonEnd = cfgSnap.get('seasonEnd') as Timestamp | undefined
    const appUrl = (process.env.APP_URL || 'https://myuberteamhand.web.app').replace(/\/$/, '')

    const from = Timestamp.fromMillis(Date.now() - 7 * 24 * 3600 * 1000)
    let q = db.collection('events').where('date', '>=', from)
    if (seasonEnd) q = q.where('date', '<=', seasonEnd)
    const eventsSnap = await q.orderBy('date', 'asc').get()

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HandCovoiturage//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      foldLine(`X-WR-CALNAME:${esc(calendarName)}`),
      'X-WR-TIMEZONE:Europe/Paris',
    ]
    const now = new Date()

    for (const d of eventsSnap.docs) {
      const ev = { id: d.id, ...(d.data() as Omit<EventDoc, 'id'>) }
      const [pSnap, cSnap] = await Promise.all([
        d.ref.collection('participants').get(),
        d.ref.collection('cars').get(),
      ])
      const participants = pSnap.docs.map((x) => x.data() as Participant)
      const cars = cSnap.docs.map((x) => x.data() as Car)

      const cancelled = ev.status !== 'scheduled'
      const emoji = ev.type === 'match' ? '🏆' : '🤾'
      const suffix = ev.status === 'vacances' ? ' (vacances)' : ev.status === 'cancelled' ? ' (annulé)' : ''
      const summary = `${cancelled ? '❌ ' : emoji + ' '}${ev.title}${suffix}`

      const start = ev.departureTime.toDate()
      const end = ev.returnTime ? ev.returnTime.toDate() : new Date(start.getTime() + 2 * 3600 * 1000)

      const desc: string[] = cancelled
        ? [`Événement ${ev.status === 'vacances' ? 'annulé (vacances scolaires)' : 'annulé'}.`]
        : [
            ...directionBlock('ALLER', ev.departureTime, 'aller', participants, cars),
            '',
            ...(ev.returnTime
              ? directionBlock('RETOUR', ev.returnTime, 'retour', participants, cars)
              : []),
          ]
      desc.push('', `Mis à jour le ${fmtDateTime(Timestamp.fromDate(now))} — ${appUrl}/event/${ev.id}`)

      const loc = [ev.location?.name, ev.location?.address, ev.location?.city].filter(Boolean).join(', ')

      lines.push(
        'BEGIN:VEVENT',
        `UID:event-${ev.id}@handcovoiturage`,
        `DTSTAMP:${toIcsUtc(now)}`,
        `DTSTART:${toIcsUtc(start)}`,
        `DTEND:${toIcsUtc(end)}`,
        foldLine(`SUMMARY:${esc(summary)}`),
        foldLine(`LOCATION:${esc(loc)}`),
        foldLine(`DESCRIPTION:${esc(desc.join('\n'))}`),
        `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT',
      )
    }
    lines.push('END:VCALENDAR')

    res.set('Content-Type', 'text/calendar; charset=utf-8')
    res.set('Content-Disposition', 'inline; filename="handcovoiturage.ics"')
    res.set('Cache-Control', 'public, max-age=300')
    res.status(200).send(lines.join('\r\n'))
  } catch (e) {
    logger.error('Échec export ICS', e)
    res.status(500).send('Erreur génération calendrier')
  }
})
