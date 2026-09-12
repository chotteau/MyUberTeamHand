import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  type User as FbUser,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions, googleProvider } from './firebase'
import { listMyChildren } from './children'
import type { User } from '../types'

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

/** Erreur métier : l'email n'est déclaré sur aucun enfant. */
export class NotDeclaredError extends Error {
  code = 'app/not-declared'
  constructor() {
    super("Cet email n'est pas déclaré au club")
  }
}

/** L'email figure-t-il dans les parents d'un enfant ? (Cloud Function, sans auth) */
export async function isEmailDeclared(email: string): Promise<boolean> {
  const call = httpsCallable<{ email: string }, { declared: boolean }>(functions, 'isEmailDeclared')
  return (await call({ email })).data.declared
}

/**
 * Création d'un compte email / mot de passe — réservée aux emails déclarés
 * par l'admin sur un enfant. Le profil est créé ensuite par ensureUserDoc.
 */
export async function registerWithEmail(email: string, password: string) {
  const normalized = email.trim().toLowerCase()
  if (!(await isEmailDeclared(normalized))) throw new NotDeclaredError()
  const cred = await createUserWithEmailAndPassword(auth, normalized, password)
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
  return snap.exists() ? ({ active: true, ...snap.data() } as User) : null
}

export async function updateDisplayName(uid: string, displayName: string) {
  await updateDoc(doc(db, 'users', uid), {
    displayName: displayName.trim(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Garantit l'existence de users/{uid} à chaque connexion (email ou Google).
 * Première connexion : l'email doit être déclaré sur un enfant, sinon
 * NotDeclaredError (aucun profil créé). Le prénom vient de la fiche enfant
 * (CSV), à défaut du prénom Google.
 */
export async function ensureUserDoc(fbUser: FbUser): Promise<User> {
  const email = (fbUser.email ?? '').toLowerCase()
  const ref = doc(db, 'users', fbUser.uid)
  const snap = await getDoc(ref)

  if (snap.exists() && snap.get('displayName')) {
    return { active: true, ...snap.data() } as User
  }

  const kids = await listMyChildren(email)
  if (kids.length === 0 && snap.get('role') !== 'admin') throw new NotDeclaredError()

  let displayName = kids.flatMap((k) => k.parents).find((p) => p.email === email)?.firstName ?? ''
  if (!displayName) displayName = (fbUser.displayName ?? '').split(' ')[0]

  if (snap.exists()) {
    await updateDoc(ref, { displayName, updatedAt: serverTimestamp() })
  } else {
    await setDoc(ref, {
      uid: fbUser.uid,
      email,
      displayName,
      role: 'parent',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  return { active: true, ...(await getDoc(ref)).data() } as User
}
