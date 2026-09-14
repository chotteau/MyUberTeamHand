import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, MapPin, MessageSquare, Users, X } from 'lucide-react'
import { assignChild, carOf as carOfIn, meetKey, orderCars, passengersKey, removeCarDirection, seatsOf, summarizeDirection, takeAll } from '../../services/board'
import { HelpLink } from '../ui/HelpLink'
import { formatAddress, tripAddressLabel } from '../../utils/address'
import { DIR_LABEL, atDirection } from '../../utils/direction'
import { formatTime } from '../../utils/dates'
import type { Car, Direction, Event, Participant } from '../../types'

interface Props {
  event: Event
  participants: Participant[]
  cars: Car[]
  editable: boolean
  /** Admin : peut retirer n'importe quelle voiture. */
  canRemoveCar?: boolean
}

/**
 * Matrice enfants × voitures, aller et retour côte à côte.
 * Cellule = bouton radio ; colonne « — » = sans voiture ; ligne Total « n/places » :
 * vert quand la voiture est pleine, rouge si on a forcé un enfant de plus.
 * Tout parent authentifié peut remplir (règle 6).
 */
export function CarMatrix({ event, participants, cars, editable, canRemoveCar }: Props) {
  const directions: Direction[] = event.returnTime ? ['aller', 'retour'] : ['aller']

  const rows = [...participants].sort((a, b) => a.childName.localeCompare(b.childName))
  // Prénom touché → détail (adresses du jour, commentaire) sous le prénom. Pas d'info-bulle sur mobile.
  const [detail, setDetail] = useState<string | null>(null)
  const ordered = orderCars(cars)
  const columns = directions.map((d) => ({ direction: d, cars: ordered.filter((c) => c[d]) }))

  const assign = useMutation({
    mutationFn: (v: { childId: string; direction: Direction; carId: string | null }) =>
      assignChild(event.id, v.childId, v.direction, v.carId, cars, participants),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Échec'),
  })
  const grab = useMutation({
    mutationFn: (v: { direction: Direction; carId: string }) =>
      takeAll(event.id, v.direction, v.carId, participants, cars),
    onError: () => toast.error('Échec'),
  })
  const remove = useMutation({
    mutationFn: (v: { carId: string; direction: Direction }) =>
      removeCarDirection(event.id, v.carId, v.direction, cars, participants),
    onError: () => toast.error('Échec'),
  })
  const busy = assign.isPending || grab.isPending || remove.isPending

  const carOf = (childId: string, d: Direction) => carOfIn(cars, childId, d)

  // Mêmes compteurs que le planning et le dashboard (summarizeDirection) + dépassements par voiture.
  const alerts = directions.flatMap((d) => {
    const s = summarizeDirection({ participants, cars }, d)
    const label = atDirection(d)
    if (s.present === 0) return []
    if (s.cars === 0) return [`Aucune voiture ${label}`]
    const over = cars
      .filter((c) => c[d] && c[passengersKey(d)].length > seatsOf(c))
      .map((c) => `Voiture de ${c.driverName} ${label} : ${c[passengersKey(d)].length} enfants pour ${seatsOf(c)} places`)
    if (s.withoutCar === 0) return over
    return [
      `${s.withoutCar} enfant${s.withoutCar > 1 ? 's' : ''} sans voiture ${label}` +
        (s.full ? ` — plus de place : ajouter un véhicule ?` : ''),
      ...over,
    ]
  })

  /** Placer un enfant ; si la voiture est pleine, on demande avant de forcer. */
  function place(childId: string, childName: string, direction: Direction, carId: string | null) {
    if (carOf(childId, direction) === carId) return // déjà là : rien à faire
    const car = carId ? cars.find((c) => c.id === carId) : undefined
    if (car) {
      const n = car[passengersKey(direction)].length
      const max = seatsOf(car)
      if (n >= max && !confirm(`La voiture de ${car.driverName} est pleine (${n}/${max}).\n\nForcer quand même ${childName} dedans ?`)) return
    }
    assign.mutate({ childId, direction, carId })
  }

  if (rows.length === 0) {
    return (
      <section className="card py-8 text-center text-sm text-slate-400">
        Personne n'est encore inscrit pour cet événement.
      </section>
    )
  }

  return (
    <section className="card !p-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 p-3">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-slate-600">Qui va dans quelle voiture</h2>
        <HelpLink section="matrice" label="Qui va dans quelle voiture" />
      </div>

      {alerts.length > 0 ? (
        <ul className="space-y-1 border-b border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
          {alerts.map((a) => (
            <li key={a} className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-2 border-b border-green-100 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          Tout le monde a une voiture
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-slate-400">
              <th className="sticky left-0 z-10 bg-slate-50 p-2 text-left" rowSpan={2}>
                Enfant
              </th>
              {columns.map((col) => (
                <th
                  key={col.direction}
                  colSpan={col.cars.length + 1}
                  className="border-l border-slate-200 p-2 text-center font-semibold text-secondary"
                >
                  {DIR_LABEL[col.direction]}{' '}
                  <span className="font-normal text-slate-400">
                    {formatTime(
                      col.direction === 'aller' ? event.departureTime : event.returnTime!,
                    )}
                  </span>
                </th>
              ))}
            </tr>
            <tr className="bg-slate-50 text-xs text-slate-500">
              {columns.map((col) => (
                <CarHeaders
                  key={col.direction}
                  direction={col.direction}
                  cars={col.cars}
                  canGrab={editable && !busy}
                  onGrab={(carId) => grab.mutate({ direction: col.direction, carId })}
                  canRemove={!!canRemoveCar && !busy}
                  onRemove={(carId) => {
                    const car = cars.find((c) => c.id === carId)
                    if (confirm(`Retirer la voiture de ${car?.driverName ?? '?'} ${atDirection(col.direction)} ?`)) {
                      remove.mutate({ carId, direction: col.direction })
                    }
                  }}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => (
              <tr key={p.childId} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white p-2 align-middle font-medium text-secondary">
                  <button
                    type="button"
                    onClick={() => setDetail(detail === p.childId ? null : p.childId)}
                    className="flex items-center gap-1 text-left"
                    aria-expanded={detail === p.childId}
                    title="Adresses du jour et commentaire"
                  >
                    {p.childName}
                    {p.note && <MessageSquare className="h-3 w-3 text-slate-400" />}
                  </button>
                  {detail === p.childId && (
                    <div className="mt-0.5 max-w-44 whitespace-normal text-xs font-normal text-slate-500">
                      {directions
                        .filter((d) => p[d])
                        .map((d) => (
                          <div key={d}>
                            {DIR_LABEL[d]} : {tripAddressLabel(p[d])}
                          </div>
                        ))}
                      {p.note && <div>💬 {p.note}</div>}
                    </div>
                  )}
                </td>
                {columns.map((col) => {
                  const present = !!p[col.direction]
                  const current = present ? carOf(p.childId, col.direction) : null
                  return [...col.cars, null].map((car) => {
                    const carId = car?.id ?? null
                    const selected = current === carId
                    const disabled = !editable || busy || !present
                    return (
                      <td
                        key={`${col.direction}-${carId ?? 'none'}`}
                        className={`border-l border-slate-100 p-1 text-center ${
                          !present ? 'bg-slate-50' : ''
                        }`}
                      >
                        {!present ? (
                          <span className="text-slate-300">─</span>
                        ) : (
                          <button
                            type="button"
                            disabled={disabled}
                            aria-label={
                              car ? `${p.childName} avec ${car.driverName}` : `${p.childName} sans voiture`
                            }
                            aria-pressed={selected}
                            onClick={() => place(p.childId, p.childName, col.direction, carId)}
                            className={`h-8 w-8 rounded-full border-2 transition disabled:cursor-not-allowed ${
                              selected
                                ? carId
                                  ? 'border-primary bg-primary'
                                  : 'border-danger bg-danger'
                                : 'border-slate-300 bg-white hover:border-primary'
                            }`}
                          >
                            {selected && !carId ? (
                              <span className="text-xs font-bold text-white">!</span>
                            ) : null}
                          </button>
                        )}
                      </td>
                    )
                  })
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold">
              <td className="sticky left-0 z-10 bg-slate-50 p-2 text-slate-500">Total</td>
              {columns.map((col) => {
                const key = passengersKey(col.direction)
                const without = rows.filter(
                  (p) => p[col.direction] && !carOf(p.childId, col.direction),
                ).length
                return [
                  ...col.cars.map((car) => {
                    const n = car[key].length
                    const max = seatsOf(car)
                    const tone =
                      n > max
                        ? 'bg-red-100 text-red-800'
                        : n === max
                          ? 'bg-green-100 text-green-800'
                          : 'text-secondary'
                    return (
                      <td
                        key={`${col.direction}-${car.id}`}
                        className={`border-l border-slate-100 p-2 text-center ${tone}`}
                        title={
                          n > max
                            ? `${n} enfants pour ${max} places — un de trop`
                            : n === max
                              ? 'Voiture pleine'
                              : `${max - n} place${max - n > 1 ? 's' : ''} libre${max - n > 1 ? 's' : ''}`
                        }
                      >
                        {n}/{max}
                      </td>
                    )
                  }),
                  <td
                    key={`${col.direction}-none`}
                    className={`border-l border-slate-100 p-2 text-center ${
                      without > 0 ? 'text-danger' : 'text-slate-400'
                    }`}
                  >
                    {without}
                  </td>,
                ]
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function CarHeaders({
  direction,
  cars,
  canGrab,
  onGrab,
  canRemove,
  onRemove,
}: {
  direction: Direction
  cars: Car[]
  canGrab: boolean
  onGrab: (carId: string) => void
  canRemove: boolean
  onRemove: (carId: string) => void
}) {
  return (
    <>
      {cars.map((car) => (
        <th
          key={`${direction}-${car.id}`}
          className="border-l border-slate-100 p-2 text-center font-medium"
          title={car[meetKey(direction)] ? `Rendez-vous : ${formatAddress(car[meetKey(direction)]!)}` : undefined}
        >
          <div className="flex items-center justify-center gap-1">
            🚗 {car.driverName || 'Chauffeur'}
            {car[meetKey(direction)] && (
              <MapPin
                className="h-3 w-3 text-primary"
                aria-label={`Rendez-vous : ${formatAddress(car[meetKey(direction)]!)}`}
              />
            )}
            {canRemove && (
              <button
                type="button"
                onClick={() => onRemove(car.id)}
                className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                aria-label="Retirer cette voiture pour cette direction"
                title="Retirer cette voiture pour cette direction (admin)"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {canGrab && (
            <button
              type="button"
              onClick={() => onGrab(car.id)}
              className="mt-0.5 text-[10px] font-normal text-primary hover:underline"
            >
              Tout prendre
            </button>
          )}
        </th>
      ))}
      <th className="border-l border-slate-100 p-2 text-center font-medium text-slate-400">
        Sans
        <br />
        voiture
      </th>
    </>
  )
}
