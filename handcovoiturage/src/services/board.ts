import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { listEvents } from './events'
import { isEventEditable, toDate } from '../utils/dates'
import { tripAddressFromChild } from '../utils/address'
import type { Car, Child, Direction, Participant, TripAddress } from '../types'

const participantsCol = (eventId: string) =>
  collection(db, 'events', eventId, 'participants')
const carsCol = (eventId: string) => collection(db, 'events', eventId, 'cars')

export const DEFAULT_THRESHOLD = 5

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
// Ordre et places (dérivés, jamais stockés)
// ---------------------------------------------------------------------------

/** Voitures dans l'ordre de déclaration (les anciennes sans createdAt en dernier). */
export function orderCars(cars: Car[]): Car[] {
  const ms = (c: Car) => (c.createdAt ? toDate(c.createdAt).getTime() : Number.MAX_SAFE_INTEGER)
  return [...cars].sort((a, b) => ms(a) - ms(b) || a.driverName.localeCompare(b.driverName))
}

/** Voiture (id) où se trouve un enfant pour une direction, ou null. */
export function carOf(cars: Car[], childId: string, d: Direction): string | null {
  return cars.find((c) => c[d] && c[passengersKey(d)].includes(childId))?.id ?? null
}

export interface DirectionSummary {
  present: number
  cars: number
  withoutCar: number
  /** Tous les véhicules actifs ont atteint le seuil et il reste des enfants sans voiture. */
  full: boolean
}

export function summarizeDirection(
  { participants, cars }: BoardSnapshot,
  direction: Direction,
  threshold = DEFAULT_THRESHOLD,
): DirectionSummary {
  const key = passengersKey(direction)
  const activeCars = cars.filter((c) => c[direction])
  const seated = new Set(activeCars.flatMap((c) => c[key]))
  const present = participants.filter((p) => p[direction])
  const withoutCar = present.filter((p) => !seated.has(p.childId)).length
  return {
    present: present.length,
    cars: activeCars.length,
    withoutCar,
    full: withoutCar > 0 && activeCars.length > 0 && activeCars.every((c) => c[key].length >= threshold),
  }
}

// ---------------------------------------------------------------------------
// Plan de places : calcul en mémoire, écriture en une seule transaction
// ---------------------------------------------------------------------------

/** Copie de travail des listes de passagers, par voiture. */
class SeatingPlan {
  private seats = new Map<string, { passengersAller: string[]; passengersRetour: string[] }>()
  private readonly cars: Car[]
  private readonly threshold: number

  constructor(cars: Car[], threshold: number) {
    this.cars = cars
    this.threshold = threshold
    for (const c of cars) {
      this.seats.set(c.id, {
        passengersAller: [...c.passengersAller],
        passengersRetour: [...c.passengersRetour],
      })
    }
  }

  list(carId: string, d: Direction): string[] {
    return this.seats.get(carId)?.[passengersKey(d)] ?? []
  }

  /** Voitures actives pour la direction, dans l'ordre de déclaration. */
  activeCars(d: Direction, exclude?: string): Car[] {
    return orderCars(this.cars).filter((c) => c[d] && c.id !== exclude)
  }

  /** Retire un enfant de toutes les voitures pour une direction. */
  unseat(childId: string, d: Direction): void {
    for (const s of this.seats.values()) {
      const k = passengersKey(d)
      s[k] = s[k].filter((id) => id !== childId)
    }
  }

  /** Place un enfant dans une voiture précise (et nulle part ailleurs). */
  seat(childId: string, d: Direction, carId: string): void {
    this.unseat(childId, d)
    const s = this.seats.get(carId)
    if (s) s[passengersKey(d)].push(childId)
  }

  isSeated(childId: string, d: Direction): string | null {
    for (const [id, s] of this.seats) if (s[passengersKey(d)].includes(childId)) return id
    return null
  }

  /**
   * Placement automatique : première voiture active (ordre de déclaration)
   * sous le seuil. Retourne l'id de la voiture, ou null (« sans voiture »).
   */
  autoSeat(childId: string, d: Direction, exclude?: string): string | null {
    this.unseat(childId, d)
    const target = this.activeCars(d, exclude).find((c) => this.list(c.id, d).length < this.threshold)
    if (!target) return null
    this.seats.get(target.id)![passengersKey(d)].push(childId)
    return target.id
  }

  /** Écrit uniquement les voitures dont les listes ont changé. */
  apply(batch: WriteBatch, eventId: string, skip?: string): void {
    for (const c of this.cars) {
      if (c.id === skip) continue
      const s = this.seats.get(c.id)!
      const same =
        s.passengersAller.join() === c.passengersAller.join() &&
        s.passengersRetour.join() === c.passengersRetour.join()
      if (!same) {
        batch.update(doc(carsCol(eventId), c.id), { ...s, updatedAt: serverTimestamp() })
      }
    }
  }

  /** Listes finales d'une voiture (pour l'écrire soi-même via set). */
  finalOf(carId: string) {
    return this.seats.get(carId) ?? { passengersAller: [], passengersRetour: [] }
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
 * Inscrit / désinscrit un enfant.
 * - Direction nouvellement cochée → placement automatique (première voiture sous le seuil).
 * - Direction décochée → retiré de sa voiture.
 */
export async function setParticipation(
  eventId: string,
  child: Child,
  uid: string,
  input: ParticipationInput,
  current: Participant | undefined,
  cars: Car[],
  threshold = DEFAULT_THRESHOLD,
): Promise<void> {
  const batch = writeBatch(db)
  const ref = doc(participantsCol(eventId), child.id)
  const plan = new SeatingPlan(cars, threshold)

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
    if (!input[d]) {
      plan.unseat(child.id, d)
    } else if (!current?.[d] || !plan.isSeated(child.id, d)) {
      plan.autoSeat(child.id, d)
    }
  }
  plan.apply(batch, eventId)
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

/** Par direction : l'enfant du chauffeur reste / va dans une autre voiture (pas la sienne) ? */
export type KeepElsewhere = Partial<Record<Direction, boolean>>

/**
 * Déclare « j'emmène » / « je ramène ». Les deux à false → voiture supprimée.
 * - Direction activée : l'enfant du chauffeur est inscrit (adresse par défaut si
 *   absent) et placé dans sa voiture, sauf s'il est déjà dans une autre et que
 *   `keep[d]` est vrai.
 * - Direction désactivée : ses passagers sont rebasculés dans les autres
 *   voitures ayant de la place, le reste passe « sans voiture ».
 */
export async function setMyCar(
  eventId: string,
  driver: DriverInfo,
  aller: boolean,
  retour: boolean,
  existing: Car | undefined,
  participants: Participant[],
  allCars: Car[],
  threshold = DEFAULT_THRESHOLD,
  keep: KeepElsewhere = {},
): Promise<void> {
  const carRef = doc(carsCol(eventId), driver.uid)
  const childIds = driver.children.map((c) => c.id)
  const batch = writeBatch(db)
  const others = allCars.filter((c) => c.id !== driver.uid)

  // Voiture retirée : rebasculer ses passagers dans les autres voitures.
  if (!aller && !retour) {
    const plan = new SeatingPlan(allCars, threshold)
    for (const d of ['aller', 'retour'] as Direction[]) {
      if (!existing?.[d]) continue
      for (const id of existing[passengersKey(d)]) plan.autoSeat(id, d, driver.uid)
    }
    batch.delete(carRef)
    new SeatingPlanView(plan, others).apply(batch, eventId)
    await batch.commit()
    return
  }

  // Le plan doit connaître la voiture du chauffeur même si elle n'existe pas encore.
  const mine: Car = existing ?? {
    id: driver.uid,
    driverUid: driver.uid,
    driverName: driver.name,
    driverChildIds: childIds,
    aller,
    retour,
    passengersAller: [],
    passengersRetour: [],
    updatedAt: undefined as unknown as Car['updatedAt'],
  }
  const fullPlan = new SeatingPlan(
    [...others, { ...mine, aller, retour }],
    threshold,
  )
  // Repartir de l'état courant des autres voitures.
  for (const d of ['aller', 'retour'] as Direction[]) {
    const active = d === 'aller' ? aller : retour
    const wasActive = existing?.[d] ?? false
    if (active) {
      for (const cid of childIds) {
        const where = fullPlan.isSeated(cid, d)
        if (keep[d]) {
          // Le parent laisse son enfant dans une autre voiture : déjà placé → rien ;
          // sinon placement automatique hors de sa propre voiture.
          if (!where || where === driver.uid) {
            // Pas de place ailleurs → il monte quand même avec son parent.
            if (fullPlan.autoSeat(cid, d, driver.uid) === null) fullPlan.seat(cid, d, driver.uid)
          }
          continue
        }
        fullPlan.seat(cid, d, driver.uid)
      }
    } else if (wasActive) {
      for (const id of existing?.[passengersKey(d)] ?? []) fullPlan.autoSeat(id, d, driver.uid)
      // La direction est désactivée : la liste de ma voiture est vidée.
      for (const id of fullPlan.list(driver.uid, d)) fullPlan.unseat(id, d)
    }
  }

  const finalMine = fullPlan.finalOf(driver.uid)
  batch.set(carRef, {
    driverUid: driver.uid,
    driverName: driver.name,
    driverChildIds: childIds,
    aller,
    retour,
    passengersAller: aller ? finalMine.passengersAller : [],
    passengersRetour: retour ? finalMine.passengersRetour : [],
    createdAt: existing?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  fullPlan.apply(batch, eventId, driver.uid)

  // Inscription des enfants du chauffeur (adresse par défaut) pour les directions activées.
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

/** Vue d'un plan restreinte à un sous-ensemble de voitures (pour l'écriture). */
class SeatingPlanView {
  private readonly plan: SeatingPlan
  private readonly cars: Car[]
  constructor(plan: SeatingPlan, cars: Car[]) {
    this.plan = plan
    this.cars = cars
  }
  apply(batch: WriteBatch, eventId: string) {
    for (const c of this.cars) {
      const s = this.plan.finalOf(c.id)
      const same =
        s.passengersAller.join() === c.passengersAller.join() &&
        s.passengersRetour.join() === c.passengersRetour.join()
      if (!same) batch.update(doc(carsCol(eventId), c.id), { ...s, updatedAt: serverTimestamp() })
    }
  }
}

/** Autres voitures actives pour une direction, avec leur nombre d'enfants. */
export function otherActiveCars(cars: Car[], driverUid: string, d: Direction): Car[] {
  return orderCars(cars).filter((c) => c.id !== driverUid && c[d])
}

/** Où sont déjà placés les enfants d'un chauffeur (hors sa voiture), par direction. */
export function childrenSeatedElsewhere(
  cars: Car[],
  driverUid: string,
  childIds: string[],
  d: Direction,
): { childId: string; driverName: string }[] {
  const out: { childId: string; driverName: string }[] = []
  for (const cid of childIds) {
    const where = cars.find((c) => c.id !== driverUid && c[d] && c[passengersKey(d)].includes(cid))
    if (where) out.push({ childId: cid, driverName: where.driverName })
  }
  return out
}

/** Admin : retire une voiture ; ses passagers sont rebasculés si possible. */
export async function removeCar(
  eventId: string,
  carId: string,
  cars: Car[],
  threshold = DEFAULT_THRESHOLD,
): Promise<void> {
  const car = cars.find((c) => c.id === carId)
  const batch = writeBatch(db)
  if (car) {
    const plan = new SeatingPlan(cars, threshold)
    for (const d of ['aller', 'retour'] as Direction[]) {
      if (!car[d]) continue
      for (const id of car[passengersKey(d)]) plan.autoSeat(id, d, carId)
    }
    new SeatingPlanView(plan, cars.filter((c) => c.id !== carId)).apply(batch, eventId)
  }
  batch.delete(doc(carsCol(eventId), carId))
  await batch.commit()
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
  const plan = new SeatingPlan(cars, Number.MAX_SAFE_INTEGER)
  if (carId) plan.seat(childId, direction, carId)
  else plan.unseat(childId, direction)
  const batch = writeBatch(db)
  plan.apply(batch, eventId)
  await batch.commit()
}

/**
 * « Tout prendre » : déplace dans cette voiture tous les enfants inscrits pour
 * la direction (pas de limite : c'est un choix explicite du chauffeur).
 */
export async function takeAll(
  eventId: string,
  direction: Direction,
  carId: string,
  participants: Participant[],
  cars: Car[],
): Promise<void> {
  const plan = new SeatingPlan(cars, Number.MAX_SAFE_INTEGER)
  for (const p of participants) if (p[direction]) plan.seat(p.childId, direction, carId)
  const batch = writeBatch(db)
  plan.apply(batch, eventId)
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Désactivation (admin) : nettoyage des événements à venir
// ---------------------------------------------------------------------------

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
      const cars = carsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Car)
      const seated = cars.some(
        (c) => c.passengersAller.includes(childId) || c.passengersRetour.includes(childId),
      )
      if (!pSnap.exists() && !seated) return 0
      const plan = new SeatingPlan(cars, Number.MAX_SAFE_INTEGER)
      plan.unseat(childId, 'aller')
      plan.unseat(childId, 'retour')
      const batch = writeBatch(db)
      if (pSnap.exists()) batch.delete(pRef)
      plan.apply(batch, ev.id)
      await batch.commit()
      return 1
    }),
  )
  return results.reduce<number>((a, b) => a + b, 0)
}

/** Retire la voiture d'un parent désactivé des événements à venir (passagers rebasculés). */
export async function purgeDriverFromUpcomingEvents(uid: string): Promise<number> {
  const events = await upcomingEditableEvents()
  const results = await Promise.all(
    events.map(async (ev) => {
      const carsSnap = await getDocs(carsCol(ev.id))
      const cars = carsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Car)
      if (!cars.some((c) => c.id === uid)) return 0
      await removeCar(ev.id, uid, cars)
      return 1
    }),
  )
  return results.reduce<number>((a, b) => a + b, 0)
}
