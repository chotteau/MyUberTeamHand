import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { db } from './lib/admin.js'
import { runIcsSync, syncIcs } from './syncIcs.js'
import { onRideChange } from './onRideChange.js'
import { sendReminders } from './sendReminders.js'
import { calendarExport } from './calendarExport.js'

// Cron de synchronisation ICS FFHB (toutes les 24h).
export { syncIcs }
// Trigger Firestore : notifications d'affectation / changement de trajet.
export { onRideChange }
// Cron quotidien 18h : rappels J-1.
export { sendReminders }
// HTTP : export ICS public des trajets.
export { calendarExport }

/** Vérifie que l'appelant est un admin authentifié. */
async function assertAdmin(uid: string | undefined): Promise<void> {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise')
  }
  const userSnap = await db.doc(`users/${uid}`).get()
  if (userSnap.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Réservé aux administrateurs')
  }
}

/** Callable : déclenche une synchro ICS à la demande (bouton admin). */
export const triggerIcsSync = onCall(
  { region: 'europe-west1' },
  async (request) => {
    await assertAdmin(request.auth?.uid)
    return await runIcsSync()
  },
)
