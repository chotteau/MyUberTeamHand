import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Car as CarIcon, MapPin, MessageSquare } from 'lucide-react'
import {
  MAX_SEATS,
  MIN_SEATS,
  carOptionsOf,
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
import { HelpLink } from '../ui/HelpLink'
import type { Address, Car, Direction, Participant, TripAddress } from '../../types'

interface Props {
  eventId: string
  driver: DriverInfo
  myCar: Car | undefined
  cars: Car[]
  participants: Participant[]
  hasReturn: boolean
  editable: boolean
  defaultSeats: number
}

const SEAT_CHOICES = Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => MIN_SEATS + i)

/**
 * Bloc « Ma voiture » : J'emmène / Je ramène, places disponibles (hors
 * chauffeur), lieu de rendez-vous imposé par direction et commentaire.
 */
export function MyCarBlock({
  eventId,
  driver,
  myCar,
  cars,
  participants,
  hasReturn,
  editable,
  defaultSeats,
}: Props) {
  const opts = carOptionsOf(myCar, defaultSeats)
  // Places choisies avant la déclaration (la voiture n'existe pas encore en base).
  const [draftSeats, setDraftSeats] = useState(opts.seats)
  const seats = myCar ? opts.seats : draftSeats

  const save = useMutation({
    mutationFn: ({ options, keep }: { options: CarOptions; keep?: KeepElsewhere }) =>
      setMyCar(eventId, driver, options, myCar, participants, cars, keep),
    onError: () => toast.error("Impossible d'enregistrer la voiture"),
  })

  const active = opts.aller || opts.retour
  const disabled = !editable || save.isPending
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
      const label = d === 'aller' ? "l'aller" : 'le retour'
      const kids = childIds.map(nameOf).join(' et ')
      const elsewhere = childrenSeatedElsewhere(cars, driver.uid, childIds, d)
      const withRoom = otherActiveCars(cars, driver.uid, d).filter(
        (c) => c[passengersKey(d)].length < seatsOf(c),
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
                key={d}
                direction={d}
                driver={driver}
                value={d === 'aller' ? opts.meetAller : opts.meetRetour}
                disabled={disabled}
                onChange={(v) => update(d === 'aller' ? { meetAller: v } : { meetRetour: v })}
              />
            ))}
          <NoteField key={opts.note} value={opts.note} disabled={disabled} onSave={(note) => update({ note })} />
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

/** Adresses connues du chauffeur : celles de ses enfants (défaut + secondaire), dédoublonnées. */
function driverAddresses(driver: DriverInfo): Address[] {
  const seen = new Set<string>()
  const out: Address[] = []
  for (const c of driver.children) {
    for (const a of [c.addresses.default, c.addresses.secondary]) {
      if (!a) continue
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
  const label = direction === 'aller' ? 'Aller' : 'Retour'
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
              const a = known[Number(v.slice(1))]
              onChange({ kind: 'default', ...a })
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

/** Commentaire libre, enregistré à la sortie du champ (ou Entrée). */
function NoteField({
  value,
  disabled,
  onSave,
}: {
  value: string
  disabled: boolean
  onSave: (note: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim())
  }
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <input
        className="input !py-1 text-xs"
        placeholder="Commentaire pour le calendrier (ex. RDV 17h05 devant chez moi)"
        disabled={disabled}
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
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
