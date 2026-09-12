import { useState } from 'react'
import toast from 'react-hot-toast'
import { Users, UserRound, Upload, Plus, Pencil, Power, ChevronDown } from 'lucide-react'
import { useChildren, useToggleChildActive } from '../../hooks/useChildren'
import { useUsers, useToggleUserActive } from '../../hooks/useUsers'
import { ImportCSV } from '../../components/admin/ImportCSV'
import { ChildFormModal } from '../../components/admin/ChildFormModal'
import { PageSpinner, Spinner } from '../../components/ui/Spinner'
import { formatAddress } from '../../utils/address'
import type { Child } from '../../types'

export default function AdminFamilies() {
  const { data: children, isLoading } = useChildren()
  const toggleActive = useToggleChildActive()
  const [showImport, setShowImport] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<Child | null | 'new'>(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
          <Users className="h-5 w-5 text-primary" />
          Familles
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport((s) => !s)} className="btn-secondary">
            <Upload className="h-4 w-4" />
            Importer CSV
          </button>
          <button onClick={() => setEditing('new')} className="btn-primary">
            <Plus className="h-4 w-4" />
            Enfant
          </button>
        </div>
      </div>

      {showImport && (
        <section className="card">
          <ImportCSV onDone={() => setShowImport(false)} />
        </section>
      )}

      {isLoading ? (
        <PageSpinner />
      ) : !children || children.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">
          Aucune famille. Importez un fichier CSV ou ajoutez un enfant.
        </div>
      ) : (
        <div className="space-y-2">
          {children.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              expanded={expanded === child.id}
              onToggleExpand={() => setExpanded((e) => (e === child.id ? null : child.id))}
              onEdit={() => setEditing(child)}
              pending={toggleActive.isPending && toggleActive.variables?.id === child.id}
              onToggleActive={() =>
                toggleActive.mutate(
                  { id: child.id, active: !child.active },
                  {
                    onSuccess: (n) =>
                      toast.success(
                        child.active
                          ? `${child.firstName} désactivé${n ? ` · retiré de ${n} événement(s)` : ''}`
                          : `${child.firstName} réactivé`,
                      ),
                    onError: () => toast.error('Échec'),
                  },
                )
              }
            />
          ))}
        </div>
      )}

      <AccountsSection />

      {editing && (
        <ChildFormModal child={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

/** Comptes ayant déjà ouvert l'app : activer / désactiver un parent. */
function AccountsSection() {
  const { data: users, isLoading } = useUsers()
  const toggle = useToggleUserActive()
  const { data: children } = useChildren()

  const childrenOf = (email: string) =>
    (children ?? [])
      .filter((c) => c.parentEmails.includes(email))
      .map((c) => c.firstName)
      .join(', ')

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <UserRound className="h-4 w-4 text-primary" />
        Comptes connectés
      </h2>
      <p className="text-xs text-slate-400">
        Un parent apparaît ici après sa première connexion. Un compte désactivé ne peut plus
        ouvrir l'app ni déclarer de voiture.
      </p>
      {isLoading ? (
        <PageSpinner />
      ) : !users || users.length === 0 ? (
        <div className="card py-6 text-center text-sm text-slate-400">Aucun compte pour l'instant.</div>
      ) : (
        users.map((u) => (
          <div key={u.uid} className={`card flex items-center justify-between !p-3 ${u.active ? '' : 'opacity-60'}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium text-secondary">
                {u.displayName || '(sans prénom)'}
                {u.role === 'admin' && <span className="badge bg-secondary text-white">Admin</span>}
              </div>
              <div className="truncate text-xs text-slate-400">
                {u.email}
                {childrenOf(u.email) ? ` · ${childrenOf(u.email)}` : ' · aucun enfant associé'}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {u.active ? 'Actif' : 'Désactivé'}
              </span>
              {u.role !== 'admin' && (
                <button
                  onClick={() =>
                    toggle.mutate(
                      { uid: u.uid, active: !u.active },
                      {
                        onSuccess: (n) =>
                          toast.success(
                            u.active
                              ? `Compte désactivé${n ? ` · voiture retirée de ${n} événement(s)` : ''}`
                              : 'Compte réactivé',
                          ),
                        onError: () => toast.error('Échec'),
                      },
                    )
                  }
                  disabled={toggle.isPending && toggle.variables?.uid === u.uid}
                  className="btn-ghost p-2 text-slate-500"
                  aria-label="Activer/désactiver"
                  title={u.active ? 'Désactiver' : 'Activer'}
                >
                  {toggle.isPending && toggle.variables?.uid === u.uid ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function ChildRow({
  child,
  expanded,
  onToggleExpand,
  onEdit,
  onToggleActive,
}: {
  child: Child
  expanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onToggleActive: () => void
  pending?: boolean
}) {
  return (
    <div className={`card !p-0 ${child.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between p-3">
        <button onClick={onToggleExpand} className="flex flex-1 items-center gap-3 text-left">
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
          <div>
            <div className="font-medium text-secondary">{child.firstName}</div>
            <div className="text-xs text-slate-400">
              {child.parents.map((p) => p.firstName).join(' & ') || 'Aucun parent'} ·{' '}
              {child.addresses.secondary ? '2 adresses' : '1 adresse'}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <span className={`badge ${child.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {child.active ? 'Actif' : 'Inactif'}
          </span>
          <button onClick={onEdit} className="btn-ghost p-2 text-slate-500" aria-label="Modifier">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onToggleActive} disabled={pending} className="btn-ghost p-2 text-slate-500" aria-label="Activer/désactiver">
            {pending ? <Spinner className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-slate-100 p-3 text-sm">
          {child.parents.map((p) => (
            <div key={p.email} className="text-slate-600">
              <span className="font-medium">{p.firstName}</span>{' '}
              <span className="text-slate-400">{p.email}</span>
            </div>
          ))}
          <div className="rounded-lg bg-slate-50 p-2">
            <span className="font-medium">{child.addresses.default.label}</span> —{' '}
            <span className="text-slate-500">{formatAddress(child.addresses.default)}</span>
          </div>
          {child.addresses.secondary && (
            <div className="rounded-lg bg-slate-50 p-2">
              <span className="font-medium">{child.addresses.secondary.label}</span> —{' '}
              <span className="text-slate-500">{formatAddress(child.addresses.secondary)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
