/**
 * Supprime complètement un compte parent (test ou départ du club) :
 *   - le document users/{uid}
 *   - ses voitures dans tous les événements (events/*\/cars/{uid})
 *   - le compte Firebase Auth
 * Les fiches enfants ne sont pas touchées.
 *
 * Usage : node scripts/deleteAccount.mjs <email>
 * Utilise le jeton de `firebase login` (même mécanisme que setAdmin.mjs).
 */
import fs from 'fs'
import os from 'os'

const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const PROJECT = process.env.FIREBASE_PROJECT || 'myuberteamhand'
const email = (process.argv[2] ?? '').trim().toLowerCase()

if (!email) {
  console.error('Usage : node scripts/deleteAccount.mjs <email>')
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
  const H = { authorization: `Bearer ${await getToken()}`, 'content-type': 'application/json' }
  const runQuery = async (structuredQuery) => {
    const res = await fetch(`${BASE}:runQuery`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ structuredQuery }),
    })
    return (await res.json()).filter((x) => x.document).map((x) => x.document)
  }
  const eq = (field, value) => ({
    fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } },
  })

  const users = await runQuery({ from: [{ collectionId: 'users' }], where: eq('email', email), limit: 1 })
  if (users.length === 0) {
    console.log(`Aucun document users pour ${email}.`)
  }

  for (const u of users) {
    const uid = u.name.split('/').pop()
    if (u.fields?.role?.stringValue === 'admin') {
      console.error('Refus : ce compte est admin.')
      process.exit(1)
    }

    const cars = await runQuery({
      from: [{ collectionId: 'cars', allDescendants: true }],
      where: eq('driverUid', uid),
    })
    for (const c of cars) {
      await fetch(`https://firestore.googleapis.com/v1/${c.name}`, { method: 'DELETE', headers: H })
      console.log('🚗 voiture supprimée :', c.name.split('/documents/')[1])
    }

    await fetch(`${BASE}/users/${uid}`, { method: 'DELETE', headers: H })
    console.log('👤 document users supprimé :', uid)

    const d = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`,
      { method: 'POST', headers: H, body: JSON.stringify({ localId: uid }) },
    )
    console.log(d.ok ? '🔐 compte Auth supprimé' : `⚠️ compte Auth : HTTP ${d.status} (${await d.text()})`)
  }

  // Voitures orphelines sans prénom (compte créé avant le contrôle des emails déclarés).
  const anon = await runQuery({
    from: [{ collectionId: 'cars', allDescendants: true }],
    where: eq('driverName', ''),
  })
  for (const c of anon) {
    await fetch(`https://firestore.googleapis.com/v1/${c.name}`, { method: 'DELETE', headers: H })
    console.log('🚗 voiture sans prénom supprimée :', c.name.split('/documents/')[1])
  }

  console.log('✅ Terminé.')
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
