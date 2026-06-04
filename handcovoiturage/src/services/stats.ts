import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Ride } from '../types'

export interface DriverStat {
  /** Enfant du chauffeur = identifiant de la famille (lisible par tous). */
  driverChildId: string
  /** Nombre de trajets aller conduits. */
  outboundCount: number
  /** Nombre de trajets retour conduits. */
  returnCount: number
  /** Total trajets conduits (aller + retour). */
  rideCount: number
  /** Nombre de passagers transportés (hors enfant du chauffeur). */
  passengerCount: number
  /** % de participation : trajets conduits / total events de la saison × 2 directions. */
  participationPct: number
}

export interface StatsResult {
  drivers: DriverStat[]
  totalRides: number
  totalPassengers: number
  eventsCount: number
}

/** Borne basse de la saison courante (1er septembre de l'année sportive). */
export function seasonStart(now = new Date()): Date {
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return new Date(year, 8, 1)
}

/**
 * Agrège les trajets confirmés/terminés sur la saison complète.
 * Inclut la ventilation aller/retour et le % de participation.
 */
export async function getStats(now = new Date()): Promise<StatsResult> {
  const from = Timestamp.fromDate(seasonStart(now))
  const to = Timestamp.fromDate(now)

  // Événements de la saison (pour calculer le % de participation).
  const eventsSnap = await getDocs(
    query(
      collection(db, 'events'),
      where('date', '>=', from),
      where('date', '<=', to),
    ),
  )
  const eventIds = new Set(eventsSnap.docs.map((d) => d.id))
  const eventsCount = eventIds.size

  // Trajets confirmés/terminés rattachés à ces événements.
  const ridesSnap = await getDocs(
    query(
      collection(db, 'rides'),
      where('status', 'in', ['confirmed', 'completed']),
    ),
  )
  const rides = ridesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Ride)
    .filter((r) => eventIds.has(r.eventId))

  const byDriver = new Map<string, DriverStat>()
  let totalPassengers = 0

  for (const ride of rides) {
    // L'enfant du chauffeur est le passager sans needId (règle 1).
    const driverPassenger = ride.passengers.find((p) => !p.needId)
    const driverChildId = driverPassenger?.childId ?? 'inconnu'
    const transported = ride.passengers.filter((p) => p.needId).length
    totalPassengers += transported

    const cur = byDriver.get(driverChildId) ?? {
      driverChildId,
      outboundCount: 0,
      returnCount: 0,
      rideCount: 0,
      passengerCount: 0,
      participationPct: 0,
    }

    if (ride.direction === 'outbound') cur.outboundCount++
    else cur.returnCount++
    cur.rideCount++
    cur.passengerCount += transported
    byDriver.set(driverChildId, cur)
  }

  // Calculer le % de participation.
  // Base : eventsCount × 2 directions = nb max de trajets possible par chauffeur.
  const maxRides = eventsCount * 2 || 1
  for (const stat of byDriver.values()) {
    stat.participationPct = Math.round((stat.rideCount / maxRides) * 100)
  }

  const drivers = Array.from(byDriver.values()).sort(
    (a, b) => b.rideCount - a.rideCount,
  )

  return {
    drivers,
    totalRides: rides.length,
    totalPassengers,
    eventsCount,
  }
}
