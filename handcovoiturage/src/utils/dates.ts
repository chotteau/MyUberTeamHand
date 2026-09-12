import { format, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import type { Event } from '../types'

/** Convertit un Timestamp Firestore (ou Date) en Date JS. */
export function toDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

/** Formate une date avec un pattern date-fns (locale fr). */
export function formatDate(value: Timestamp | Date, pattern = 'PPP'): string {
  return format(toDate(value), pattern, { locale: fr })
}

/** Ex: "lundi 17 janvier" */
export function formatDayMonth(value: Timestamp | Date): string {
  return format(toDate(value), 'EEEE d MMMM', { locale: fr })
}

/** Ex: "17:15" */
export function formatTime(value: Timestamp | Date): string {
  return format(toDate(value), 'HH:mm', { locale: fr })
}

/** Ex: "12/09 à 14:32" */
export function formatShortDateTime(value: Timestamp | Date): string {
  return format(toDate(value), "dd/MM 'à' HH:mm", { locale: fr })
}

/** Un événement est passé dès que son heure de départ est dépassée. */
export function isEventPast(event: Pick<Event, 'departureTime'>): boolean {
  return !isAfter(toDate(event.departureTime), new Date())
}

/**
 * Règle métier 8 : modifiable uniquement si programmé et pas encore passé.
 * Les statuts 'cancelled' et 'vacances' sont figés.
 */
export function isEventEditable(
  event: Pick<Event, 'departureTime' | 'status'>,
): boolean {
  return event.status === 'scheduled' && !isEventPast(event)
}

/** Combine un jour et une heure "HH:mm" en Date locale. */
export function combineDateAndTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(hours, minutes, 0, 0)
  return d
}

/** "YYYY-MM-DD" (input type=date) → Date locale à minuit. */
export function parseDateInput(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

/** Date → "YYYY-MM-DD" local (input type=date). */
export function toDateInput(value?: Timestamp | Date): string {
  return value ? format(toDate(value), 'yyyy-MM-dd') : ''
}

/** Date → "HH:mm" local (input type=time). */
export function toTimeInput(value?: Timestamp | Date): string {
  return value ? format(toDate(value), 'HH:mm') : ''
}

/** Date locale → "YYYY-MM-DD" sans passer par l'UTC (ids d'entraînement). */
export function localIsoDay(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
