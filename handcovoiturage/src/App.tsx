import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/ui/Layout'
import { AdminLayout } from './components/admin/AdminLayout'
import { PrivateRoute } from './components/ui/PrivateRoute'

import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
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
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/planning" replace />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/mon-profil" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<PrivateRoute requireAdmin />}>
          <Route element={<Layout />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/evenements" element={<AdminEvents />} />
              <Route path="/admin/event/:id" element={<EventDetail adminMode />} />
              <Route path="/admin/familles" element={<AdminFamilies />} />
              <Route path="/admin/config" element={<AdminConfig />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
