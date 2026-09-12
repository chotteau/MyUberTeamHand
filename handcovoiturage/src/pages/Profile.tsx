import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { User as UserIcon, Mail, Baby, CalendarPlus, Shield, Pencil, CircleHelp } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useMyChildren } from '../hooks/useChildren'
import { useConfig } from '../hooks/useConfig'
import { updateDisplayName } from '../services/auth'
import { formatAddress } from '../utils/address'
import { Spinner, PageSpinner } from '../components/ui/Spinner'
import { ChildAddressesModal } from '../components/admin/ChildFormModal'
import type { Child, User } from '../types'

export default function Profile() {
  const { profile } = useAuth()
  if (!profile) return <PageSpinner />
  // key : le formulaire est (ré)initialisé avec le prénom réellement enregistré.
  return <ProfileContent key={profile.uid + profile.displayName} profile={profile} />
}

function ProfileContent({ profile }: { profile: User }) {
  const { isAdmin, refreshProfile } = useAuth()
  const { data: myChildren } = useMyChildren()
  const { data: config } = useConfig()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [editing, setEditing] = useState<Child | null>(null)

  const save = useMutation({
    mutationFn: () => updateDisplayName(profile.uid, displayName),
    onSuccess: async () => {
      await refreshProfile()
      toast.success('Profil mis à jour')
    },
    onError: () => toast.error('Échec de la mise à jour'),
  })

  const base = (import.meta.env.VITE_APP_URL ?? window.location.origin).replace(/\/$/, '')
  const calendarUrl = config?.calendarToken
    ? `${base}/api/calendar/${config.calendarToken}.ics`
    : ''
  const webcalUrl = calendarUrl.replace(/^https?:\/\//, 'webcal://')

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

      <section className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Prénom affiché</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jean"
          />
          <p className="mt-1 text-xs text-slate-400">En cas de doublon, ajoutez une initiale : « Jean M »</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Mail className="h-4 w-4" />
          {profile.email}
        </div>
        <button
          onClick={() => save.mutate()}
          className="btn-primary w-full"
          disabled={save.isPending || !displayName.trim()}
        >
          {save.isPending ? <Spinner className="h-4 w-4 text-white" /> : 'Enregistrer'}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Baby className="h-4 w-4 text-primary" />
          Mes enfants
        </h2>
        {!myChildren || myChildren.length === 0 ? (
          <p className="text-sm text-slate-400">
            Aucun enfant associé à {profile.email}. Contactez un administrateur.
          </p>
        ) : (
          myChildren.map((child) => (
            <div key={child.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-secondary">{child.firstName}</span>
                <button
                  onClick={() => setEditing(child)}
                  className="btn-ghost !p-1 text-xs text-primary"
                >
                  <Pencil className="h-3 w-3" />
                  Adresses
                </button>
              </div>
              <div className="mt-1 text-slate-500">
                <span className="font-medium">{child.addresses.default.label}</span> —{' '}
                {formatAddress(child.addresses.default)}
              </div>
              {child.addresses.secondary && (
                <div className="text-slate-500">
                  <span className="font-medium">{child.addresses.secondary.label}</span> —{' '}
                  {formatAddress(child.addresses.secondary)}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <CalendarPlus className="h-4 w-4 text-primary" />
          Calendrier partagé
        </h2>
        {!calendarUrl ? (
          <p className="text-sm text-slate-400">
            Le lien d'abonnement n'est pas encore généré (Admin → Config).
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Abonnez-vous : chaque événement contient, dans ses notes, qui emmène
              et ramène qui, et à quelle adresse.
            </p>
            <a href={webcalUrl} className="btn-primary w-full">
              <CalendarPlus className="h-4 w-4" />
              S'abonner (Apple Calendrier / Outlook)
            </a>
            <p className="text-xs text-slate-500">
              Google Agenda : « Autres agendas » → « À partir d'une URL » → collez :
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
              Copier le lien
            </button>
          </>
        )}
      </section>

      <Link to="/aide" className="btn-ghost w-full text-slate-500">
        <CircleHelp className="h-4 w-4" />
        Mode d'emploi (lien à partager)
      </Link>

      {editing && <ChildAddressesModal child={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
