import { useQuery } from '@tanstack/react-query'
import { getStats } from '../services/stats'

/** Statistiques de covoiturage agrégées sur la saison complète. */
export function useStats() {
  return useQuery({
    queryKey: ['stats', 'season'],
    queryFn: () => getStats(),
  })
}
