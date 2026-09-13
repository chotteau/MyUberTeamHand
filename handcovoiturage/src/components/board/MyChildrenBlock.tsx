import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Baby, ChevronDown, MessageSquare } from 'lucide-react'
import { setParticipation, type ParticipationInput } from '../../services/board'
import { tripAddressFromChild, tripAddressLabel } from '../../utils/address'
import { DIR_LABEL } from '../../utils/direction'
import { TripAddressPicker } from './TripAddressPicker'
import { NoteField } from './NoteField'
import { HelpLink } from '../ui/HelpLink'
import type { Car, Child, Direction, Participant } from '../../types'

interface Props {
  eventId: string
  uid: string
  myChildren: Child[]
  participants: Participant[]
  cars: Car[]
  hasReturn: boolean
}

/**
 * Bloc « Mes enfants » : une ligne compacte par enfant (présence aller / retour
 * avec le lieu entre parenthèses), dépliable pour choisir l'adresse et un commentaire.
 * Monté uniquement quand l'événement est modifiable.
 */
export function MyChildrenBlock({ eventId, uid, myChildren, participants, cars, hasReturn }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const save = useMutation({
    mutationFn: ({ child, input }: { child: Child; input: ParticipationInput }) =>
      setParticipation(
        eventId,
        child,
        uid,
        input,
        participants.find((p) => p.childId === child.id),
        cars,
      ),
    onError: () => toast.error("Impossible d'enregistrer"),
  })

  if (myChildren.length === 0) {
    return (
      <section className="card text-sm text-amber-800 bg-amber-50 border-amber-200">
        Aucun enfant n'est associé à votre email. Contactez un administrateur.
      </section>
    )
  }

  const directions: Direction[] = hasReturn ? ['aller', 'retour'] : ['aller']

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Baby className="h-4 w-4 text-primary" />
        Mes enfants
        <HelpLink section="enfants" label="Mes enfants" />
      </h2>

      {myChildren.map((child) => {
        const p = participants.find((x) => x.childId === child.id)
        const current: ParticipationInput = {
          aller: p?.aller ?? null,
          retour: p?.retour ?? null,
          note: p?.note ?? '',
        }
        const isOpen = !!open[child.id]
        const disabled = save.isPending
        const anyPresent = directions.some((d) => !!current[d])

        const update = (patch: Partial<ParticipationInput>, openAfter?: boolean) => {
          save.mutate({ child, input: { ...current, ...patch } })
          if (openAfter !== undefined) setOpen((o) => ({ ...o, [child.id]: openAfter }))
        }

        return (
          <div key={child.id} className="rounded-xl border border-slate-200">
            {/* Ligne compacte */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
              <span className="font-medium text-secondary">{child.firstName}</span>
              {directions.map((d) => (
                <label
                  key={d}
                  className={`flex cursor-pointer items-center gap-1.5 text-sm ${
                    current[d] ? 'text-secondary' : 'text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    disabled={disabled}
                    checked={!!current[d]}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Cocher : adresse par défaut, puis déplier pour la confirmer / changer.
                        update({ [d]: tripAddressFromChild(child, 'default') }, true)
                      } else {
                        const rest = directions.filter((x) => x !== d).some((x) => !!current[x])
                        update({ [d]: null }, rest ? undefined : false)
                      }
                    }}
                  />
                  <span className="font-medium">{DIR_LABEL[d]}</span>
                  <span className="text-xs">({tripAddressLabel(current[d]) || 'absent'})</span>
                </label>
              ))}
              {anyPresent && current.note && (
                <MessageSquare
                  className="h-3.5 w-3.5 text-slate-400"
                  aria-label={`Commentaire : ${current.note}`}
                />
              )}
              {anyPresent && (
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [child.id]: !isOpen }))}
                  className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-secondary"
                  aria-label={isOpen ? 'Replier' : "Changer l'adresse"}
                  title={isOpen ? 'Replier' : "Changer l'adresse"}
                >
                  <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Choix des adresses + commentaire (déplié) */}
            {isOpen && anyPresent && (
              <div className="space-y-3 border-t border-slate-100 p-3">
                <div className={`grid gap-3 ${hasReturn ? 'sm:grid-cols-2' : ''}`}>
                  {directions.map((d) =>
                    current[d] ? (
                      <div key={d} className="rounded-lg bg-slate-50 p-2.5">
                        <div className="mb-2 text-xs font-semibold uppercase text-slate-400">
                          {DIR_LABEL[d]} — lieu de {d === 'aller' ? 'prise en charge' : 'dépose'}
                        </div>
                        <TripAddressPicker
                          child={child}
                          value={current[d]!}
                          disabled={disabled}
                          onChange={(v) => update({ [d]: v }, false)}
                        />
                      </div>
                    ) : null,
                  )}
                </div>
                <NoteField
                  key={current.note}
                  value={current.note ?? ''}
                  disabled={disabled}
                  placeholder={`Commentaire pour ${child.firstName} (ex. a son sac de sport avec lui)`}
                  onSave={(note) => update({ note })}
                />
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
