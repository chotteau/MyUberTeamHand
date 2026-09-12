import Papa from 'papaparse'
import { createChild, findChildByFirstName, updateChild } from './children'
import { csvFamilyRowSchema, type CsvFamilyRow } from '../utils/validation'
import type { ChildAddresses, ChildParent } from '../types'

export interface ImportError {
  line: number
  message: string
}

export interface ImportReport {
  created: number
  updated: number
  errors: ImportError[]
}

export const CSV_HEADER =
  'prenom_enfant;prenom_parent1;email_parent1;adresse1_rue;adresse1_cp;adresse1_ville;label_adresse1;prenom_parent2;email_parent2;adresse2_rue;adresse2_cp;adresse2_ville;label_adresse2'

/** Parse un texte CSV (séparateur ';', UTF-8) en lignes brutes. */
export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return result.data
}

function buildParents(row: CsvFamilyRow): ChildParent[] {
  const parents: ChildParent[] = [
    { firstName: row.prenom_parent1, email: row.email_parent1 },
  ]
  if (row.email_parent2) {
    parents.push({
      firstName: row.prenom_parent2 || 'Parent 2',
      email: row.email_parent2,
    })
  }
  return parents
}

/** adresse1 → défaut ; adresse2 → secondaire uniquement si renseignée. */
function buildAddresses(row: CsvFamilyRow): ChildAddresses {
  const addresses: ChildAddresses = {
    default: {
      label: row.label_adresse1 || 'Domicile',
      street: row.adresse1_rue,
      zipCode: row.adresse1_cp,
      city: row.adresse1_ville,
    },
  }
  if (row.adresse2_rue && row.adresse2_ville) {
    addresses.secondary = {
      label: row.label_adresse2 || 'Adresse 2',
      street: row.adresse2_rue,
      zipCode: row.adresse2_cp,
      city: row.adresse2_ville,
    }
  }
  return addresses
}

/**
 * Importe les familles. Enfant existant (même prénom) → mis à jour, sinon créé.
 * La liaison parent ↔ enfant se fait ensuite automatiquement par l'email du compte.
 */
export async function importFamiliesCsv(text: string): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, errors: [] }
  const rows = parseCsv(text)

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2 // en-tête + base 1
    const parsed = csvFamilyRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      report.errors.push({
        line,
        message: parsed.error.issues
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join(', '),
      })
      continue
    }

    const row = parsed.data
    const input = {
      firstName: row.prenom_enfant,
      parents: buildParents(row),
      addresses: buildAddresses(row),
      active: true,
    }
    try {
      const existing = await findChildByFirstName(row.prenom_enfant)
      if (existing) {
        await updateChild(existing.id, input)
        report.updated++
      } else {
        await createChild(input)
        report.created++
      }
    } catch (e) {
      report.errors.push({
        line,
        message: e instanceof Error ? e.message : 'Erreur inconnue',
      })
    }
  }

  return report
}
