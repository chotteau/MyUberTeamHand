import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { signOut } from '../services/auth'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/ui/Spinner'

/**
 * Affichée quand le profil est incomplet (childId non lié).
 * Le parent complète son prénom affiché. La liaison à l'enfant
 * est faite par l'admin (ou via import CSV).
 */
export default function CompleteProfile() {
  const { firebaseUser, profile, refreshProfile, profileIncomplete } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [loading, setLoading] = useState(false)

  const childLinked = !!profile?.childId

  // Plus rien à compléter (admin, ou enfant déjà lié) → retour à l'app.
  if (!profileIncomplete) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!firebaseUser) return
    setLoading(true)
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName,
        updatedAt: serverTimestamp(),
      })
      await refreshProfile()
      toast.success('Profil enregistré')
    } catch {
      toast.error("Impossible d'enregistrer le profil")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold text-secondary">
          Bienvenue 👋
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Complétez votre prénom pour finaliser votre compte.
        </p>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prénom affiché
            </label>
            <input
              type="text"
              required
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jean"
            />
            <p className="mt-1 text-xs text-slate-400">
              En cas de doublon, ajoutez une initiale : "Jean M"
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? <Spinner className="h-4 w-4 text-white" /> : null}
            Enregistrer
          </button>
        </form>

        {!childLinked && profileIncomplete && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Votre compte n'est pas encore relié à un enfant. Un administrateur
            doit effectuer la liaison avant que vous puissiez déclarer des
            trajets.
          </div>
        )}

        <button
          type="button"
          onClick={() => signOut()}
          className="btn-ghost mt-4 w-full text-slate-500"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
