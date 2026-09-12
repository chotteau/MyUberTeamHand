# CLAUDE.md — HandCovoiturage

## Rôle et contexte

Tu es le développeur principal de **HandCovoiturage**, une application web de gestion de covoiturage pour une équipe de handball jeunes.
Lis intégralement `SPECS.md` (v2.0) avant toute action. Ce fichier est la référence absolue du projet.

Principe directeur v2.0 : **le plus simple possible**. Pas d'email applicatif, pas de capacité voiture, pas de transactions complexes. Une matrice enfants × voitures, un calendrier partagé, c'est tout.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS (mobile-first) |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Base de données | Firebase Firestore |
| Hosting | Firebase Hosting |
| Backend | Firebase Cloud Functions v2 (Node.js 20, région `europe-west1`) |
| Calendrier import | ical.js (parsing ICS FFHB, côté functions uniquement) |
| Calendrier export | ICS écrit à la main dans `calendarExport.ts` |
| Charts | Recharts |
| Dates | date-fns (toujours `locale: fr`) |
| Validation | Zod |
| Data fetching | TanStack Query v5 + `onSnapshot` pour le temps réel |
| CSV | PapaParse |
| Icons | Lucide React |
| Toasts | react-hot-toast |

**Supprimé en v2.0** : Brevo, `ics` (npm), invitations, notifications, `needs`/`offers`/`rides`.

---

## Conventions de code

### TypeScript
- Tous les types centralisés dans `src/types/index.ts`
- Pas de `any` — `unknown` si nécessaire
- Zod pour la validation des données externes (CSV, ICS, formulaires)

### React
- Composants fonctionnels uniquement ; hooks custom dans `src/hooks/`
- Modales : monter le contenu seulement quand `open` (`{open && <Form/>}`) plutôt que des `useEffect` de reset
- Pas de prop drilling > 2 niveaux → Context ou TanStack Query

### Firebase
- Toute la logique Firebase dans `src/services/` — jamais d'appel Firestore direct dans un composant
- `onSnapshot` pour `participants` + `cars` d'un événement (matrice temps réel) ; `getDocs` pour le reste
- Les listeners `onSnapshot` sont toujours désinscrits dans le cleanup du `useEffect`
- Ids déterministes partout : `participants/{childId}`, `cars/{driverUid}`, `events/training_day{idx}_{YYYY-MM-DD}` → `setDoc` idempotent, pas de transaction
- `config/app` est lisible par tous les authentifiés (aucun secret dedans)

### Tailwind
- Mobile-first : classes de base = mobile, `md:` = desktop
- Palette (`tailwind.config.ts`) : `primary` #F97316 · `secondary` #1E293B · `success` #22C55E · `warning` #F59E0B · `danger` #EF4444
- Pas de style inline

### Langue
- **Tout en français** : UI, messages, commentaires, variables métier. Variables/fonctions techniques en anglais.

---

## Structure du projet

```
handcovoiturage/
├── src/
│   ├── components/
│   │   ├── ui/               # Modal, Spinner, PageSpinner, StatusBadge, KpiCard
│   │   ├── events/           # EventSummary
│   │   ├── board/            # MyChildrenBlock, MyCarBlock, CarMatrix, TripAddressPicker
│   │   └── admin/            # ImportCSV, EventFormModal, ChildFormModal
│   ├── pages/                # Login, ResetPassword, Planning, EventDetail, Stats, Profile
│   │   └── admin/            # Dashboard, Events, Families, Config
│   ├── hooks/                # useAuth, useMyChildren, useChildren, useEvents, useEventBoard, useConfig, useStats
│   ├── services/             # firebase, auth, children, events, board, csv, stats, config, icsSync
│   ├── types/index.ts
│   ├── utils/                # dates, address, validation
│   └── contexts/AuthContext.tsx
├── functions/src/
│   ├── index.ts
│   ├── syncIcs.ts            # scheduled 24h + callable admin
│   ├── calendarExport.ts     # HTTP GET /api/calendar/{token}.ics
│   └── lib/                  # admin.ts, icsParser.ts, data.ts
├── firestore.rules
├── firestore.indexes.json    # vide
├── firebase.json
├── .env.local                # jamais commité
├── SPECS.md
└── CLAUDE.md
```

---

## Règles métier à ne jamais violer

1. **L'enfant du chauffeur est toujours dans sa voiture** pour chaque direction active
2. **Aller et retour sont indépendants**
3. **Un enfant est dans au plus une voiture par direction**
4. **Seul le chauffeur ajoute/retire sa voiture** (1 par chauffeur par événement)
5. **Seul le parent inscrit/désinscrit son enfant**
6. **Tout le monde remplit** : n'importe quel parent place/déplace n'importe quel enfant
7. **Pas de limite de places** — orange à partir de `config.carWarningThreshold` (5), jamais bloquant
8. **Gel après l'heure H** — `isEventEditable(event)` = `departureTime > now()` et statut `scheduled`, vérifié côté UI **et** règles Firestore
9. **Retirer une voiture/direction → passagers sans voiture ; désinscrire un enfant → retiré de sa voiture**
10. **L'appli fait foi ; le calendrier est un miroir**
11. **Prénoms uniquement** — jamais de nom de famille, téléphone ou email affiché

---

## Cloud Functions

### syncIcs (scheduled toutes les 24 h + callable admin)
```
1. Lire config/app.icsUrl, fetch, parser (ical.js, TZ Europe/Paris)
2. Si 0 VEVENT → stop (ne rien annuler)
3. Pour chaque VEVENT : upsert events/{icsUid} SANS toucher `status` si le doc existe
4. Events ics_ffhb FUTURS absents du flux → status 'cancelled'
5. Écrire config/app.icsLastSync
```

### calendarExport (HTTP GET /api/calendar/{token}.ics)
```
1. Vérifier token == config/app.calendarToken sinon 404
2. Charger events de (now − 7 j) à seasonEnd + leurs participants et cars
3. 1 VEVENT par événement ; DESCRIPTION = voitures aller / retour avec passagers et adresses ; annulés → STATUS:CANCELLED
4. Content-Type text/calendar ; Cache-Control max-age=300
```

Le rewrite Hosting doit préciser la région : `"function": { "functionId": "calendarExport", "region": "europe-west1" }`.

---

## Format CSV import — Exemple

```csv
prenom_enfant;prenom_parent1;email_parent1;adresse1_rue;adresse1_cp;adresse1_ville;label_adresse1;prenom_parent2;email_parent2;adresse2_rue;adresse2_cp;adresse2_ville;label_adresse2
Lucas;Jean;jean.martin@email.fr;12 rue de la Paix;75001;Paris;Chez Papa;Marie;marie.martin@email.fr;45 avenue Gambetta;75020;Paris;Chez Maman
Emma;Sophie;sophie.petit@email.fr;8 rue des Roses;75015;Paris;Domicile;;;;;;
Tom B;Alex;alex.b@email.fr;3 rue du Moulin;75011;Paris;Domicile;;;;;;
```

- adresse1 = adresse par défaut, adresse2 = secondaire (optionnelle)
- Famille monoparentale : colonnes parent2 / adresse2 vides
- Emails en minuscules → `parentEmails`

---

## Commandes utiles

```bash
npm run dev
npm run build
npm run lint
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase emulators:start
npm run seed
```

---

## Pièges à éviter

1. **`isEventEditable(event)` avant toute écriture** sur participants / cars
2. **Toujours snapshoter** `childName`, `driverName`, adresse du trajet — `users` n'est lisible que par son propriétaire
3. **L'export ICS est public par token** — prénoms + adresses de prise en charge autorisés, **jamais d'email**
4. **Désinscrire les `onSnapshot`**
5. **Dédupliquer les events ICS** via `icsUid` ; ne jamais réécrire `status` depuis la sync
6. **date-fns toujours avec `fr`** ; dates construites en heure locale (Europe/Paris)
7. **Ne pas stocker de compteurs** (total par voiture, enfants sans voiture) — dérivés des listes
8. **Ne pas réintroduire d'email applicatif** ni de capacité voiture

---

## Ressources

- Calendrier FFHB ICS : `https://competition-calendar.ffhandball.fr/c-29681/s-3309.ics`
- Firebase console : https://console.firebase.google.com
- App : https://myuberteamhand.web.app
- Spécifications : `SPECS.md`
