import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Car as CarIcon } from 'lucide-react'
import {
  childrenSeatedElsewhere,
  otherActiveCars,
  passengersKey,
  setMyCar,
  type DriverInfo,
  type KeepElsewhere,
} from '../../services/board'
import { HelpLink } from '../ui/HelpLink'
import type { Car, Direction, Participant } from '../../types'

interface Props {
  eventId: string
  driver: DriverInfo
  myCar: Car | undefined
  cars: Car[]
  participants: Participant[]
  hasReturn: boolean
  editable: boolean
  threshold: number
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
  threshold,
}: Props) {
  const save = useMutation({
    mutationFn: ({ aller, retour, keep }: { aller: boolean; retour: boolean; keep: KeepElsewhere }) =>
      setMyCar(eventId, driver, aller, retour, myCar, participants, cars, threshold, keep),
    onError: () => toast.error("Impossible d'enregistrer la voiture"),
  })

  const aller = myCar?.aller ?? false
  const retour = myCar?.retour ?? false
  const disabled = !editable || save.isPending
  const childIds = driver.children.map((c) => c.id)
  const nameOf = (id: string) => driver.children.find((c) => c.id === id)?.firstName ?? 'votre enfant'

  /**
   * Active une direction : si mon enfant est déjà dans une autre voiture,
   * demander s'il y reste (règle : plus de verrouillage dans la voiture du parent).
   */
  function toggle(d: Direction) {
    const next = { aller, retour, [d]: !(d === 'aller' ? aller : retour) }
    const keep: KeepElsewhere = {}
    if (next[d] && childIds.length > 0) {
      const label = d === 'aller' ? "l'aller" : 'le retour'
      const kids = childIds.map(nameOf).join(' et ')
      const elsewhere = childrenSeatedElsewhere(cars, driver.uid, childIds, d)
      const withRoom = otherActiveCars(cars, driver.uid, d).filter(
        (c) => c[passengersKey(d)].length < threshold,
      )
      if (elsewhere.length > 0) {
        const who = elsewhere
          .map((e) => `${nameOf(e.childId)} est déjà dans la voiture de ${e.driverName}`)
          .join(', ')
        keep[d] = !confirm(`${who} pour ${label}.\n\nOK → je prends ${kids} dans ma voiture\nAnnuler → je laisse comme c'est`)
      } else if (withRoom.length > 0) {
        const names = withRoom.map((c) => c.driverName).join(', ')
        keep[d] = !confirm(`Pour ${label}, il reste de la place chez ${names}.\n\nOK → ${kids} monte avec moi\nAnnuler → ${kids} va dans l'autre voiture`)
      }
    }
    save.mutate({ ...next, keep })
  }

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <CarIcon className="h-4 w-4 text-primary" />
        Ma voiture
        <HelpLink section="voiture" label="Ma voiture" />
      </h2>
      <div className="flex flex-wrap gap-2">
        <Toggle label="J'emmène" active={aller} disabled={disabled} onClick={() => toggle('aller')} />
        {hasReturn && (
          <Toggle label="Je ramène" active={retour} disabled={disabled} onClick={() => toggle('retour')} />
        )}
      </div>
      <p className="text-xs text-slate-400">
        Les enfants inscrits sont placés automatiquement dans les voitures, par ordre de
        déclaration, jusqu'à {threshold} par voiture. Retirer sa voiture rebascule ses passagers.
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
