import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listUsers, setUserActive } from '../services/users'

const USERS_KEY = ['users']

/** Liste des comptes (admin). */
export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: listUsers })
}

export function useToggleUserActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uid, active }: { uid: string; active: boolean }) => setUserActive(uid, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}
