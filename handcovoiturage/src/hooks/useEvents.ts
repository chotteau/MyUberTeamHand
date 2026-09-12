import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addWeeks, startOfDay } from 'date-fns'
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  setEventStatus,
  updateEvent,
} from '../services/events'
import { getBoard, summarizeDirection } from '../services/board'
import type { Event, EventStatus } from '../types'

export const EVENTS_KEY = ['events']

export type EventsRange = 'two-weeks' | 'season' | 'past'

/**
 * Événements selon la fenêtre : 2 semaines glissantes (défaut), toute la
 * saison à venir, ou les 4 dernières semaines (passés).
 */
export function useEvents(range: EventsRange = 'two-weeks') {
  const today = startOfDay(new Date())
  return useQuery({
    queryKey: [...EVENTS_KEY, range, today.toISOString()],
    queryFn: () => {
      if (range === 'two-weeks') return listEvents(today, addWeeks(today, 2))
      if (range === 'past') return listEvents(addWeeks(today, -4), today)
      return listEvents(today)
    },
  })
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: [...EVENTS_KEY, id],
    queryFn: () => (id ? getEvent(id) : null),
    enabled: !!id,
  })
}

/** Résumé aller / retour d'un événement (compteurs dérivés). */
export function useEventSummary(eventId: string) {
  return useQuery({
    queryKey: [...EVENTS_KEY, eventId, 'summary'],
    queryFn: async () => {
      const board = await getBoard(eventId)
      return {
        board,
        aller: summarizeDirection(board, 'aller'),
        retour: summarizeDirection(board, 'retour'),
      }
    },
    staleTime: 15_000,
  })
}

function useInvalidateEvents() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: EVENTS_KEY })
}

export function useCreateEvent() {
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: (data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => createEvent(data),
    onSuccess: invalidate,
  })
}

export function useUpdateEvent() {
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Event> }) =>
      updateEvent(id, patch),
    onSuccess: invalidate,
  })
}

export function useSetEventStatus() {
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventStatus }) =>
      setEventStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidateEvents()
  return useMutation({ mutationFn: deleteEvent, onSuccess: invalidate })
}
