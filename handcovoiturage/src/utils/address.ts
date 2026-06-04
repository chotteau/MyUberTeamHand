import type { Address, Child } from '../types'

/** Formate une adresse en une ligne lisible : « 12 rue X, 75001 Paris ». */
export function formatAddress(addr: Address): string {
  const cp = [addr.zipCode, addr.city].filter(Boolean).join(' ')
  return [addr.street, cp].filter(Boolean).join(', ')
}

/** Retrouve une adresse d'un enfant par son id. */
export function findAddress(
  child: Child | undefined,
  addressId: string,
): Address | undefined {
  return child?.addresses.find((a) => a.id === addressId)
}

/** Snapshot texte d'une adresse d'un enfant (pour les rides/passagers). */
export function snapshotAddress(
  child: Child | undefined,
  addressId: string,
): string {
  const addr = findAddress(child, addressId)
  return addr ? formatAddress(addr) : ''
}
