import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Ban } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../services/auth'
import { PageSpinner } from './Spinner'

interface PrivateRouteProps {
  requireAdmin?: boolean
}

/**
 * non authentifié → /login ; compte désactivé → écran bloquant ;
 * requireAdmin mais non admin → /planning
 */
export function PrivateRoute({ requireAdmin = false }: PrivateRouteProps) {
  const { firebaseUser, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <PageSpinner />
  if (!firebaseUser) return <Navigate to="/login" replace state={{ from: location }} />

  if (profile && profile.active === false) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 px-4">
        <div className="card max-w-sm space-y-4 text-center">
          <Ban className="mx-auto h-8 w-8 text-slate-400" />
          <h1 className="font-semibold text-secondary">Compte désactivé</h1>
          <p className="text-sm text-slate-500">
            Votre compte ({profile.email}) a été désactivé par un administrateur.
          </p>
          <button onClick={() => signOut()} className="btn-ghost w-full text-slate-500">
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/planning" replace />
  return <Outlet />
}
