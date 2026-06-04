import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Address, Child } from '../types'

const childrenCol = () => collection(db, 'children')

/** Liste tous les enfants (triés par prénom). */
export async function listChildren(): Promise<Child[]> {
  const q = query(childrenCol(), orderBy('firstName', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Child)
}

/** Récupère un enfant. */
export async function getChild(id: string): Promise<Child | null> {
  const snap = await getDoc(doc(db, 'children', id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Child) : null
}

/**
 * Recherche un enfant par prénom (déduplication import CSV).
 * Pas de nom de famille — le prénom est l'identifiant lisible (ex: "Lucas M").
 */
export async function findChildByFirstName(
  firstName: string,
): Promise<Child | null> {
  const q = query(childrenCol(), where('firstName', '==', firstName))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Child
}

/** Crée un enfant. */
export async function createChild(
  data: Omit<Child, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(childrenCol(), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Met à jour un enfant. */
export async function updateChild(
  id: string,
  patch: Partial<Omit<Child, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, 'children', id), patch)
}

/** Active / désactive un enfant. */
export async function setChildActive(id: string, active: boolean): Promise<void> {
  await updateChild(id, { active })
}

/** Génère un id d'adresse stable. */
export function makeAddressId(): string {
  return `addr_${Math.random().toString(36).slice(2, 10)}`
}

/** Fusionne des adresses sans doublon (par street + zipCode). */
export function mergeAddresses(
  existing: Address[],
  incoming: Address[],
): Address[] {
  const result = [...existing]
  for (const addr of incoming) {
    const dup = result.some(
      (a) => a.street === addr.street && a.zipCode === addr.zipCode,
    )
    if (!dup) result.push(addr)
  }
  return result
}
