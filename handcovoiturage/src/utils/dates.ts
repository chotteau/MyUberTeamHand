import { format, formatRelative, isAfter } from 'date-fns'
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

/** Ex: "demain à 17:15" */
export function formatRelativeDate(value: Timestamp | Date): string {
  return formatRelative(toDate(value), new Date(), { locale: fr })
}

/**
 * Un événement est modifiable tant que son heure de départ n'est pas dépassée.
 * Règle métier critique : aucune modification après l'heure H.
 */
export function isEventEditable(event: Pick<Event, 'departureTime' | 'status'>): boolean {
  if (event.status === 'cancelled' || event.status === 'completed') return false
  return isAfter(toDate(event.departureTime), new Date())
}

/**
 * Combine une date (jour) et une heure "HH:mm" en un objet Date.
 */
export function combineDateAndTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(hours, minutes, 0, 0)
  return d
}
