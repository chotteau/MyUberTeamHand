import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { BarChart3, Car, Users, CalendarDays, Trophy } from 'lucide-react'
import { useStats } from '../hooks/useStats'
import { PageSpinner } from '../components/ui/Spinner'
import { KpiCard } from '../components/ui/KpiCard'
import type { DriverStat } from '../services/stats'

const MEDALS = ['🥇', '🥈', '🥉']
const MEDAL_CLS = [
  'border-amber-400 text-amber-500',
  'border-slate-400 text-slate-500',
  'border-orange-700 text-orange-700',
]

function PodiumCard({ stat, rank }: { stat: DriverStat; rank: number }) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-white p-4 text-center shadow-sm ${MEDAL_CLS[rank]}`}
    >
      <span className="text-3xl">{MEDALS[rank]}</span>
      <span className="font-semibold text-secondary">{stat.driverName}</span>
      <span className="text-2xl font-bold">{stat.total}</span>
      <span className="text-xs text-slate-400">trajets</span>
      <span className="text-xs font-medium text-slate-500">
        {stat.participationPct}% de participation
      </span>
      <div className="mt-1 flex gap-2 text-xs text-slate-400">
        <span>↗ {stat.allerCount} aller</span>
        <span>↙ {stat.retourCount} retour</span>
      </div>
    </div>
  )
}

export default function Stats() {
  const { data: stats, isLoading } = useStats()

  const top3 = stats?.drivers.slice(0, 3) ?? []
  const minTotal = stats?.drivers.length
    ? Math.min(...stats.drivers.map((d) => d.total))
    : 0
  const chartData = (stats?.drivers ?? []).map((d) => ({
    name: d.driverName,
    Aller: d.allerCount,
    Retour: d.retourCount,
  }))

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
        <BarChart3 className="h-5 w-5 text-primary" />
        Statistiques — Saison
      </h1>

      {isLoading ? (
        <PageSpinner />
      ) : !stats || stats.drivers.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">
          Aucun trajet enregistré cette saison.
        </div>
      ) : (
        <>
          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-secondary">
              <Trophy className="h-4 w-4 text-amber-500" />
              Les héros du covoiturage 🚗
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {top3.map((d, i) => (
                <PodiumCard key={d.driverUid} stat={d} rank={i} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-3 gap-3">
            <KpiCard icon={<Car className="h-4 w-4" />} label="Trajets" value={stats.totalTrips} />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Enfants transportés"
              value={stats.totalPassengers}
            />
            <KpiCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Événements passés"
              value={stats.eventsCount}
            />
          </div>

          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-600">Trajets par chauffeur</h2>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Aller" stackId="a" fill="#F97316" />
                <Bar dataKey="Retour" stackId="a" fill="#1E293B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card !p-0 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
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
                  const least = stats.drivers.length > 1 && d.total === minTotal
                  return (
                    <tr
                      key={d.driverUid}
                      className={`border-b border-slate-50 last:border-0 ${
                        i === 0 ? 'bg-amber-50' : least ? 'bg-slate-50' : ''
                      }`}
                    >
                      <td className="p-3 font-medium text-secondary">
                        {d.driverName}
                        {least && (
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                            À ton tour 😉
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-600">{d.allerCount}</td>
                      <td className="p-3 text-right text-slate-600">{d.retourCount}</td>
                      <td className="p-3 text-right font-semibold text-secondary">{d.total}</td>
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

          {stats.familiesWithoutTrip.length > 0 && (
            <p className="text-xs text-slate-400">
              Pas encore au volant cette saison : {stats.familiesWithoutTrip.join(', ')} 😉
            </p>
          )}
        </>
      )}
    </div>
  )
}
