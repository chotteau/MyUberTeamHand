# Déploiement — MyUberTeamHand (v2.0)

Projet Firebase : **`myuberteamhand`** — https://console.firebase.google.com/project/myuberteamhand
App : https://myuberteamhand.web.app

## Prérequis (une fois)

1. **Auth** : activer *E‑mail/Mot de passe* et *Google* dans
   https://console.firebase.google.com/project/myuberteamhand/authentication/providers
2. **Admin** : se connecter une fois sur l'app, puis
   ```bash
   node scripts/setAdmin.mjs christophe@chotteau.com
   ```
3. **Blaze** (Cloud Functions) : https://console.firebase.google.com/project/myuberteamhand/usage/details

## Déployer

```bash
# Front
npm run build && firebase deploy --only hosting

# Règles Firestore (v2 : participants / cars — obligatoire avec le front v2)
firebase deploy --only firestore:rules,firestore:indexes

# Fonctions (le build est lancé automatiquement par le predeploy)
firebase deploy --only functions
```

Fonctions v2 :
- `syncIcs` — cron 03:00 : synchro matchs FFHB (ne réactive jamais un match annulé par l'admin)
- `triggerIcsSync` — bouton « Sync FFHB » de l'admin
- `calendarExport` — calendrier partagé `GET /api/calendar/{token}.ics`

Supprimées en v2 : `onRideChange`, `sendReminders` (plus d'email). Lors du premier
déploiement v2, `firebase deploy --only functions` propose de les supprimer : répondre **oui**.

## Passage v1 → v2 (données)

Aucun email, aucun secret : plus rien à configurer côté Brevo.

1. **Admin → Config** : vérifier saison / jours, cliquer **Générer le lien** du calendrier, **Enregistrer**,
   puis **Générer / Regénérer le calendrier de la saison**.
2. **Admin → Familles** : ré‑importer le CSV (format sans nom / tél / capacité). Les fiches existantes
   sont mises à jour avec la nouvelle structure d'adresses (défaut / secondaire).
3. Les anciennes collections `needs`, `offers`, `rides`, `invitations`, `notifications` ne sont plus
   lues : les supprimer depuis la console Firestore (optionnel).
4. Chaque parent se connecte avec l'email du CSV : ses enfants lui sont associés automatiquement.

## Calendrier partagé

Le lien (avec token) est affiché dans **Mon profil** de chaque parent. Regénérer le token dans
Admin → Config invalide l'ancien lien.
