import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Address, Child, ChildAddresses, ChildParent } from '../types'

const childrenCol = () => collection(db, 'children')

/**
 * Normalise un document enfant. Tolère l'ancienne structure
 * (addresses en tableau, pas de parents) pour ne jamais planter l'UI.
 */
function toChild(d: QueryDocumentSnapshot<DocumentData>): Child {
  const raw = d.data()
  let addresses: ChildAddresses
  if (Array.isArray(raw.addresses)) {
    const [a, b] = raw.addresses as Address[]
    addresses = {
      default: a ?? { label: 'Domicile', street: '', zipCode: '', city: '' },
      ...(b ? { secondary: b } : {}),
    }
  } else {
    addresses = raw.addresses ?? {
      default: { label: 'Domicile', street: '', zipCode: '', city: '' },
    }
  }
  const parents: ChildParent[] = raw.parents ?? []
  return {
    id: d.id,
    firstName: raw.firstName ?? '',
    parents,
    parentEmails: raw.parentEmails ?? parents.map((p) => p.email),
    addresses,
    active: raw.active ?? true,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

/** Tous les enfants, triés par prénom. */
export async function listChildren(): Promise<Child[]> {
  const snap = await getDocs(query(childrenCol(), orderBy('firstName', 'asc')))
  return snap.docs.map(toChild)
}

/** Les enfants d'un parent (liaison par email du compte). */
export async function listMyChildren(email: string): Promise<Child[]> {
  if (!email) return []
  const snap = await getDocs(
    query(childrenCol(), where('parentEmails', 'array-contains', email.toLowerCase())),
  )
  return snap.docs.map(toChild).sort((a, b) => a.firstName.localeCompare(b.firstName))
}

export interface ChildInput {
  firstName: string
  parents: ChildParent[]
  addresses: ChildAddresses
  active: boolean
}

function withDerived(input: ChildInput) {
  const parents = input.parents.map((p) => ({
    firstName: p.firstName.trim(),
    email: p.email.trim().toLowerCase(),
  }))
  return {
    firstName: input.firstName.trim(),
    parents,
    parentEmails: parents.map((p) => p.email),
    addresses: input.addresses,
    active: input.active,
  }
}

export async function createChild(input: ChildInput): Promise<string> {
  const ref = await addDoc(childrenCol(), {
    ...withDerived(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Met à jour une fiche. `keepActive` : ne touche pas au statut actif/inactif
 * (ré-import CSV — un enfant désactivé par l'admin ne doit pas être réactivé).
 */
export async function updateChild(
  id: string,
  input: ChildInput,
  opts: { keepActive?: boolean } = {},
): Promise<void> {
  const { active, ...rest } = withDerived(input)
  await updateDoc(doc(db, 'children', id), {
    ...rest,
    ...(opts.keepActive ? {} : { active }),
    updatedAt: serverTimestamp(),
  })
}

/** Un parent ne peut modifier que les adresses de son enfant. */
export async function updateChildAddresses(
  id: string,
  addresses: ChildAddresses,
): Promise<void> {
  await updateDoc(doc(db, 'children', id), { addresses, updatedAt: serverTimestamp() })
}

export async function setChildActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'children', id), { active, updatedAt: serverTimestamp() })
}
