import type { Direction } from '../types'

/** « Aller » / « Retour ». */
export const DIR_LABEL: Record<Direction, string> = { aller: 'Aller', retour: 'Retour' }

/** « à l'aller » / « au retour ». */
export const atDirection = (d: Direction) => (d === 'aller' ? "à l'aller" : 'au retour')

/** « l'aller » / « le retour ». */
export const theDirection = (d: Direction) => (d === 'aller' ? "l'aller" : 'le retour')
