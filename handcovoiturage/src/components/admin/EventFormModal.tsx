import { useEffect, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { useCreateEvent, useUpdateEvent } from '../../hooks/useEvents'
import { combineDateAndTime, toDate } from '../../utils/dates'
import type { Event, EventType } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Événement à modifier ; absent = création. */
  event?: Event | null
}

interface FormState {
  type: EventType
  title: string
  date: string // YYYY-MM-DD
  departureTime: string // HH:mm
  returnTime: string // HH:mm
  locationName: string
  locationAddress: string
  locationCity: string
}

const EMPTY: FormState = {
  type: 'match',
  title: '',
  date: '',
  departureTime: '',
  returnTime: '',
  locationName: '',
  locationAddress: '',
  locationCity: '',
}

/** Convertit un Timestamp en "HH:mm" local. */
function toTimeInput(ts?: Timestamp): string {
  if (!ts) return ''
  const d = toDate(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

/** Convertit un Timestamp en "YYYY-MM-DD" local. */
function toDateInput(ts?: Timestamp): string {
  if (!ts) return ''
  const d = toDate(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Formulaire de création/modification d'un événement manuel. */
export function EventFormModal({ open, onClose, event }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const isEdit = !!event
  const saving = createEvent.isPending || updateEvent.isPending

  useEffect(() => {
    if (!open) return
    if (event) {
      setForm({
        type: event.type,
        title: event.title,
        date: toDateInput(event.date),
        departureTime: toTimeInput(event.departureTime),
        returnTime: toTimeInput(event.returnTime),
        locationName: event.location.name,
        locationAddress: event.location.address,
        locationCity: event.location.city,
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, event])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.title.trim()) return toast.error('Le titre est requis')
    if (!form.date) return toast.error('La date est requise')
    if (!form.departureTime) return toast.error("L'heure de départ est requise")

    const day = new Date(`${form.date}T00:00:00`)
    const departure = combineDateAndTime(day, form.departureTime)
    const ret = form.returnTime
      ? combineDateAndTime(day, form.returnTime)
      : undefined

    const base = {
      type: form.type,
      title: form.title.trim(),
      date: Timestamp.fromDate(day),
      departureTime: Timestamp.fromDate(departure),
      ...(ret ? { returnTime: Timestamp.fromDate(ret) } : {}),
      location: {
        name: form.locationName.trim(),
        address: form.locationAddress.trim(),
        city: form.locationCity.trim(),
      },
    }

    try {
      if (isEdit && event) {
        await updateEvent.mutateAsync({ id: event.id, patch: base })
        toast.success('Événement modifié')
      } else {
        await createEvent.mutateAsync({
          ...base,
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
      open={open}
      onClose={onClose}
      title={isEdit ? "Modifier l'événement" : 'Nouvel événement'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
            disabled={saving}
          >
            {saving ? <Spinner /> : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Type
          </label>
          <div className="flex gap-2">
            {(['match', 'training'] as EventType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  form.type === t
                    ? 'border-primary bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {t === 'match' ? 'Match' : 'Entraînement'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Titre
          </label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="ex: Match vs Saint-Denis"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Date
          </label>
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Départ
            </label>
            <input
              type="time"
              className="input"
              value={form.departureTime}
              onChange={(e) => set('departureTime', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">
              Retour
            </label>
            <input
              type="time"
              className="input"
              value={form.returnTime}
              onChange={(e) => set('returnTime', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Lieu
          </label>
          <input
            className="input mb-2"
            value={form.locationName}
            onChange={(e) => set('locationName', e.target.value)}
            placeholder="Nom du gymnase"
          />
          <input
            className="input mb-2"
            value={form.locationAddress}
            onChange={(e) => set('locationAddress', e.target.value)}
            placeholder="Adresse"
          />
          <input
            className="input"
            value={form.locationCity}
            onChange={(e) => set('locationCity', e.target.value)}
            placeholder="Ville"
          />
        </div>
      </div>
    </Modal>
  )
}
