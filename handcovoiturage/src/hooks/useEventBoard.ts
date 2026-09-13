import { useEffect, useState } from 'react'
import { subscribeCars, subscribeParticipants } from '../services/board'
import type { Car, Participant } from '../types'

interface EventBoard {
  participants: Participant[]
  cars: Car[]
  loading: boolean
  error: Error | null
}

/**
 * Abonnement temps réel aux participants et voitures d'un événement.
 * Les états sont nullables tant que la 1re réponse n'est pas arrivée,
 * et remis à zéro au changement d'événement.
 */
export function useEventBoard(eventId: string | undefined): EventBoard {
  const [participants, setParticipants] = useState<Participant[] | null>(null)
  const [cars, setCars] = useState<Car[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!eventId) return
    // En cas d'erreur, on sort du chargement (sinon spinner infini) : le message est affiché.
    const fail = (e: Error) => {
      setError(e)
      setParticipants((p) => p ?? [])
      setCars((c) => c ?? [])
    }
    const unsubP = subscribeParticipants(eventId, setParticipants, fail)
    const unsubC = subscribeCars(eventId, setCars, fail)
    return () => {
      unsubP()
      unsubC()
      setParticipants(null)
      setCars(null)
      setError(null)
    }
  }, [eventId])

  return {
    participants: participants ?? [],
    cars: cars ?? [],
    loading: participants === null || cars === null,
    error,
  }
}
