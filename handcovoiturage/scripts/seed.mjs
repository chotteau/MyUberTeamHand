/**
 * Script de seed v2 — données de test pour les émulateurs Firebase.
 *
 *   1. firebase emulators:start
 *   2. npm run seed
 *
 * Le SDK admin contourne les règles Firestore (normal pour un seed).
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099'

initializeApp({ projectId: 'myuberteamhand' })
const db = getFirestore()
const auth = getAuth()
const now = FieldValue.serverTimestamp()

async function ensureUser({ email, displayName, role }) {
  let user
  try {
    user = await auth.createUser({ email, password: 'password123', displayName })
  } catch (e) {
    if (e.code === 'auth/email-already-exists') user = await auth.getUserByEmail(email)
    else throw e
  }
  await db.doc(`users/${user.uid}`).set(
    { uid: user.uid, email, displayName, role, createdAt: now, updatedAt: now },
    { merge: true },
  )
  return user.uid
}

const A = (label, street, zipCode, city) => ({ label, street, zipCode, city })
const trip = (kind, a) => ({ kind, ...a })

function dayInDays(n, time) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const [h, m] = time ? time.split(':').map(Number) : [0, 0]
  d.setHours(h, m, 0, 0)
  return Timestamp.fromDate(d)
}

async function main() {
  console.log('🌱 Seed v2 en cours…')

  // --- Comptes -------------------------------------------------------------
  await ensureUser({ email: 'admin@hand.fr', displayName: 'Coach', role: 'admin' })
  const jean = await ensureUser({ email: 'jean@hand.fr', displayName: 'Jean', role: 'parent' })
  const marie = await ensureUser({ email: 'marie@hand.fr', displayName: 'Marie', role: 'parent' })
  const sophie = await ensureUser({ email: 'sophie@hand.fr', displayName: 'Sophie', role: 'parent' })
  const luc = await ensureUser({ email: 'luc@hand.fr', displayName: 'Luc', role: 'parent' })
  const nadia = await ensureUser({ email: 'nadia@hand.fr', displayName: 'Nadia', role: 'parent' })

  // --- Enfants -------------------------------------------------------------
  const children = {
    lucas: {
      firstName: 'Lucas',
      parents: [{ firstName: 'Jean', email: 'jean@hand.fr' }, { firstName: 'Marie', email: 'marie@hand.fr' }],
      addresses: {
        default: A('Chez Papa', '12 rue de la Paix', '75001', 'Paris'),
        secondary: A('Chez Maman', '45 avenue Gambetta', '75020', 'Paris'),
      },
    },
    emma: {
      firstName: 'Emma',
      parents: [{ firstName: 'Sophie', email: 'sophie@hand.fr' }],
      addresses: { default: A('Domicile', '8 rue des Roses', '75015', 'Paris') },
    },
    tom: {
      firstName: 'Tom',
      parents: [{ firstName: 'Luc', email: 'luc@hand.fr' }],
      addresses: { default: A('Domicile', '5 avenue du Parc', '75012', 'Paris') },
    },
    lea: {
      firstName: 'Léa',
      parents: [{ firstName: 'Nadia', email: 'nadia@hand.fr' }],
      addresses: { default: A('Domicile', '3 rue du Moulin', '75011', 'Paris') },
    },
    hugo: {
      firstName: 'Hugo',
      parents: [{ firstName: 'Nadia', email: 'nadia@hand.fr' }],
      addresses: { default: A('Domicile', '3 rue du Moulin', '75011', 'Paris') },
    },
  }
  for (const [id, c] of Object.entries(children)) {
    await db.doc(`children/${id}`).set(
      { ...c, parentEmails: c.parents.map((p) => p.email), active: true, createdAt: now, updatedAt: now },
      { merge: true },
    )
  }

  // --- Config --------------------------------------------------------------
  const y = new Date().getFullYear()
  await db.doc('config/app').set(
    {
      season: `${y}-${y + 1}`,
      seasonStart: Timestamp.fromDate(new Date(y, 8, 1)),
      seasonEnd: Timestamp.fromDate(new Date(y + 1, 5, 30)),
      trainingDays: [
        { dayOfWeek: 1, label: 'Lundi soir', departureTime: '17:15', returnTime: '19:00', location: { name: 'Gymnase Malraux', address: '15 rue André Malraux', city: 'Paris' } },
        { dayOfWeek: 5, label: 'Vendredi soir', departureTime: '17:15', returnTime: '19:00', location: { name: 'Gymnase Malraux', address: '15 rue André Malraux', city: 'Paris' } },
      ],
      icsUrl: 'https://competition-calendar.ffhandball.fr/c-29681/s-3309.ics',
      calendarName: 'HandCovoiturage (test)',
      calendarToken: 'seedtoken123',
      carWarningThreshold: 5,
      updatedAt: now,
    },
    { merge: true },
  )

  // --- Événements ----------------------------------------------------------
  const gym = { name: 'Gymnase Malraux', address: '15 rue André Malraux', city: 'Paris' }
  const events = [
    { id: 'evt-past-1', type: 'training', title: 'Entraînement Lundi', n: -7, dep: '17:15', ret: '19:00', location: gym, source: 'generated' },
    { id: 'evt-past-2', type: 'match', title: 'Match vs Montreuil', n: -3, dep: '14:00', ret: '17:00', location: { name: 'Gymnase de Montreuil', address: '', city: 'Montreuil' }, source: 'ics_ffhb' },
    { id: 'evt-next-1', type: 'training', title: 'Entraînement Lundi', n: 2, dep: '17:15', ret: '19:00', location: gym, source: 'generated' },
    { id: 'evt-next-2', type: 'match', title: 'Match vs Saint-Denis', n: 5, dep: '14:00', ret: '17:00', location: { name: 'Gymnase de Saint-Denis', address: '2 rue Gabriel Péri', city: 'Saint-Denis' }, source: 'ics_ffhb' },
    { id: 'evt-next-3', type: 'training', title: 'Entraînement Vendredi', n: 6, dep: '17:15', ret: '19:00', location: gym, source: 'generated' },
  ]
  for (const e of events) {
    await db.doc(`events/${e.id}`).set({
      type: e.type,
      title: e.title,
      date: dayInDays(e.n),
      departureTime: dayInDays(e.n, e.dep),
      returnTime: dayInDays(e.n, e.ret),
      location: e.location,
      status: 'scheduled',
      source: e.source,
      ...(e.source === 'ics_ffhb' ? { icsUid: `seed-${e.id}` } : {}),
      createdAt: now,
      updatedAt: now,
    })
  }

  // --- Participants + voitures ---------------------------------------------
  const P = (eventId, id, aller, retour, by) =>
    db.doc(`events/${eventId}/participants/${id}`).set({
      childId: id, childName: children[id].firstName, aller, retour, updatedBy: by, updatedAt: now,
    })
  const C = (eventId, uid, name, kids, aller, retour, pa, pr) =>
    db.doc(`events/${eventId}/cars/${uid}`).set({
      driverUid: uid, driverName: name, driverChildIds: kids, aller, retour,
      passengersAller: pa, passengersRetour: pr, updatedAt: now,
    })

  // Passé 1 : Jean emmène + ramène tout le monde ; passé 2 : Sophie aller, Luc retour.
  for (const id of ['lucas', 'emma', 'tom']) await P('evt-past-1', id, trip('default', children[id].addresses.default), trip('default', children[id].addresses.default), jean)
  await C('evt-past-1', jean, 'Jean', ['lucas'], true, true, ['lucas', 'emma', 'tom'], ['lucas', 'emma', 'tom'])
  for (const id of ['lucas', 'emma', 'tom', 'lea']) await P('evt-past-2', id, trip('default', children[id].addresses.default), trip('default', children[id].addresses.default), sophie)
  await C('evt-past-2', sophie, 'Sophie', ['emma'], true, false, ['emma', 'lucas', 'tom', 'lea'], [])
  await C('evt-past-2', luc, 'Luc', ['tom'], false, true, [], ['tom', 'lucas', 'emma', 'lea'])

  // À venir 1 : 4 inscrits, 2 voitures, Hugo sans voiture à l'aller, Lucas chez Maman au retour.
  await P('evt-next-1', 'lucas', trip('default', children.lucas.addresses.default), trip('secondary', children.lucas.addresses.secondary), jean)
  await P('evt-next-1', 'emma', trip('default', children.emma.addresses.default), trip('default', children.emma.addresses.default), sophie)
  await P('evt-next-1', 'lea', trip('default', children.lea.addresses.default), null, nadia)
  await P('evt-next-1', 'hugo', trip('custom', A('Autre', '20 rue de Lyon', '75012', 'Paris')), trip('default', children.hugo.addresses.default), nadia)
  await C('evt-next-1', jean, 'Jean', ['lucas'], true, true, ['lucas', 'emma'], ['lucas', 'emma', 'hugo'])
  await C('evt-next-1', sophie, 'Sophie', ['emma'], true, false, ['lea'], [])
  void marie

  console.log('✅ Seed terminé.')
  console.log('   Admin   : admin@hand.fr / password123')
  console.log('   Parents : jean@, marie@, sophie@, luc@, nadia@ hand.fr / password123')
  console.log('   Calendrier : http://localhost:5000/api/calendar/seedtoken123.ics')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ Seed échoué :', e)
  process.exit(1)
})
