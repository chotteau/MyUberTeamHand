import { getConfig } from './config'
import { listEvents } from './events'
import { getCars } from './board'
import { isEventPast, toDate } from '../utils/dates'
import type { Child } from '../types'

export interface DriverStat {
  driverUid: string
  driverName: string
  allerCount: number
  retourCount: number
  total: number
  passengerCount: number
  participationPct: number
}

export interface StatsResult {
  drivers: DriverStat[]
  totalTrips: number
  totalPassengers: number
  eventsCount: number
  /** Familles (prénoms des parents) sans aucun trajet cette saison. */
  familiesWithoutTrip: string[]
}

/**
 * Agrège les voitures de tous les événements passés de la saison.
 * Un trajet = une voiture × une direction active.
 */
export async function getStats(children: Child[]): Promise<StatsResult> {
  const config = await getConfig()
  const events = (await listEvents(toDate(config.seasonStart), new Date()))
    .filter((e) => e.status === 'scheduled' && isEventPast(e))

  const carsByEvent = await Promise.all(events.map((e) => getCars(e.id)))

  const byDriver = new Map<string, DriverStat>()
  let totalTrips = 0
  let totalPassengers = 0
  let maxTrips = 0

  events.forEach((ev, i) => {
    maxTrips += ev.returnTime ? 2 : 1
    for (const car of carsByEvent[i]) {
      const cur = byDriver.get(car.driverUid) ?? {
        driverUid: car.driverUid,
        driverName: car.driverName,
        allerCount: 0,
        retourCount: 0,
        total: 0,
        passengerCount: 0,
        participationPct: 0,
      }
      if (car.aller) {
        cur.allerCount++
        cur.passengerCount += car.passengersAller.filter(
          (id) => !car.driverChildIds.includes(id),
        ).length
      }
      if (car.retour) {
        cur.retourCount++
        cur.passengerCount += car.passengersRetour.filter(
          (id) => !car.driverChildIds.includes(id),
        ).length
      }
      cur.total = cur.allerCount + cur.retourCount
      byDriver.set(car.driverUid, cur)
    }
  })

  for (const s of byDriver.values()) {
    s.participationPct = maxTrips ? Math.round((s.total / maxTrips) * 100) : 0
    totalTrips += s.total
    totalPassengers += s.passengerCount
  }

  const drivers = [...byDriver.values()].sort((a, b) => b.total - a.total)

  // Familles sans trajet : prénoms de parents actifs jamais vus comme chauffeur.
  const driverNames = new Set(drivers.map((d) => d.driverName.toLowerCase()))
  const familiesWithoutTrip = Array.from(
    new Set(
      children
        .filter((c) => c.active)
        .flatMap((c) => c.parents.map((p) => p.firstName))
        .filter((n) => n && !driverNames.has(n.toLowerCase())),
    ),
  ).sort()

  return {
    drivers,
    totalTrips,
    totalPassengers,
    eventsCount: events.length,
    familiesWithoutTrip,
  }
}
