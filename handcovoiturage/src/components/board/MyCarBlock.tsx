import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Car as CarIcon, MapPin } from 'lucide-react'
import {
  SEAT_CHOICES,
  carOf,
  carOptionsOf,
  clampSeats,
  childrenSeatedElsewhere,
  otherActiveCars,
  passengersKey,
  seatsOf,
  setMyCar,
  type CarOptions,
  type DriverInfo,
  type KeepElsewhere,
} from '../../services/board'
import { formatAddress } from '../../utils/address'
import { DIR_LABEL, theDirection } from '../../utils/direction'
import { HelpLink } from '../ui/HelpLink'
import { NoteField } from './NoteField'
import type { Address, Car, Direction, Participant, TripAddress, TripAddressKind } from '../../types'

interface Props {
  eventId: string
  driver: DriverInfo
  myCar: Car | undefined
  cars: Car[]
  participants: Participant[]
  hasReturn: boolean
  defaultSeats: number
}

/**
 * Bloc « Ma voiture » : J'emmène / Je ramène, places disponibles (hors
 * chauffeur), lieu de rendez-vous imposé par direction et commentaire.
 * Monté uniquement quand l'événement est modifiable.
 */
export function MyCarBlock({
  eventId,
  driver,
  myCar,
  cars,
  participants,
  hasReturn,
  defaultSeats,
}: Props) {
  const opts = carOptionsOf(myCar, defaultSeats)
  // Places choisies avant la déclaration (null = suivre la config, qui peut arriver après le 1er rendu).
  const [draftSeats, setDraftSeats] = useState<number | null>(null)
  const seats = myCar ? opts.seats : (draftSeats ?? clampSeats(defaultSeats))

  const save = useMutation({
    mutationFn: ({ options, keep }: { options: CarOptions; keep?: KeepElsewhere }) =>
      setMyCar(eventId, driver, options, myCar, participants, cars, keep),
    onError: () => toast.error("Impossible d'enregistrer la voiture"),
  })

  const active = opts.aller || opts.retour
  const disabled = save.isPending
  const childIds = driver.children.map((c) => c.id)
  const nameOf = (id: string) => driver.children.find((c) => c.id === id)?.firstName ?? 'votre enfant'

  const update = (patch: Partial<CarOptions>, keep?: KeepElsewhere) =>
    save.mutate({ options: { ...opts, seats, ...patch }, keep })

  /**
   * Active / désactive une direction. À l'activation, si mon enfant est déjà
   * dans une autre voiture (ou qu'une autre a de la place), on demande.
   */
  function toggle(d: Direction) {
    const next = !opts[d]
    const keep: KeepElsewhere = {}
    if (next && childIds.length > 0) {
      const label = theDirection(d)
      const kids = childIds.map(nameOf).join(' et ')
      const elsewhere = childrenSeatedElsewhere(cars, driver.uid, childIds, d)
      const withRoom = otherActiveCars(cars, driver.uid, d).filter(
        (c) => c[passengersKey(d)].length < seatsOf(c),
      )
      const waiting = participants.filter((p) => p[d] && !carOf(cars, p.childId, d)).length
      if (elsewhere.length > 0 && waiting > 0) {
        // Des enfants attendent une place : le chauffeur reprend son enfant, ce qui libère une place.
        toast(`${kids} monte avec vous pour ${label} : la place libérée revient à un enfant en attente.`)
      } else if (elsewhere.length > 0) {
        const who = elsewhere
          .map((e) => `${nameOf(e.childId)} est déjà dans la voiture de ${e.driverName}`)
          .join(', ')
        keep[d] = !confirm(`${who} pour ${label}.\n\nOK → je prends ${kids} dans ma voiture\nAnnuler → je laisse comme c'est`)
      } else if (withRoom.length > 0) {
        const names = withRoom.map((c) => c.driverName).join(', ')
        keep[d] = !confirm(`Pour ${label}, il reste de la place chez ${names}.\n\nOK → ${kids} monte avec moi\nAnnuler → ${kids} va dans l'autre voiture`)
      }
    }
    update({ [d]: next }, keep)
  }

  const directions: Direction[] = hasReturn ? ['aller', 'retour'] : ['aller']

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <CarIcon className="h-4 w-4 text-primary" />
        Ma voiture
        <HelpLink section="voiture" label="Ma voiture" />
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="J'emmène" active={opts.aller} disabled={disabled} onClick={() => toggle('aller')} />
        {hasReturn && (
          <Toggle label="Je ramène" active={opts.retour} disabled={disabled} onClick={() => toggle('retour')} />
        )}
        <label className="ml-auto flex items-center gap-1.5 text-sm text-slate-600">
          Places
          <select
            className="input !w-auto !py-1.5"
            disabled={disabled}
            value={seats}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (myCar) update({ seats: n })
              else setDraftSeats(n)
            }}
            aria-label="Places disponibles pour les enfants, hors chauffeur"
          >
            {SEAT_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {active && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            Lieu de rendez-vous
          </div>
          {directions
            .filter((d) => opts[d])
            .map((d) => (
              <MeetingPointField
                key={`${d}-${JSON.stringify(value(opts, d))}`}
                direction={d}
                driver={driver}
                value={d === 'aller' ? opts.meetAller : opts.meetRetour}
                disabled={disabled}
                onChange={(v) => update(d === 'aller' ? { meetAller: v } : { meetRetour: v })}
              />
            ))}
          <NoteField
            key={opts.note}
            value={opts.note}
            disabled={disabled}
            placeholder="Commentaire pour le calendrier (ex. RDV 17h05 devant chez moi)"
            onSave={(note) => update({ note })}
          />
        </div>
      )}

      <p className="text-xs text-slate-400">
        Les enfants inscrits montent automatiquement dans les voitures, par ordre de déclaration,
        tant qu'il reste des places (votre enfant en occupe une). Retirer sa voiture rebascule ses
        passagers.
      </p>
    </section>
  )
}

const value = (o: CarOptions, d: Direction) => (d === 'aller' ? o.meetAller : o.meetRetour)

type KnownAddress = Address & { kind: Exclude<TripAddressKind, 'custom'> }

/** Adresses connues du chauffeur : celles de ses enfants (défaut + secondaire), dédoublonnées. */
function driverAddresses(driver: DriverInfo): KnownAddress[] {
  const seen = new Set<string>()
  const out: KnownAddress[] = []
  for (const c of driver.children) {
    const candidates: KnownAddress[] = [{ kind: 'default', ...c.addresses.default }]
    if (c.addresses.secondary) candidates.push({ kind: 'secondary', ...c.addresses.secondary })
    for (const a of candidates) {
      const k = `${a.street}|${a.city}`.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(a)
    }
  }
  return out
}

/**
 * Sélecteur du lieu de rendez-vous pour une direction : chez chaque enfant
 * (défaut), une adresse du chauffeur, ou une autre adresse saisie.
 */
function MeetingPointField({
  direction,
  driver,
  value,
  disabled,
  onChange,
}: {
  direction: Direction
  driver: DriverInfo
  value: TripAddress | null
  disabled: boolean
  onChange: (v: TripAddress | null) => void
}) {
  const known = driverAddresses(driver)
  const matchIdx = value
    ? known.findIndex(
        (a) => a.street.toLowerCase() === value.street.toLowerCase() && a.city.toLowerCase() === value.city.toLowerCase(),
      )
    : -1
  const selected = !value ? 'none' : matchIdx >= 0 ? `k${matchIdx}` : 'custom'
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState({
    street: selected === 'custom' ? value!.street : '',
    zipCode: selected === 'custom' ? value!.zipCode : '',
    city: selected === 'custom' ? value!.city : '',
  })
  const customValid = custom.street.trim() && custom.city.trim()
  const label = DIR_LABEL[direction]
  const hint = direction === 'aller' ? 'je prends les enfants' : 'je dépose les enfants'

  return (
    <div className="text-sm">
      <label className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 font-medium text-secondary">{label}</span>
        <select
          className="input !w-auto !py-1 text-xs"
          disabled={disabled}
          value={customOpen ? 'custom' : selected}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'custom') {
              setCustomOpen(true)
              return
            }
            setCustomOpen(false)
            if (v === 'none') onChange(null)
            else {
              onChange(known[Number(v.slice(1))])
            }
          }}
        >
          <option value="none">chez chaque enfant</option>
          {known.map((a, i) => (
            <option key={i} value={`k${i}`}>
              {hint} {a.label ? `« ${a.label} »` : ''} — {formatAddress(a)}
            </option>
          ))}
          <option value="custom">autre adresse…</option>
        </select>
      </label>
      {(customOpen || selected === 'custom') && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-14">
          <input
            className="input !py-1 min-w-40 flex-1 text-xs"
            placeholder="Rue"
            disabled={disabled}
            value={custom.street}
            onChange={(e) => setCustom({ ...custom, street: e.target.value })}
          />
          <input
            className="input !py-1 w-20 text-xs"
            placeholder="CP"
            disabled={disabled}
            value={custom.zipCode}
            onChange={(e) => setCustom({ ...custom, zipCode: e.target.value })}
          />
          <input
            className="input !py-1 w-28 text-xs"
            placeholder="Ville"
            disabled={disabled}
            value={custom.city}
            onChange={(e) => setCustom({ ...custom, city: e.target.value })}
          />
          <button
            type="button"
            className="btn-primary !py-1 text-xs"
            disabled={disabled || !customValid}
            onClick={() => {
              setCustomOpen(false)
              onChange({
                kind: 'custom',
                label: 'Autre',
                street: custom.street.trim(),
                zipCode: custom.zipCode.trim(),
                city: custom.city.trim(),
              })
            }}
          >
            Utiliser
          </button>
        </div>
      )}
    </div>
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
