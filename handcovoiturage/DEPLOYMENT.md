# Déploiement — MyUberTeamHand

Projet Firebase : **`myuberteamhand`**
Console : https://console.firebase.google.com/project/myuberteamhand

## ✅ Déjà configuré (automatiquement)

- [x] Projet Firebase `myuberteamhand` créé
- [x] App web enregistrée, clés réelles dans `.env.local`
- [x] `.firebaserc` pointant sur `myuberteamhand`
- [x] Base **Firestore** créée (région `eur3` / Europe)
- [x] **Règles de sécurité** déployées (`firestore.rules`)
- [x] **Index** déployés (`firestore.indexes.json`)
- [x] **Hosting** déployé → https://myuberteamhand.web.app
- [x] APIs activées : Firestore, Identity Toolkit

## ⏳ Étapes restantes (action requise)

### 1. Activer les providers d'authentification

Le plus simple (gratuit, 30 s) — dans la console :
https://console.firebase.google.com/project/myuberteamhand/authentication/providers
→ Activer **E‑mail/Mot de passe** puis **Google**.

> L'activation par API est bloquée tant que la facturation n'est pas active
> (`BILLING_NOT_ENABLED`). Après avoir activé Blaze (étape 3), vous pouvez aussi
> lancer : `node scripts/enableAuthProviders.mjs`

### 2. Se connecter et devenir admin

1. Ouvrez https://myuberteamhand.web.app et créez votre compte (email/mot de passe).
2. Promouvez‑vous administrateur :
   ```bash
   node scripts/setAdmin.mjs christophe@chotteau.com
   ```
3. Rechargez la page : l'onglet **Admin** apparaît.

### 3. Activer la facturation Blaze (pour les Cloud Functions)

https://console.firebase.google.com/project/myuberteamhand/usage/details
→ Passer au plan **Blaze** (pay‑as‑you‑go, quota gratuit généreux).

Puis déployer les fonctions :
```bash
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions --project myuberteamhand
```

Fonctions déployées :
- `syncIcs` — cron 24 h : synchro calendrier FFHB
- `triggerIcsSync` — bouton « Sync ICS » de l'admin
- `onRideChange` — emails d'affectation / changement
- `sendReminders` — cron 18 h : rappels J‑1
- `calendarExport` — export ICS public (`/api/calendar/handcovoiturage.ics`)

### 4. Configurer la clé Brevo (emails)

⚠️ **Jamais** dans `.env` côté client. Dans la page **Admin → Config** de l'app,
renseignez `brevoApiKey` et `emailFrom` (stockés dans Firestore `config/app`,
lus uniquement par les Cloud Functions).

### 5. (Optionnel) Données de configuration initiales

Dans **Admin → Config** : saison, jours d'entraînement, URL ICS FFHB, vacances,
puis bouton **« Générer les entraînements »**. Importez les familles via
**Admin → Familles → Importer CSV**.

## Redéploiements courants

```bash
npm run build && firebase deploy --only hosting           # front
firebase deploy --only firestore:rules                    # règles
firebase deploy --only functions                          # fonctions (Blaze)
```
