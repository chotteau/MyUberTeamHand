import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  MapPin,
  HandHelping,
  Car,
  Lock,
} from 'lucide-react'
import { useEvent } from '../hooks/useEvents'
import { useChildren } from '../hooks/useChildren'
import { useEventBoard } from '../hooks/useEventBoard'
import { useAuth } from '../hooks/useAuth'
import { RideBoard } from '../components/rides/RideBoard'
import { NeedFormModal } from '../components/rides/NeedFormModal'
import { OfferFormModal } from '../components/rides/OfferFormModal'
import {
  EventStatusBadge,
  EventTypeBadge,
} from '../components/ui/StatusBadge'
import { Spinner } from '../components/ui/Spinner'
import { formatDayMonth, formatTime, isEventEditable } from '../utils/dates'
import type { Child, RideDirection } from '../types'

export default function EventDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data: event, isLoading: loadingEvent } = useEvent(id)
  const { data: children } = useChildren()
  const { needs, offers, rides, loading: loadingBoard } = useEventBoard(id)

  const [tab, setTab] = useState<RideDirection>('outbound')
  const [needOpen, setNeedOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)

  const childById = useMemo(() => {
    const m = new Map<string, Child>()
    ;(children ?? []).forEach((c) => m.set(c.id, c))
    return m
  }, [children])

  const myChild = profile?.childId
    ? childById.get(profile.childId)
    : undefined

  if (loadingEvent) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (!event) {
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

  const editable = isEventEditable(event)
  const hasReturn = !!event.returnTime

  return (
    <div className="space-y-6">
      <Link
        to="/planning"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Planning
      </Link>

      {/* En-tête événement */}
      <header className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.type} />
          <EventStatusBadge status={event.status} />
          {!editable && (
            <span className="badge inline-flex items-center gap-1 bg-slate-100 text-slate-500">
              <Lock className="h-3 w-3" />
              Modifications fermées
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-secondary">{event.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="capitalize">{formatDayMonth(event.date)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatTime(event.departureTime)}
            {event.returnTime ? ` → ${formatTime(event.returnTime)}` : ''}
          </span>
          {event.location.name && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.location.name}
              {event.location.city ? `, ${event.location.city}` : ''}
            </span>
          )}
        </div>
      </header>

      {/* Actions de déclaration */}
      {editable && myChild && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setNeedOpen(true)} className="btn-secondary">
            <HandHelping className="h-4 w-4" />
            Déclarer un besoin
          </button>
          <button onClick={() => setOfferOpen(true)} className="btn-primary">
            <Car className="h-4 w-4" />
            Proposer ma voiture
          </button>
        </div>
      )}
      {editable && !myChild && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Aucun enfant n'est rattaché à votre compte. Contactez un
          administrateur pour participer au covoiturage.
        </p>
      )}

      {/* Onglets direction */}
      {hasReturn && (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['outbound', 'return'] as RideDirection[]).map((d) => (
            <button
              key={d}
              onClick={() => setTab(d)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                tab === d
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {d === 'outbound' ? 'Aller' : 'Retour'}
            </button>
          ))}
        </div>
      )}

      {/* Tableau collaboratif */}
      {loadingBoard ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <RideBoard
          eventId={event.id}
          direction={hasReturn ? tab : 'outbound'}
          needs={needs}
          offers={offers}
          rides={rides}
          childById={childById}
          editable={editable}
        />
      )}

      {/* Modales */}
      {myChild && (
        <>
          <NeedFormModal
            open={needOpen}
            onClose={() => setNeedOpen(false)}
            eventId={event.id}
            child={myChild}
            declaredByUid={profile!.uid}
            allowReturn={hasReturn}
          />
          <OfferFormModal
            open={offerOpen}
            onClose={() => setOfferOpen(false)}
            eventId={event.id}
            child={myChild}
            driverUid={profile!.uid}
            allowReturn={hasReturn}
          />
        </>
      )}
    </div>
  )
}
