import ICAL from 'ical.js'

/**
 * Événement ICS normalisé issu du flux FFHB.
 * Volontairement indépendant de Firestore (Timestamp) pour rester pur
 * et testable, et réutilisable côté Cloud Function.
 */
export interface ParsedIcsEvent {
  icsUid: string
  title: string
  start: Date
  end?: Date
  locationName: string
  locationAddress: string
  locationCity: string
}

/** Découpe une chaîne de localisation ICS « Nom, Adresse, Ville ». */
function splitLocation(raw: string): {
  name: string
  address: string
  city: string
} {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return { name: '', address: '', city: '' }
  if (parts.length === 1) return { name: parts[0], address: '', city: '' }
  if (parts.length === 2)
    return { name: parts[0], address: '', city: parts[1] }
  return {
    name: parts[0],
    address: parts.slice(1, -1).join(', '),
    city: parts[parts.length - 1],
  }
}

/**
 * Parse un flux ICS brut et renvoie la liste des VEVENT normalisés.
 * Dédoublonne par `icsUid` (un même match peut apparaître plusieurs fois
 * dans le flux FFHB s'il a été modifié — on garde la dernière occurrence).
 */
export function parseIcs(icsText: string): ParsedIcsEvent[] {
  const jcal = ICAL.parse(icsText)
  const comp = new ICAL.Component(jcal)
  const vevents = comp.getAllSubcomponents('vevent')

  const byUid = new Map<string, ParsedIcsEvent>()

  for (const ve of vevents) {
    const event = new ICAL.Event(ve)
    const icsUid = event.uid
    if (!icsUid) continue

    const start = event.startDate ? event.startDate.toJSDate() : null
    if (!start) continue
    const end = event.endDate ? event.endDate.toJSDate() : undefined

    const rawLocation = event.location ?? ''
    const loc = splitLocation(rawLocation)

    byUid.set(icsUid, {
      icsUid,
      title: event.summary ?? 'Match FFHB',
      start,
      end,
      locationName: loc.name,
      locationAddress: loc.address,
      locationCity: loc.city,
    })
  }

  return Array.from(byUid.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )
}
