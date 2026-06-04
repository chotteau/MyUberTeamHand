import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { AppConfig, TrainingDay } from '../types'

const CONFIG_REF = () => doc(db, 'config', 'app')

/** Valeurs par défaut à la première initialisation. */
export const DEFAULT_CONFIG: Omit<AppConfig, 'icsLastSync'> = {
  season: '2024-2025',
  seasonStart: Timestamp.fromDate(new Date('2024-09-01')),
  seasonEnd: Timestamp.fromDate(new Date('2025-06-30')),
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
  reminderHoursBefore: 24,
  brevoApiKey: '',
  emailFrom: '',
  calendarName: 'HandCovoiturage',
}

// ---------------------------------------------------------------------------
// Migration de l'ancienne structure vers la nouvelle
// ---------------------------------------------------------------------------

const OLD_DAY_OF_WEEK: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}
const OLD_DAY_LABEL: Record<string, string> = {
  monday: 'Lundi soir', tuesday: 'Mardi soir', wednesday: 'Mercredi soir',
  thursday: 'Jeudi soir', friday: 'Vendredi soir',
  saturday: 'Samedi', sunday: 'Dimanche',
}

/**
 * Normalise la config lue depuis Firestore.
 * Gère la migration de l'ancienne structure trainingDays (objet) vers la
 * nouvelle (tableau) et ajoute les champs manquants avec des valeurs par défaut.
 */
function normalizeConfig(raw: Record<string, unknown>): AppConfig {
  const cfg = { ...raw } as Record<string, unknown>

  // Migration trainingDays : objet → tableau
  if (cfg.trainingDays && !Array.isArray(cfg.trainingDays)) {
    const old = cfg.trainingDays as Record<
      string,
      { active?: boolean; departureTime: string; returnTime: string }
    >
    cfg.trainingDays = Object.entries(old)
      .filter(([, v]) => v.active !== false)
      .map(([key, v]): TrainingDay => ({
        dayOfWeek: OLD_DAY_OF_WEEK[key] ?? 1,
        label: OLD_DAY_LABEL[key] ?? key,
        departureTime: v.departureTime ?? '17:15',
        returnTime: v.returnTime ?? '19:00',
        location: { name: 'Gymnase', address: '', city: '' },
      }))
  }

  // Garantir au moins 2 entrées
  if (!Array.isArray(cfg.trainingDays) || cfg.trainingDays.length === 0) {
    cfg.trainingDays = DEFAULT_CONFIG.trainingDays
  }

  // Ajouter seasonStart / seasonEnd si absents
  if (!cfg.seasonStart) cfg.seasonStart = DEFAULT_CONFIG.seasonStart
  if (!cfg.seasonEnd)   cfg.seasonEnd   = DEFAULT_CONFIG.seasonEnd

  // Supprimer les champs obsolètes
  delete cfg.schoolHolidays

  return cfg as unknown as AppConfig
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Lit la configuration (one-shot). Retourne null si pas encore créée. */
export async function getConfig(): Promise<AppConfig | null> {
  const snap = await getDoc(CONFIG_REF())
  if (!snap.exists()) return null
  return normalizeConfig(snap.data() as Record<string, unknown>)
}

/** Crée ou met à jour la configuration (merge). */
export async function saveConfig(patch: Partial<AppConfig>): Promise<void> {
  await setDoc(
    CONFIG_REF(),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** Initialise la config avec les valeurs par défaut si absente. */
export async function ensureConfig(): Promise<AppConfig> {
  const existing = await getConfig()
  if (existing) return existing
  await saveConfig(DEFAULT_CONFIG)
  return DEFAULT_CONFIG as AppConfig
}
