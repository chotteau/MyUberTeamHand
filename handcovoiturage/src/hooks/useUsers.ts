import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listUsers, setUserActive } from '../services/users'
import { purgeDriverFromUpcomingEvents } from '../services/board'
import { EVENTS_KEY } from './useEvents'

const USERS_KEY = ['users']

/** Liste des comptes (admin). */
export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: listUsers })
}

/** Désactiver un parent retire aussi sa voiture des événements à venir. */
export function useToggleUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ uid, active }: { uid: string; active: boolean }) => {
      await setUserActive(uid, active)
      // La liste reflète le statut tout de suite ; le nettoyage continue derrière.
      qc.invalidateQueries({ queryKey: USERS_KEY })
      return active ? 0 : purgeDriverFromUpcomingEvents(uid)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_KEY })
      qc.invalidateQueries({ queryKey: EVENTS_KEY })
    },
  })
}
