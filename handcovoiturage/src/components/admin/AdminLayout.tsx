import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, Users, Settings } from 'lucide-react'

const TABS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/evenements', label: 'Événements', icon: CalendarDays },
  { to: '/admin/familles', label: 'Familles', icon: Users },
  { to: '/admin/config', label: 'Config', icon: Settings },
]

/** Enveloppe les écrans admin avec une sous-navigation par onglets. */
export function AdminLayout() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="badge bg-primary-100 text-primary-700">Admin</span>
      </div>

      <nav className="mb-6 -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-secondary text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
