import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { directionOverlaps } from './needs'
import type { Direction, Offer, OfferStatus } from '../types'

const offersCol = () => collection(db, 'offers')

/** Liste (one-shot) les offres d'un événement. */
export async function listOffersForEvent(eventId: string): Promise<Offer[]> {
  const q = query(offersCol(), where('eventId', '==', eventId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Offer)
}

/** Écoute en temps réel les offres d'un événement. */
export function subscribeOffersForEvent(
  eventId: string,
  cb: (offers: Offer[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(offersCol(), where('eventId', '==', eventId))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Offer)),
    (err) => onError?.(err),
  )
}

/**
 * Crée une offre de transport (un chauffeur propose sa voiture).
 * Règle 6 : un driver = 1 offre par direction par événement.
 * Règle 2 : places disponibles = capacité - 1 (l'enfant du chauffeur
 * occupe une place — comptabilisé dynamiquement côté ride).
 */
export async function createOffer(input: {
  eventId: string
  driverUid: string
  childId: string
  direction: Direction
  vehicleCapacity: number
  departureAddressId: string
}): Promise<string> {
  const existing = await listOffersForEvent(input.eventId)
  const clash = existing.find(
    (o) =>
      o.driverUid === input.driverUid &&
      o.status !== 'cancelled' &&
      directionOverlaps(o.direction, input.direction),
  )
  if (clash) {
    throw new Error(
      'Vous avez déjà proposé une voiture pour cette direction.',
    )
  }

  // Places offertes aux autres (hors enfant du chauffeur).
  const availableSeats = input.vehicleCapacity - 1

  const ref = await addDoc(offersCol(), {
    eventId: input.eventId,
    driverUid: input.driverUid,
    childId: input.childId,
    direction: input.direction,
    vehicleCapacity: input.vehicleCapacity,
    availableSeats,
    departureAddressId: input.departureAddressId,
    status: 'open' as OfferStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Change le statut d'une offre. */
export async function setOfferStatus(
  id: string,
  status: OfferStatus,
): Promise<void> {
  await updateDoc(doc(db, 'offers', id), {
    status,
    updatedAt: serverTimestamp(),
  })
}

/** Supprime une offre. */
export async function deleteOffer(id: string): Promise<void> {
  await deleteDoc(doc(db, 'offers', id))
}
