/**
 * Script de seed — données de test pour les émulateurs Firebase.
 *
 * Prérequis :
 *   1. Lancer les émulateurs :  firebase emulators:start
 *   2. Dans un autre terminal :  npm run seed
 *
 * Le SDK admin contourne les règles Firestore (normal pour un seed).
 * Variables d'env utilisées (valeurs par défaut = émulateurs locaux) :
 *   FIRESTORE_EMULATOR_HOST=localhost:8080
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099'

initializeApp({ projectId: 'handcovoiturage' })
const db = getFirestore()
const auth = getAuth()

/** Crée (ou récupère) un utilisateur Auth + son doc Firestore. */
async function ensureUser({ email, password, displayName, phone, role }) {
  let user
  try {
    user = await auth.createUser({ email, password, displayName })
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      user = await auth.getUserByEmail(email)
    } else throw e
  }
  await db.doc(`users/${user.uid}`).set(
    {
      uid: user.uid,
      email,
      displayName,
      phone: phone ?? '',
      role,
      childId: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  return user.uid
}

function addr(label, street, zipCode, city, parentUid) {
  return {
    id: `${label}-${zipCode}`.toLowerCase().replace(/\s+/g, '-'),
    label,
    street,
    zipCode,
    city,
    parentUid,
  }
}

/** Combine une date (jour) et "HH:mm". */
function at(day, time) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

async function main() {
  console.log('🌱 Seed en cours…')

  // --- Utilisateurs --------------------------------------------------------
  const adminUid = await ensureUser({
    email: 'admin@hand.fr',
    password: 'password123',
    displayName: 'Coach Admin',
    phone: '0600000000',
    role: 'admin',
  })
  const jeanUid = await ensureUser({
    email: 'jean.martin@hand.fr',
    password: 'password123',
    displayName: 'Jean Martin',
    phone: '0612345678',
    role: 'driver',
  })
  const sophieUid = await ensureUser({
    email: 'sophie.petit@hand.fr',
    password: 'password123',
    displayName: 'Sophie Petit',
    phone: '0623456789',
    role: 'driver',
  })
  const lucUid = await ensureUser({
    email: 'luc.bernard@hand.fr',
    password: 'password123',
    displayName: 'Luc Bernard',
    phone: '0634567890',
    role: 'driver',
  })

  // --- Enfants -------------------------------------------------------------
  const children = [
    {
      id: 'child-martin',
      firstName: 'Lucas',
      lastName: 'Martin',
      parentIds: [jeanUid],
      addresses: [addr('Domicile', '12 rue de la Paix', '75001', 'Paris', jeanUid)],
      active: true,
    },
    {
      id: 'child-petit',
      firstName: 'Emma',
      lastName: 'Petit',
      parentIds: [sophieUid],
      addresses: [addr('Domicile', '8 rue des Roses', '75015', 'Paris', sophieUid)],
      active: true,
    },
    {
      id: 'child-bernard',
      firstName: 'Tom',
      lastName: 'Bernard',
      parentIds: [lucUid],
      addresses: [addr('Domicile', '5 av du Parc', '75012', 'Paris', lucUid)],
      active: true,
    },
  ]
  for (const c of children) {
    await db.doc(`children/${c.id}`).set(
      { ...c, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  }
  // Lier chaque parent à son enfant.
  await db.doc(`users/${jeanUid}`).set({ childId: 'child-martin' }, { merge: true })
  await db.doc(`users/${sophieUid}`).set({ childId: 'child-petit' }, { merge: true })
  await db.doc(`users/${lucUid}`).set({ childId: 'child-bernard' }, { merge: true })

  // --- Config --------------------------------------------------------------
  await db.doc('config/app').set(
    {
      season: '2024-2025',
      trainingDays: {
        monday: { active: true, departureTime: '17:15', returnTime: '19:00' },
        friday: { active: true, departureTime: '17:15', returnTime: '19:00' },
      },
      icsUrl: 'https://competition-calendar.ffhandball.fr/c-29681/s-3309.ics',
      schoolHolidays: [],
      reminderHoursBefore: 24,
      brevoApiKey: '',
      emailFrom: 'no-reply@handcovoiturage.fr',
      calendarName: 'HandCovoiturage',
      appUrl: 'http://localhost:5173',
    },
    { merge: true },
  )

  // --- Événements ----------------------------------------------------------
  const today = new Date()
  function dayInDays(n) {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const events = [
    {
      id: 'evt-training-1',
      type: 'training',
      title: 'Entraînement Lundi',
      day: dayInDays(2),
      departure: '17:15',
      ret: '19:00',
      location: { name: 'Gymnase Malraux', address: '15 rue André Malraux', city: 'Paris' },
      source: 'manual',
    },
    {
      id: 'evt-match-1',
      type: 'match',
      title: 'Match vs Saint-Denis',
      day: dayInDays(5),
      departure: '14:00',
      ret: '17:00',
      location: { name: 'Gymnase de Saint-Denis', address: '2 rue Gabriel Péri', city: 'Saint-Denis' },
      source: 'ics_ffhb',
    },
  ]
  for (const e of events) {
    await db.doc(`events/${e.id}`).set({
      type: e.type,
      title: e.title,
      date: Timestamp.fromDate(e.day),
      departureTime: Timestamp.fromDate(at(e.day, e.departure)),
      returnTime: Timestamp.fromDate(at(e.day, e.ret)),
      location: e.location,
      status: 'scheduled',
      source: e.source,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  console.log('✅ Seed terminé.')
  console.log('   Admin : admin@hand.fr / password123')
  console.log('   Parents : jean.martin@hand.fr, sophie.petit@hand.fr, luc.bernard@hand.fr (password123)')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ Seed échoué :', e)
  process.exit(1)
})
