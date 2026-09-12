import { useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, Users, X } from 'lucide-react'
import { assignChild, passengersKey, removeCar, takeAll } from '../../services/board'
import { tripAddressLabel } from '../../utils/address'
import { formatTime } from '../../utils/dates'
import type { Car, Direction, Event, Participant } from '../../types'

interface Props {
  event: Event
  participants: Participant[]
  cars: Car[]
  editable: boolean
  threshold: number
  /** Admin : peut retirer n'importe quelle voiture. */
  canRemoveCar?: boolean
}

const DIR_LABEL: Record<Direction, string> = { aller: 'Aller', retour: 'Retour' }

/**
 * Matrice enfants × voitures, aller et retour côte à côte.
 * Cellule = bouton radio ; colonne « — » = sans voiture ; ligne Total orange
 * à partir du seuil. Tout parent authentifié peut remplir (règle 6).
 */
export function CarMatrix({ event, participants, cars, editable, threshold, canRemoveCar }: Props) {
  const directions: Direction[] = event.returnTime ? ['aller', 'retour'] : ['aller']

  const rows = useMemo(
    () => [...participants].sort((a, b) => a.childName.localeCompare(b.childName)),
    [participants],
  )
  const columns = useMemo(
    () =>
      directions.map((d) => ({
        direction: d,
        cars: cars
          .filter((c) => c[d])
          .sort((a, b) => a.driverName.localeCompare(b.driverName)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cars, event.returnTime],
  )

  const assign = useMutation({
    mutationFn: (v: { childId: string; direction: Direction; carId: string | null }) =>
      assignChild(event.id, v.childId, v.direction, v.carId, cars),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Échec'),
  })
  const grab = useMutation({
    mutationFn: (v: { direction: Direction; carId: string }) =>
      takeAll(event.id, v.direction, v.carId, participants, cars),
    onError: () => toast.error('Échec'),
  })
  const remove = useMutation({
    mutationFn: (carId: string) => removeCar(event.id, carId),
    onError: () => toast.error('Échec'),
  })
  const busy = assign.isPending || grab.isPending || remove.isPending

  /** Voiture d'un enfant pour une direction (au plus une). */
  const carOf = (childId: string, d: Direction) =>
    cars.find((c) => c[d] && c[passengersKey(d)].includes(childId))?.id ?? null

  const alerts = directions.flatMap((d) => {
    const present = rows.filter((p) => p[d])
    const active = cars.filter((c) => c[d])
    if (present.length === 0) return []
    if (active.length === 0)
      return [`Aucune voiture ${d === 'aller' ? "à l'aller" : 'au retour'}`]
    const without = present.filter((p) => !carOf(p.childId, d)).length
    return without > 0
      ? [`${without} enfant${without > 1 ? 's' : ''} sans voiture ${d === 'aller' ? "à l'aller" : 'au retour'}`]
      : []
  })

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
                    if (confirm('Retirer cette voiture (aller et retour) ?')) remove.mutate(carId)
                  }}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((p) => (
              <tr key={p.childId} className="border-t border-slate-100">
                <td
                  className="sticky left-0 z-10 bg-white p-2 align-middle font-medium text-secondary"
                  title={directions
                    .filter((d) => p[d])
                    .map((d) => `${DIR_LABEL[d]} : ${tripAddressLabel(p[d])}`)
                    .join(' · ')}
                >
                  {p.childName}
                </td>
                {columns.map((col) => {
                  const present = !!p[col.direction]
                  const current = present ? carOf(p.childId, col.direction) : null
                  return [...col.cars, null].map((car) => {
                    const carId = car?.id ?? null
                    const locked = !!car && car.driverChildIds.includes(p.childId)
                    const selected = current === carId
                    const disabled = !editable || busy || !present || locked
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
                            onClick={() =>
                              assign.mutate({
                                childId: p.childId,
                                direction: col.direction,
                                carId,
                              })
                            }
                            className={`h-8 w-8 rounded-full border-2 transition disabled:cursor-not-allowed ${
                              selected
                                ? carId
                                  ? 'border-primary bg-primary'
                                  : 'border-danger bg-danger'
                                : 'border-slate-300 bg-white hover:border-primary'
                            } ${locked ? 'opacity-70' : ''}`}
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
                    return (
                      <td
                        key={`${col.direction}-${car.id}`}
                        className={`border-l border-slate-100 p-2 text-center ${
                          n >= threshold ? 'bg-amber-100 text-amber-800' : 'text-secondary'
                        }`}
                        title={n >= threshold ? `${n} enfants — voiture bien remplie` : undefined}
                      >
                        {n}
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
        >
          <div className="flex items-center justify-center gap-1">
            🚗 {car.driverName || 'Chauffeur'}
            {canRemove && (
              <button
                type="button"
                onClick={() => onRemove(car.id)}
                className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                aria-label="Retirer cette voiture"
                title="Retirer cette voiture (admin)"
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
