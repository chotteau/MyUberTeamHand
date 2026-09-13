import { RotateCcw } from 'lucide-react'

/**
 * Sur un téléphone tenu en paysage (hauteur < 500 px), incite à repasser en
 * portrait : le tableau et les blocs y sont plus lisibles.
 */
export function OrientationHint() {
  return (
    <div className="hidden items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-white [@media(orientation:landscape)_and_(max-height:500px)]:flex">
      <RotateCcw className="h-4 w-4 shrink-0" />
      Tournez votre téléphone en portrait : c'est plus lisible.
    </div>
  )
}
