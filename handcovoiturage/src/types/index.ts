import type { Timestamp } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Énumérations & alias
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'driver'
export type Direction = 'outbound' | 'return' | 'both'
export type RideDirection = 'outbound' | 'return'
export type EventType = 'training' | 'match'
export type EventStatus = 'scheduled' | 'cancelled' | 'vacances' | 'completed'
// 'cancelled' → annulé (raison quelconque)
// 'vacances'  → annulé car vacances scolaires
// 'completed' → passé — figé, alimente les stats, non modifiable
export type EventSource = 'manual' | 'ics_ffhb' | 'generated'
// 'generated' → entraînement auto-généré depuis la config saison
export type NeedStatus = 'pending' | 'assigned' | 'cancelled'
export type OfferStatus = 'open' | 'full' | 'cancelled'
export type RideStatus = 'draft' | 'confirmed' | 'completed' | 'cancelled'
export type NotificationType =
  | 'reminder'
  | 'missing_driver'
  | 'assignment_confirmed'
  | 'schedule_change'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

// ---------------------------------------------------------------------------
// Sous-objets
// ---------------------------------------------------------------------------

export interface Address {
  id: string
  label: string // ex: "Chez Papa", "Chez Maman", "Domicile"
  street: string
  city: string
  zipCode: string
  parentUid: string // à quel parent appartient cette adresse
}

export interface EventLocation {
  name: string
  address: string
  city: string
}

export interface Passenger {
  childId: string
  needId: string
  pickupAddress: string // snapshot de l'adresse complète
  confirmedAt?: Timestamp
}

/**
 * Un jour d'entraînement configurable.
 * Exactement 2 entrées dans config.trainingDays.
 */
export interface TrainingDay {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 1=Lundi…0=Dimanche (getDay())
  label: string        // ex: "Lundi soir", "Vendredi"
  departureTime: string // "HH:mm" heure départ aller
  returnTime: string    // "HH:mm" heure départ retour
  location: EventLocation
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface User {
  uid: string
  email: string
  displayName: string  // prénom seul ou "Prénom I" si ambiguïté — pas de nom complet
  role: Role
  childId: string      // référence → children/{id}
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Child {
  id: string
  firstName: string    // prénom seul (ex: "Lucas") ou avec initiale (ex: "Lucas M")
  // Pas de nom de famille stocké
  parentIds: string[]  // 1 ou 2 UIDs — famille monoparentale supportée
  addresses: Address[] // 1 adresse si parents même toit, 2 sinon
  active: boolean
  createdAt: Timestamp
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
  icsUid?: string      // UID déduplication ICS FFHB
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Need {
  id: string
  eventId: string
  childId: string
  declaredByUid: string
  direction: Direction
  pickupAddressId: string
  dropoffAddressId?: string
  status: NeedStatus
  assignedRideId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Offer {
  id: string
  eventId: string
  driverUid: string
  childId: string      // enfant du chauffeur (toujours embarqué)
  direction: Direction
  vehicleCapacity: number // saisi au moment de la déclaration — non stocké sur la famille
  // Places disponibles = vehicleCapacity - 1 (enfant du chauffeur)
  // Calculé dynamiquement depuis les rides, JAMAIS stocké comme champ fixe
  departureAddressId: string
  status: OfferStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Ride {
  id: string
  eventId: string
  offerId: string
  driverUid: string
  direction: RideDirection
  passengers: Passenger[]
  status: RideStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AppConfig {
  season: string           // ex: "2024-2025"
  seasonStart: Timestamp   // 1er jour de la saison
  seasonEnd: Timestamp     // dernier jour de la saison
  // Le calendrier complet est généré entre seasonStart et seasonEnd.
  // Affichage par défaut : 2 semaines glissantes.

  trainingDays: TrainingDay[] // Exactement 2 jours configurables
  icsUrl: string
  icsLastSync?: Timestamp
  reminderHoursBefore: number // défaut: 24
  brevoApiKey: string
  emailFrom: string
  calendarName: string
}

export interface Notification {
  id: string
  type: NotificationType
  recipientUid: string
  eventId: string
  message: string
  sentAt?: Timestamp
  status: NotificationStatus
}
