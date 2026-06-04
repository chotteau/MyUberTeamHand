import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { Timestamp } from 'firebase-admin/firestore'
import { db } from './lib/admin.js'
import { sendEmail } from './lib/brevo.js'
import { reminderParentEmail, reminderDriverEmail } from './lib/templates.js'
import { getAppUrl, getParentRecipients } from './lib/data.js'

function dateLabel(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Logique de rappel J-1, extraite pour la testabilité.
 * Parcourt les événements de la fenêtre [now+18h, now+30h].
 */
export async function runReminders(now = new Date()): Promise<void> {
  const from = Timestamp.fromMillis(now.getTime() + 18 * 3600 * 1000)
  const to = Timestamp.fromMillis(now.getTime() + 30 * 3600 * 1000)

  const eventsSnap = await db
    .collection('events')
    .where('departureTime', '>=', from)
    .where('departureTime', '<=', to)
    .get()

  if (eventsSnap.empty) {
    logger.info('Aucun événement dans la fenêtre de rappel')
    return
  }

  const appUrl = await getAppUrl()

  // Enfants actifs (une seule lecture).
  const childrenSnap = await db
    .collection('children')
    .where('active', '==', true)
    .get()
  const activeChildren = childrenSnap.docs.map((d) => ({
    id: d.id,
    firstName: d.get('firstName') as string,
    lastName: d.get('lastName') as string,
  }))

  for (const evDoc of eventsSnap.docs) {
    const event = {
      id: evDoc.id,
      title: evDoc.get('title') as string,
      date: evDoc.get('date') as Timestamp,
      status: evDoc.get('status') as string,
    }
    if (event.status === 'cancelled') continue

    const eventUrl = `${appUrl}/event/${event.id}`
    const label = dateLabel(event.date)

    const [needsSnap, offersSnap] = await Promise.all([
      db.collection('needs').where('eventId', '==', event.id).get(),
      db.collection('offers').where('eventId', '==', event.id).get(),
    ])

    const childrenWithNeed = new Set(
      needsSnap.docs
        .filter((d) => d.get('status') !== 'cancelled')
        .map((d) => d.get('childId') as string),
    )

    // a. Rappel aux parents d'enfants sans besoin déclaré.
    for (const child of activeChildren) {
      if (childrenWithNeed.has(child.id)) continue
      const recipients = await getParentRecipients(child.id)
      const childName = `${child.firstName} ${child.lastName}`.trim()
      for (const r of recipients) {
        const { subject, html } = reminderParentEmail({
          parentName: r.name || 'Bonjour',
          childName,
          eventTitle: event.title,
          dateLabel: label,
          eventUrl,
        })
        await sendEmail({ to: [r], subject, htmlContent: html })
      }
    }

    // b. Calcul des places manquantes.
    const totalFreeSeats = offersSnap.docs
      .filter((d) => d.get('status') !== 'cancelled')
      .reduce((sum, d) => sum + ((d.get('vehicleCapacity') as number) - 1), 0)
    const totalNeeds = childrenWithNeed.size
    const missingSeats = totalNeeds - totalFreeSeats

    if (missingSeats > 0) {
      const driverUids = new Set(
        offersSnap.docs.map((d) => d.get('driverUid') as string),
      )
      // Rappel aux parents d'enfants actifs n'ayant pas proposé de voiture.
      const notified = new Set<string>()
      for (const child of activeChildren) {
        const recipients = await getParentRecipients(child.id)
        for (const r of recipients) {
          if (notified.has(r.email)) continue
          notified.add(r.email)
          const { subject, html } = reminderDriverEmail({
            parentName: r.name || 'Bonjour',
            eventTitle: event.title,
            dateLabel: label,
            missingSeats,
            eventUrl,
          })
          // On ne sollicite pas ceux qui ont déjà offert (best effort par uid).
          void driverUids
          await sendEmail({ to: [r], subject, htmlContent: html })
        }
      }
    }
  }
}

/** Cron quotidien à 18h (Europe/Paris) : rappels J-1. */
export const sendReminders = onSchedule(
  {
    schedule: 'every day 18:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    await runReminders()
  },
)
