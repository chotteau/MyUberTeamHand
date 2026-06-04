import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Offer,
  Passenger,
  Ride,
  RideDirection,
} from '../types'

const ridesCol = () => collection(db, 'rides')

/** Places libres restantes d'un trajet (capacité - passagers déjà à bord). */
export function computeFreeSeats(
  capacity: number,
  ride: Pick<Ride, 'passengers'> | null,
): number {
  const occupied = ride ? ride.passengers.length : 1 // enfant du chauffeur
  return Math.max(0, capacity - occupied)
}

/** Liste (one-shot) les trajets d'un événement. */
export async function listRidesForEvent(eventId: string): Promise<Ride[]> {
  const q = query(ridesCol(), where('eventId', '==', eventId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Ride)
}

/**
 * Écoute en temps réel les trajets d'un événement (planning collaboratif).
 * Pense à appeler la fonction de désinscription retournée dans le cleanup
 * du useEffect.
 */
export function subscribeRidesForEvent(
  eventId: string,
  cb: (rides: Ride[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(ridesCol(), where('eventId', '==', eventId))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Ride)),
    (err) => onError?.(err),
  )
}

/** Identifiant déterministe d'un trajet : 1 trajet par offre et direction. */
function rideId(offerId: string, direction: RideDirection): string {
  return `${offerId}_${direction}`
}

/** Récupère le trajet associé à une offre/direction, s'il existe. */
export async function getRide(
  offerId: string,
  direction: RideDirection,
): Promise<Ride | null> {
  const snap = await getDoc(doc(db, 'rides', rideId(offerId, direction)))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Ride) : null
}

/**
 * Affecte un enfant à une voiture (offre) pour une direction donnée.
 * - Crée le trajet à la volée s'il n'existe pas, en y ajoutant d'abord
 *   l'enfant du chauffeur (règle 1).
 * - Refuse si la voiture est pleine (règle 2).
 * - Transactionnel : sûr face aux attributions concurrentes (règle 7).
 */
export async function assignChildToRide(input: {
  eventId: string
  offer: Offer
  direction: RideDirection
  /** Adresse de départ du chauffeur (snapshot pour son enfant). */
  driverPickupAddress: string
  /** Passager à embarquer (enfant + besoin + adresse de prise en charge). */
  passenger: Passenger
}): Promise<string> {
  const { eventId, offer, direction, driverPickupAddress, passenger } = input
  const id = rideId(offer.id, direction)
  const ref = doc(db, 'rides', id)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)

    if (!snap.exists()) {
      // Création : l'enfant du chauffeur embarque automatiquement.
      const driverPassenger: Passenger = {
        childId: offer.childId,
        needId: '',
        pickupAddress: driverPickupAddress,
        confirmedAt: Timestamp.now(),
      }
      const passengers: Passenger[] = [driverPassenger]
      if (passenger.childId !== offer.childId) {
        if (offer.vehicleCapacity - passengers.length <= 0) {
          throw new Error('La voiture est complète.')
        }
        passengers.push({ ...passenger, confirmedAt: Timestamp.now() })
      }
      tx.set(ref, {
        eventId,
        offerId: offer.id,
        driverUid: offer.driverUid,
        direction,
        passengers,
        status: 'confirmed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return
    }

    const ride = snap.data() as Ride
    if (ride.passengers.some((p) => p.childId === passenger.childId)) {
      return // déjà à bord, idempotent
    }
    if (offer.vehicleCapacity - ride.passengers.length <= 0) {
      throw new Error('La voiture est complète.')
    }
    tx.update(ref, {
      passengers: [
        ...ride.passengers,
        { ...passenger, confirmedAt: Timestamp.now() },
      ],
      updatedAt: serverTimestamp(),
    })
  })

  return id
}

/**
 * Retire un enfant d'un trajet. Si seul l'enfant du chauffeur reste,
 * le trajet est marqué annulé (le chauffeur peut retirer son offre).
 */
export async function removeChildFromRide(
  offerId: string,
  direction: RideDirection,
  childId: string,
): Promise<void> {
  const id = rideId(offerId, direction)
  const ref = doc(db, 'rides', id)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) return
    const ride = snap.data() as Ride
    const passengers = ride.passengers.filter((p) => p.childId !== childId)
    tx.update(ref, {
      passengers,
      updatedAt: serverTimestamp(),
    })
  })
}
