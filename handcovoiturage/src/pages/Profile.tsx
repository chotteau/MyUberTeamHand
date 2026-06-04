import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  User as UserIcon,
  Mail,
  Baby,
  MapPin,
  LogOut,
  CalendarPlus,
  Shield,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useChildren } from '../hooks/useChildren'
import { updateUserProfile, signOut } from '../services/auth'
import { formatAddress } from '../utils/address'
import { Spinner } from '../components/ui/Spinner'

const CALENDAR_PATH = '/api/calendar/handcovoiturage.ics'

export default function Profile() {
  const { profile, isAdmin, refreshProfile } = useAuth()
  const { data: children } = useChildren()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '')
    }
  }, [profile])

  const myChild = profile?.childId
    ? (children ?? []).find((c) => c.id === profile.childId)
    : undefined

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      await updateUserProfile(profile.uid, { displayName })
      await refreshProfile()
      toast.success('Profil mis à jour')
    } catch {
      toast.error('Échec de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const calendarUrl =
    (import.meta.env.VITE_APP_URL ?? window.location.origin) + CALENDAR_PATH
  // webcal:// → Apple Calendrier / Outlook proposent « S'abonner » (et
  // resynchronisent), au lieu d'un import ponctuel comme avec https://.
  const webcalUrl = calendarUrl.replace(/^https?:\/\//, 'webcal://')

  if (!profile) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
        <UserIcon className="h-5 w-5 text-primary" />
        Mon profil
        {isAdmin && (
          <span className="badge inline-flex items-center gap-1 bg-secondary text-white">
            <Shield className="h-3 w-3" />
            Admin
          </span>
        )}
      </h1>

      {/* Coordonnées */}
      <section className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Nom affiché
          </label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Prénom Nom"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Mail className="h-4 w-4" />
          {profile.email}
        </div>
        <button
          onClick={handleSave}
          className="btn-primary w-full"
          disabled={saving}
        >
          {saving ? <Spinner /> : 'Enregistrer'}
        </button>
      </section>

      {/* Enfant rattaché */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Baby className="h-4 w-4 text-primary" />
          Mon enfant
        </h2>
        {!myChild ? (
          <p className="text-sm text-slate-400">
            Aucun enfant rattaché à votre compte. Contactez un administrateur.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="font-medium text-secondary">
              {myChild.firstName}
            </div>
            {myChild.addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="font-medium">{addr.label}</div>
                  <div className="text-slate-500">{formatAddress(addr)}</div>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400">
              Les adresses sont gérées par un administrateur.
            </p>
          </div>
        )}
      </section>

      {/* Calendrier */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <CalendarPlus className="h-4 w-4 text-primary" />
          Calendrier des trajets
        </h2>
        <p className="text-sm text-slate-500">
          Abonnez-vous à ce calendrier pour voir vos trajets se mettre à jour
          automatiquement.
        </p>

        {/* Apple Calendrier / Outlook : abonnement direct via webcal:// */}
        <a href={webcalUrl} className="btn-primary w-full">
          <CalendarPlus className="h-4 w-4" />
          S'abonner (Apple Calendrier / Outlook)
        </a>

        {/* Google Agenda : nécessite une URL https à coller manuellement */}
        <p className="text-xs text-slate-500">
          Google Agenda : « Autres agendas » → « À partir d'une URL » → collez
          ce lien :
        </p>
        <code className="block overflow-x-auto rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
          {calendarUrl}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(calendarUrl)
            toast.success('Lien copié')
          }}
          className="btn-secondary w-full"
        >
          Copier le lien (https)
        </button>
      </section>

      {/* Déconnexion */}
      <button
        onClick={() => signOut()}
        className="btn-ghost w-full text-danger"
      >
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </button>
    </div>
  )
}
