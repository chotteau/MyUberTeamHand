import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/ui/Layout'
import { AdminLayout } from './components/admin/AdminLayout'
import { PrivateRoute } from './components/ui/PrivateRoute'

import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import CompleteProfile from './pages/CompleteProfile'
import Planning from './pages/Planning'
import EventDetail from './pages/EventDetail'
import Stats from './pages/Stats'
import Profile from './pages/Profile'
import Dashboard from './pages/admin/Dashboard'
import AdminEvents from './pages/admin/Events'
import AdminFamilies from './pages/admin/Families'
import AdminConfig from './pages/admin/Config'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Profil à compléter (authentifié mais enfant non lié) */}
        <Route element={<PrivateRoute />}>
          <Route path="/completer-profil" element={<CompleteProfile />} />
        </Route>

        {/* Routes Driver (parent) */}
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/planning" replace />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/mon-profil" element={<Profile />} />
          </Route>
        </Route>

        {/* Routes Admin */}
        <Route element={<PrivateRoute requireAdmin />}>
          <Route element={<Layout />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/evenements" element={<AdminEvents />} />
              <Route path="/admin/familles" element={<AdminFamilies />} />
              <Route path="/admin/config" element={<AdminConfig />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
