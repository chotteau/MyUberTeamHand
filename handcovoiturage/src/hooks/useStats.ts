import { useQuery } from '@tanstack/react-query'
import { getStats } from '../services/stats'
import { useChildren } from './useChildren'

/** Statistiques de la saison (vue unique). */
export function useStats() {
  const { data: children } = useChildren()
  return useQuery({
    queryKey: ['stats', 'season', children?.length ?? 0],
    queryFn: () => getStats(children ?? []),
    enabled: !!children,
    staleTime: 60_000,
  })
}
