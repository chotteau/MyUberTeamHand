import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight } from 'lucide-react'
import { useEvents, useEventSummary, type EventsRange } from '../hooks/useEvents'
import { useMyChildren } from '../hooks/useChildren'
import { EventSummary } from '../components/events/EventSummary'
import { EventStatusBadge, EventTypeBadge } from '../components/ui/StatusBadge'
import { PageSpinner } from '../components/ui/Spinner'
import { formatDate, isEventPast } from '../utils/dates'
import type { Child, Event } from '../types'

export default function Planning() {
  const [range, setRange] = useState<EventsRange>('upcoming')
  const { data: events, isLoading } = useEvents(range)
  const { data: myChildren } = useMyChildren()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
          <Calendar className="h-5 w-5 text-primary" />
          Planning
        </h1>
        <button
          onClick={() => setRange(range === 'upcoming' ? 'season' : 'upcoming')}
          className="btn-ghost text-xs text-primary"
        >
          {range === 'upcoming' ? 'Voir toute la saison' : 'Voir 4 semaines'}
        </button>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : !events || events.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">
          Aucun événement sur cette période.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} myChildren={myChildren ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventCard({ event, myChildren }: { event: Event; myChildren: Child[] }) {
  const past = isEventPast(event)
  const inactive = past || event.status !== 'scheduled'
  return (
    <Link
      to={`/event/${event.id}`}
      className={`card flex items-center gap-3 !p-3 transition hover:border-primary hover:shadow-sm ${
        inactive ? 'opacity-60' : ''
      }`}
    >
      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary-50 py-2 text-primary-700">
        <span className="text-xs font-medium uppercase">{formatDate(event.date, 'MMM')}</span>
        <span className="text-xl font-bold leading-none">{formatDate(event.date, 'd')}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.type} />
          <EventStatusBadge status={event.status} past={past} />
        </div>
        <div className="truncate font-medium text-secondary">{event.title}</div>
        <EventSummary event={event} />
        {!inactive && <EventStatusLine event={event} myChildren={myChildren} />}
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
    </Link>
  )
}

/** Résumé : « Lucas : aller ✔ retour ✔ · 3 voitures · 1 sans voiture ». */
function EventStatusLine({ event, myChildren }: { event: Event; myChildren: Child[] }) {
  const { data } = useEventSummary(event.id)
  if (!data) return null

  const mine = myChildren.map((c) => {
    const p = data.board.participants.find((x) => x.childId === c.id)
    if (!p) return `${c.firstName} : à déclarer`
    const parts = [p.aller ? 'aller ✔' : null, event.returnTime ? (p.retour ? 'retour ✔' : null) : null]
      .filter(Boolean)
      .join(' ')
    return `${c.firstName} : ${parts || 'absent'}`
  })

  const cars = Math.max(data.aller.cars, data.retour.cars)
  const without = data.aller.withoutCar + data.retour.withoutCar
  const tone = without > 0 || (cars === 0 && data.aller.present + data.retour.present > 0)
    ? 'text-amber-700'
    : 'text-slate-500'

  return (
    <div className={`mt-1 flex flex-wrap gap-x-3 text-xs ${tone}`}>
      {mine.map((m) => (
        <span key={m} className="font-medium">
          {m}
        </span>
      ))}
      <span>
        {cars} voiture{cars > 1 ? 's' : ''}
        {without > 0 ? ` · ${without} sans voiture` : ''}
      </span>
    </div>
  )
}
