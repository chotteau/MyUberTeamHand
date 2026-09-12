import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createChild,
  listChildren,
  listMyChildren,
  setChildActive,
  updateChild,
  updateChildAddresses,
  type ChildInput,
} from '../services/children'
import { useAuth } from './useAuth'
import type { ChildAddresses } from '../types'

export const CHILDREN_KEY = ['children']

/** Tous les enfants (admin et matrice). */
export function useChildren() {
  return useQuery({ queryKey: CHILDREN_KEY, queryFn: listChildren })
}

/** Mes enfants — liaison par l'email du compte. */
export function useMyChildren() {
  const { profile } = useAuth()
  const email = profile?.email ?? ''
  return useQuery({
    queryKey: [...CHILDREN_KEY, 'mine', email],
    queryFn: () => listMyChildren(email),
    enabled: !!email,
  })
}

function useInvalidateChildren() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: CHILDREN_KEY })
}

export function useSaveChild() {
  const invalidate = useInvalidateChildren()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ChildInput }) =>
      id ? updateChild(id, input).then(() => id) : createChild(input),
    onSuccess: invalidate,
  })
}

export function useSaveChildAddresses() {
  const invalidate = useInvalidateChildren()
  return useMutation({
    mutationFn: ({ id, addresses }: { id: string; addresses: ChildAddresses }) =>
      updateChildAddresses(id, addresses),
    onSuccess: invalidate,
  })
}

export function useToggleChildActive() {
  const invalidate = useInvalidateChildren()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setChildActive(id, active),
    onSuccess: invalidate,
  })
}
