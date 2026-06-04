import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { sendEmail } from './lib/brevo.js'
import {
  assignmentConfirmedEmail,
  scheduleChangeEmail,
} from './lib/templates.js'
import {
  getAppUrl,
  getChild,
  getEvent,
  getParentRecipients,
  getUserName,
} from './lib/data.js'

interface PassengerLite {
  childId: string
  needId?: string
  pickupAddress?: string
}

interface RideLite {
  eventId: string
  offerId: string
  driverUid: string
  direction: 'outbound' | 'return'
  passengers: PassengerLite[]
  status: string
}

const DIRECTION_LABEL: Record<'outbound' | 'return', string> = {
  outbound: 'Aller',
  return: 'Retour',
}

function passengerSet(ride: RideLite | undefined): Map<string, PassengerLite> {
  const m = new Map<string, PassengerLite>()
  ride?.passengers?.forEach((p) => m.set(p.childId, p))
  return m
}

/**
 * Trigger Firestore rides/{rideId} :
 * - création → confirmer aux parents des passagers (hors enfant du chauffeur)
 * - ajout passager → confirmer au parent concerné
 * - retrait passager → prévenir le parent (changement)
 * - statut annulé → prévenir tous les passagers
 */
export const onRideChange = onDocumentWritten(
  { document: 'rides/{rideId}', region: 'europe-west1' },
  async (event) => {
    const before = event.data?.before.data() as RideLite | undefined
    const after = event.data?.after.data() as RideLite | undefined

    // Suppression pure : rien à notifier.
    if (!after) return

    const eventDoc = await getEvent(after.eventId)
    if (!eventDoc) return
    const appUrl = await getAppUrl()
    const eventUrl = `${appUrl}/event/${after.eventId}`
    const driverName = await getUserName(after.driverUid)
    const dateLabel = eventDoc.date
      ? eventDoc.date.toDate().toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : ''
    const directionLabel = DIRECTION_LABEL[after.direction]

    // Annulation du trajet → prévenir tous les passagers (hors chauffeur).
    if (after.status === 'cancelled' && before?.status !== 'cancelled') {
      for (const p of after.passengers) {
        await notifyChange(p.childId, {
          eventTitle: eventDoc.title,
          eventUrl,
          changeLabel: `Le trajet ${directionLabel.toLowerCase()} a été annulé. Déclarez un nouveau besoin.`,
        })
      }
      return
    }

    const beforeSet = passengerSet(before)
    const afterSet = passengerSet(after)

    // Passagers ajoutés (hors enfant du chauffeur).
    for (const [childId, p] of afterSet) {
      if (beforeSet.has(childId)) continue
      if (!p.needId) continue // enfant du chauffeur (pas de need)
      await notifyAssignment(childId, {
        eventTitle: eventDoc.title,
        dateLabel,
        directionLabel,
        driverName,
        pickupAddress: p.pickupAddress ?? '',
        eventUrl,
      })
    }

    // Passagers retirés.
    for (const [childId] of beforeSet) {
      if (afterSet.has(childId)) continue
      await notifyChange(childId, {
        eventTitle: eventDoc.title,
        eventUrl,
        changeLabel: `Retiré du trajet ${directionLabel.toLowerCase()}. Pensez à redéclarer un besoin si nécessaire.`,
      })
    }
  },
)

async function notifyAssignment(
  childId: string,
  ctx: {
    eventTitle: string
    dateLabel: string
    directionLabel: string
    driverName: string
    pickupAddress: string
    eventUrl: string
  },
) {
  const child = await getChild(childId)
  const recipients = await getParentRecipients(childId)
  if (!child || recipients.length === 0) return
  const childName = `${child.firstName} ${child.lastName}`.trim()
  for (const r of recipients) {
    const { subject, html } = assignmentConfirmedEmail({
      parentName: r.name || 'Bonjour',
      childName,
      ...ctx,
    })
    const ok = await sendEmail({ to: [r], subject, htmlContent: html })
    logger.info('Email affectation', { childId, to: r.email, ok })
  }
}

async function notifyChange(
  childId: string,
  ctx: { eventTitle: string; eventUrl: string; changeLabel: string },
) {
  const child = await getChild(childId)
  const recipients = await getParentRecipients(childId)
  if (!child || recipients.length === 0) return
  const childName = `${child.firstName} ${child.lastName}`.trim()
  for (const r of recipients) {
    const { subject, html } = scheduleChangeEmail({
      parentName: r.name || 'Bonjour',
      childName,
      ...ctx,
    })
    const ok = await sendEmail({ to: [r], subject, htmlContent: html })
    logger.info('Email changement', { childId, to: r.email, ok })
  }
}
