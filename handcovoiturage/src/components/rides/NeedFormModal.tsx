import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { createNeed } from '../../services/needs'
import { formatAddress } from '../../utils/address'
import type { Child, Direction } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  eventId: string
  /** Enfant du parent connecté (sélectionne ses adresses). */
  child: Child
  declaredByUid: string
  /** Restreint les directions proposées (ex: pas de retour si event sans returnTime). */
  allowReturn: boolean
}

const DIRECTION_LABEL: Record<Direction, string> = {
  outbound: 'Aller',
  return: 'Retour',
  both: 'Aller-retour',
}

/** Formulaire : déclarer un besoin de transport pour son enfant. */
export function NeedFormModal({
  open,
  onClose,
  eventId,
  child,
  declaredByUid,
  allowReturn,
}: Props) {
  const [direction, setDirection] = useState<Direction>('both')
  const [pickupAddressId, setPickupAddressId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDirection(allowReturn ? 'both' : 'outbound')
      setPickupAddressId(child.addresses[0]?.id ?? '')
    }
  }, [open, allowReturn, child.addresses])

  const directions: Direction[] = allowReturn
    ? ['both', 'outbound', 'return']
    : ['outbound']

  async function handleSubmit() {
    if (!pickupAddressId) return toast.error('Choisissez une adresse')
    setSaving(true)
    try {
      await createNeed({
        eventId,
        childId: child.id,
        declaredByUid,
        direction,
        pickupAddressId,
      })
      toast.success('Besoin déclaré')
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
      title={`Besoin de transport — ${child.firstName}`}
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
            {saving ? <Spinner /> : 'Déclarer'}
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
            Point de prise en charge
          </label>
          {child.addresses.length === 0 ? (
            <p className="text-sm text-danger">
              Aucune adresse enregistrée pour {child.firstName}. Contactez un
              administrateur.
            </p>
          ) : (
            <div className="space-y-2">
              {child.addresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm transition ${
                    pickupAddressId === addr.id
                      ? 'border-primary bg-primary-50'
                      : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="pickup"
                    className="mt-1"
                    checked={pickupAddressId === addr.id}
                    onChange={() => setPickupAddressId(addr.id)}
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
