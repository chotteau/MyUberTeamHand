import { z } from 'zod'

/** Heure au format "HH:mm". */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (HH:mm)')

const eventLocationSchema = z.object({
  name: z.string().min(1, 'Nom du lieu requis'),
  address: z.string().default(''),
  city: z.string().default(''),
})

const trainingDaySchema = z.object({
  dayOfWeek: z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3),
    z.literal(4), z.literal(5), z.literal(6),
  ]),
  label: z.string().min(1, 'Libellé requis'),
  departureTime: timeSchema,
  returnTime: timeSchema,
  location: eventLocationSchema,
})

export const configFormSchema = z.object({
  season: z.string().min(4, 'Saison requise (ex: 2024-2025)'),
  // Les dates de saison sont validées en dehors de ce schéma (Timestamp Firestore)
  trainingDays: z.array(trainingDaySchema).length(2, 'Exactement 2 jours d\'entraînement requis'),
  icsUrl: z.string().url('URL ICS invalide').or(z.literal('')),
  reminderHoursBefore: z.coerce.number().int().min(1).max(72),
  brevoApiKey: z.string().optional().default(''),
  emailFrom: z.string().email('Email expéditeur invalide').or(z.literal('')),
  calendarName: z.string().min(1, 'Nom du calendrier requis'),
})

export type ConfigFormValues = z.infer<typeof configFormSchema>

/**
 * Ligne brute d'un CSV d'import des familles (séparateur ';').
 * Format v2 : sans nom de famille, sans téléphone, sans capacité voiture.
 * Les champs parent2 / adresse2 sont entièrement optionnels (monoparental supporté).
 * Adresse2 vide = les 2 parents vivent à la même adresse (adresse1 partagée).
 */
export const csvFamilyRowSchema = z.object({
  prenom_enfant: z.string().min(1, 'Prénom enfant requis'),
  prenom_parent1: z.string().min(1, 'Prénom parent 1 requis'),
  email_parent1: z.string().email('Email parent 1 invalide'),
  adresse1_rue: z.string().min(1, 'Adresse 1 requise'),
  adresse1_cp: z.string().min(1, 'Code postal 1 requis'),
  adresse1_ville: z.string().min(1, 'Ville 1 requise'),
  label_adresse1: z.string().optional().default('Domicile'),
  prenom_parent2: z.string().optional().default(''),
  email_parent2: z.string().email().or(z.literal('')).optional().default(''),
  adresse2_rue: z.string().optional().default(''),
  adresse2_cp: z.string().optional().default(''),
  adresse2_ville: z.string().optional().default(''),
  label_adresse2: z.string().optional().default(''),
})

export type CsvFamilyRow = z.infer<typeof csvFamilyRowSchema>
