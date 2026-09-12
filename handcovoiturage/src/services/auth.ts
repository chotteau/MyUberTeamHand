import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  type User as FbUser,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { listMyChildren } from './children'
import type { User } from '../types'

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  return cred.user
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}

export async function signOut() {
  await fbSignOut(auth)
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as User) : null
}

export async function updateDisplayName(uid: string, displayName: string) {
  await updateDoc(doc(db, 'users', uid), {
    displayName: displayName.trim(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Garantit l'existence de users/{uid} à chaque connexion (email ou Google).
 * Le prénom est pris, dans l'ordre : profil existant, fiche enfant (CSV),
 * prénom Google. Le rôle par défaut est 'parent'.
 */
export async function ensureUserDoc(fbUser: FbUser): Promise<User> {
  const email = (fbUser.email ?? '').toLowerCase()
  const ref = doc(db, 'users', fbUser.uid)
  const snap = await getDoc(ref)

  if (snap.exists() && snap.get('displayName')) {
    return snap.data() as User
  }

  let displayName = ''
  try {
    const kids = await listMyChildren(email)
    displayName =
      kids.flatMap((k) => k.parents).find((p) => p.email === email)?.firstName ?? ''
  } catch {
    // Pas bloquant : on retombe sur le prénom Google.
  }
  if (!displayName) displayName = (fbUser.displayName ?? '').split(' ')[0]

  if (snap.exists()) {
    await updateDoc(ref, { displayName, updatedAt: serverTimestamp() })
  } else {
    await setDoc(ref, {
      uid: fbUser.uid,
      email,
      displayName,
      role: 'parent',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  return (await getDoc(ref)).data() as User
}
