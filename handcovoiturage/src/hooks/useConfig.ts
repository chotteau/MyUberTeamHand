import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ensureConfig, saveConfig } from '../services/config'
import type { AppConfig } from '../types'

const CONFIG_KEY = ['config', 'app']

/** Lit la configuration (créée avec valeurs par défaut si absente). */
export function useConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: ensureConfig,
    staleTime: 60_000,
  })
}

/** Mutation d'enregistrement de la configuration. */
export function useSaveConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<AppConfig>) => saveConfig(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONFIG_KEY }),
  })
}
