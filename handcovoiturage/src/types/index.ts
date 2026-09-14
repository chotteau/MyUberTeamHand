import type { Timestamp } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Énumérations & alias
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'parent'
/** Direction d'un trajet. Aller et retour sont indépendants. */
export type Direction = 'aller' | 'retour'
export const DIRECTIONS: Direction[] = ['aller', 'retour']
export type EventType = 'training' | 'match'
/**
 * 'cancelled' → annulé (raison quelconque)
 * 'vacances'  → annulé car vacances scolaires
 * Un événement passé n'a pas de statut : il est dérivé (departureTime < now).
 */
export type EventStatus = 'scheduled' | 'cancelled' | 'vacances'
export type EventSource = 'manual' | 'ics_ffhb' | 'generated'
/** 'custom' = adresse saisie à la main pour ce trajet, non enregistrée sur la fiche. */
export type TripAddressKind = 'default' | 'secondary' | 'custom'

// ---------------------------------------------------------------------------
// Sous-objets
// ---------------------------------------------------------------------------

export interface Address {
  label: string // "Chez Papa", "Domicile"…
  street: string
  zipCode: string
  city: string
}

/** Adresse snapshotée sur une participation à un trajet. */
export interface TripAddress extends Address {
  kind: TripAddressKind
}

export interface EventLocation {
  name: string
  address: string
  city: string
}

export interface ChildParent {
  firstName: string
  email: string // minuscules
}

export interface ChildAddresses {
  default: Address
  secondary?: Address
}

/** Un jour d'entraînement configurable (exactement 2 dans config.trainingDays). */
export interface TrainingDay {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // getDay() : 0 = dimanche
  label: string
  departureTime: string // "HH:mm"
  returnTime: string // "HH:mm"
  location: EventLocation
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface User {
  uid: string
  email: string
  displayName: string // prénom seul
  role: Role
  active: boolean // false → compte désactivé par l'admin (plus d'accès à l'app)
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Child {
  id: string
  firstName: string // "Lucas" ou "Lucas M" — jamais de nom de famille
  parents: ChildParent[] // 1 ou 2
  parentEmails: string[] // dérivé — règles + requêtes
  addresses: ChildAddresses
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Event {
  id: string
  type: EventType
  title: string
  date: Timestamp
  departureTime: Timestamp
  returnTime?: Timestamp
  location: EventLocation
  status: EventStatus
  source: EventSource
  icsUid?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** events/{eventId}/participants/{childId} */
export interface Participant {
  childId: string
  childName: string
  aller: TripAddress | null
  retour: TripAddress | null
  /** Commentaire libre du parent (info globale, pas lié à une direction), repris en fin d'invitation ICS. */
  note?: string
  /** Première inscription (ordre d'embarquement automatique). Absent avant le 14/09/2026 → updatedAt. */
  registeredAt?: Timestamp
  updatedBy: string
  updatedAt: Timestamp
}

/** events/{eventId}/cars/{driverUid} */
export interface Car {
  id: string // = driverUid
  driverUid: string
  driverName: string
  driverChildIds: string[]
  aller: boolean
  retour: boolean
  passengersAller: string[]
  passengersRetour: string[]
  /** Places disponibles pour les enfants (hors chauffeur), 2..6. Absent sur les voitures antérieures au 13/09/2026 → DEFAULT_SEATS. */
  seats?: number
  /** Lieu de rendez-vous imposé par le chauffeur (null / absent = chez chaque enfant). */
  meetAller?: TripAddress | null
  meetRetour?: TripAddress | null
  /** Commentaire libre du chauffeur, repris en fin d'invitation calendrier (« Note de X : … »). */
  note?: string
  createdAt?: Timestamp // ordre de déclaration (absent sur les voitures antérieures au 13/09/2026)
  updatedAt: Timestamp
}

export interface AppConfig {
  season: string
  seasonStart: Timestamp
  seasonEnd: Timestamp
  trainingDays: TrainingDay[]
  icsUrl: string
  icsLastSync?: Timestamp
  calendarName: string
  calendarToken: string
  /** Places proposées par défaut à un chauffeur qui se déclare (hors chauffeur). */
  defaultSeats: number
  updatedAt?: Timestamp
}
