import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Calendar,
  Plus,
  RefreshCw,
  Pencil,
  Ban,
  Trash2,
  MapPin,
  Clock,
} from 'lucide-react'
import { useEvents, useSetEventStatus, useDeleteEvent } from '../../hooks/useEvents'
import { triggerIcsSync } from '../../services/icsSync'
import { EventFormModal } from '../../components/admin/EventFormModal'
import {
  EventStatusBadge,
  EventTypeBadge,
} from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { formatDate, formatTime } from '../../utils/dates'
import type { Event } from '../../types'

export default function AdminEvents() {
  const { data: events, isLoading } = useEvents()
  const setStatus = useSetEventStatus()
  const deleteEvent = useDeleteEvent()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [syncing, setSyncing] = useState(false)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(event: Event) {
    setEditing(event)
    setModalOpen(true)
  }

  function handleCancel(event: Event) {
    if (!confirm(`Annuler « ${event.title} » ?`)) return
    setStatus.mutate(
      { id: event.id, status: 'cancelled' },
      {
        onSuccess: () => toast.success('Événement annulé'),
        onError: () => toast.error("Échec de l'annulation"),
      },
    )
  }

  function handleDelete(event: Event) {
    if (!confirm(`Supprimer définitivement « ${event.title} » ?`)) return
    deleteEvent.mutate(event.id, {
      onSuccess: () => toast.success('Événement supprimé'),
      onError: () => toast.error('Échec de la suppression'),
    })
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await triggerIcsSync()
      qc.invalidateQueries({ queryKey: ['events'] })
      toast.success(
        `Sync ICS : ${res.created} créé(s), ${res.updated} mis à jour, ${res.cancelled} annulé(s)`,
      )
    } catch {
      toast.error('Échec de la synchronisation ICS')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
          <Calendar className="h-5 w-5 text-primary" />
          Événements
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            className="btn-secondary"
            disabled={syncing}
          >
            <RefreshCw
              className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
            />
            {syncing ? 'Synchro…' : 'Sync ICS'}
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouvel événement
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !events || events.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">
          Aucun événement à venir. Créez-en un ou générez les entraînements
          depuis la Config.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onEdit={() => openEdit(event)}
              onCancel={() => handleCancel(event)}
              onDelete={() => handleDelete(event)}
            />
          ))}
        </div>
      )}

      <EventFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={editing}
      />
    </div>
  )
}

function EventRow({
  event,
  onEdit,
  onCancel,
  onDelete,
}: {
  event: Event
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const cancelled = event.status === 'cancelled'
  return (
    <div className={`card !p-3 ${cancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <EventTypeBadge type={event.type} />
            <EventStatusBadge status={event.status} />
            {event.source === 'ics_ffhb' && (
              <span className="badge bg-slate-100 text-slate-500">FFHB</span>
            )}
          </div>
          <div className="truncate font-medium text-secondary">
            {event.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(event.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(event.departureTime)}
              {event.returnTime ? ` → ${formatTime(event.returnTime)}` : ''}
            </span>
            {event.location.name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location.name}
                {event.location.city ? `, ${event.location.city}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="btn-ghost p-2 text-slate-500"
            aria-label="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {!cancelled && (
            <button
              onClick={onCancel}
              className="btn-ghost p-2 text-amber-600"
              aria-label="Annuler"
            >
              <Ban className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="btn-ghost p-2 text-danger"
            aria-label="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
