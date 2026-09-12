import { Loader2 } from 'lucide-react'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <Loader2
      className={`h-6 w-6 animate-spin text-primary ${className}`}
      aria-label="Chargement"
    />
  )
}

/** Spinner centré pour une page ou une section en chargement. */
export function PageSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Spinner />
    </div>
  )
}
