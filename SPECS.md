# HandCovoiturage — Spécifications Détaillées v2.0

## Vue d'ensemble

Application web de gestion de covoiturage pour une équipe de handball jeunes.
Permet aux parents de coordonner les trajets (entraînements + matchs) de manière collaborative.

- **Stack** : React + TypeScript + Firebase (Auth + Firestore + Hosting + Functions)
- **Langue** : 100% Français
- **Interface** : Mobile-first + Desktop compatible
- **Rôles** : Admin / Parent
- **Aucun email applicatif** : la seule communication sortante est le **calendrier partagé** (ICS). L'appli fait foi ; le calendrier est un miroir.

### Ce qui a changé par rapport à la v1.x

| v1.x | v2.0 |
|---|---|
| Emails Brevo (5 templates), invitations par token, rappels J-1 | **Supprimés.** Calendrier partagé uniquement |
| `needs` + `offers` + `rides` (3 collections, transactions) | **2 sous-collections par événement** : `participants` et `cars` |
| Capacité voiture déclarée à l'offre, places bloquantes | **Plus de capacité.** Compteur d'enfants par voiture, **orange à partir de 5**, jamais bloquant |
| 1 adresse par trajet choisie dans la liste | Adresse **par défaut / secondaire / saisie à la main**, choisie séparément pour l'aller et le retour |
| Liaison parent ↔ enfant via invitation | **Liaison automatique par l'email du compte** (CSV → `parentEmails`) |
| Vue liste besoins / voitures avec onglets Aller / Retour | **Vue matricielle unique** enfants × voitures, aller et retour côte à côte |
| Statut `completed` stocké | **Dérivé** : `departureTime < now()` |

---

## 1. Modèle de données (Firestore)

### Collection `users`
```typescript
// Document id = uid Firebase Auth
{
  uid: string,
  email: string,                  // en minuscules
  displayName: string,            // prénom seul ("Jean") — pas de nom de famille
  role: 'admin' | 'parent',
  active: boolean,                // false → désactivé par l'admin : écran bloquant, aucune écriture
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```
> Il n'y a **pas** de champ `childId` : les enfants d'un parent sont retrouvés par `children.parentEmails array-contains user.email`.

### Collection `children`
```typescript
{
  id: string,
  firstName: string,              // "Lucas" ou "Lucas M" si ambiguïté — jamais de nom de famille
  parents: [                      // 1 ou 2 entrées — famille monoparentale supportée
    { firstName: string, email: string }   // email en minuscules
  ],
  parentEmails: string[],         // dérivé de parents[].email — utilisé par les règles et les requêtes
  addresses: {
    default: Address,             // adresse principale (obligatoire)
    secondary?: Address           // 2e adresse — optionnelle
  },
  active: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

type Address = {
  label: string,                  // "Chez Papa", "Domicile"…
  street: string,
  zipCode: string,
  city: string
}
```

### Collection `events`
```typescript
{
  id: string,                     // généré : "training_day{idx}_{YYYY-MM-DD}" (idempotent) ; ICS : icsUid ; manuel : auto
  type: 'training' | 'match',
  title: string,                  // "Entraînement Lundi", "Match vs Montpellier"
  date: Timestamp,                // minuit Europe/Paris
  departureTime: Timestamp,       // heure de départ aller
  returnTime?: Timestamp,         // heure de départ retour (optionnel)
  location: { name: string, address: string, city: string },
  status: 'scheduled' | 'cancelled' | 'vacances',
  // 'cancelled' → annulé (raison quelconque)
  // 'vacances'  → annulé car vacances scolaires
  // Un événement PASSÉ n'a pas de statut dédié : il est dérivé (departureTime < now())
  source: 'manual' | 'ics_ffhb' | 'generated',
  icsUid?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Sous-collection `events/{eventId}/participants`
Un document par enfant inscrit à l'événement. **Document id = childId.**
```typescript
{
  childId: string,
  childName: string,              // snapshot du prénom (affichage sans lecture de children)
  aller: TripAddress | null,      // null = l'enfant ne vient pas à l'aller
  retour: TripAddress | null,     // null = l'enfant ne rentre pas au retour
  updatedBy: string,              // uid
  updatedAt: Timestamp
}

type TripAddress = {
  kind: 'default' | 'secondary' | 'custom',   // 'custom' = saisie à la main, non enregistrée sur la fiche
  label: string,                  // snapshot
  street: string,
  zipCode: string,
  city: string
}
```
> L'adresse est **toujours snapshotée** dans le participant : le calendrier et l'historique ne bougent pas si la fiche enfant change ensuite.

### Sous-collection `events/{eventId}/cars`
Une voiture par chauffeur par événement. **Document id = driverUid.**
```typescript
{
  driverUid: string,
  driverName: string,             // snapshot du displayName (users n'est lisible que par son propriétaire)
  driverChildIds: string[],       // enfant(s) du chauffeur — toujours à bord
  aller: boolean,                 // "j'emmène"
  retour: boolean,                // "je ramène"
  passengersAller: string[],      // childIds — inclut driverChildIds si aller = true
  passengersRetour: string[],     // childIds — inclut driverChildIds si retour = true
  updatedAt: Timestamp
}
```
> Pas de capacité. Le nombre d'enfants = longueur de la liste. **Avertissement orange à partir de 5** (voiture 5 places = 1 adulte + 4 enfants), jamais bloquant.

### Collection `config`
```typescript
// Document unique : config/app — lisible par tous les authentifiés (aucun secret dedans)
{
  season: string,                 // "2025-2026"
  seasonStart: Timestamp,
  seasonEnd: Timestamp,
  trainingDays: [                 // exactement 2
    {
      dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6,   // 0 = dimanche … 6 = samedi
      label: string,              // "Lundi soir"
      departureTime: string,      // "HH:mm"
      returnTime: string,         // "HH:mm"
      location: { name: string, address: string, city: string }
    }
  ],
  icsUrl: string,                 // flux FFHB
  icsLastSync?: Timestamp,
  calendarName: string,           // nom du calendrier ICS exporté
  calendarToken: string,          // secret dans l'URL d'abonnement (généré par l'admin)
  carWarningThreshold: number,    // défaut 5
  updatedAt: Timestamp
}
```

Collections **supprimées** : `needs`, `offers`, `rides`, `notifications`, `invitations`.

---

## 2. Fonctionnalités détaillées

### 2.1 Authentification et liaison parent ↔ enfant

- **Création de compte** email / mot de passe depuis la page de login (onglet « Créer un compte »), connexion email / mot de passe ou Google OAuth (Firebase Auth), récupération de mot de passe par email Firebase (seul email du système, géré par Firebase).
- À chaque connexion, `ensureUserDoc` crée/complète `users/{uid}` :
  - `email` = email du compte en minuscules
  - `displayName` = si absent, le `parents[].firstName` trouvé dans `children` pour cet email, sinon le prénom Google, sinon demandé à l'écran.
- **Liaison automatique** : les enfants d'un parent = `children where parentEmails array-contains email`. Aucun token, aucune invitation, aucune action admin.
- **Création de compte réservée aux emails déclarés** : la Cloud Function publique `isEmailDeclared` est appelée avant `createUserWithEmailAndPassword` ; un email absent de tout `parentEmails` est refusé (« Cet email n'est pas déclaré au club »). Même contrôle à la première connexion Google (déconnexion immédiate). Un compte existant n'est jamais recréé : « Un compte existe déjà — Mot de passe oublié ».
- Un parent sans enfant actif ne voit pas le bloc « Ma voiture ».
- **Désactivation (admin)** : désactiver un parent supprime sa voiture de tous les événements à venir (ses passagers passent « Sans voiture ») ; désactiver un enfant supprime son inscription et le retire des voitures des événements à venir. Les événements passés ne sont jamais modifiés (stats).
- **Deux modes pour l'admin** : sur `/event/:id` (onglet Planning) il agit comme un parent, sans pouvoir destructif ; sur `/admin/event/:id` (depuis le Dashboard ou la liste admin) il voit le badge « Mode admin », un bouton **Modifier** l'événement et un ✕ pour retirer n'importe quelle voiture.
- Le rôle `admin` est posé manuellement (script `setAdmin` ou console).

### 2.2 Import CSV (admin)

Format (UTF-8, séparateur `;`) — inchangé :
```
prenom_enfant;prenom_parent1;email_parent1;adresse1_rue;adresse1_cp;adresse1_ville;label_adresse1;prenom_parent2;email_parent2;adresse2_rue;adresse2_cp;adresse2_ville;label_adresse2
```
- `adresse1` → `addresses.default` ; `adresse2` (si remplie) → `addresses.secondary`
- Pas de nom de famille, pas de téléphone, pas de capacité
- Famille monoparentale : colonnes parent2 / adresse2 vides
- Emails normalisés en minuscules ; `parentEmails` recalculé
- Enfant existant (même `firstName`) → mis à jour ; sinon créé
- Rapport : créés / mis à jour / erreurs (ligne + motif)

### 2.3 Gestion des événements

#### Entraînements générés
- Générés pour **toute la saison** (`seasonStart` → `seasonEnd`) depuis `config.trainingDays`, id idempotent → « Regénérer » ne crée jamais de doublon et **ne touche pas** aux événements déjà modifiés individuellement (déplacés, annulés, `vacances`).
- Pas de calendrier de vacances : l'admin passe chaque entraînement concerné en `vacances`.
- Modification ponctuelle (date, heures, lieu) sans toucher au pattern.

#### Matchs FFHB (ICS)
- Sync auto toutes les 24 h (Cloud Function planifiée) + bouton « Synchroniser maintenant » (callable admin).
- Dédup par `icsUid`.
- **Ne touche jamais** `status` d'un événement existant (l'admin garde la main sur les annulations).
- Un match **futur** absent du flux → `cancelled`, uniquement si le flux contient au moins 1 événement. Les matchs passés ne sont jamais modifiés.

#### Création manuelle (onglet Événements admin)
- Entraînement exceptionnel, match/tournoi hors flux FFHB, tout événement d'équipe.

#### Événements passés
- `departureTime < now()` → grisés, lecture seule, alimentent les stats. Aucun statut stocké.

### 2.4 Inscription d'un enfant (parent)

Sur la page événement, bloc **« Mes enfants »** — un sous-bloc par enfant :

| | Aller | Retour |
|---|---|---|
| Présent ? | ☐ | ☐ |
| Adresse | ◉ Défaut (Chez Papa) ○ Secondaire (Chez Maman) ○ Autre… | ◉ Défaut ○ Secondaire ○ Autre… |

- « Autre… » ouvre 3 champs (rue, CP, ville) — enregistrés **uniquement** dans le participant (`kind: 'custom'`), jamais sur la fiche enfant.
- Sauvegarde immédiate à chaque changement (pas de bouton Valider) → `participants/{childId}`.
- Décocher une direction retire automatiquement l'enfant de la voiture où il était pour cette direction.
- Seuls les parents de l'enfant (ou l'admin) peuvent inscrire / désinscrire.

### 2.5 Déclaration d'une voiture (chauffeur)

Bloc **« Ma voiture »** : deux interrupteurs **« J'emmène »** / **« Je ramène »**.
- Activer une direction crée/maj `cars/{uid}` avec l'enfant du chauffeur déjà dans la liste de passagers correspondante, **et le retire de toute autre voiture** pour cette direction (règles 1 et 3).
- Désactiver une direction (ou les deux → suppression de la voiture) : ses passagers redeviennent « sans voiture » pour cette direction. Pas de retour automatique dans une voiture précédente : le bandeau d'alerte signale les enfants à re-placer.
- Aucune capacité demandée.
- Seul le chauffeur (ou l'admin) crée/supprime sa voiture. Une seule voiture par chauffeur par événement.

### 2.6 Remplissage collaboratif — la matrice

Vue unique enfants × voitures, **aller et retour dans le même tableau** :

```
                  │        ALLER 17:15        │       RETOUR 19:00       │
Enfant            │ 🚗 Jean │ 🚗 Sophie │ —   │ 🚗 Jean │ 🚗 Marc  │ —   │
──────────────────┼─────────┼───────────┼─────┼─────────┼──────────┼─────┤
Lucas  (enf. Jean)│    ●    │           │     │    ●    │          │     │
Emma   Chez Maman │    ●    │           │     │         │    ●     │     │
Tom               │         │     ●     │     │         │          │  ❗  │
Léa    (ne vient pas à l'aller)   ─     │     │         │    ●     │     │
──────────────────┼─────────┼───────────┼─────┼─────────┼──────────┼─────┤
Total             │    2    │     1     │     │    1    │    2     │  1  │
```

- Une ligne par enfant inscrit (aller ou retour) ; les enfants des chauffeurs apparaissent toujours.
- Une colonne par voiture et par direction + une colonne « Sans voiture ».
- Cellule = bouton radio : cliquer met l'enfant dans cette voiture pour cette direction (et le retire de l'autre). Cliquer « — » le sort de toute voiture.
- Cellule grisée « ─ » si l'enfant n'est pas inscrit pour cette direction.
- Ligne **Total** : nombre d'enfants par voiture, **orange si ≥ `carWarningThreshold`** (5).
- Bandeau d'alertes au-dessus : « ❗ 2 enfants sans voiture à l'aller », « ❗ Aucune voiture au retour ».
- L'adresse du jour de chaque enfant est affichée sous son prénom (label, ex. « Chez Maman », ou l'adresse custom).
- **Tout parent authentifié** peut remplir / déplacer **n'importe quel** enfant. Un chauffeur peut ainsi « prendre » les enfants sans voiture ; une nouvelle voiture peut reprendre tous les enfants d'une autre (action « Tout prendre » sur l'en-tête de colonne).
- Temps réel (`onSnapshot` sur `participants` et `cars`).
- Mobile : première colonne figée, défilement horizontal du tableau.
- Après l'heure H : tableau en lecture seule.

### 2.7 Calendrier partagé (export ICS)

URL d'abonnement : `/api/calendar/{calendarToken}.ics` (token = `config.calendarToken`, regénérable par l'admin ; une URL sans token valide renvoie 404).

- **Un VEVENT par événement** (pas par voiture) : événements **non terminés** uniquement (fin > maintenant) jusqu’à `seasonEnd`, statuts `scheduled` + annulés (avec `STATUS:CANCELLED` et préfixe « ❌ »).
- `SUMMARY` : `🤾 Entraînement Lundi` / `🏆 Match vs Montpellier` / `❌ Entraînement Lundi (vacances)`
- `DTSTART` = `departureTime`, `DTEND` = `returnTime` (ou `departureTime + 2 h`)
- `LOCATION` = lieu de l'événement
- `DESCRIPTION` — c'est là que vit l'organisation :
```
ALLER — départ 17:15
Inscrits (4) : Emma, Hugo, Léa, Lucas
🚗 Jean
   • Lucas (12 rue de la Paix, Paris)
   • Emma (45 av. Gambetta, Paris)
🚗 Sophie
   • Léa (3 rue du Moulin, Paris)
❗ Sans voiture :
   • Hugo (3 rue du Moulin, Paris)

RETOUR — départ 19:00
🚗 Jean : Lucas, Emma (Chez Papa — 12 rue de la Paix, Paris)
🚗 Marc : Tom, Léa
✅ Tout le monde a une voiture

Mis à jour le 12/09 à 14:32 — https://myuberteamhand.web.app/event/xxx
```
- Prénoms uniquement, adresses de prise en charge (voulues par l'équipe), **jamais** d'email.
- `Cache-Control: max-age=60`. Les clients calendrier se resynchronisent périodiquement (Google : quelques heures ; Apple : réglable).

### 2.8 Statistiques

Page accessible à tous — **vue saison uniquement**.
- Source : `cars` de tous les événements passés de la saison (`config.seasonStart` → `now`, statut `scheduled`). Un trajet = une voiture × une direction active.
- **Podium Top 3** (🥇🥈🥉) : prénom chauffeur (`driverName`), total trajets, % participation.
- **Barres horizontales bicolores** aller / retour par chauffeur, du plus au moins actif.
- **Tableau** : Chauffeur · Aller · Retour · Total · % (= trajets / (événements passés × 2, retour absent non compté)).
- Badge discret « À ton tour 😉 » pour le(s) moins actif(s) ; les parents à 0 trajet apparaissent (liste des `users` role parent → non lisible par les parents ; on liste donc les **enfants actifs** sans trajet avec leurs prénoms de parents depuis `children.parents`).

---

## 3. Structure des écrans

### 3.1 Publics
- `/login` — email/mdp + Google
- `/reset-password`
- `/aide` — mode d’emploi une page (création de compte, planning, inscription, voiture, matrice, calendrier, profil), partageable par lien ; lié depuis le login et le profil

### 3.2 Parent
- `/` → `/planning`
- `/planning` — 4 semaines glissantes (bouton « Voir toute la saison »). Par événement : date/heure/lieu, badge statut, et **résumé** : « Lucas : aller ✔ retour ✔ » / « À déclarer », « 3 voitures · 1 enfant sans voiture ».
- `/event/:id` — en-tête + « Mes enfants » (2.4) + « Ma voiture » (2.5) + matrice (2.6). L'admin y est un parent comme les autres.
- `/stats`
- `/mon-profil` — prénom ; adresses par défaut / secondaire de mes enfants

### 3.3 Admin (en plus)
- `/admin` — événements de la semaine, alertes (enfants sans voiture, événements sans voiture), dernière sync ICS
- `/admin/evenements` — liste 4 semaines / saison, passés grisés, sync ICS, créer / modifier / annuler / `vacances` / réactiver. Suppression réservée aux `manual`. Titre → `/admin/event/:id`.
- `/admin/event/:id` — même page que `/event/:id` en **mode admin** : Modifier l'événement, retirer une voiture (✕).
- `/admin/familles` — liste, import CSV, fiche enfant (prénom, parents, adresses, actif) ; section **Comptes connectés** : activer / désactiver un parent (compte désactivé = écran bloquant + règles Firestore refusent ses écritures)
- `/admin/config` — saison, 2 jours d'entraînement, URL ICS, nom + token du calendrier (bouton « Regénérer le lien »), seuil orange, bouton « Générer / Regénérer le calendrier »

---

## 4. Règles métier

1. **L'enfant du chauffeur est toujours dans sa voiture** pour chaque direction active.
2. **Aller et retour sont indépendants** (participation, voitures, passagers).
3. **Un enfant est dans au plus une voiture par direction.**
4. **Seul le chauffeur ajoute / retire sa voiture** (1 voiture par chauffeur par événement). L'admin peut tout faire.
5. **Seul le parent inscrit / désinscrit son enfant** (présent / absent, adresse).
6. **Tout le monde remplit** : n'importe quel parent authentifié place / déplace n'importe quel enfant dans n'importe quelle voiture.
7. **Pas de limite de places** — compteur orange à partir de `carWarningThreshold` (5) enfants.
8. **Gel après l'heure H** : `departureTime < now()` → tout est en lecture seule (UI + règles Firestore).
9. **Retirer une voiture / une direction** → ses passagers redeviennent « sans voiture ». **Désinscrire un enfant** → retiré de sa voiture.
10. **L'appli fait foi** ; le calendrier ICS est un miroir en lecture seule.
11. **Prénoms uniquement**, jamais de nom de famille, de téléphone ni d'email affiché.

---

## 5. Architecture technique

```
handcovoiturage/
├── src/
│   ├── components/
│   │   ├── ui/                 # Modal, Spinner, StatusBadge, KpiCard, PageSpinner…
│   │   ├── events/             # EventSummary (date/heure/lieu réutilisé partout)
│   │   ├── board/              # MyChildrenBlock, MyCarBlock, CarMatrix, TripAddressPicker
│   │   └── admin/              # ImportCSV, EventFormModal, ChildFormModal
│   ├── pages/                  # Login, ResetPassword, Planning, EventDetail, Stats, Profile, admin/*
│   ├── hooks/                  # useAuth, useMyChildren, useEvents, useEventBoard, useConfig, useStats
│   ├── services/               # firebase, auth, children, events, board (participants + cars), csv, stats, config, icsSync
│   ├── types/index.ts
│   ├── utils/                  # dates, address, validation (Zod)
│   └── contexts/AuthContext.tsx
├── functions/src/
│   ├── index.ts
│   ├── syncIcs.ts              # scheduled 24h + callable admin
│   ├── calendarExport.ts       # HTTP GET /api/calendar/{token}.ics
│   └── lib/                    # admin (init), icsParser, data
├── firestore.rules
├── firestore.indexes.json      # vide (aucun index composite requis)
└── firebase.json               # rewrite → calendarExport (region europe-west1)
```

Cloud Functions **supprimées** : `sendReminders`, `onRideChange`, `lib/brevo`, `lib/templates`.

---

## 6. Règles de sécurité Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth()  { return request.auth != null; }
    function email()   { return request.auth.token.email.lower(); }
    function isAdmin() {
      return isAuth() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    function isParentOf(childId) {
      return email() in get(/databases/$(database)/documents/children/$(childId)).data.parentEmails;
    }
    function eventEditable(eventId) {
      return get(/databases/$(database)/documents/events/$(eventId)).data.departureTime > request.time;
    }
    function onlyKeys(keys) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(keys);
    }

    match /users/{uid} {
      allow read: if isAuth() && (request.auth.uid == uid || isAdmin());
      allow create: if isAuth() && request.auth.uid == uid
                    && request.resource.data.role == 'parent';
      allow update: if isAuth() && request.auth.uid == uid && onlyKeys(['displayName', 'updatedAt'])
                    || isAdmin();
    }

    match /children/{childId} {
      allow read: if isAuth();
      allow create, delete: if isAdmin();
      allow update: if isAdmin()
                    || (isAuth() && email() in resource.data.parentEmails
                        && onlyKeys(['addresses', 'updatedAt']));
    }

    match /events/{eventId} {
      allow read: if isAuth();
      allow write: if isAdmin();

      match /participants/{childId} {
        allow read: if isAuth();
        allow write: if isAdmin()
                     || (isAuth() && isParentOf(childId) && eventEditable(eventId));
      }

      match /cars/{driverUid} {
        allow read: if isAuth();
        allow create, delete: if isAdmin()
                     || (isAuth() && request.auth.uid == driverUid && eventEditable(eventId));
        allow update: if isAdmin()
                     || (isAuth() && eventEditable(eventId) && (
                          request.auth.uid == driverUid
                          || onlyKeys(['passengersAller', 'passengersRetour', 'updatedAt'])
                        ));
      }
    }

    match /config/{docId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }
  }
}
```

---

## 7. Dépendances npm

```json
{
  "dependencies": {
    "react", "react-dom", "react-router-dom",
    "firebase",
    "date-fns",
    "papaparse",
    "zod",
    "recharts",
    "@tanstack/react-query",
    "react-hot-toast",
    "lucide-react"
  }
}
```
Côté `functions` : `firebase-admin`, `firebase-functions`, `ical.js`. Plus de `ics` ni de client Brevo.

---

## 8. Variables d'environnement

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_URL=https://myuberteamhand.web.app
```
Aucun secret applicatif (plus de clé email). `calendarToken` vit dans `config/app`.

---

## 9. Données de test (seed)

- 1 admin
- 6 enfants (2 familles à 2 adresses, 1 monoparentale), 10 parents
- 3 événements à venir (2 entraînements, 1 match) + 2 passés avec voitures (pour les stats)
- Sur un événement à venir : 4 participants, 2 voitures partiellement remplies, 1 enfant sans voiture

---

## 10. Checklist de livraison

- [ ] Auth email/mdp + Google, liaison automatique par email
- [ ] Import CSV avec rapport d'erreurs
- [ ] Génération des entraînements sur la saison + modification ponctuelle
- [ ] Sync ICS FFHB (auto + manuelle) sans écraser les annulations admin
- [ ] Inscription enfant aller/retour avec adresse défaut / secondaire / custom
- [ ] Déclaration voiture (j'emmène / je ramène)
- [ ] Matrice collaborative temps réel, totaux orange, alertes
- [ ] Export ICS tokenisé avec description complète
- [ ] Stats saison (podium, barres, tableau, badge)
- [ ] Règles Firestore v2 déployées et testées
- [ ] Responsive mobile-first (matrice défilable)
- [ ] Seed
- [ ] Déploiement Hosting + Functions
