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

const opts = { region: 'europe-west1', maxInstances: 5 } as const

/** Callable admin : synchro FFHB immédiate. */
export const triggerIcsSync = onCall(opts, async (request) => {
  await assertAdmin(request.auth?.uid)
  return await runIcsSync()
})

/**
 * Callable publique : l'email est-il déclaré comme parent d'un enfant ?
 * Sert à refuser la création de compte d'un email inconnu, sans exposer la liste.
 */
export const isEmailDeclared = onCall(opts, async (request) => {
  const email = String((request.data as { email?: string })?.email ?? '').trim().toLowerCase()
  if (!email) return { declared: false }
  const snap = await db
    .collection('children')
    .where('parentEmails', 'array-contains', email)
    .limit(1)
    .get()
  return { declared: !snap.empty }
})
