import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, Zap, MapPin } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useConfig, useSaveConfig } from '../../hooks/useConfig'
import { generateTrainingsSeq } from '../../services/events'
import { configFormSchema } from '../../utils/validation'
import { formatDate, toDate } from '../../utils/dates'
import { Spinner } from '../../components/ui/Spinner'
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
  const saveConfig = useSaveConfig()
  const [form, setForm] = useState<AppConfig | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (config) setForm(config)
  }, [config])

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  function updateTrainingDay(index: number, patch: Partial<TrainingDay>) {
    setForm((f) =>
      f
        ? {
            ...f,
            trainingDays: f.trainingDays.map((d, i) =>
              i === index ? { ...d, ...patch } : d,
            ),
          }
        : f,
    )
  }

  function updateTrainingLocation(index: number, patch: Partial<EventLocation>) {
    setForm((f) =>
      f
        ? {
            ...f,
            trainingDays: f.trainingDays.map((d, i) =>
              i === index ? { ...d, location: { ...d.location, ...patch } } : d,
            ),
          }
        : f,
    )
  }

  async function handleSave() {
    if (!form) return
    const parsed = configFormSchema.safeParse({
      season: form.season,
      trainingDays: form.trainingDays,
      icsUrl: form.icsUrl,
      reminderHoursBefore: form.reminderHoursBefore,
      brevoApiKey: form.brevoApiKey,
      emailFrom: form.emailFrom,
      calendarName: form.calendarName,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }
    try {
      await saveConfig.mutateAsync(form)
      toast.success('Configuration enregistrée')
    } catch {
      toast.error("Échec de l'enregistrement")
    }
  }

  async function handleGenerate() {
    if (!form) return
    if (!form.seasonStart || !form.seasonEnd) {
      toast.error('Définissez les dates de saison avant de générer')
      return
    }
    setGenerating(true)
    try {
      const res = await generateTrainingsSeq(form)
      toast.success(
        `${res.created} entraînement(s) créé(s) · ${res.skippedExisting} déjà existant(s)`,
      )
    } catch {
      toast.error('Échec de la génération')
    } finally {
      setGenerating(false)
    }
  }

  const seasonStartStr = form.seasonStart
    ? formatDate(toDate(form.seasonStart), 'yyyy-MM-dd')
    : ''
  const seasonEndStr = form.seasonEnd
    ? formatDate(toDate(form.seasonEnd), 'yyyy-MM-dd')
    : ''

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-secondary">Configuration</h1>

      {/* Saison */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-secondary">Saison</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Libellé saison</label>
            <input
              className="input"
              value={form.season}
              onChange={(e) => setForm({ ...form, season: e.target.value })}
              placeholder="2024-2025"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Début de saison</label>
            <input
              type="date"
              className="input"
              value={seasonStartStr}
              onChange={(e) =>
                setForm({
                  ...form,
                  seasonStart: Timestamp.fromDate(new Date(e.target.value)),
                })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Fin de saison</label>
            <input
              type="date"
              className="input"
              value={seasonEndStr}
              onChange={(e) =>
                setForm({
                  ...form,
                  seasonEnd: Timestamp.fromDate(new Date(e.target.value)),
                })
              }
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Le calendrier complet est généré entre ces deux dates. L'affichage par défaut montre 2 semaines glissantes.
        </p>
      </section>

      {/* Entraînements */}
      <section className="card space-y-4">
        <h2 className="font-semibold text-secondary">Jours d'entraînement</h2>
        <p className="text-xs text-slate-400">
          Configurez exactement 2 jours récurrents. Les exceptions (annulation, déplacement, changement de lieu) se gèrent event par event dans l'onglet Événements.
        </p>

        {form.trainingDays.map((day, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* Jour de la semaine */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">Jour</label>
                <select
                  className="input w-36"
                  value={day.dayOfWeek}
                  onChange={(e) =>
                    updateTrainingDay(idx, {
                      dayOfWeek: Number(e.target.value) as TrainingDay['dayOfWeek'],
                    })
                  }
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              {/* Libellé */}
              <div className="flex-1 min-w-32">
                <label className="mb-1 block text-xs text-slate-500">Libellé affiché</label>
                <input
                  className="input"
                  value={day.label}
                  onChange={(e) => updateTrainingDay(idx, { label: e.target.value })}
                  placeholder="Lundi soir"
                />
              </div>
              {/* Horaires */}
              <div>
                <label className="mb-1 block text-xs text-slate-500">Aller</label>
                <input
                  type="time"
                  className="input w-28"
                  value={day.departureTime}
                  onChange={(e) => updateTrainingDay(idx, { departureTime: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Retour</label>
                <input
                  type="time"
                  className="input w-28"
                  value={day.returnTime}
                  onChange={(e) => updateTrainingDay(idx, { returnTime: e.target.value })}
                />
              </div>
            </div>

            {/* Lieu par défaut */}
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Nom du lieu</label>
                  <input
                    className="input"
                    value={day.location.name}
                    onChange={(e) => updateTrainingLocation(idx, { name: e.target.value })}
                    placeholder="Gymnase Malraux"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Adresse</label>
                  <input
                    className="input"
                    value={day.location.address}
                    onChange={(e) => updateTrainingLocation(idx, { address: e.target.value })}
                    placeholder="15 rue André Malraux"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Ville</label>
                  <input
                    className="input"
                    value={day.location.city}
                    onChange={(e) => updateTrainingLocation(idx, { city: e.target.value })}
                    placeholder="Paris"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-secondary"
        >
          {generating ? (
            <Spinner className="h-4 w-4 text-white" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Générer / Regénérer le calendrier de la saison
        </button>
      </section>

      {/* Calendrier FFHB */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-secondary">Calendrier FFHB (ICS)</h2>
        <input
          className="input"
          value={form.icsUrl}
          onChange={(e) => setForm({ ...form, icsUrl: e.target.value })}
          placeholder="https://competition-calendar.ffhandball.fr/..."
        />
        {config?.icsLastSync && (
          <p className="text-xs text-slate-400">
            Dernière synchro : {formatDate(toDate(config.icsLastSync), 'PPpp')}
          </p>
        )}
        <p className="text-xs text-slate-400">
          La synchronisation est automatique toutes les 24h. Le bouton Sync dans l'onglet Événements permet de forcer une mise à jour immédiate.
        </p>
      </section>

      {/* Email Brevo */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-secondary">Email (Brevo)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Clé API Brevo</label>
            <input
              type="password"
              className="input"
              value={form.brevoApiKey}
              onChange={(e) => setForm({ ...form, brevoApiKey: e.target.value })}
              placeholder="xkeysib-..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Email expéditeur</label>
            <input
              type="email"
              className="input"
              value={form.emailFrom}
              onChange={(e) => setForm({ ...form, emailFrom: e.target.value })}
              placeholder="noreply@hand.fr"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Rappel (heures avant)</label>
            <input
              type="number"
              className="input"
              value={form.reminderHoursBefore}
              onChange={(e) =>
                setForm({ ...form, reminderHoursBefore: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Nom du calendrier exporté</label>
            <input
              className="input"
              value={form.calendarName}
              onChange={(e) => setForm({ ...form, calendarName: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Barre d'action */}
      <div className="sticky bottom-20 flex justify-end md:bottom-0">
        <button
          onClick={handleSave}
          disabled={saveConfig.isPending}
          className="btn-primary shadow-lg"
        >
          {saveConfig.isPending ? (
            <Spinner className="h-4 w-4 text-white" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Enregistrer
        </button>
      </div>
    </div>
  )
}
