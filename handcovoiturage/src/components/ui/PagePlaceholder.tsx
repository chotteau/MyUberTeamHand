import { Construction } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

/** Placeholder temporaire pour les écrans en cours de développement. */
export function PagePlaceholder({ title, description }: Props) {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-secondary">{title}</h1>
      <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Construction className="h-10 w-10 text-primary" />
        <p className="max-w-sm text-sm text-slate-500">
          {description ?? 'Écran en cours de construction.'}
        </p>
      </div>
    </div>
  )
}
