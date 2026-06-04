import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  setEventStatus,
  updateEvent,
} from '../services/events'
import type { Event, EventStatus } from '../types'

const EVENTS_KEY = ['events']

/** Liste les événements à venir (par défaut depuis aujourd'hui). */
export function useEvents(fromDate?: Date) {
  return useQuery({
    queryKey: [...EVENTS_KEY, fromDate?.toISOString() ?? 'now'],
    queryFn: () => listEvents(fromDate),
  })
}

/** Récupère un événement par id. */
export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: [...EVENTS_KEY, id],
    queryFn: () => (id ? getEvent(id) : null),
    enabled: !!id,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) =>
      createEvent(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: EVENTS_KEY }),
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Event> }) =>
      updateEvent(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: EVENTS_KEY }),
  })
}

export function useSetEventStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) =>
      setEventStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: EVENTS_KEY }),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: EVENTS_KEY }),
  })
}
