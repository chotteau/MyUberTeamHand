/**
 * Active les providers d'authentification Email/Password + Google.
 *
 * ⚠️ Prérequis : la facturation Blaze doit être active OU les providers
 * peuvent être activés en un clic dans la console Firebase (gratuit) :
 *   https://console.firebase.google.com/project/myuberteamhand/authentication/providers
 *
 * Ce script utilise le jeton de la CLI Firebase (firebase login).
 * Usage : node scripts/enableAuthProviders.mjs
 */
import fs from 'fs'
import os from 'os'

const CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
const PROJECT = process.env.FIREBASE_PROJECT || 'myuberteamhand'

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

async function main() {
  const token = await getToken()
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  // 1. Email / Password
  const r1 = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`,
    {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({
        signIn: { email: { enabled: true, passwordRequired: true } },
      }),
    },
  )
  console.log('Email/Password →', r1.status)
  if (r1.status === 404) {
    console.log(
      '  ⚠️ Auth non initialisé. Activez un provider une fois dans la console,\n' +
        '     ou activez Blaze, puis relancez ce script.',
    )
    return
  }

  // 2. Google (provider IdP par défaut, sans clientId/secret = config Firebase auto)
  const r2 = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/defaultSupportedIdpConfigs?idpId=google.com`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ enabled: true }),
    },
  )
  console.log('Google →', r2.status)
  console.log('✅ Providers configurés.')
}

main().catch((e) => {
  console.error('Échec :', e.message)
  process.exit(1)
})
