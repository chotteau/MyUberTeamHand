import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { db } from './lib/admin.js'
import { runIcsSync, syncIcs } from './syncIcs.js'
import { calendarExport } from './calendarExport.js'

// Cron 24 h : synchronisation des matchs FFHB.
export { syncIcs }
// HTTP : calendrier partagé /api/calendar/{token}.ics
export { calendarExport }

async function assertAdmin(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError('unauthenticated', 'Authentification requise')
  const snap = await db.doc(`users/${uid}`).get()
  if (snap.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Réservé aux administrateurs')
  }
}

/** Callable admin : synchro FFHB immédiate. */
export const triggerIcsSync = onCall({ region: 'europe-west1' }, async (request) => {
  await assertAdmin(request.auth?.uid)
  return await runIcsSync()
})
