import type { EventStatus, EventType } from '../../types'

const EVENT_STATUS: Record<EventStatus, { label: string; cls: string }> = {
  scheduled: { label: 'Prévu', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Annulé', cls: 'bg-red-100 text-red-700' },
  vacances: { label: 'Vacances', cls: 'bg-amber-100 text-amber-700' },
}

const EVENT_TYPE: Record<EventType, { label: string; cls: string }> = {
  training: { label: 'Entraînement', cls: 'bg-primary-100 text-primary-700' },
  match: { label: 'Match', cls: 'bg-purple-100 text-purple-700' },
}

export function EventStatusBadge({
  status,
  past,
}: {
  status: EventStatus
  past?: boolean
}) {
  if (past && status === 'scheduled') {
    return <span className="badge bg-slate-100 text-slate-500">Passé</span>
  }
  const s = EVENT_STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500' }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

export function EventTypeBadge({ type }: { type: EventType }) {
  const t = EVENT_TYPE[type] ?? { label: type, cls: 'bg-slate-100 text-slate-500' }
  return <span className={`badge ${t.cls}`}>{t.label}</span>
}
