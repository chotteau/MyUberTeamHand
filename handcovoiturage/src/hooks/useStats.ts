import { useQuery } from '@tanstack/react-query'
import { getStats } from '../services/stats'
import { STATS_KEY, useChildren } from './useChildren'

/** Statistiques de la saison (vue unique). */
export function useStats() {
  const { data: children } = useChildren()
  return useQuery({
    queryKey: [...STATS_KEY, 'season'],
    queryFn: () => getStats(children ?? []),
    enabled: !!children,
    staleTime: 60_000,
  })
}
