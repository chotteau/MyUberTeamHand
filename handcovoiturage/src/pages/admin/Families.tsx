import { useState } from 'react'
import { Users, Upload, MapPin, Power, ChevronDown } from 'lucide-react'
import { useChildren, useToggleChildActive } from '../../hooks/useChildren'
import { ImportCSV } from '../../components/admin/ImportCSV'
import { Spinner } from '../../components/ui/Spinner'
import type { Child } from '../../types'

export default function AdminFamilies() {
  const { data: children, isLoading } = useChildren()
  const toggleActive = useToggleChildActive()
  const [showImport, setShowImport] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-secondary">
          <Users className="h-5 w-5 text-primary" />
          Familles
        </h1>
        <button
          onClick={() => setShowImport((s) => !s)}
          className="btn-primary"
        >
          <Upload className="h-4 w-4" />
          Importer CSV
        </button>
      </div>

      {showImport && (
        <section className="card">
          <ImportCSV onDone={() => undefined} />
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !children || children.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-400">
          Aucune famille. Importez un fichier CSV pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {children.map((child) => (
            <ChildRow
              key={child.id}
              child={child}
              expanded={expanded === child.id}
              onToggleExpand={() =>
                setExpanded((e) => (e === child.id ? null : child.id))
              }
              onToggleActive={() =>
                toggleActive.mutate({ id: child.id, active: !child.active })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChildRow({
  child,
  expanded,
  onToggleExpand,
  onToggleActive,
}: {
  child: Child
  expanded: boolean
  onToggleExpand: () => void
  onToggleActive: () => void
}) {
  return (
    <div className="card !p-0">
      <div className="flex items-center justify-between p-3">
        <button
          onClick={onToggleExpand}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition ${
              expanded ? 'rotate-180' : ''
            }`}
          />
          <div>
            <div className="font-medium text-secondary">
              {child.firstName}
            </div>
            <div className="text-xs text-slate-400">
              {child.parentIds.length} parent(s) lié(s) ·{' '}
              {child.addresses.length} adresse(s)
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`badge ${
              child.active
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {child.active ? 'Actif' : 'Inactif'}
          </span>
          <button
            onClick={onToggleActive}
            className="btn-ghost p-2 text-slate-500"
            aria-label="Activer/désactiver"
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-slate-100 p-3">
          {child.addresses.map((addr) => (
            <div
              key={addr.id}
              className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="font-medium">{addr.label}</div>
                <div className="text-slate-500">
                  {addr.street}, {addr.zipCode} {addr.city}
                </div>
              </div>
            </div>
          ))}
          {child.addresses.length === 0 && (
            <p className="text-sm text-slate-400">Aucune adresse renseignée.</p>
          )}
        </div>
      )}
    </div>
  )
}
