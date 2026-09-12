import { createContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User as FbUser } from 'firebase/auth'
import { auth } from '../services/firebase'
import toast from 'react-hot-toast'
import { ensureUserDoc, getUserProfile, signOut } from '../services/auth'
import type { User } from '../types'

export interface AuthContextValue {
  firebaseUser: FbUser | null
  profile: User | null
  /** true tant que l'état d'auth initial n'est pas résolu */
  loading: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FbUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      // Rester en « chargement » tant que le profil Firestore n'est pas résolu :
      // les pages ne doivent jamais se rendre avec un profil null après connexion.
      setLoading(true)
      setFirebaseUser(fbUser)
      if (fbUser) {
        try {
          setProfile(await ensureUserDoc(fbUser))
        } catch (e) {
          if ((e as { code?: string })?.code === 'app/not-declared') {
            toast.error("Cet email n'est pas déclaré au club. Contactez l'administrateur.", { duration: 8000 })
            await signOut()
            return
          }
          console.error('Profil utilisateur inaccessible', e)
          setProfile(null)
        }
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
    refreshProfile: async () => {
      if (firebaseUser) setProfile(await getUserProfile(firebaseUser.uid))
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
