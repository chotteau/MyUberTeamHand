import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, Pencil, ShieldCheck } from 'lucide-react'
import { EventFormModal } from '../components/admin/EventFormModal'
import { useEvent } from '../hooks/useEvents'
import { useMyChildren } from '../hooks/useChildren'
import { useEventBoard } from '../hooks/useEventBoard'
import { useConfig } from '../hooks/useConfig'
import { useAuth } from '../hooks/useAuth'
import { MyChildrenBlock } from '../components/board/MyChildrenBlock'
import { MyCarBlock } from '../components/board/MyCarBlock'
import { CarMatrix } from '../components/board/CarMatrix'
import { EventSummary } from '../components/events/EventSummary'
import { EventStatusBadge, EventTypeBadge } from '../components/ui/StatusBadge'
import { PageSpinner } from '../components/ui/Spinner'
import { isEventEditable, isEventPast } from '../utils/dates'

/**
 * adminMode (route /admin/event/:id) : pouvoirs admin visibles (retirer une
 * voiture, modifier l'événement). Sur /event/:id l'admin agit comme un parent.
 */
export default function EventDetail({ adminMode = false }: { adminMode?: boolean }) {
  const { id } = useParams()
  const { profile, isAdmin } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const { data: event, isLoading } = useEvent(id)
  const { data: myChildren } = useMyChildren()
  const { data: config } = useConfig()
  const { participants, cars, loading: loadingBoard, error } = useEventBoard(id)

  if (isLoading) return <PageSpinner />
  if (!event || !profile) {
    return (
      <div className="card py-12 text-center text-sm text-slate-400">
        Événement introuvable.
        <div className="mt-4">
          <Link to="/planning" className="btn-ghost text-primary">
            Retour au planning
          </Link>
        </div>
      </div>
    )
  }

  const admin = adminMode && isAdmin
  const editable = isEventEditable(event)
  const past = isEventPast(event)
  const hasReturn = !!event.returnTime
  const myCar = cars.find((c) => c.id === profile.uid)
  // Un enfant désactivé par l'admin ne peut plus être inscrit.
  const activeChildren = (myChildren ?? []).filter((c) => c.active)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={admin ? '/admin/evenements' : '/planning'}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {admin ? 'Événements (admin)' : 'Planning'}
        </Link>
        {admin && (
          <div className="flex items-center gap-2">
            <span className="badge inline-flex items-center gap-1 bg-secondary text-white">
              <ShieldCheck className="h-3 w-3" />
              Mode admin
            </span>
            {!past && (
              <button onClick={() => setEditOpen(true)} className="btn-secondary !py-1.5 text-xs">
                <Pencil className="h-3 w-3" />
                Modifier
              </button>
            )}
          </div>
        )}
      </div>

      <header className={`card space-y-2 ${past ? 'opacity-70' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.type} />
          <EventStatusBadge status={event.status} past={past} />
          {!editable && (
            <span className="badge inline-flex items-center gap-1 bg-slate-100 text-slate-500">
              <Lock className="h-3 w-3" />
              Lecture seule
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-secondary">{event.title}</h1>
        <EventSummary event={event} size="md" />
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Impossible de charger le covoiturage : {error.message}
        </p>
      )}

      {loadingBoard ? (
        <PageSpinner />
      ) : (
        <>
          {editable && activeChildren.length === 0 && (
            <MyChildrenBlock
              eventId={event.id}
              uid={profile.uid}
              children={[]}
              participants={participants}
              cars={cars}
              hasReturn={hasReturn}
              editable={editable}
            />
          )}
          {editable && activeChildren.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <MyChildrenBlock
                eventId={event.id}
                uid={profile.uid}
                children={activeChildren}
                participants={participants}
                cars={cars}
                hasReturn={hasReturn}
                editable={editable}
              />
              <MyCarBlock
                eventId={event.id}
                driver={{
                  uid: profile.uid,
                  name: profile.displayName || 'Chauffeur',
                  children: activeChildren,
                }}
                myCar={myCar}
                cars={cars}
                participants={participants}
                hasReturn={hasReturn}
                editable={editable}
              />
            </div>
          )}

          <CarMatrix
            event={event}
            participants={participants}
            cars={cars}
            editable={editable}
            threshold={config?.carWarningThreshold ?? 5}
            canRemoveCar={admin}
          />
        </>
      )}

      {editOpen && <EventFormModal event={event} onClose={() => setEditOpen(false)} />}
    </div>
  )
}
