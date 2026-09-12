import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { listEvents } from './events'
import { isEventEditable } from '../utils/dates'
import { tripAddressFromChild } from '../utils/address'
import type { Car, Child, Direction, Participant, TripAddress } from '../types'

const participantsCol = (eventId: string) =>
  collection(db, 'events', eventId, 'participants')
const carsCol = (eventId: string) => collection(db, 'events', eventId, 'cars')

/** Champ passagers correspondant à une direction. */
export const passengersKey = (d: Direction) =>
  d === 'aller' ? ('passengersAller' as const) : ('passengersRetour' as const)

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export function subscribeParticipants(
  eventId: string,
  onData: (p: Participant[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    participantsCol(eventId),
    (snap) => onData(snap.docs.map((d) => d.data() as Participant)),
    onError,
  )
}

export function subscribeCars(
  eventId: string,
  onData: (c: Car[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    carsCol(eventId),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Car)),
    onError,
  )
}

export interface BoardSnapshot {
  participants: Participant[]
  cars: Car[]
}

/** Lecture one-shot (planning, stats, dashboard). */
export async function getBoard(eventId: string): Promise<BoardSnapshot> {
  const [p, c] = await Promise.all([
    getDocs(participantsCol(eventId)),
    getDocs(carsCol(eventId)),
  ])
  return {
    participants: p.docs.map((d) => d.data() as Participant),
    cars: c.docs.map((d) => ({ id: d.id, ...d.data() }) as Car),
  }
}

// ---------------------------------------------------------------------------
// Résumé (dérivé, jamais stocké)
// ---------------------------------------------------------------------------

export interface DirectionSummary {
  present: number
  cars: number
  withoutCar: number
}

export function summarizeDirection(
  { participants, cars }: BoardSnapshot,
  direction: Direction,
): DirectionSummary {
  const key = passengersKey(direction)
  const activeCars = cars.filter((c) => c[direction])
  const seated = new Set(activeCars.flatMap((c) => c[key]))
  const present = participants.filter((p) => p[direction])
  return {
    present: present.length,
    cars: activeCars.length,
    withoutCar: present.filter((p) => !seated.has(p.childId)).length,
  }
}

// ---------------------------------------------------------------------------
// Écriture — participants (parent uniquement, règle 5)
// ---------------------------------------------------------------------------

export interface ParticipationInput {
  aller: TripAddress | null
  retour: TripAddress | null
}

/**
 * Inscrit / désinscrit un enfant. Décocher une direction le retire de la
 * voiture où il était pour cette direction (règle 9).
 */
export async function setParticipation(
  eventId: string,
  child: Child,
  uid: string,
  input: ParticipationInput,
  cars: Car[],
): Promise<void> {
  const batch = writeBatch(db)
  const ref = doc(participantsCol(eventId), child.id)

  if (!input.aller && !input.retour) {
    batch.delete(ref)
  } else {
    batch.set(ref, {
      childId: child.id,
      childName: child.firstName,
      aller: input.aller,
      retour: input.retour,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    })
  }

  for (const d of ['aller', 'retour'] as Direction[]) {
    if (input[d]) continue
    const key = passengersKey(d)
    for (const car of cars) {
      if (car[key].includes(child.id)) {
        batch.update(doc(carsCol(eventId), car.id), {
          [key]: car[key].filter((id) => id !== child.id),
          updatedAt: serverTimestamp(),
        })
      }
    }
  }
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Écriture — voitures (chauffeur uniquement, règle 4)
// ---------------------------------------------------------------------------

export interface DriverInfo {
  uid: string
  name: string
  children: Child[]
}

/**
 * Déclare « j'emmène » / « je ramène ». Les deux à false → voiture supprimée.
 * L'enfant du chauffeur est inscrit (adresse par défaut si absent) et placé
 * dans la voiture (règle 1).
 */
export async function setMyCar(
  eventId: string,
  driver: DriverInfo,
  aller: boolean,
  retour: boolean,
  existing: Car | undefined,
  participants: Participant[],
  otherCars: Car[] = [],
): Promise<void> {
  const carRef = doc(carsCol(eventId), driver.uid)
  if (!aller && !retour) {
    await deleteDoc(carRef)
    return
  }

  const childIds = driver.children.map((c) => c.id)
  const union = (list: string[]) => Array.from(new Set([...list, ...childIds]))
  const batch = writeBatch(db)

  batch.set(carRef, {
    driverUid: driver.uid,
    driverName: driver.name,
    driverChildIds: childIds,
    aller,
    retour,
    passengersAller: aller ? union(existing?.passengersAller ?? []) : [],
    passengersRetour: retour ? union(existing?.passengersRetour ?? []) : [],
    updatedAt: serverTimestamp(),
  })

  // Règle 1 + règle 3 : l'enfant du chauffeur est dans SA voiture, donc dans
  // aucune autre pour chaque direction activée.
  for (const d of ['aller', 'retour'] as Direction[]) {
    if (!(d === 'aller' ? aller : retour)) continue
    const key = passengersKey(d)
    for (const car of otherCars) {
      if (car.id === driver.uid) continue
      const next = car[key].filter((id) => !childIds.includes(id))
      if (next.length !== car[key].length) {
        batch.update(doc(carsCol(eventId), car.id), { [key]: next, updatedAt: serverTimestamp() })
      }
    }
  }

  for (const child of driver.children) {
    const cur = participants.find((p) => p.childId === child.id)
    const next: ParticipationInput = {
      aller: cur?.aller ?? (aller ? tripAddressFromChild(child, 'default') : null),
      retour: cur?.retour ?? (retour ? tripAddressFromChild(child, 'default') : null),
    }
    if (cur && cur.aller === next.aller && cur.retour === next.retour) continue
    batch.set(doc(participantsCol(eventId), child.id), {
      childId: child.id,
      childName: child.firstName,
      ...next,
      updatedBy: driver.uid,
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

/** Admin : retire une voiture (ses passagers redeviennent « sans voiture »). */
export async function removeCar(eventId: string, carId: string): Promise<void> {
  await deleteDoc(doc(carsCol(eventId), carId))
}

// ---------------------------------------------------------------------------
// Écriture — remplissage (tout le monde, règle 6)
// ---------------------------------------------------------------------------

/**
 * Place un enfant dans une voiture (carId) ou dans aucune (null) pour une
 * direction. Un enfant est dans au plus une voiture par direction (règle 3).
 */
export async function assignChild(
  eventId: string,
  childId: string,
  direction: Direction,
  carId: string | null,
  cars: Car[],
): Promise<void> {
  const key = passengersKey(direction)
  const batch = writeBatch(db)
  for (const car of cars) {
    const has = car[key].includes(childId)
    if (car.id === carId) {
      if (!has) batch.update(doc(carsCol(eventId), car.id), {
        [key]: [...car[key], childId],
        updatedAt: serverTimestamp(),
      })
    } else if (has) {
      if (car.driverChildIds.includes(childId) && car[direction]) {
        throw new Error("L'enfant du chauffeur reste dans sa voiture")
      }
      batch.update(doc(carsCol(eventId), car.id), {
        [key]: car[key].filter((id) => id !== childId),
        updatedAt: serverTimestamp(),
      })
    }
  }
  await batch.commit()
}

/**
 * « Tout prendre » : déplace dans cette voiture tous les enfants inscrits pour
 * la direction, sauf les enfants des autres chauffeurs actifs (règle 1).
 */
export async function takeAll(
  eventId: string,
  direction: Direction,
  carId: string,
  participants: Participant[],
  cars: Car[],
): Promise<void> {
  const key = passengersKey(direction)
  const locked = new Set(
    cars.filter((c) => c.id !== carId && c[direction]).flatMap((c) => c.driverChildIds),
  )
  const target = participants
    .filter((p) => p[direction] && !locked.has(p.childId))
    .map((p) => p.childId)

  const batch = writeBatch(db)
  for (const car of cars) {
    const next =
      car.id === carId
        ? Array.from(new Set([...car[key], ...target]))
        : car[key].filter((id) => !target.includes(id))
    if (next.length !== car[key].length) {
      batch.update(doc(carsCol(eventId), car.id), {
        [key]: next,
        updatedAt: serverTimestamp(),
      })
    }
  }
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Désactivation (admin) : nettoyage des événements à venir
// ---------------------------------------------------------------------------

/** Événements encore modifiables (à venir, programmés). */
async function upcomingEditableEvents() {
  return (await listEvents(new Date())).filter(isEventEditable)
}

/** Retire un enfant désactivé : inscription + présence dans les voitures, événements à venir. */
export async function purgeChildFromUpcomingEvents(childId: string): Promise<number> {
  const events = await upcomingEditableEvents()
  const results = await Promise.all(
    events.map(async (ev) => {
      const pRef = doc(participantsCol(ev.id), childId)
      const [pSnap, carsSnap] = await Promise.all([getDoc(pRef), getDocs(carsCol(ev.id))])
      const batch = writeBatch(db)
      let dirty = false
      if (pSnap.exists()) {
        batch.delete(pRef)
        dirty = true
      }
      for (const d of carsSnap.docs) {
        const car = d.data() as Car
        const pa = car.passengersAller.filter((id) => id !== childId)
        const pr = car.passengersRetour.filter((id) => id !== childId)
        if (pa.length !== car.passengersAller.length || pr.length !== car.passengersRetour.length) {
          batch.update(d.ref, { passengersAller: pa, passengersRetour: pr, updatedAt: serverTimestamp() })
          dirty = true
        }
      }
      if (dirty) await batch.commit()
      return dirty ? 1 : 0
    }),
  )
  return results.reduce((a, b) => a + b, 0)
}

/** Retire la voiture d'un parent désactivé des événements à venir. */
export async function purgeDriverFromUpcomingEvents(uid: string): Promise<number> {
  const events = await upcomingEditableEvents()
  const results = await Promise.all(
    events.map(async (ev) => {
      const ref = doc(carsCol(ev.id), uid)
      if (!(await getDoc(ref)).exists()) return 0
      await deleteDoc(ref)
      return 1
    }),
  )
  return results.reduce((a, b) => a + b, 0)
}
