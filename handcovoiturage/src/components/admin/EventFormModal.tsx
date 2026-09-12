import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { deleteField } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { useCreateEvent, useUpdateEvent } from '../../hooks/useEvents'
import { combineDateAndTime, parseDateInput, toDateInput, toTimeInput } from '../../utils/dates'
import type { Event, EventType } from '../../types'

interface Props {
  /** Événement à modifier ; null = création. */
  event: Event | null
  onClose: () => void
}

/** Création / modification d'un événement. Monté uniquement quand ouvert. */
export function EventFormModal({ event, onClose }: Props) {
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const saving = createEvent.isPending || updateEvent.isPending

  const [form, setForm] = useState({
    type: event?.type ?? ('match' as EventType),
    title: event?.title ?? '',
    date: toDateInput(event?.date),
    departureTime: toTimeInput(event?.departureTime),
    returnTime: toTimeInput(event?.returnTime),
    locationName: event?.location.name ?? '',
    locationAddress: event?.location.address ?? '',
    locationCity: event?.location.city ?? '',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit() {
    if (!form.title.trim()) return toast.error('Le titre est requis')
    if (!form.date) return toast.error('La date est requise')
    if (!form.departureTime) return toast.error("L'heure de départ est requise")

    const day = parseDateInput(form.date)
    const base = {
      type: form.type,
      title: form.title.trim(),
      date: Timestamp.fromDate(day),
      departureTime: Timestamp.fromDate(combineDateAndTime(day, form.departureTime)),
      location: {
        name: form.locationName.trim(),
        address: form.locationAddress.trim(),
        city: form.locationCity.trim(),
      },
    }
    const returnTime = form.returnTime
      ? Timestamp.fromDate(combineDateAndTime(day, form.returnTime))
      : undefined

    try {
      if (event) {
        await updateEvent.mutateAsync({
          id: event.id,
          // Vider « Retour » supprime réellement le champ.
          patch: { ...base, returnTime: returnTime ?? (deleteField() as unknown as undefined) },
        })
        toast.success('Événement modifié')
      } else {
        await createEvent.mutateAsync({
          ...base,
          ...(returnTime ? { returnTime } : {}),
          status: 'scheduled',
          source: 'manual',
        })
        toast.success('Événement créé')
      }
      onClose()
    } catch {
      toast.error("Échec de l'enregistrement")
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={event ? "Modifier l'événement" : 'Nouvel événement'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>Annuler</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4 text-white" /> : event ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {event?.source === 'ics_ffhb' && (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            Match FFHB : le titre, l'heure et le lieu seront réalignés sur le flux à la prochaine synchro.
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Type</label>
          <div className="flex gap-2">
            {(['match', 'training'] as EventType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                className={`chip flex-1 ${form.type === t ? 'chip-active' : ''}`}
              >
                {t === 'match' ? 'Match' : 'Entraînement'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Titre</label>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="ex: Match vs Saint-Denis" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Départ aller</label>
            <input type="time" className="input" value={form.departureTime} onChange={(e) => set('departureTime', e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Départ retour</label>
            <input type="time" className="input" value={form.returnTime} onChange={(e) => set('returnTime', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Lieu</label>
          <input className="input mb-2" value={form.locationName} onChange={(e) => set('locationName', e.target.value)} placeholder="Nom du gymnase" />
          <input className="input mb-2" value={form.locationAddress} onChange={(e) => set('locationAddress', e.target.value)} placeholder="Adresse" />
          <input className="input" value={form.locationCity} onChange={(e) => set('locationCity', e.target.value)} placeholder="Ville" />
        </div>
      </div>
    </Modal>
  )
}
