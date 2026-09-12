import { useState } from 'react'
import { formatAddress, tripAddressFromChild } from '../../utils/address'
import type { Child, TripAddress } from '../../types'

interface Props {
  child: Child
  value: TripAddress
  onChange: (addr: TripAddress) => void
  disabled?: boolean
}

/**
 * Choix de l'adresse pour une direction : par défaut / secondaire / autre
 * (saisie à la main, stockée uniquement sur cette participation).
 */
export function TripAddressPicker({ child, value, onChange, disabled }: Props) {
  const [customOpen, setCustomOpen] = useState(value.kind === 'custom')
  const [custom, setCustom] = useState({
    street: value.kind === 'custom' ? value.street : '',
    zipCode: value.kind === 'custom' ? value.zipCode : '',
    city: value.kind === 'custom' ? value.city : '',
  })

  const options: { kind: 'default' | 'secondary'; label: string; detail: string }[] = [
    {
      kind: 'default',
      label: child.addresses.default.label || 'Par défaut',
      detail: formatAddress(child.addresses.default),
    },
  ]
  if (child.addresses.secondary) {
    options.push({
      kind: 'secondary',
      label: child.addresses.secondary.label || 'Secondaire',
      detail: formatAddress(child.addresses.secondary),
    })
  }

  const customValid = custom.street.trim() && custom.city.trim()

  return (
    <div className="space-y-1.5">
      {options.map((o) => (
        <label
          key={o.kind}
          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 text-xs transition ${
            value.kind === o.kind && !customOpen
              ? 'border-primary bg-primary-50'
              : 'border-slate-200'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <input
            type="radio"
            className="mt-0.5"
            disabled={disabled}
            checked={value.kind === o.kind && !customOpen}
            onChange={() => {
              setCustomOpen(false)
              onChange(tripAddressFromChild(child, o.kind))
            }}
          />
          <span>
            <span className="font-medium text-secondary">{o.label}</span>
            <span className="block text-slate-500">{o.detail}</span>
          </span>
        </label>
      ))}

      <label
        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 text-xs transition ${
          customOpen ? 'border-primary bg-primary-50' : 'border-slate-200'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          type="radio"
          className="mt-0.5"
          disabled={disabled}
          checked={customOpen}
          onChange={() => setCustomOpen(true)}
        />
        <span className="flex-1">
          <span className="font-medium text-secondary">Autre adresse…</span>
          {customOpen && (
            <span className="mt-1.5 block space-y-1.5">
              <input
                className="input !py-1 text-xs"
                placeholder="Rue"
                disabled={disabled}
                value={custom.street}
                onChange={(e) => setCustom({ ...custom, street: e.target.value })}
              />
              <span className="flex gap-1.5">
                <input
                  className="input !py-1 w-24 text-xs"
                  placeholder="CP"
                  disabled={disabled}
                  value={custom.zipCode}
                  onChange={(e) => setCustom({ ...custom, zipCode: e.target.value })}
                />
                <input
                  className="input !py-1 text-xs"
                  placeholder="Ville"
                  disabled={disabled}
                  value={custom.city}
                  onChange={(e) => setCustom({ ...custom, city: e.target.value })}
                />
              </span>
              <button
                type="button"
                className="btn-primary !py-1 text-xs"
                disabled={disabled || !customValid}
                onClick={() =>
                  onChange({
                    kind: 'custom',
                    label: 'Autre',
                    street: custom.street.trim(),
                    zipCode: custom.zipCode.trim(),
                    city: custom.city.trim(),
                  })
                }
              >
                Utiliser cette adresse
              </button>
            </span>
          )}
        </span>
      </label>
    </div>
  )
}
