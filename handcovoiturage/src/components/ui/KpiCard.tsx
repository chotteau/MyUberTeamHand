import type { ReactNode } from 'react'

export function KpiCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tone?: 'default' | 'warning' | 'danger'
}) {
  const valueCls =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-secondary'
  return (
    <div className="card flex flex-col gap-1 !p-4">
      <span className="text-primary">{icon}</span>
      <span className={`text-2xl font-bold ${valueCls}`}>{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}
