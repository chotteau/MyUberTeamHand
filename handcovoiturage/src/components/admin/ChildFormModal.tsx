import { useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { useSaveChild, useSaveChildAddresses } from '../../hooks/useChildren'
import { addressSchema } from '../../utils/validation'
import type { Address, Child, ChildAddresses, ChildParent } from '../../types'

const EMPTY_ADDR: Address = { label: '', street: '', zipCode: '', city: '' }

function AddressFields({
  title,
  value,
  onChange,
  optional,
}: {
  title: string
  value: Address | undefined
  onChange: (a: Address | undefined) => void
  optional?: boolean
}) {
  const a = value ?? EMPTY_ADDR
  const set = (patch: Partial<Address>) => onChange({ ...a, ...patch })
  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase text-slate-400">{title}</legend>
      {optional && !value ? (
        <button type="button" className="btn-ghost text-xs text-primary" onClick={() => onChange(EMPTY_ADDR)}>
          + Ajouter une adresse secondaire (parents séparés)
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="Libellé (Chez Papa)" value={a.label} onChange={(e) => set({ label: e.target.value })} />
          <input className="input" placeholder="Rue" value={a.street} onChange={(e) => set({ street: e.target.value })} />
          <input className="input" placeholder="Code postal" value={a.zipCode} onChange={(e) => set({ zipCode: e.target.value })} />
          <input className="input" placeholder="Ville" value={a.city} onChange={(e) => set({ city: e.target.value })} />
          {optional && (
            <button type="button" className="btn-ghost text-xs text-danger sm:col-span-2" onClick={() => onChange(undefined)}>
              Retirer l'adresse secondaire
            </button>
          )}
        </div>
      )}
    </fieldset>
  )
}

function validateAddresses(addresses: ChildAddresses): string | null {
  const d = addressSchema.safeParse(addresses.default)
  if (!d.success) return `Adresse par défaut : ${d.error.issues[0].message}`
  if (addresses.secondary) {
    const s = addressSchema.safeParse(addresses.secondary)
    if (!s.success) return `Adresse secondaire : ${s.error.issues[0].message}`
  }
  return null
}

// ---------------------------------------------------------------------------
// Fiche enfant complète (admin)
// ---------------------------------------------------------------------------

export function ChildFormModal({ child, onClose }: { child: Child | null; onClose: () => void }) {
  const save = useSaveChild()
  const [firstName, setFirstName] = useState(child?.firstName ?? '')
  const [parents, setParents] = useState<ChildParent[]>(
    child?.parents.length ? child.parents : [{ firstName: '', email: '' }],
  )
  const [addresses, setAddresses] = useState<ChildAddresses>(
    child?.addresses ?? { default: EMPTY_ADDR },
  )

  function setParent(i: number, patch: Partial<ChildParent>) {
    setParents((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }

  async function handleSubmit() {
    if (!firstName.trim()) return toast.error('Prénom requis')
    const validParents = parents.filter((p) => p.email.trim())
    if (validParents.length === 0) return toast.error('Au moins un email parent requis')
    const err = validateAddresses(addresses)
    if (err) return toast.error(err)
    try {
      await save.mutateAsync({
        id: child?.id,
        input: { firstName, parents: validParents, addresses, active: child?.active ?? true },
      })
      toast.success(child ? 'Fiche mise à jour' : 'Enfant créé')
      onClose()
    } catch {
      toast.error("Échec de l'enregistrement")
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={child ? `Fiche de ${child.firstName}` : 'Nouvel enfant'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={save.isPending}>Annuler</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={save.isPending}>
            {save.isPending ? <Spinner className="h-4 w-4 text-white" /> : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Prénom de l'enfant</label>
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Lucas (ou « Lucas M » si doublon)" />
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-slate-400">Parents (1 ou 2)</legend>
          <div className="space-y-2">
            {parents.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <input className="input" placeholder={`Prénom parent ${i + 1}`} value={p.firstName} onChange={(e) => setParent(i, { firstName: e.target.value })} />
                <input className="input" type="email" placeholder="email@…" value={p.email} onChange={(e) => setParent(i, { email: e.target.value })} />
              </div>
            ))}
            {parents.length < 2 ? (
              <button type="button" className="btn-ghost text-xs text-primary" onClick={() => setParents([...parents, { firstName: '', email: '' }])}>
                + Ajouter le 2e parent
              </button>
            ) : (
              <button type="button" className="btn-ghost text-xs text-danger" onClick={() => setParents(parents.slice(0, 1))}>
                Retirer le 2e parent
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Chaque parent se connecte avec cet email : l'enfant lui est associé automatiquement.
          </p>
        </fieldset>

        <AddressFields title="Adresse par défaut" value={addresses.default} onChange={(a) => setAddresses({ ...addresses, default: a ?? EMPTY_ADDR })} />
        <AddressFields title="Adresse secondaire" optional value={addresses.secondary} onChange={(a) => setAddresses({ default: addresses.default, ...(a ? { secondary: a } : {}) })} />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Adresses uniquement (parent, depuis son profil)
// ---------------------------------------------------------------------------

export function ChildAddressesModal({ child, onClose }: { child: Child; onClose: () => void }) {
  const save = useSaveChildAddresses()
  const [addresses, setAddresses] = useState<ChildAddresses>(child.addresses)

  async function handleSubmit() {
    const err = validateAddresses(addresses)
    if (err) return toast.error(err)
    try {
      await save.mutateAsync({ id: child.id, addresses })
      toast.success('Adresses mises à jour')
      onClose()
    } catch {
      toast.error("Échec de l'enregistrement")
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adresses de ${child.firstName}`}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={save.isPending}>Annuler</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={save.isPending}>
            {save.isPending ? <Spinner className="h-4 w-4 text-white" /> : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <AddressFields title="Adresse par défaut" value={addresses.default} onChange={(a) => setAddresses({ ...addresses, default: a ?? EMPTY_ADDR })} />
        <AddressFields title="Adresse secondaire" optional value={addresses.secondary} onChange={(a) => setAddresses({ default: addresses.default, ...(a ? { secondary: a } : {}) })} />
        <p className="text-xs text-slate-400">
          Pour un trajet ponctuel vers une autre adresse, utilisez « Autre adresse… » sur l'événement.
        </p>
      </div>
    </Modal>
  )
}
