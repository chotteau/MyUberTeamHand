import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getConfig, saveConfig } from '../services/config'
import type { AppConfig } from '../types'

const CONFIG_KEY = ['config', 'app']

/** Configuration (lisible par tous les authentifiés). */
export function useConfig() {
  return useQuery({ queryKey: CONFIG_KEY, queryFn: getConfig, staleTime: 60_000 })
}

export function useSaveConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<AppConfig>) => saveConfig(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONFIG_KEY }),
  })
}
