import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listChildren, setChildActive } from '../services/children'

const CHILDREN_KEY = ['children']

/** Liste tous les enfants. */
export function useChildren() {
  return useQuery({
    queryKey: CHILDREN_KEY,
    queryFn: listChildren,
  })
}

/** Active / désactive un enfant. */
export function useToggleChildActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setChildActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHILDREN_KEY }),
  })
}
