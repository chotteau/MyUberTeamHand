import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export interface IcsSyncResult {
  created: number
  updated: number
  cancelled: number
}

/**
 * Déclenche la synchronisation ICS FFHB côté serveur (Cloud Function callable).
 * Le fetch du flux est fait par la fonction (le navigateur serait bloqué par
 * CORS, et l'écriture des events est réservée aux admins).
 */
export async function triggerIcsSync(): Promise<IcsSyncResult> {
  const call = httpsCallable<unknown, IcsSyncResult>(functions, 'triggerIcsSync')
  const res = await call()
  return res.data
}
