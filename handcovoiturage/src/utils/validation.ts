import { z } from 'zod'

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
  season: z.string().min(4, 'Saison requise (ex: 2025-2026)'),
  trainingDays: z
    .array(trainingDaySchema)
    .length(2, "Exactement 2 jours d'entraînement requis"),
  icsUrl: z.string().url('URL ICS invalide').or(z.literal('')),
  calendarName: z.string().min(1, 'Nom du calendrier requis'),
  carWarningThreshold: z.coerce.number().int().min(2).max(9),
})

export const addressSchema = z.object({
  label: z.string().min(1, 'Libellé requis'),
  street: z.string().min(1, 'Rue requise'),
  zipCode: z.string().min(1, 'Code postal requis'),
  city: z.string().min(1, 'Ville requise'),
})

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email invalide')

/**
 * Ligne d'un CSV d'import des familles (séparateur ';').
 * Sans nom de famille, sans téléphone, sans capacité voiture.
 * parent2 / adresse2 optionnels (monoparental, ou parents même toit).
 */
export const csvFamilyRowSchema = z.object({
  prenom_enfant: z.string().trim().min(1, 'Prénom enfant requis'),
  prenom_parent1: z.string().trim().min(1, 'Prénom parent 1 requis'),
  email_parent1: emailSchema,
  adresse1_rue: z.string().trim().min(1, 'Adresse 1 requise'),
  adresse1_cp: z.string().trim().min(1, 'Code postal 1 requis'),
  adresse1_ville: z.string().trim().min(1, 'Ville 1 requise'),
  label_adresse1: z.string().trim().optional().default(''),
  prenom_parent2: z.string().trim().optional().default(''),
  email_parent2: emailSchema.or(z.literal('')).optional().default(''),
  adresse2_rue: z.string().trim().optional().default(''),
  adresse2_cp: z.string().trim().optional().default(''),
  adresse2_ville: z.string().trim().optional().default(''),
  label_adresse2: z.string().trim().optional().default(''),
})

export type CsvFamilyRow = z.infer<typeof csvFamilyRowSchema>
