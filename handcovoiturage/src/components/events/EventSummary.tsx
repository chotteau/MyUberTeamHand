import { Clock, MapPin } from 'lucide-react'
import { formatDayMonth, formatTime } from '../../utils/dates'
import type { Event } from '../../types'

/** Bloc date / heures / lieu réutilisé partout (planning, admin, détail). */
export function EventSummary({
  event,
  size = 'sm',
}: {
  event: Pick<Event, 'date' | 'departureTime' | 'returnTime' | 'location'>
  size?: 'sm' | 'md'
}) {
  const icon = size === 'md' ? 'h-4 w-4' : 'h-3 w-3'
  const text = size === 'md' ? 'text-sm' : 'text-xs'
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500 ${text}`}>
      <span className="capitalize">{formatDayMonth(event.date)}</span>
      <span className="flex items-center gap-1">
        <Clock className={icon} />
        {formatTime(event.departureTime)}
        {event.returnTime ? ` → ${formatTime(event.returnTime)}` : ''}
      </span>
      {event.location?.name && (
        <span className="flex items-center gap-1">
          <MapPin className={icon} />
          {event.location.name}
          {event.location.city ? `, ${event.location.city}` : ''}
        </span>
      )}
    </div>
  )
}
