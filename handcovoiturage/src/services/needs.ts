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
import type { Direction, Need, NeedStatus } from '../types'

const needsCol = () => collection(db, 'needs')

/** Deux directions se chevauchent-elles ? ('both' couvre tout). */
export function directionOverlaps(a: Direction, b: Direction): boolean {
  if (a === 'both' || b === 'both') return true
  return a === b
}

/** Liste (one-shot) les besoins d'un événement. */
export async function listNeedsForEvent(eventId: string): Promise<Need[]> {
  const q = query(needsCol(), where('eventId', '==', eventId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Need)
}

/** Écoute en temps réel les besoins d'un événement. */
export function subscribeNeedsForEvent(
  eventId: string,
  cb: (needs: Need[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(needsCol(), where('eventId', '==', eventId))
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Need)),
    (err) => onError?.(err),
  )
}

/**
 * Crée un besoin de transport pour un enfant.
 * Règle 5 : un enfant = 1 besoin par direction par événement.
 * On vérifie qu'aucun besoin existant ne chevauche la direction demandée.
 */
export async function createNeed(input: {
  eventId: string
  childId: string
  declaredByUid: string
  direction: Direction
  pickupAddressId: string
  dropoffAddressId?: string
}): Promise<string> {
  const existing = await listNeedsForEvent(input.eventId)
  const clash = existing.find(
    (n) =>
      n.childId === input.childId &&
      n.status !== 'cancelled' &&
      directionOverlaps(n.direction, input.direction),
  )
  if (clash) {
    throw new Error(
      'Un besoin existe déjà pour cet enfant sur cette direction.',
    )
  }

  const ref = await addDoc(needsCol(), {
    eventId: input.eventId,
    childId: input.childId,
    declaredByUid: input.declaredByUid,
    direction: input.direction,
    pickupAddressId: input.pickupAddressId,
    ...(input.dropoffAddressId
      ? { dropoffAddressId: input.dropoffAddressId }
      : {}),
    status: 'pending' as NeedStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Met à jour le statut d'un besoin (ex: 'assigned' après attribution). */
export async function setNeedStatus(
  id: string,
  status: NeedStatus,
  assignedRideId?: string,
): Promise<void> {
  await updateDoc(doc(db, 'needs', id), {
    status,
    ...(assignedRideId !== undefined ? { assignedRideId } : {}),
    updatedAt: serverTimestamp(),
  })
}

/** Supprime un besoin (déclarant ou admin — contrôlé par les règles). */
export async function deleteNeed(id: string): Promise<void> {
  await deleteDoc(doc(db, 'needs', id))
}
