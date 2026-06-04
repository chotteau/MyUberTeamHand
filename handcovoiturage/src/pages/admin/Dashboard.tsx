import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  RefreshCw,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { useEvents } from '../../hooks/useEvents'
import { useChildren } from '../../hooks/useChildren'
import { useConfig } from '../../hooks/useConfig'
import { Spinner } from '../../components/ui/Spinner'
import { formatRelativeDate } from '../../utils/dates'

export default function Dashboard() {
  const { data: events, isLoading: loadingEvents } = useEvents()
  const { data: children } = useChildren()
  const { data: config } = useConfig()

  const upcoming = (events ?? []).filter((e) => e.status !== 'cancelled')
  const activeFamilies = (children ?? []).filter((c) => c.active).length

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
        <LayoutDashboard className="h-5 w-5 text-primary" />
        Tableau de bord
      </h1>

      {loadingEvents ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="Événements à venir"
              value={upcoming.length}
            />
            <KpiCard
              icon={<Users className="h-5 w-5" />}
              label="Familles actives"
              value={activeFamilies}
            />
            <KpiCard
              icon={<RefreshCw className="h-5 w-5" />}
              label="Dernière sync ICS"
              text={
                config?.icsLastSync
                  ? formatRelativeDate(config.icsLastSync)
                  : 'Jamais'
              }
            />
          </div>

          <div className="space-y-2">
            <QuickLink
              to="/admin/evenements"
              icon={<CalendarDays className="h-5 w-5 text-primary" />}
              label="Gérer les événements"
            />
            <QuickLink
              to="/admin/familles"
              icon={<Users className="h-5 w-5 text-primary" />}
              label="Gérer les familles"
            />
            <QuickLink
              to="/admin/config"
              icon={<Settings className="h-5 w-5 text-primary" />}
              label="Configuration"
            />
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  text,
}: {
  icon: React.ReactNode
  label: string
  value?: number
  text?: string
}) {
  return (
    <div className="card flex flex-col gap-1 !p-4">
      <span className="text-primary">{icon}</span>
      <span className="text-2xl font-bold capitalize text-secondary">
        {value !== undefined ? value : text}
      </span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

function QuickLink({
  to,
  icon,
  label,
}: {
  to: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="card flex items-center gap-3 !p-3 transition hover:border-primary"
    >
      {icon}
      <span className="flex-1 font-medium text-secondary">{label}</span>
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </Link>
  )
}
