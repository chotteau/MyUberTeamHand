import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { createOffer } from '../../services/offers'
import { formatAddress } from '../../utils/address'
import type { Child, Direction } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  eventId: string
  /** Enfant du chauffeur connecté (embarque automatiquement — règle 1). */
  child: Child
  driverUid: string
  allowReturn: boolean
}

const DIRECTION_LABEL: Record<Direction, string> = {
  outbound: 'Aller',
  return: 'Retour',
  both: 'Aller-retour',
}

const CAPACITIES: number[] = [4, 5, 6, 7, 8, 9]

/** Formulaire : proposer sa voiture pour un événement. */
export function OfferFormModal({
  open,
  onClose,
  eventId,
  child,
  driverUid,
  allowReturn,
}: Props) {
  const [direction, setDirection] = useState<Direction>('both')
  const [capacity, setCapacity] = useState<number>(5)
  const [departureAddressId, setDepartureAddressId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDirection(allowReturn ? 'both' : 'outbound')
      setCapacity(5)
      setDepartureAddressId(child.addresses[0]?.id ?? '')
    }
  }, [open, allowReturn, child.addresses])

  const directions: Direction[] = allowReturn
    ? ['both', 'outbound', 'return']
    : ['outbound']

  async function handleSubmit() {
    if (!departureAddressId) return toast.error('Choisissez une adresse')
    setSaving(true)
    try {
      await createOffer({
        eventId,
        driverUid,
        childId: child.id,
        direction,
        vehicleCapacity: capacity,
        departureAddressId,
      })
      toast.success('Voiture proposée')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proposer ma voiture"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
            disabled={saving}
          >
            {saving ? <Spinner /> : 'Proposer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Direction
          </label>
          <div className="flex flex-wrap gap-2">
            {directions.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  direction === d
                    ? 'border-primary bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {DIRECTION_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Nombre de places (véhicule)
          </label>
          <div className="flex gap-2">
            {CAPACITIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCapacity(c)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  capacity === c
                    ? 'border-primary bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {child.firstName} occupe une place : {capacity - 1} place(s) pour les
            autres.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Adresse de départ
          </label>
          {child.addresses.length === 0 ? (
            <p className="text-sm text-danger">Aucune adresse enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {child.addresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm transition ${
                    departureAddressId === addr.id
                      ? 'border-primary bg-primary-50'
                      : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="departure"
                    className="mt-1"
                    checked={departureAddressId === addr.id}
                    onChange={() => setDepartureAddressId(addr.id)}
                  />
                  <span>
                    <span className="font-medium">{addr.label}</span>
                    <span className="block text-slate-500">
                      {formatAddress(addr)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
