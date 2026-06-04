import type { EventStatus, EventType } from '../../types'

const EVENT_STATUS: Record<EventStatus, { label: string; cls: string }> = {
  scheduled: { label: 'Prévu', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Annulé', cls: 'bg-red-100 text-red-700' },
  vacances:  { label: 'Vacances', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Terminé', cls: 'bg-slate-100 text-slate-500' },
}

const EVENT_TYPE: Record<EventType, { label: string; cls: string }> = {
  training: { label: 'Entraînement', cls: 'bg-primary-100 text-primary-700' },
  match: { label: 'Match', cls: 'bg-purple-100 text-purple-700' },
}

/** Badge couleur du statut d'un événement. */
export function EventStatusBadge({ status }: { status: EventStatus }) {
  const s = EVENT_STATUS[status]
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

/** Badge couleur du type d'un événement. */
export function EventTypeBadge({ type }: { type: EventType }) {
  const t = EVENT_TYPE[type]
  return <span className={`badge ${t.cls}`}>{t.label}</span>
}

/** Badge générique de déclaration covoiturage (planning driver). */
export function RideStatusBadge({
  state,
}: {
  state: 'to_declare' | 'pending' | 'confirmed'
}) {
  const map = {
    to_declare: { label: 'À déclarer', cls: 'bg-amber-100 text-amber-700' },
    pending: { label: 'En attente', cls: 'bg-blue-100 text-blue-700' },
    confirmed: { label: 'Confirmé', cls: 'bg-green-100 text-green-700' },
  }
  const s = map[state]
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}
