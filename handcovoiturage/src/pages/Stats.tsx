import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { BarChart3, Car, Users, CalendarDays, Trophy } from 'lucide-react'
import { useStats } from '../hooks/useStats'
import { useChildren } from '../hooks/useChildren'
import { Spinner } from '../components/ui/Spinner'
import type { DriverStat } from '../services/stats'

// ---------------------------------------------------------------------------
// Podium — Top 3
// ---------------------------------------------------------------------------
const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32'] // or, argent, bronze

function PodiumCard({
  stat,
  rank,
  name,
}: {
  stat: DriverStat
  rank: number
  name: string
}) {
  const color = MEDAL_COLORS[rank] ?? '#CBD5E1'
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl p-4 text-center shadow-sm"
      style={{ border: `2px solid ${color}` }}
    >
      <span className="text-3xl">{MEDALS[rank]}</span>
      <span className="font-semibold text-secondary">{name}</span>
      <span className="text-2xl font-bold" style={{ color }}>
        {stat.rideCount}
      </span>
      <span className="text-xs text-slate-400">trajets</span>
      <span className="text-xs font-medium text-slate-500">
        {stat.participationPct}% de participation
      </span>
      <div className="mt-1 flex gap-2 text-xs text-slate-400">
        <span>↗ {stat.outboundCount} aller</span>
        <span>↙ {stat.returnCount} retour</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------
export default function Stats() {
  const { data: stats, isLoading } = useStats()
  const { data: children } = useChildren()

  const nameByChild = useMemo(() => {
    const m = new Map<string, string>()
    ;(children ?? []).forEach((c) => m.set(c.id, c.firstName))
    return m
  }, [children])

  const top3 = stats?.drivers.slice(0, 3) ?? []
  const lastDriver = stats && stats.drivers.length > 1
    ? stats.drivers[stats.drivers.length - 1]
    : null

  const chartData = useMemo(
    () =>
      (stats?.drivers ?? []).map((d) => ({
        name: nameByChild.get(d.driverChildId) ?? 'Famille',
        Aller: d.outboundCount,
        Retour: d.returnCount,
        isLast: d === lastDriver,
      })),
    [stats, nameByChild, lastDriver],
  )

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
        <BarChart3 className="h-5 w-5 text-primary" />
        Statistiques — Saison
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !stats || stats.drivers.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">
          Aucun trajet enregistré cette saison.
        </div>
      ) : (
        <>
          {/* Podium Top 3 */}
          {top3.length > 0 && (
            <section className="card space-y-3">
              <h2 className="flex items-center gap-2 font-semibold text-secondary">
                <Trophy className="h-4 w-4 text-amber-500" />
                Les héros du covoiturage 🚗
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {top3.map((d, i) => (
                  <PodiumCard
                    key={d.driverChildId}
                    stat={d}
                    rank={i}
                    name={nameByChild.get(d.driverChildId) ?? 'Famille'}
                  />
                ))}
              </div>
            </section>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard
              icon={<Car className="h-4 w-4" />}
              label="Trajets"
              value={stats.totalRides}
            />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Passagers"
              value={stats.totalPassengers}
            />
            <KpiCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Événements"
              value={stats.eventsCount}
            />
          </div>

          {/* Graphique barres bicolores aller/retour */}
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-600">
              Trajets par chauffeur
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Aller" stackId="a" fill="#F97316" radius={[0, 0, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.isLast ? '#FED7AA' : '#F97316'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="Retour" stackId="a" fill="#1E293B" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.isLast ? '#CBD5E1' : '#1E293B'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tableau détaillé */}
          <div className="card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="p-3">Chauffeur</th>
                  <th className="p-3 text-right">Aller</th>
                  <th className="p-3 text-right">Retour</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {stats.drivers.map((d, i) => {
                  const isTopDriver = i === 0
                  const isLastDriver = i === stats.drivers.length - 1 && stats.drivers.length > 1
                  return (
                    <tr
                      key={d.driverChildId}
                      className={`border-b border-slate-50 last:border-0 ${
                        isTopDriver ? 'bg-amber-50' : isLastDriver ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="p-3 font-medium text-secondary">
                        {nameByChild.get(d.driverChildId) ?? 'Famille'}
                        {isLastDriver && (
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                            À ton tour 😉
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-600">{d.outboundCount}</td>
                      <td className="p-3 text-right text-slate-600">{d.returnCount}</td>
                      <td className="p-3 text-right font-semibold text-secondary">{d.rideCount}</td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-medium ${
                            d.participationPct >= 50 ? 'text-green-600' : 'text-slate-400'
                          }`}
                        >
                          {d.participationPct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="card flex flex-col items-center gap-1 !p-3 text-center">
      <span className="text-primary">{icon}</span>
      <span className="text-2xl font-bold text-secondary">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}
