import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Save, Zap, MapPin, Link2, RefreshCw } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useConfig, useSaveConfig } from '../../hooks/useConfig'
import { generateTrainings } from '../../services/events'
import { newCalendarToken } from '../../services/config'
import { configFormSchema } from '../../utils/validation'
import { formatDate, parseDateInput, toDate, toDateInput } from '../../utils/dates'
import { PageSpinner, Spinner } from '../../components/ui/Spinner'
import type { AppConfig, TrainingDay, EventLocation } from '../../types'

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
] as const

export default function AdminConfig() {
  const { data: config, isLoading } = useConfig()
  if (isLoading || !config) return <PageSpinner />
  // `key` remonte un formulaire neuf uniquement quand la config a réellement changé en base.
  return <ConfigForm key={String(config.icsLastSync?.toMillis() ?? 0) + config.calendarToken} initial={config} />
}

function ConfigForm({ initial }: { initial: AppConfig }) {
  const saveConfig = useSaveConfig()
  const [form, setForm] = useState<AppConfig>(initial)

  const generate = useMutation({
    mutationFn: () => generateTrainings(form),
    onSuccess: (res) =>
      toast.success(`${res.created} entraînement(s) créé(s) · ${res.skippedExisting} déjà existant(s)`),
    onError: () => toast.error('Échec de la génération'),
  })

  function updateTrainingDay(index: number, patch: Partial<TrainingDay>) {
    setForm((f) => ({
      ...f,
      trainingDays: f.trainingDays.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    }))
  }
  function updateTrainingLocation(index: number, patch: Partial<EventLocation>) {
    setForm((f) => ({
      ...f,
      trainingDays: f.trainingDays.map((d, i) =>
        i === index ? { ...d, location: { ...d.location, ...patch } } : d,
      ),
    }))
  }

  async function handleSave() {
    const parsed = configFormSchema.safeParse(form)
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
    if (toDate(form.seasonStart) >= toDate(form.seasonEnd)) {
      return toast.error('La fin de saison doit être après le début')
    }
    try {
      await saveConfig.mutateAsync({ ...form, ...parsed.data })
      toast.success('Configuration enregistrée')
    } catch {
      toast.error("Échec de l'enregistrement")
    }
  }

  function handleGenerate() {
    if (toDate(form.seasonStart) >= toDate(form.seasonEnd)) {
      return toast.error('Vérifiez les dates de saison')
    }
    generate.mutate()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-secondary">Configuration</h1>

      <section className="card space-y-4">
        <h2 className="font-semibold text-secondary">Saison</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Libellé</label>
            <input className="input" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} placeholder="2025-2026" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Début</label>
            <input type="date" className="input" value={toDateInput(form.seasonStart)} onChange={(e) => e.target.value && setForm({ ...form, seasonStart: Timestamp.fromDate(parseDateInput(e.target.value)) })} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Fin</label>
            <input type="date" className="input" value={toDateInput(form.seasonEnd)} onChange={(e) => e.target.value && setForm({ ...form, seasonEnd: Timestamp.fromDate(parseDateInput(e.target.value)) })} />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold text-secondary">Jours d'entraînement</h2>
        <p className="text-xs text-slate-400">
          2 jours récurrents. Les exceptions (vacances, annulation, déplacement) se gèrent événement par événement.
        </p>
        {form.trainingDays.map((day, idx) => (
          <div key={idx} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Jour</label>
                <select className="input w-36" value={day.dayOfWeek} onChange={(e) => updateTrainingDay(idx, { dayOfWeek: Number(e.target.value) as TrainingDay['dayOfWeek'] })}>
                  {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="min-w-32 flex-1">
                <label className="mb-1 block text-xs text-slate-500">Libellé</label>
                <input className="input" value={day.label} onChange={(e) => updateTrainingDay(idx, { label: e.target.value })} placeholder="Lundi soir" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Aller</label>
                <input type="time" className="input w-28" value={day.departureTime} onChange={(e) => updateTrainingDay(idx, { departureTime: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Retour</label>
                <input type="time" className="input w-28" value={day.returnTime} onChange={(e) => updateTrainingDay(idx, { returnTime: e.target.value })} />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                <input className="input" value={day.location.name} onChange={(e) => updateTrainingLocation(idx, { name: e.target.value })} placeholder="Nom du lieu" />
                <input className="input" value={day.location.address} onChange={(e) => updateTrainingLocation(idx, { address: e.target.value })} placeholder="Adresse" />
                <input className="input" value={day.location.city} onChange={(e) => updateTrainingLocation(idx, { city: e.target.value })} placeholder="Ville" />
              </div>
            </div>
          </div>
        ))}
        <button onClick={handleGenerate} disabled={generate.isPending} className="btn-secondary">
          {generate.isPending ? <Spinner className="h-4 w-4 text-white" /> : <Zap className="h-4 w-4" />}
          Générer / Regénérer le calendrier de la saison
        </button>
        <p className="text-xs text-slate-400">
          Idempotent : les entraînements déjà créés (même modifiés) ne sont pas touchés. Enregistrez d'abord si vous avez changé les jours.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-secondary">Matchs FFHB (ICS)</h2>
        <input className="input" value={form.icsUrl} onChange={(e) => setForm({ ...form, icsUrl: e.target.value })} placeholder="https://competition-calendar.ffhandball.fr/..." />
        <p className="text-xs text-slate-400">
          Synchro automatique toutes les 24 h
          {initial.icsLastSync ? ` — dernière : ${formatDate(initial.icsLastSync, 'PPp')}` : ''}.
          La synchro ne réactive jamais un match que vous avez annulé.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-secondary">Calendrier partagé & matrice</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Nom du calendrier</label>
            <input className="input" value={form.calendarName} onChange={(e) => setForm({ ...form, calendarName: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Places proposées par défaut (enfants, hors chauffeur)</label>
            <input type="number" min={2} max={6} className="input" value={form.defaultSeats} onChange={(e) => setForm({ ...form, defaultSeats: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-slate-400">Chaque chauffeur peut ajuster de 2 à 6 en déclarant sa voiture.</p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Lien d'abonnement (secret)</label>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={form.calendarToken ? `/api/calendar/${form.calendarToken}.ics` : 'Non généré'} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => setForm({ ...form, calendarToken: newCalendarToken() })}>
              {form.calendarToken ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {form.calendarToken ? 'Regénérer' : 'Générer'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Regénérer invalide l'ancien lien : les parents devront se réabonner (lien dans leur profil).
          </p>
        </div>
      </section>

      <div className="sticky bottom-20 flex justify-end md:bottom-0">
        <button onClick={handleSave} disabled={saveConfig.isPending} className="btn-primary shadow-lg">
          {saveConfig.isPending ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}
