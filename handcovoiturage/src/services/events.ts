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
import { combineDateAndTime, toDate } from '../utils/dates'
import type { AppConfig, Event, EventStatus, TrainingDay } from '../types'

const eventsCol = () => collection(db, 'events')

/** Récupère un événement par id. */
export async function getEvent(id: string): Promise<Event | null> {
  const snap = await getDoc(doc(db, 'events', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Event) : null
}

/** Liste les événements à partir d'une date (triés par date). */
export async function listEvents(fromDate: Date = new Date()): Promise<Event[]> {
  const q = query(
    eventsCol(),
    where('date', '>=', Timestamp.fromDate(startOfDay(fromDate))),
    orderBy('date', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Event)
}

/** Crée un événement manuel. */
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

/** Met à jour un événement. */
export async function updateEvent(
  id: string,
  patch: Partial<Event>,
): Promise<void> {
  await updateDoc(doc(db, 'events', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

/** Change le statut d'un événement (annulation, vacances, etc.). */
export async function setEventStatus(
  id: string,
  status: EventStatus,
): Promise<void> {
  await updateEvent(id, { status })
}

/** Supprime un événement. */
export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'events', id))
}

// ---------------------------------------------------------------------------
// Génération automatique des entraînements sur toute la saison
// ---------------------------------------------------------------------------

/**
 * Identifiant déterministe d'un entraînement : date ISO + index du jour.
 * Permet l'idempotence : un setDoc sur le même id ne recrée pas l'event.
 */
function trainingId(date: Date, dayIndex: number): string {
  const iso = date.toISOString().slice(0, 10) // YYYY-MM-DD
  return `training_day${dayIndex}_${iso}`
}

export interface GenerationResult {
  created: number
  skippedExisting: number
}

/**
 * Génère les entraînements sur toute la saison (de seasonStart à seasonEnd)
 * selon config.trainingDays (exactement 2 jours configurables).
 *
 * Pas de logique de vacances scolaires : chaque entraînement est créé avec
 * status 'scheduled'. L'admin gère manuellement les exceptions (annulé /
 * vacances / déplacement de date) event par event.
 *
 * Idempotent : appeler plusieurs fois ne crée pas de doublons.
 */
export async function generateTrainings(
  config: AppConfig,
): Promise<GenerationResult> {
  const result: GenerationResult = { created: 0, skippedExisting: 0 }

  const start = startOfDay(toDate(config.seasonStart))
  const end = startOfDay(toDate(config.seasonEnd))

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor = addDays(cursor, 1)
  ) {
    const weekday = cursor.getDay()

    config.trainingDays.forEach((day: TrainingDay, idx: number) => {
      if (day.dayOfWeek !== weekday) return

      // Vérification async gérée séquentiellement ci-dessous
      void (async () => {
        const id = trainingId(cursor, idx)
        const existing = await getDoc(doc(db, 'events', id))
        if (existing.exists()) {
          result.skippedExisting++
          return
        }

        const departure = combineDateAndTime(cursor, day.departureTime)
        const ret = combineDateAndTime(cursor, day.returnTime)

        await setDoc(doc(db, 'events', id), {
          type: 'training',
          title: `Entraînement ${day.label}`,
          date: Timestamp.fromDate(startOfDay(new Date(cursor))),
          departureTime: Timestamp.fromDate(departure),
          returnTime: Timestamp.fromDate(ret),
          location: day.location,
          status: 'scheduled',
          source: 'generated',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        result.created++
      })()
    })
  }

  return result
}

/**
 * Version séquentielle (await) de generateTrainings — préférée pour la
 * cohérence des compteurs et éviter les race conditions.
 */
export async function generateTrainingsSeq(
  config: AppConfig,
): Promise<GenerationResult> {
  const result: GenerationResult = { created: 0, skippedExisting: 0 }

  const start = startOfDay(toDate(config.seasonStart))
  const end = startOfDay(toDate(config.seasonEnd))

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor = addDays(cursor, 1)
  ) {
    const weekday = cursor.getDay()

    for (let idx = 0; idx < config.trainingDays.length; idx++) {
      const day = config.trainingDays[idx]
      if (day.dayOfWeek !== weekday) continue

      const id = trainingId(cursor, idx)
      const existing = await getDoc(doc(db, 'events', id))
      if (existing.exists()) {
        result.skippedExisting++
        continue
      }

      const departure = combineDateAndTime(cursor, day.departureTime)
      const ret = combineDateAndTime(cursor, day.returnTime)

      await setDoc(doc(db, 'events', id), {
        type: 'training',
        title: `Entraînement ${day.label}`,
        date: Timestamp.fromDate(startOfDay(new Date(cursor))),
        departureTime: Timestamp.fromDate(departure),
        returnTime: Timestamp.fromDate(ret),
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
