import type { Address, Child, TripAddress, TripAddressKind } from '../types'

/** « 12 rue X, 75001 Paris » */
export function formatAddress(addr: Address): string {
  const cp = [addr.zipCode, addr.city].filter(Boolean).join(' ')
  return [addr.street, cp].filter(Boolean).join(', ')
}

/** Adresse d'un enfant selon le type choisi (défaut / secondaire). */
function childAddress(
  child: Child,
  kind: Exclude<TripAddressKind, 'custom'>,
): Address | undefined {
  return kind === 'default' ? child.addresses.default : child.addresses.secondary
}

/** Construit le snapshot TripAddress depuis la fiche enfant. */
export function tripAddressFromChild(
  child: Child,
  kind: Exclude<TripAddressKind, 'custom'>,
): TripAddress {
  const a = childAddress(child, kind) ?? child.addresses.default
  return { kind, ...a }
}

/** Libellé court d'une adresse de trajet : « Chez Maman » ou l'adresse custom. */
export function tripAddressLabel(addr: TripAddress | null): string {
  if (!addr) return ''
  if (addr.kind === 'custom') return formatAddress(addr)
  return addr.label || formatAddress(addr)
}
