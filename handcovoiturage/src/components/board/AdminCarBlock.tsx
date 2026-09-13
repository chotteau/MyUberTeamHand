import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CarFront, ShieldCheck } from 'lucide-react'
import { setMyCar } from '../../services/board'
import { useUsers } from '../../hooks/useUsers'
import { useChildren } from '../../hooks/useChildren'
import { Spinner } from '../ui/Spinner'
import type { Car, Participant } from '../../types'

interface Props {
  eventId: string
  cars: Car[]
  participants: Participant[]
  hasReturn: boolean
  threshold: number
}

/**
 * Mode admin : déclarer la voiture d'un parent à sa place (il a prévenu par
 * téléphone, pas de compte…). Même logique que « Ma voiture » pour ce parent.
 */
export function AdminCarBlock({ eventId, cars, participants, hasReturn, threshold }: Props) {
  const { data: users } = useUsers()
  const { data: children } = useChildren()
  const [uid, setUid] = useState('')
  const [aller, setAller] = useState(true)
  const [retour, setRetour] = useState(hasReturn)

  const candidates = (users ?? []).filter(
    (u) => u.role === 'parent' && u.active && !cars.some((c) => c.id === u.uid),
  )

  const add = useMutation({
    mutationFn: async () => {
      const u = candidates.find((x) => x.uid === uid)
      if (!u) throw new Error('Parent introuvable')
      const kids = (children ?? []).filter((c) => c.active && c.parentEmails.includes(u.email))
      await setMyCar(
        eventId,
        { uid: u.uid, name: u.displayName || 'Chauffeur', children: kids },
        aller,
        retour,
        undefined,
        participants,
        cars,
        threshold,
      )
      return u.displayName
    },
    onSuccess: (name) => {
      toast.success(`Voiture de ${name} ajoutée`)
      setUid('')
    },
    onError: () => toast.error("Impossible d'ajouter la voiture"),
  })

  return (
    <section className="card space-y-3 border-secondary/30">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <ShieldCheck className="h-4 w-4 text-secondary" />
        Ajouter la voiture d'un parent
        <span className="badge bg-secondary text-white">admin</span>
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs text-slate-500">Parent</label>
          <select className="input" value={uid} onChange={(e) => setUid(e.target.value)}>
            <option value="">— choisir —</option>
            {candidates.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName || u.email}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={aller} onChange={(e) => setAller(e.target.checked)} />
          Aller
        </label>
        {hasReturn && (
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={retour} onChange={(e) => setRetour(e.target.checked)} />
            Retour
          </label>
        )}
        <button
          className="btn-secondary"
          disabled={!uid || (!aller && !retour) || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? <Spinner className="h-4 w-4 text-white" /> : <CarFront className="h-4 w-4" />}
          Ajouter
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Son enfant est inscrit et placé dans cette voiture ; les enfants sans voiture y sont
        rebasculés à la prochaine inscription. Seuls les parents actifs sans voiture sur cet
        événement sont proposés.
      </p>
    </section>
  )
}
