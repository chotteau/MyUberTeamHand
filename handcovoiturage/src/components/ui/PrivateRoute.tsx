import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from './Spinner'

interface PrivateRouteProps {
  /** Si true, seul un admin peut accéder */
  requireAdmin?: boolean
}

/**
 * Garde de route :
 * - non authentifié → /login
 * - profil incomplet → /completer-profil
 * - requireAdmin mais non admin → /planning
 */
export function PrivateRoute({ requireAdmin = false }: PrivateRouteProps) {
  const { firebaseUser, loading, isAdmin, profileIncomplete } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profileIncomplete && location.pathname !== '/completer-profil') {
    return <Navigate to="/completer-profil" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/planning" replace />
  }

  return <Outlet />
}
