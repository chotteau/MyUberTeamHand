import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import type { User } from '../types'

/** Connexion email / mot de passe */
export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

/** Connexion Google OAuth */
export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  await ensureUserDoc(cred.user.uid, {
    email: cred.user.email ?? '',
    displayName: cred.user.displayName ?? '',
  })
  return cred.user
}

/** Création d'un compte email / mot de passe */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) await updateProfile(cred.user, { displayName })
  await ensureUserDoc(cred.user.uid, { email, displayName })
  return cred.user
}

/** Envoi d'un email de réinitialisation de mot de passe */
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}

/** Déconnexion */
export async function signOut() {
  await fbSignOut(auth)
}

/** Récupère le profil Firestore d'un utilisateur */
export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as User) : null
}

/** Met à jour les informations modifiables du profil. */
export async function updateUserProfile(
  uid: string,
  data: { displayName?: string; phone?: string },
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Crée le document users/{uid} s'il n'existe pas encore.
 * Le rôle par défaut est 'driver' ; l'admin lie ensuite l'enfant.
 */
async function ensureUserDoc(
  uid: string,
  data: { email: string; displayName: string },
) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    uid,
    email: data.email,
    displayName: data.displayName,
    role: 'driver',
    childId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
