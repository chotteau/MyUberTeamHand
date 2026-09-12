import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { User } from '../types'

/** Tous les comptes (admin uniquement — règles Firestore). */
export async function listUsers(): Promise<User[]> {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('displayName', 'asc')))
  return snap.docs.map((d) => ({ active: true, ...d.data() }) as User)
}

/** Active / désactive un compte parent (il ne peut plus se servir de l'app). */
export async function setUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { active, updatedAt: serverTimestamp() })
}
