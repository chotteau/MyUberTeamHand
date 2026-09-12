import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { addDays, startOfDay } from 'date-fns'
import { db } from './firebase'
import { combineDateAndTime, localIsoDay, toDate } from '../utils/dates'
import type { AppConfig, Event, EventStatus } from '../types'

const eventsCol = () => collection(db, 'events')

export async function getEvent(id: string): Promise<Event | null> {
  const snap = await getDoc(doc(db, 'events', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Event) : null
}

/** Événements entre deux dates (bornes incluses, triés par date). */
export async function listEvents(from: Date, to?: Date): Promise<Event[]> {
  const constraints = [
    where('date', '>=', Timestamp.fromDate(startOfDay(from))),
    ...(to ? [where('date', '<=', Timestamp.fromDate(to))] : []),
    orderBy('date', 'asc'),
  ]
  const snap = await getDocs(query(eventsCol(), ...constraints))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Event)
}

export async function createEvent(
  data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(eventsCol(), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateEvent(id: string, patch: Partial<Event>): Promise<void> {
  await updateDoc(doc(db, 'events', id), { ...patch, updatedAt: serverTimestamp() })
}

export async function setEventStatus(id: string, status: EventStatus): Promise<void> {
  await updateEvent(id, { status })
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'events', id))
}

// ---------------------------------------------------------------------------
// Génération des entraînements sur toute la saison
// ---------------------------------------------------------------------------

export interface GenerationResult {
  created: number
  skippedExisting: number
}

/**
 * Id déterministe → idempotent : « Regénérer » ne crée jamais de doublon
 * et ne touche pas aux entraînements déjà modifiés individuellement.
 */
function trainingId(day: Date, dayIndex: number): string {
  return `training_day${dayIndex}_${localIsoDay(day)}`
}

export async function generateTrainings(config: AppConfig): Promise<GenerationResult> {
  const result: GenerationResult = { created: 0, skippedExisting: 0 }
  const start = startOfDay(toDate(config.seasonStart))
  const end = startOfDay(toDate(config.seasonEnd))

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    for (let idx = 0; idx < config.trainingDays.length; idx++) {
      const day = config.trainingDays[idx]
      if (day.dayOfWeek !== cursor.getDay()) continue

      const ref = doc(db, 'events', trainingId(cursor, idx))
      if ((await getDoc(ref)).exists()) {
        result.skippedExisting++
        continue
      }
      await setDoc(ref, {
        type: 'training',
        title: `Entraînement ${day.label}`,
        date: Timestamp.fromDate(cursor),
        departureTime: Timestamp.fromDate(combineDateAndTime(cursor, day.departureTime)),
        returnTime: Timestamp.fromDate(combineDateAndTime(cursor, day.returnTime)),
        location: day.location,
        status: 'scheduled',
        source: 'generated',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      result.created++
    }
  }
  return result
}
