import { useState } from 'react'
import { MessageSquare } from 'lucide-react'

interface Props {
  value: string
  disabled: boolean
  placeholder: string
  onSave: (note: string) => void
}

/**
 * Commentaire libre (chauffeur ou enfant), enregistré à la sortie du champ
 * ou sur Entrée. Remonter le composant avec `key={value}` pour le resynchroniser.
 */
export function NoteField({ value, disabled, placeholder, onSave }: Props) {
  const [draft, setDraft] = useState(value)
  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim())
  }
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <input
        className="input !py-1 text-xs"
        placeholder={placeholder}
        disabled={disabled}
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}
