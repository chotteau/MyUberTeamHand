import { createContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User as FbUser } from 'firebase/auth'
import { auth } from '../services/firebase'
import { getUserProfile } from '../services/auth'
import type { User } from '../types'

export interface AuthContextValue {
  /** Utilisateur Firebase Auth brut (null si déconnecté) */
  firebaseUser: FbUser | null
  /** Profil Firestore (null si pas encore créé / chargé) */
  profile: User | null
  /** true tant que l'état d'auth initial n'est pas résolu */
  loading: boolean
  isAdmin: boolean
  /** Profil incomplet → l'enfant n'est pas encore lié */
  profileIncomplete: boolean
  /** Force le rechargement du profil Firestore */
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FbUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(uid: string) {
    const p = await getUserProfile(uid)
    setProfile(p)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        await loadProfile(fbUser.uid)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const value: AuthContextValue = {
    firebaseUser,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    // Un admin n'est jamais « incomplet » : il n'a pas d'enfant à lier et
    // doit pouvoir accéder à l'app pour gérer familles, événements, etc.
    profileIncomplete:
      !!firebaseUser && profile?.role !== 'admin' && (!profile || !profile.childId),
    refreshProfile: async () => {
      if (firebaseUser) await loadProfile(firebaseUser.uid)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
