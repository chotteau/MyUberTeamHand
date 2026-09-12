import { Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { LayoutDashboard, CalendarDays, Users, RefreshCw, Settings, ChevronRight, AlertTriangle } from 'lucide-react'
import { eventSummaryQuery, useEvents } from '../../hooks/useEvents'
import { useChildren } from '../../hooks/useChildren'
import { useConfig } from '../../hooks/useConfig'
import { PageSpinner } from '../../components/ui/Spinner'
import { KpiCard } from '../../components/ui/KpiCard'
import { formatShortDateTime, formatDayMonth, isEventEditable } from '../../utils/dates'

export default function Dashboard() {
  const { data: events, isLoading } = useEvents('upcoming')
  const { data: children } = useChildren()
  const { data: config } = useConfig()

  const upcoming = (events ?? []).filter(isEventEditable)
  const boards = useQueries({ queries: upcoming.map((e) => eventSummaryQuery(e.id)) })

  const alerts = upcoming.flatMap((e, i) => {
    const s = boards[i]?.data
    if (!s) return []
    const out: string[] = []
    const present = s.aller.present + s.retour.present
    if (present > 0 && s.aller.cars === 0) out.push("aucune voiture à l'aller")
    if (present > 0 && e.returnTime && s.retour.cars === 0) out.push('aucune voiture au retour')
    if (s.aller.withoutCar > 0) out.push(`${s.aller.withoutCar} sans voiture à l'aller`)
    if (s.retour.withoutCar > 0) out.push(`${s.retour.withoutCar} sans voiture au retour`)
    return out.length ? [{ event: e, text: out.join(' · ') }] : []
  })

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
        <LayoutDashboard className="h-5 w-5 text-primary" />
        Tableau de bord
      </h1>

      {isLoading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard icon={<CalendarDays className="h-5 w-5" />} label="Événements (4 sem.)" value={upcoming.length} />
            <KpiCard icon={<Users className="h-5 w-5" />} label="Familles actives" value={(children ?? []).filter((c) => c.active).length} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Alertes" value={alerts.length} tone={alerts.length ? 'warning' : 'default'} />
            <KpiCard
              icon={<RefreshCw className="h-5 w-5" />}
              label="Dernière sync FFHB"
              value={<span className="text-base">{config?.icsLastSync ? formatShortDateTime(config.icsLastSync) : 'Jamais'}</span>}
            />
          </div>

          {alerts.length > 0 && (
            <section className="card space-y-2">
              <h2 className="text-sm font-semibold text-slate-600">À surveiller</h2>
              {alerts.map((a) => (
                <Link key={a.event.id} to={`/admin/event/${a.event.id}`} className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800 hover:bg-amber-100">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="capitalize">{formatDayMonth(a.event.date)}</span> — {a.event.title} : {a.text}
                </Link>
              ))}
            </section>
          )}

          <div className="space-y-2">
            <QuickLink to="/admin/evenements" icon={<CalendarDays className="h-5 w-5 text-primary" />} label="Gérer les événements" />
            <QuickLink to="/admin/familles" icon={<Users className="h-5 w-5 text-primary" />} label="Gérer les familles" />
            <QuickLink to="/admin/config" icon={<Settings className="h-5 w-5 text-primary" />} label="Configuration" />
          </div>
        </>
      )}
    </div>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 !p-3 transition hover:border-primary">
      {icon}
      <span className="flex-1 font-medium text-secondary">{label}</span>
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </Link>
  )
}
