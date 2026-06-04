import { Link } from 'react-router-dom'
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import {
  EventStatusBadge,
  EventTypeBadge,
} from '../components/ui/StatusBadge'
import { Spinner } from '../components/ui/Spinner'
import { formatDate, formatTime, formatRelativeDate } from '../utils/dates'
import type { Event } from '../types'

export default function Planning() {
  const { data: events, isLoading } = useEvents()

  const visible = (events ?? []).filter((e) => e.status !== 'cancelled')

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
        <Calendar className="h-5 w-5 text-primary" />
        Planning
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">
          Aucun événement à venir pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link
      to={`/event/${event.id}`}
      className="card flex items-center gap-3 !p-3 transition hover:border-primary hover:shadow-sm"
    >
      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary-50 py-2 text-primary-700">
        <span className="text-xs font-medium uppercase">
          {formatDate(event.date, 'MMM')}
        </span>
        <span className="text-xl font-bold leading-none">
          {formatDate(event.date, 'd')}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.type} />
          <EventStatusBadge status={event.status} />
        </div>
        <div className="truncate font-medium text-secondary">
          {event.title}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="capitalize">{formatRelativeDate(event.date)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(event.departureTime)}
          </span>
          {event.location.name && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.location.name}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
    </Link>
  )
}
