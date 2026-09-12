import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageSpinner } from './Spinner'

interface PrivateRouteProps {
  requireAdmin?: boolean
}

/** non authentifié → /login ; requireAdmin mais non admin → /planning */
export function PrivateRoute({ requireAdmin = false }: PrivateRouteProps) {
  const { firebaseUser, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <PageSpinner />
  if (!firebaseUser) return <Navigate to="/login" replace state={{ from: location }} />
  if (requireAdmin && !isAdmin) return <Navigate to="/planning" replace />
  return <Outlet />
}
