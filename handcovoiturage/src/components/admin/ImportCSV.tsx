import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Upload, FileCheck2, AlertTriangle, X } from 'lucide-react'
import { CSV_HEADER, importFamiliesCsv } from '../../services/csv'
import { Spinner } from '../ui/Spinner'

const CSV_EXAMPLE = `${CSV_HEADER}
Lucas;Jean;jean.martin@email.fr;12 rue de la Paix;75001;Paris;Chez Papa;Marie;marie.martin@email.fr;45 avenue Gambetta;75020;Paris;Chez Maman
Emma;Sophie;sophie.petit@email.fr;8 rue des Roses;75015;Paris;Domicile;;;;;;
`

export function ImportCSV({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')

  const importCsv = useMutation({
    mutationFn: async (file: File) => importFamiliesCsv(await file.text()),
    onSuccess: (res) => {
      if (res.errors.length === 0) {
        toast.success(`${res.created} créé(s), ${res.updated} mis à jour`)
      } else {
        toast(`Import terminé avec ${res.errors.length} erreur(s)`, { icon: '⚠️' })
      }
      onDone?.()
    },
    onError: () => toast.error('Fichier illisible'),
  })

  function handleFile(file: File) {
    setFileName(file.name)
    importCsv.mutate(file)
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_EXAMPLE], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'modele_familles.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const report = importCsv.data

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
        {importCsv.isPending ? (
          <Spinner />
        ) : (
          <>
            <Upload className="h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">Glissez un fichier CSV ou cliquez pour choisir</p>
            <p className="text-xs text-slate-400">UTF-8, séparateur « ; » — sans nom de famille ni téléphone</p>
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
          <div className="grid grid-cols-2 gap-3 text-center">
            <Stat label="Créés" value={report.created} color="text-success" />
            <Stat label="Mis à jour" value={report.updated} color="text-primary" />
          </div>
          {report.errors.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-auto text-xs">
              {report.errors.map((err, i) => (
                <li key={i} className="flex items-start gap-1 rounded bg-red-50 px-2 py-1 text-red-700">
                  <X className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>Ligne {err.line} : {err.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
