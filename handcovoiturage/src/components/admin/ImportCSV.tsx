import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Upload, FileCheck2, AlertTriangle, X } from 'lucide-react'
import { importFamiliesCsv, type ImportReport } from '../../services/csv'
import { Spinner } from '../ui/Spinner'

interface Props {
  onDone?: () => void
}

const CSV_HEADER =
  'prenom_enfant;nom_enfant;prenom_parent1;nom_parent1;email_parent1;tel_parent1;adresse1_rue;adresse1_cp;adresse1_ville;label_adresse1;prenom_parent2;nom_parent2;email_parent2;tel_parent2;adresse2_rue;adresse2_cp;adresse2_ville;label_adresse2;capacite_voiture'

export function ImportCSV({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [fileName, setFileName] = useState('')

  async function handleFile(file: File) {
    setFileName(file.name)
    setLoading(true)
    setReport(null)
    try {
      const text = await file.text()
      const res = await importFamiliesCsv(text)
      setReport(res)
      if (res.errors.length === 0) {
        toast.success(
          `${res.created} créé(s), ${res.updated} mis à jour, ${res.invitations} invitation(s)`,
        )
      } else {
        toast(`Import terminé avec ${res.errors.length} erreur(s)`, {
          icon: '⚠️',
        })
      }
      onDone?.()
    } catch {
      toast.error('Fichier illisible')
    } finally {
      setLoading(false)
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_HEADER + '\n'], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele_familles.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) handleFile(f)
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-primary hover:bg-primary-50"
      >
        {loading ? (
          <Spinner />
        ) : (
          <>
            <Upload className="h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">
              Glissez un fichier CSV ou cliquez pour choisir
            </p>
            <p className="text-xs text-slate-400">
              UTF-8, séparateur « ; »
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      </div>

      <button onClick={downloadTemplate} className="btn-ghost text-primary">
        Télécharger le modèle CSV
      </button>

      {report && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            {report.errors.length === 0 ? (
              <FileCheck2 className="h-5 w-5 text-success" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
            <h3 className="font-semibold">Rapport d'import — {fileName}</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Créés" value={report.created} color="text-success" />
            <Stat
              label="Mis à jour"
              value={report.updated}
              color="text-primary"
            />
            <Stat
              label="Invitations"
              value={report.invitations}
              color="text-secondary"
            />
          </div>
          {report.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-danger">
                {report.errors.length} erreur(s)
              </p>
              <ul className="max-h-40 space-y-1 overflow-auto text-xs">
                {report.errors.map((err, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1 rounded bg-red-50 px-2 py-1 text-red-700"
                  >
                    <X className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Ligne {err.line} : {err.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-lg bg-slate-50 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
