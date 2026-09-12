import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Baby } from 'lucide-react'
import { setParticipation, type ParticipationInput } from '../../services/board'
import { tripAddressFromChild } from '../../utils/address'
import { TripAddressPicker } from './TripAddressPicker'
import type { Car, Child, Direction, Participant, TripAddress } from '../../types'

interface Props {
  eventId: string
  uid: string
  children: Child[]
  participants: Participant[]
  cars: Car[]
  hasReturn: boolean
  editable: boolean
}

/** Bloc « Mes enfants » : présent aller / retour + adresse par direction. */
export function MyChildrenBlock({
  eventId,
  uid,
  children,
  participants,
  cars,
  hasReturn,
  editable,
}: Props) {
  const save = useMutation({
    mutationFn: ({ child, input }: { child: Child; input: ParticipationInput }) =>
      setParticipation(eventId, child, uid, input, cars),
    onError: () => toast.error("Impossible d'enregistrer"),
  })

  if (children.length === 0) {
    return (
      <section className="card text-sm text-amber-800 bg-amber-50 border-amber-200">
        Aucun enfant n'est associé à votre email. Contactez un administrateur.
      </section>
    )
  }

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Baby className="h-4 w-4 text-primary" />
        Mes enfants
      </h2>

      {children.map((child) => {
        const p = participants.find((x) => x.childId === child.id)
        const current: ParticipationInput = {
          aller: p?.aller ?? null,
          retour: p?.retour ?? null,
        }
        const update = (patch: Partial<ParticipationInput>) =>
          save.mutate({ child, input: { ...current, ...patch } })

        return (
          <div key={child.id} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-2 font-medium text-secondary">{child.firstName}</div>
            <div className={`grid gap-3 ${hasReturn ? 'sm:grid-cols-2' : ''}`}>
              <DirectionCell
                label="Aller"
                direction="aller"
                child={child}
                value={current.aller}
                disabled={!editable || save.isPending}
                onChange={(v) => update({ aller: v })}
              />
              {hasReturn && (
                <DirectionCell
                  label="Retour"
                  direction="retour"
                  child={child}
                  value={current.retour}
                  disabled={!editable || save.isPending}
                  onChange={(v) => update({ retour: v })}
                />
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function DirectionCell({
  label,
  direction,
  child,
  value,
  disabled,
  onChange,
}: {
  label: string
  direction: Direction
  child: Child
  value: TripAddress | null
  disabled: boolean
  onChange: (v: TripAddress | null) => void
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-secondary">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          disabled={disabled}
          checked={!!value}
          onChange={(e) =>
            onChange(e.target.checked ? tripAddressFromChild(child, 'default') : null)
          }
        />
        {label}
        <span className="text-xs font-normal text-slate-400">
          {value ? 'présent' : 'absent'}
        </span>
      </label>
      {value && (
        <div className="mt-2" data-direction={direction}>
          <TripAddressPicker
            child={child}
            value={value}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}
