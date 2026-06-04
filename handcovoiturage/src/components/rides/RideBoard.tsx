import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Car, UserPlus, X, AlertTriangle, MapPin, Crown } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { assignChildToRide, removeChildFromRide } from '../../services/rides'
import { setNeedStatus, directionOverlaps } from '../../services/needs'
import { snapshotAddress } from '../../utils/address'
import type {
  Child,
  Direction,
  Need,
  Offer,
  Ride,
  RideDirection,
} from '../../types'

interface Props {
  eventId: string
  direction: RideDirection
  needs: Need[]
  offers: Offer[]
  rides: Ride[]
  childById: Map<string, Child>
  editable: boolean
}

function applies(d: Direction, target: RideDirection): boolean {
  return directionOverlaps(d, target)
}

/** Tableau collaboratif d'une direction (aller ou retour). */
export function RideBoard({
  eventId,
  direction,
  needs,
  offers,
  rides,
  childById,
  editable,
}: Props) {
  const [assignInto, setAssignInto] = useState<Offer | null>(null)

  // Offres concernées par cette direction.
  const dirOffers = useMemo(
    () =>
      offers.filter(
        (o) => o.status !== 'cancelled' && applies(o.direction, direction),
      ),
    [offers, direction],
  )

  // Trajet existant par offre.
  const rideByOffer = useMemo(() => {
    const m = new Map<string, Ride>()
    for (const r of rides) {
      if (r.direction === direction && r.status !== 'cancelled') {
        m.set(r.offerId, r)
      }
    }
    return m
  }, [rides, direction])

  // Enfants déjà à bord (toutes voitures confondues, hors chauffeur).
  const assignedChildIds = useMemo(() => {
    const s = new Set<string>()
    for (const o of dirOffers) {
      const ride = rideByOffer.get(o.id)
      ride?.passengers.forEach((p) => {
        if (p.childId !== o.childId) s.add(p.childId)
      })
    }
    return s
  }, [dirOffers, rideByOffer])

  // Enfants chauffeurs (déjà transportés par définition).
  const driverChildIds = useMemo(
    () => new Set(dirOffers.map((o) => o.childId)),
    [dirOffers],
  )

  // Besoins non encore satisfaits pour cette direction.
  const unassignedNeeds = useMemo(
    () =>
      needs.filter(
        (n) =>
          n.status !== 'cancelled' &&
          applies(n.direction, direction) &&
          !assignedChildIds.has(n.childId) &&
          !driverChildIds.has(n.childId),
      ),
    [needs, direction, assignedChildIds, driverChildIds],
  )

  const totalFreeSeats = dirOffers.reduce((sum, o) => {
    const ride = rideByOffer.get(o.id)
    const occupied = ride ? ride.passengers.length : 1
    return sum + Math.max(0, o.vehicleCapacity - occupied)
  }, 0)

  const missingSeats = unassignedNeeds.length - totalFreeSeats

  async function handleAssign(offer: Offer, need: Need) {
    const driverChild = childById.get(offer.childId)
    const passengerChild = childById.get(need.childId)
    try {
      await assignChildToRide({
        eventId,
        offer,
        direction,
        driverPickupAddress: snapshotAddress(
          driverChild,
          offer.departureAddressId,
        ),
        passenger: {
          childId: need.childId,
          needId: need.id,
          pickupAddress: snapshotAddress(passengerChild, need.pickupAddressId),
        },
      })
      await setNeedStatus(need.id, 'assigned')
      toast.success(`${passengerChild?.firstName ?? 'Enfant'} affecté`)
      setAssignInto(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec de l\'affectation')
    }
  }

  async function handleRemove(offer: Offer, childId: string, needId: string) {
    try {
      await removeChildFromRide(offer.id, direction, childId)
      if (needId) await setNeedStatus(needId, 'pending', '')
      toast.success('Passager retiré')
    } catch {
      toast.error('Échec du retrait')
    }
  }

  return (
    <div className="space-y-4">
      {/* Alerte manque de chauffeur / places */}
      {missingSeats > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{missingSeats}</strong> place(s) manquante(s) — il faut un
            chauffeur supplémentaire pour cette direction.
          </span>
        </div>
      )}

      {/* Voitures */}
      {dirOffers.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-400">
          Aucune voiture proposée pour cette direction.
        </p>
      ) : (
        <div className="space-y-3">
          {dirOffers.map((offer) => {
            const ride = rideByOffer.get(offer.id)
            const driverChild = childById.get(offer.childId)
            const passengers = ride?.passengers ?? []
            const free = Math.max(
              0,
              offer.vehicleCapacity - (ride ? passengers.length : 1),
            )
            return (
              <div key={offer.id} className="card !p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-secondary">
                    <Car className="h-4 w-4 text-primary" />
                    Voiture de {driverChild?.firstName ?? '—'}
                  </div>
                  <span
                    className={`badge ${
                      free === 0
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {free} place(s) libre(s)
                  </span>
                </div>

                <ul className="space-y-1">
                  {/* Chauffeur + son enfant (toujours à bord) */}
                  <li className="flex items-center gap-2 rounded bg-primary-50 px-2 py-1 text-sm">
                    <Crown className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">
                      {driverChild?.firstName}                    </span>
                    <span className="text-xs text-slate-400">(chauffeur)</span>
                  </li>

                  {passengers
                    .filter((p) => p.childId !== offer.childId)
                    .map((p) => {
                      const c = childById.get(p.childId)
                      return (
                        <li
                          key={p.childId}
                          className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="font-medium">
                              {c?.firstName}                            </span>
                            {p.pickupAddress && (
                              <span className="flex items-center gap-0.5 truncate text-xs text-slate-400">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {p.pickupAddress}
                              </span>
                            )}
                          </span>
                          {editable && (
                            <button
                              onClick={() =>
                                handleRemove(offer, p.childId, p.needId)
                              }
                              className="btn-ghost p-1 text-slate-400"
                              aria-label="Retirer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      )
                    })}
                </ul>

                {editable && free > 0 && unassignedNeeds.length > 0 && (
                  <button
                    onClick={() => setAssignInto(offer)}
                    className="btn-ghost mt-2 text-primary"
                  >
                    <UserPlus className="h-4 w-4" />
                    Affecter un enfant
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Enfants en attente d'affectation */}
      {unassignedNeeds.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-600">
            En attente d'une voiture ({unassignedNeeds.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {unassignedNeeds.map((n) => {
              const c = childById.get(n.childId)
              return (
                <span
                  key={n.id}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800"
                >
                  {c?.firstName}                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal d'affectation : choisir un enfant à embarquer */}
      <Modal
        open={!!assignInto}
        onClose={() => setAssignInto(null)}
        title="Affecter un enfant à cette voiture"
      >
        <div className="space-y-2">
          {unassignedNeeds.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun enfant en attente.</p>
          ) : (
            unassignedNeeds.map((n) => {
              const c = childById.get(n.childId)
              return (
                <button
                  key={n.id}
                  onClick={() => assignInto && handleAssign(assignInto, n)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left text-sm transition hover:border-primary hover:bg-primary-50"
                >
                  <span className="font-medium">
                    {c?.firstName}                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="h-3 w-3" />
                    {snapshotAddress(c, n.pickupAddressId) || 'Adresse ?'}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </Modal>
    </div>
  )
}
