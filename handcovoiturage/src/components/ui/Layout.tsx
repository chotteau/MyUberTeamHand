import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Calendar, BarChart3, User, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../services/auth'

interface NavItem {
  to: string
  label: string
  icon: typeof Calendar
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { to: '/planning', label: 'Planning', icon: Calendar },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/mon-profil', label: 'Profil', icon: User },
  { to: '/admin', label: 'Admin', icon: Settings, adminOnly: true },
]

export function Layout() {
  const { isAdmin, profile } = useAuth()
  const navigate = useNavigate()
  const items = NAV.filter((i) => !i.adminOnly || isAdmin)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* En-tête (desktop) */}
      <header className="hidden border-b border-slate-200 bg-white md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              🤾
            </span>
            <span className="font-bold text-secondary">HandCovoiturage</span>
          </div>
          <nav className="flex items-center gap-1">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary-50 text-primary'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleSignOut}
              className="ml-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">{profile?.displayName}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Contenu */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6">
        <Outlet />
      </main>

      {/* Barre de navigation (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-around">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                  isActive ? 'text-primary' : 'text-slate-500'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
