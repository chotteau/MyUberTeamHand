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
import { DIRECTIONS, type Car, type Child, type Direction, type Participant, type TripAddress } from '../types'

const participantsCol = (eventId: string) =>
  collection(db, 'events', eventId, 'participants')
const carsCol = (eventId: string) => collection(db, 'events', eventId, 'cars')

/** Places par défaut des voitures antérieures au 13/09/2026 (champ `seats` absent). */
export const DEFAULT_SEATS = 4
export const MIN_SEATS = 2
export const MAX_SEATS = 6
/** Choix proposés dans les sélecteurs de places. */
export const SEAT_CHOICES = Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i)

/** Places disponibles (enfants, hors chauffeur) d'une voiture. */
export const seatsOf = (c: Car): number => c.seats ?? DEFAULT_SEATS

/** Champ lieu de rendez-vous correspondant à une direction. */
export const meetKey = (d: Direction) => (d === 'aller' ? ('meetAller' as const) : ('meetRetour' as const))

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

/** Voitures d'un événement, lecture one-shot (stats, purges). */
export async function getCars(eventId: string): Promise<Car[]> {
  const c = await getDocs(carsCol(eventId))
  return c.docs.map((d) => ({ id: d.id, ...d.data() }) as Car)
}

/** Lecture one-shot (planning, dashboard). */
export async function getBoard(eventId: string): Promise<BoardSnapshot> {
  const [p, cars] = await Promise.all([getDocs(participantsCol(eventId)), getCars(eventId)])
  return { participants: p.docs.map((d) => d.data() as Participant), cars }
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
  /** Tous les véhicules actifs sont pleins et il reste des enfants sans voiture. */
  full: boolean
}

export function summarizeDirection(
  { participants, cars }: BoardSnapshot,
  direction: Direction,
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
    full: withoutCar > 0 && activeCars.length > 0 && activeCars.every((c) => c[key].length >= seatsOf(c)),
  }
}

// ---------------------------------------------------------------------------
// Plan de places : calcul en mémoire, écriture en une seule transaction
// ---------------------------------------------------------------------------

/** Copie de travail des listes de passagers, par voiture. */
class SeatingPlan {
  private seats = new Map<string, { passengersAller: string[]; passengersRetour: string[] }>()
  private readonly cars: Car[]
  private readonly ordered: Car[]

  constructor(cars: Car[]) {
    this.cars = cars
    this.ordered = orderCars(cars)
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
    return this.ordered.filter((c) => c[d] && c.id !== exclude)
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
   * ayant encore une place. Retourne l'id de la voiture, ou null (« sans voiture »).
   */
  autoSeat(childId: string, d: Direction, exclude?: string): string | null {
    this.unseat(childId, d)
    const target = this.activeCars(d, exclude).find((c) => this.list(c.id, d).length < seatsOf(c))
    if (!target) return null
    this.seats.get(target.id)![passengersKey(d)].push(childId)
    return target.id
  }

  /** Écrit uniquement les voitures dont les listes ont changé (`skip` : voiture écrite/supprimée à part). */
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
  /** Commentaire pour le calendrier (absent → conservé tel quel). */
  note?: string
}

/**
 * Inscrit / désinscrit un enfant.
 * - Direction nouvellement cochée → placement automatique (première voiture ayant une place).
 * - Direction décochée → retiré de sa voiture.
 */
export async function setParticipation(
  eventId: string,
  child: Child,
  uid: string,
  input: ParticipationInput,
  current: Participant | undefined,
  cars: Car[],
): Promise<void> {
  const batch = writeBatch(db)
  const ref = doc(participantsCol(eventId), child.id)
  const plan = new SeatingPlan(cars)

  if (!input.aller && !input.retour) {
    batch.delete(ref)
  } else {
    batch.set(ref, {
      childId: child.id,
      childName: child.firstName,
      aller: input.aller,
      retour: input.retour,
      note: (input.note ?? current?.note ?? '').trim(),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    })
  }

  for (const d of DIRECTIONS) {
    if (!input[d]) {
      plan.unseat(child.id, d)
    } else if (!current?.[d]) {
      // Direction nouvellement cochée uniquement : un enfant mis « sans voiture »
      // à la main n'est pas replacé quand on change son adresse ou sa note.
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

/** Ce que le chauffeur déclare pour sa voiture. */
export interface CarOptions {
  aller: boolean
  retour: boolean
  /** Places disponibles pour les enfants (hors chauffeur), MIN_SEATS..MAX_SEATS. */
  seats: number
  /** Lieu de rendez-vous imposé (null = chez chaque enfant). */
  meetAller: TripAddress | null
  meetRetour: TripAddress | null
  /** Commentaire pour le calendrier. */
  note: string
}

export const clampSeats = (n: number) =>
  Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(Number.isFinite(n) ? n : DEFAULT_SEATS)))

/** Options courantes d'une voiture (pour un formulaire). */
export function carOptionsOf(car: Car | undefined, defaultSeats: number): CarOptions {
  return {
    aller: car?.aller ?? false,
    retour: car?.retour ?? false,
    seats: car ? seatsOf(car) : clampSeats(defaultSeats),
    meetAller: car?.meetAller ?? null,
    meetRetour: car?.meetRetour ?? null,
    note: car?.note ?? '',
  }
}

/**
 * Déclare / met à jour « ma voiture ». Les deux directions à false → voiture supprimée.
 * - Direction nouvellement activée : l'enfant du chauffeur est inscrit (adresse
 *   par défaut si absent) et placé dans sa voiture, sauf s'il est déjà dans une
 *   autre et que `keep[d]` est vrai.
 * - Direction désactivée : ses passagers sont rebasculés dans les autres
 *   voitures ayant de la place, le reste passe « sans voiture ».
 * - Dans tous les cas, les enfants inscrits sans voiture montent tant qu'il
 *   reste des places (ordre d'inscription) — donc aussi quand on augmente `seats`.
 * - Changer le lieu de RDV, la note ou les places ne déplace personne d'autre.
 */
export async function setMyCar(
  eventId: string,
  driver: DriverInfo,
  options: CarOptions,
  existing: Car | undefined,
  participants: Participant[],
  allCars: Car[],
  keep: KeepElsewhere = {},
): Promise<void> {
  const { aller, retour } = options
  const seats = clampSeats(options.seats)
  const carRef = doc(carsCol(eventId), driver.uid)
  const childIds = driver.children.map((c) => c.id)
  const batch = writeBatch(db)
  const others = allCars.filter((c) => c.id !== driver.uid)

  // Voiture retirée : rebasculer ses passagers dans les autres voitures.
  if (!aller && !retour) {
    const plan = new SeatingPlan(allCars)
    for (const d of DIRECTIONS) {
      if (!existing?.[d]) continue
      for (const id of existing[passengersKey(d)]) plan.autoSeat(id, d, driver.uid)
    }
    batch.delete(carRef)
    plan.apply(batch, eventId, driver.uid)
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
  const fullPlan = new SeatingPlan([...others, { ...mine, aller, retour, seats }])
  const justOn: Record<Direction, boolean> = {
    aller: aller && !(existing?.aller ?? false),
    retour: retour && !(existing?.retour ?? false),
  }
  const grew = existing ? seats > seatsOf(existing) : true
  for (const d of DIRECTIONS) {
    const active = d === 'aller' ? aller : retour
    const wasActive = existing?.[d] ?? false
    if (justOn[d]) {
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
    } else if (!active && wasActive) {
      // Direction désactivée : ses passagers sont rebasculés (autoSeat les retire d'abord de ma voiture).
      for (const id of existing?.[passengersKey(d)] ?? []) fullPlan.autoSeat(id, d, driver.uid)
    }
  }

  // Enfants déjà inscrits et sans voiture : ils montent dans les voitures ayant
  // de la place (ordre de déclaration), par ordre d'inscription — seulement
  // quand une direction vient d'être activée ou que les places ont augmenté
  // (changer le lieu de RDV ou la note ne déplace personne).
  const byRegistration = [...participants].sort(
    (a, b) => (a.updatedAt ? toDate(a.updatedAt).getTime() : 0) - (b.updatedAt ? toDate(b.updatedAt).getTime() : 0),
  )
  for (const d of DIRECTIONS) {
    if (!(d === 'aller' ? aller : retour)) continue
    if (!justOn[d] && !grew) continue
    for (const p of byRegistration) {
      if (p[d] && !fullPlan.isSeated(p.childId, d)) fullPlan.autoSeat(p.childId, d)
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
    seats,
    meetAller: aller ? options.meetAller : null,
    meetRetour: retour ? options.meetRetour : null,
    note: options.note.trim(),
    createdAt: existing?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  fullPlan.apply(batch, eventId, driver.uid)

  // Inscription des enfants du chauffeur (adresse par défaut) pour les directions
  // qui viennent d'être activées — jamais pour une direction déjà active, sinon
  // un enfant désinscrit par l'autre parent serait réinscrit à chaque réglage.
  for (const child of driver.children) {
    const cur = participants.find((p) => p.childId === child.id)
    const next: ParticipationInput = {
      aller: cur?.aller ?? (justOn.aller ? tripAddressFromChild(child, 'default') : null),
      retour: cur?.retour ?? (justOn.retour ? tripAddressFromChild(child, 'default') : null),
    }
    if (!next.aller && !next.retour) continue
    if (cur && cur.aller === next.aller && cur.retour === next.retour) continue
    batch.set(doc(participantsCol(eventId), child.id), {
      childId: child.id,
      childName: child.firstName,
      ...next,
      note: cur?.note ?? '',
      updatedBy: driver.uid,
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
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

/**
 * Admin : retire une voiture pour UNE direction (colonne). Ses passagers sont
 * rebasculés si possible ; si l'autre direction n'est plus active non plus,
 * la voiture est supprimée.
 */
export async function removeCarDirection(
  eventId: string,
  carId: string,
  d: Direction,
  cars: Car[],
): Promise<void> {
  const car = cars.find((c) => c.id === carId)
  if (!car) return
  const other: Direction = d === 'aller' ? 'retour' : 'aller'
  if (!car[other]) return removeCar(eventId, carId, cars)

  const plan = new SeatingPlan(cars)
  for (const id of car[passengersKey(d)]) plan.autoSeat(id, d, carId)
  const batch = writeBatch(db)
  plan.apply(batch, eventId, carId)
  batch.update(doc(carsCol(eventId), carId), {
    [d]: false,
    [passengersKey(d)]: [],
    [meetKey(d)]: null,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

/** Admin : retire une voiture (aller et retour) ; ses passagers sont rebasculés si possible. */
export async function removeCar(
  eventId: string,
  carId: string,
  cars: Car[],
): Promise<void> {
  const car = cars.find((c) => c.id === carId)
  const batch = writeBatch(db)
  if (car) {
    const plan = new SeatingPlan(cars)
    for (const d of DIRECTIONS) {
      if (!car[d]) continue
      for (const id of car[passengersKey(d)]) plan.autoSeat(id, d, carId)
    }
    plan.apply(batch, eventId, carId)
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
 * Pas de limite : un +1 forcé à la main est accepté (la case passe au rouge).
 */
export async function assignChild(
  eventId: string,
  childId: string,
  direction: Direction,
  carId: string | null,
  cars: Car[],
): Promise<void> {
  const plan = new SeatingPlan(cars)
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
  const plan = new SeatingPlan(cars)
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
      const [pSnap, cars] = await Promise.all([getDoc(pRef), getCars(ev.id)])
      const seated = cars.some(
        (c) => c.passengersAller.includes(childId) || c.passengersRetour.includes(childId),
      )
      if (!pSnap.exists() && !seated) return 0
      const plan = new SeatingPlan(cars)
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
      const cars = await getCars(ev.id)
      if (!cars.some((c) => c.id === uid)) return 0
      await removeCar(ev.id, uid, cars)
      return 1
    }),
  )
  return results.reduce<number>((a, b) => a + b, 0)
}
