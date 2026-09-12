import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { AppConfig } from '../types'

const CONFIG_REF = () => doc(db, 'config', 'app')

/** Génère un token d'abonnement calendrier (URL secrète). */
export function newCalendarToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/** Valeurs par défaut. */
export const DEFAULT_CONFIG: AppConfig = {
  season: '2025-2026',
  seasonStart: Timestamp.fromDate(new Date(2025, 8, 1)),
  seasonEnd: Timestamp.fromDate(new Date(2026, 5, 30)),
  trainingDays: [
    {
      dayOfWeek: 1,
      label: 'Lundi soir',
      departureTime: '17:15',
      returnTime: '19:00',
      location: { name: 'Gymnase', address: '', city: '' },
    },
    {
      dayOfWeek: 5,
      label: 'Vendredi soir',
      departureTime: '17:15',
      returnTime: '19:00',
      location: { name: 'Gymnase', address: '', city: '' },
    },
  ],
  icsUrl: 'https://competition-calendar.ffhandball.fr/c-29681/s-3309.ics',
  calendarName: 'HandCovoiturage',
  calendarToken: '',
  carWarningThreshold: 5,
}

/** Lit la configuration ; les champs absents prennent la valeur par défaut. */
export async function getConfig(): Promise<AppConfig> {
  const snap = await getDoc(CONFIG_REF())
  if (!snap.exists()) return DEFAULT_CONFIG
  const raw = snap.data()
  // Ancienne structure (objet) → on repart sur les jours par défaut.
  const trainingDays = Array.isArray(raw.trainingDays) && raw.trainingDays.length === 2
    ? raw.trainingDays
    : DEFAULT_CONFIG.trainingDays
  return { ...DEFAULT_CONFIG, ...raw, trainingDays } as AppConfig
}

/** Crée ou met à jour la configuration (merge). */
export async function saveConfig(patch: Partial<AppConfig>): Promise<void> {
  await setDoc(
    CONFIG_REF(),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
