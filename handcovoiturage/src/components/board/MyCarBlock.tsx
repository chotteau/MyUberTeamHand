import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Car as CarIcon } from 'lucide-react'
import { setMyCar, type DriverInfo } from '../../services/board'
import type { Car, Participant } from '../../types'

interface Props {
  eventId: string
  driver: DriverInfo
  myCar: Car | undefined
  cars: Car[]
  participants: Participant[]
  hasReturn: boolean
  editable: boolean
}

/** Bloc « Ma voiture » : deux interrupteurs J'emmène / Je ramène. */
export function MyCarBlock({
  eventId,
  driver,
  myCar,
  cars,
  participants,
  hasReturn,
  editable,
}: Props) {
  const save = useMutation({
    mutationFn: ({ aller, retour }: { aller: boolean; retour: boolean }) =>
      setMyCar(eventId, driver, aller, retour, myCar, participants, cars),
    onError: () => toast.error("Impossible d'enregistrer la voiture"),
  })

  const aller = myCar?.aller ?? false
  const retour = myCar?.retour ?? false
  const disabled = !editable || save.isPending

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <CarIcon className="h-4 w-4 text-primary" />
        Ma voiture
      </h2>
      <div className="flex flex-wrap gap-2">
        <Toggle
          label="J'emmène"
          active={aller}
          disabled={disabled}
          onClick={() => save.mutate({ aller: !aller, retour })}
        />
        {hasReturn && (
          <Toggle
            label="Je ramène"
            active={retour}
            disabled={disabled}
            onClick={() => save.mutate({ aller, retour: !retour })}
          />
        )}
      </div>
      <p className="text-xs text-slate-400">
        Pas de nombre de places à saisir : le compteur de la matrice passe en
        orange quand la voiture se remplit.
      </p>
    </section>
  )
}

function Toggle({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {active ? '✓ ' : ''}
      {label}
    </button>
  )
}
