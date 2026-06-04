import { useEffect, useState } from 'react'
import { subscribeNeedsForEvent } from '../services/needs'
import { subscribeOffersForEvent } from '../services/offers'
import { subscribeRidesForEvent } from '../services/rides'
import type { Need, Offer, Ride } from '../types'

interface EventBoard {
  needs: Need[]
  offers: Offer[]
  rides: Ride[]
  loading: boolean
  error: Error | null
}

/**
 * Abonnement temps réel au tableau de covoiturage d'un événement :
 * besoins, offres et trajets. Toutes les souscriptions sont désinscrites
 * dans le cleanup du useEffect.
 */
export function useEventBoard(eventId: string | undefined): EventBoard {
  const [needs, setNeeds] = useState<Need[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!eventId) return
    setLoading(true)

    let ready = 0
    const markReady = () => {
      ready++
      if (ready >= 3) setLoading(false)
    }
    const onErr = (e: Error) => setError(e)

    const unsubNeeds = subscribeNeedsForEvent(
      eventId,
      (d) => {
        setNeeds(d)
        markReady()
      },
      onErr,
    )
    const unsubOffers = subscribeOffersForEvent(
      eventId,
      (d) => {
        setOffers(d)
        markReady()
      },
      onErr,
    )
    const unsubRides = subscribeRidesForEvent(
      eventId,
      (d) => {
        setRides(d)
        markReady()
      },
      onErr,
    )

    return () => {
      unsubNeeds()
      unsubOffers()
      unsubRides()
    }
  }, [eventId])

  return { needs, offers, rides, loading, error }
}
