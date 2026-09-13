import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'

/** Petit ⓘ vers une section du mode d'emploi (/aide#section). */
export function HelpLink({ section, label = 'Aide' }: { section: string; label?: string }) {
  return (
    <Link
      to={`/aide#${section}`}
      className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-primary-50 hover:text-primary"
      aria-label={`${label} — mode d'emploi`}
      title="Comment ça marche ?"
    >
      <Info className="h-4 w-4" />
    </Link>
  )
}
