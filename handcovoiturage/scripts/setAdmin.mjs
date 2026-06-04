/**
 * Promeut un utilisateur au rôle 'admin'.
 *
 * Prérequis : l'utilisateur doit s'être connecté au moins une fois (le doc
 * users/{uid} est créé automatiquement à la première connexion).
 *
 * Usage : node scripts/setAdmin.mjs christophe@chotteau.com
 */
import fs from 'fs'
import os from 'os'

const CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const PROJECT = process.env.FIREBASE_PROJECT || 'myuberteamhand'
const email = process.argv[2]

if (!email) {
  console.error('Usage : node scripts/setAdmin.mjs <email>')
  process.exit(1)
}

const cfg = JSON.parse(
  fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'),
)

async function getToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: cfg.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('Token: ' + JSON.stringify(j))
  return j.access_token
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

async function main() {
  const token = await getToken()
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  // Trouver le doc users dont email == <email>.
  const q = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'email' },
          op: 'EQUAL',
          value: { stringValue: email },
        },
      },
      limit: 1,
    },
  }
  const r = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(q),
  })
  const rows = await r.json()
  const doc = rows.find?.((x) => x.document)?.document
  if (!doc) {
    console.error(
      `Aucun utilisateur avec l'email ${email}.\n` +
        'Connectez-vous une fois dans l\'app avant de relancer ce script.',
    )
    process.exit(1)
  }
  const name = doc.name // .../users/{uid}

  // Patch role = admin.
  const p = await fetch(
    `https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=role`,
    {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ fields: { role: { stringValue: 'admin' } } }),
    },
  )
  console.log('Promotion admin →', p.status)
  if (p.ok) console.log(`✅ ${email} est maintenant administrateur.`)
}

main().catch((e) => {
  console.error('Échec :', e.message)
  process.exit(1)
})
