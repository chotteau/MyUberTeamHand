import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Calendar, Plus, RefreshCw, Pencil, Ban, Sun, RotateCcw, Trash2 } from 'lucide-react'
import {
  EVENTS_KEY,
  useEvents,
  useSetEventStatus,
  useDeleteEvent,
  type EventsRange,
} from '../../hooks/useEvents'
import { triggerIcsSync } from '../../services/icsSync'
import { EventFormModal } from '../../components/admin/EventFormModal'
import { EventSummary } from '../../components/events/EventSummary'
import { EventStatusBadge, EventTypeBadge } from '../../components/ui/StatusBadge'
import { PageSpinner } from '../../components/ui/Spinner'
import { isEventPast } from '../../utils/dates'
import type { Event, EventStatus } from '../../types'

const RANGES: { value: EventsRange; label: string }[] = [
  { value: 'upcoming', label: '4 semaines' },
  { value: 'season', label: 'Saison' },
  { value: 'past', label: 'Passés' },
]

export default function AdminEvents() {
  const [range, setRange] = useState<EventsRange>('upcoming')
  const { data: events, isLoading } = useEvents(range)
  const setStatus = useSetEventStatus()
  const deleteEvent = useDeleteEvent()
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; event: Event | null }>({ open: false, event: null })

  const sync = useMutation({
    mutationFn: triggerIcsSync,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: EVENTS_KEY })
      toast.success(`Sync ICS : ${res.created} créé(s), ${res.updated} mis à jour, ${res.cancelled} annulé(s)`)
    },
    onError: () => toast.error('Échec de la synchronisation ICS'),
  })

  function changeStatus(event: Event, status: EventStatus, label: string) {
    setStatus.mutate(
      { id: event.id, status },
      { onSuccess: () => toast.success(label), onError: () => toast.error('Échec') },
    )
  }

  function handleDelete(event: Event) {
    if (!confirm(`Supprimer définitivement « ${event.title} » ?`)) return
    deleteEvent.mutate(event.id, {
      onSuccess: () => toast.success('Événement supprimé'),
      onError: () => toast.error('Échec de la suppression'),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
          <Calendar className="h-5 w-5 text-primary" />
          Événements
        </h1>
        <div className="flex gap-2">
          <button onClick={() => sync.mutate()} className="btn-secondary" disabled={sync.isPending}>
            <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} />
            Sync FFHB
          </button>
          <button onClick={() => setModal({ open: true, event: null })} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouvel événement
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Les entraînements récurrents sont générés depuis la Config ; les matchs FFHB arrivent par la synchro
        (auto toutes les 24 h). Créez ici un entraînement exceptionnel ou un match hors flux.
      </p>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              range === r.value ? 'bg-white text-secondary shadow-sm' : 'text-slate-500'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !events || events.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">Aucun événement sur cette période.</div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onEdit={() => setModal({ open: true, event })}
              onStatus={(s, label) => changeStatus(event, s, label)}
              onDelete={() => handleDelete(event)}
            />
          ))}
        </div>
      )}

      {modal.open && (
        <EventFormModal event={modal.event} onClose={() => setModal({ open: false, event: null })} />
      )}
    </div>
  )
}

function EventRow({
  event,
  onEdit,
  onStatus,
  onDelete,
}: {
  event: Event
  onEdit: () => void
  onStatus: (s: EventStatus, label: string) => void
  onDelete: () => void
}) {
  const past = isEventPast(event)
  const scheduled = event.status === 'scheduled'
  return (
    <div className={`card !p-3 ${past || !scheduled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <EventTypeBadge type={event.type} />
            <EventStatusBadge status={event.status} past={past} />
            {event.source === 'ics_ffhb' && <span className="badge bg-slate-100 text-slate-500">FFHB</span>}
            {event.source === 'generated' && <span className="badge bg-slate-100 text-slate-500">Auto</span>}
          </div>
          <Link to={`/admin/event/${event.id}`} className="block truncate font-medium text-secondary hover:text-primary hover:underline">
            {event.title}
          </Link>
          <EventSummary event={event} />
        </div>
        {!past && (
          <div className="flex shrink-0 gap-0.5">
            <button onClick={onEdit} className="btn-ghost p-2 text-slate-500" aria-label="Modifier" title="Modifier">
              <Pencil className="h-4 w-4" />
            </button>
            {scheduled ? (
              <>
                <button onClick={() => onStatus('vacances', 'Marqué « vacances »')} className="btn-ghost p-2 text-amber-600" aria-label="Vacances" title="Vacances scolaires">
                  <Sun className="h-4 w-4" />
                </button>
                <button onClick={() => onStatus('cancelled', 'Événement annulé')} className="btn-ghost p-2 text-danger" aria-label="Annuler" title="Annuler">
                  <Ban className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button onClick={() => onStatus('scheduled', 'Événement réactivé')} className="btn-ghost p-2 text-success" aria-label="Réactiver" title="Réactiver">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            {event.source === 'manual' && (
              <button onClick={onDelete} className="btn-ghost p-2 text-slate-400" aria-label="Supprimer" title="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
