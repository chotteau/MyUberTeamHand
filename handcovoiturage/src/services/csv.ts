import Papa from 'papaparse'
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  createChild,
  findChildByFirstName,
  makeAddressId,
  mergeAddresses,
  updateChild,
} from './children'
import { csvFamilyRowSchema, type CsvFamilyRow } from '../utils/validation'
import type { Address } from '../types'

export interface ImportError {
  line: number
  message: string
}

export interface ImportReport {
  created: number
  updated: number
  invitations: number
  errors: ImportError[]
}

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

/**
 * Construit les adresses d'un enfant à partir d'une ligne CSV validée.
 * - Si adresse2 vide → 1 seule adresse (parents même toit)
 * - Sinon → 2 adresses distinctes
 */
function buildAddresses(
  row: CsvFamilyRow,
  parent1Email: string,
  parent2Email: string,
): Address[] {
  const addresses: Address[] = [
    {
      id: makeAddressId(),
      label: row.label_adresse1 || 'Domicile',
      street: row.adresse1_rue,
      city: row.adresse1_ville,
      zipCode: row.adresse1_cp,
      parentUid: parent1Email, // placeholder : remplacé par l'UID à la liaison
    },
  ]
  // Adresse 2 uniquement si différente (rue renseignée)
  if (row.adresse2_rue && row.adresse2_ville) {
    addresses.push({
      id: makeAddressId(),
      label: row.label_adresse2 || 'Domicile 2',
      street: row.adresse2_rue,
      city: row.adresse2_ville,
      zipCode: row.adresse2_cp,
      parentUid: parent2Email || parent1Email,
    })
  }
  return addresses
}

/**
 * Crée une invitation (token) pour un parent.
 * L'email réel est envoyé par une Cloud Function (clé Brevo côté serveur).
 */
async function queueInvitation(
  email: string,
  firstName: string,
  childId: string,
): Promise<void> {
  if (!email) return
  await addDoc(collection(db, 'invitations'), {
    email,
    firstName,
    childId,
    token: crypto.randomUUID(),
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

/**
 * Importe les familles depuis un texte CSV (format v2 sans nom/tél/capacité).
 * - Validation Zod ligne par ligne
 * - Déduplication enfant par prénom (pas de doublon attendu)
 * - File d'invitations pour chaque parent
 * - Monoparental supporté (parent2 optionnel)
 */
export async function importFamiliesCsv(text: string): Promise<ImportReport> {
  const report: ImportReport = {
    created: 0,
    updated: 0,
    invitations: 0,
    errors: [],
  }
  const rows = parseCsv(text)

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2 // +1 en-tête, +1 base 1
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
    try {
      const addresses = buildAddresses(
        row,
        row.email_parent1,
        row.email_parent2 ?? '',
      )

      const existing = await findChildByFirstName(row.prenom_enfant)

      let childId: string
      if (existing) {
        await updateChild(existing.id, {
          addresses: mergeAddresses(existing.addresses, addresses),
          active: true,
        })
        childId = existing.id
        report.updated++
      } else {
        childId = await createChild({
          firstName: row.prenom_enfant,
          parentIds: [],
          addresses,
          active: true,
        })
        report.created++
      }

      await queueInvitation(row.email_parent1, row.prenom_parent1, childId)
      report.invitations++

      if (row.email_parent2 && row.prenom_parent2) {
        await queueInvitation(row.email_parent2, row.prenom_parent2, childId)
        report.invitations++
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
