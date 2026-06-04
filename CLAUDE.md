# CLAUDE.md — HandCovoiturage

## Rôle et contexte

Tu es le développeur principal de **HandCovoiturage**, une application web de gestion de covoiturage pour une équipe de handball jeunes.
Lis intégralement `SPECS.md` avant toute action. Ce fichier est la référence absolue du projet.

---

<!-- ## Méthode d'édition de SPECS.md (désactivé)
- Applique les modifications par petits lots : 2 à 3 changements maximum par réponse, puis arrête-toi.
- Évite les éditions massives en un seul bloc ; préfère plusieurs petites éditions ciblées.
- Après chaque lot, attends la validation avant de poursuivre.
- Si une section est longue, découpe son édition en sous-étapes successives.
-->

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (mobile-first) |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Base de données | Firebase Firestore |
| Hosting | Firebase Hosting |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Email | Brevo API (ex-Sendinblue) |
| Calendrier import | ical.js (parsing ICS FFHB) |
| Calendrier export | ics (génération ICS) |
| Charts | Recharts |
| Dates | date-fns (toujours en fr-FR) |
| Validation | Zod |
| Data fetching | TanStack Query v5 |
| CSV | PapaParse |
| Icons | Lucide React |
| Toasts | react-hot-toast |

---

## Conventions de code

### TypeScript
- Tous les types centralisés dans `src/types/index.ts`
- Interfaces préfixées sans `I` (ex: `User` pas `IUser`)
- Pas de `any` — utiliser `unknown` si nécessaire
- Zod pour la validation des données externes (CSV, ICS, Firestore)

### React
- Composants fonctionnels uniquement
- Hooks custom dans `src/hooks/`
- Pas de prop drilling > 2 niveaux → utiliser Context ou TanStack Query
- Nommage : PascalCase pour composants, camelCase pour hooks (`useAuth`, `useEvent`)

### Firebase
- Toute la logique Firebase dans `src/services/`
- Jamais d'appel Firestore direct dans les composants → toujours via un hook ou service
- Utiliser `onSnapshot` pour les données temps réel (planning collaboratif)
- Utiliser `getDocs` pour les données one-shot (stats, config)

### Tailwind
- Mobile-first systématiquement : classes de base = mobile, `md:` = desktop
- Palette de couleurs du projet (définie dans `tailwind.config.ts`) :
  ```
  primary: handball orange → #F97316 (orange-500)
  secondary: slate → #1E293B (slate-800)
  success: #22C55E (green-500)
  warning: #F59E0B (amber-500)
  danger: #EF4444 (red-500)
  ```
- Pas de style inline sauf cas exceptionnel justifié

### Langue
- **Tout en français** : UI, messages d'erreur, commentaires de code, noms de variables métier
- Exception : noms de variables/fonctions techniques en anglais (conventions JS)
- Dates affichées avec `date-fns/locale/fr`

---

## Structure du projet

```
handcovoiturage/
├── src/
│   ├── components/
│   │   ├── ui/               # Composants atomiques réutilisables
│   │   ├── events/           # EventCard, EventDetail, EventList
│   │   ├── rides/            # NeedCard, OfferCard, RideBoard
│   │   ├── stats/            # StatsChart, StatsTable
│   │   └── admin/            # ImportCSV, FamilyManager, ConfigPanel
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Planning.tsx
│   │   ├── EventDetail.tsx
│   │   ├── Stats.tsx
│   │   ├── Profile.tsx
│   │   └── admin/
│   │       ├── Dashboard.tsx
│   │       ├── Events.tsx
│   │       ├── Families.tsx
│   │       └── Config.tsx
│   ├── hooks/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── contexts/
├── functions/
│   └── src/
│       ├── syncIcs.ts        # Cron : sync ICS FFHB toutes les 24h
│       ├── sendReminders.ts  # Cron : rappels J-1 à 18h
│       ├── calendarExport.ts # HTTP : GET /api/calendar/handcovoiturage.ics
│       └── onRideChange.ts   # Trigger Firestore → notifications email
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .env.local               # Variables d'env (jamais commitées)
├── SPECS.md                 # Spécifications complètes (référence)
└── CLAUDE.md                # Ce fichier
```

---

## Ordre de développement recommandé

Développe dans cet ordre strict. Chaque étape doit être fonctionnelle avant de passer à la suivante.

### Phase 1 — Fondations
1. Init projet Vite + React + TypeScript + Tailwind
2. Config Firebase (Auth + Firestore + Hosting)
3. Définir tous les types TypeScript (`src/types/index.ts`)
4. Service Firebase (`src/services/firebase.ts`)
5. AuthContext + useAuth hook
6. Routes protégées (PrivateRoute par rôle)
7. Pages Login + Reset password

### Phase 2 — Admin de base
8. Layout Admin avec navigation
9. Page Config :
   - Dates de début/fin de saison
   - 2 jours d'entraînement configurables (jour semaine, heure aller/retour, lieu)
   - URL ICS FFHB
   - Config email Brevo
10. Génération du calendrier d'entraînements sur toute la saison (source `generated`)
    - Affichage par défaut : 2 semaines glissantes
    - Bouton "Regénérer" après modification de config
11. Page Familles — liste (prénoms uniquement, sans nom de famille)
12. Import CSV — parsing + validation Zod + création Firestore (format sans tél ni capacité)
13. Envoi invitation email (Brevo)
14. Page Familles — ajout/modification manuel

### Phase 3 — Événements
15. Sync ICS FFHB (service + Cloud Function cron)
16. Page Events admin — liste + actions
17. Création/modification/annulation événement manuel

### Phase 4 — Covoiturage (cœur de l'app)
18. Page Planning (vue driver) — liste événements avec badges statut
19. Formulaire déclaration besoin (avec sélection adresse)
20. Formulaire déclaration offre (avec capacité voiture)
21. RideBoard — vue collaborative temps réel (onSnapshot)
22. Attribution enfant → voiture (chauffeur ou parent)
23. Alertes manque chauffeur

### Phase 5 — Notifications
24. Service Brevo — envoi email générique
25. Templates email (5 templates)
26. Cloud Function onRideChange → emails
27. Cloud Function sendReminders → cron J-1

### Phase 6 — Calendrier & Stats
28. Export ICS (Cloud Function HTTP)
29. Page Stats — vue saison uniquement :
    - Podium Top 3 ludique (🥇🥈🥉)
    - Graphique barres bicolores aller/retour par chauffeur
    - Tableau avec % de participation
    - Badge discret pour les moins actifs

### Phase 7 — Finitions
31. Page Profil utilisateur
32. Règles Firestore sécurisées + tests
33. Script seed (données de test)
34. Responsive mobile review complète
35. Déploiement Firebase Hosting

---

## Règles métier à ne jamais violer

1. **Un chauffeur emmène toujours son enfant** — lors de la création d'un ride, l'enfant du chauffeur est automatiquement ajouté comme passager
2. **Places disponibles = capacité - 1** (l'enfant du chauffeur occupe une place)
3. **Aller et retour sont des rides distincts** même si la même offre couvre les deux
4. **Modifications bloquées après l'heure H** de l'événement — vérifier `event.departureTime < now()`
5. **Un enfant = 1 need par direction par événement** — vérifier doublon avant création
6. **Un driver = 1 offer par direction par événement** — vérifier doublon avant création
7. **Attribution collaborative** — n'importe quel parent authentifié peut attribuer n'importe quel enfant (pas seulement le sien)

---

## Firestore — Règles de sécurité

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() { return request.auth != null; }
    function isAdmin() {
      return isAuth() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    function isOwner(uid) { return isAuth() && request.auth.uid == uid; }

    match /users/{uid} {
      allow read, write: if isOwner(uid) || isAdmin();
    }

    match /children/{childId} {
      allow read: if isAuth() &&
        (isAdmin() || request.auth.uid in resource.data.parentIds);
      allow write: if isAdmin();
    }

    match /events/{eventId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    match /needs/{needId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update, delete: if isAuth() &&
        (isAdmin() || request.auth.uid == resource.data.declaredByUid);
    }

    match /offers/{offerId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update, delete: if isAuth() &&
        (isAdmin() || request.auth.uid == resource.data.driverUid);
    }

    match /rides/{rideId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update: if isAuth() &&
        (isAdmin() ||
         request.auth.uid == resource.data.driverUid ||
         request.auth.uid in resource.data.passengers.map(p, p.parentUid));
      allow delete: if isAdmin();
    }

    match /config/{docId} {
      allow read, write: if isAdmin();
    }

    match /notifications/{notifId} {
      allow read: if isAuth() && request.auth.uid == resource.data.recipientUid;
      allow write: if isAdmin();
    }
  }
}
```

---

## Cloud Functions — Points d'attention

### syncIcs (Scheduled — toutes les 24h)
```typescript
// 1. Lire config/app.icsUrl
// 2. Fetch le fichier ICS
// 3. Parser avec ical.js
// 4. Pour chaque VEVENT :
//    - Si icsUid existe déjà en base → mettre à jour si changements
//    - Si icsUid nouveau → créer l'event
//    - Si event en base non trouvé dans le flux → marquer cancelled
// 5. Notifier l'admin des changements
```

### sendReminders (Scheduled — tous les jours à 18h)
```typescript
// 1. Trouver tous les events dont departureTime est entre now+18h et now+26h
// 2. Pour chaque event :
//    a. Trouver les enfants actifs sans need déclaré → email reminder_parent
//    b. Calculer si places insuffisantes → email reminder_driver aux parents sans offre
```

### calendarExport (HTTP GET /api/calendar/handcovoiturage.ics)
```typescript
// 1. Lire tous les rides confirmed ou completed des 4 prochaines semaines
// 2. Pour chaque ride : générer un VEVENT avec détails complets
// 3. Retourner le fichier ICS avec Content-Type: text/calendar
// 4. Header Cache-Control: max-age=300 (5 min)
```

### onRideChange (Firestore trigger rides/{rideId})
```typescript
// onCreate : notifier les parents des passagers (assignment_confirmed)
// onUpdate :
//   - Si passager ajouté → notifier le parent concerné
//   - Si passager retiré → notifier le parent concerné (schedule_change)
//   - Si status cancelled → notifier tous les passagers
```

---

## Format ICS export — Exemple

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HandCovoiturage//FR
CALSCALE:GREGORIAN
X-WR-CALNAME:HandCovoiturage — Saison 2024-2025
X-WR-TIMEZONE:Europe/Paris

BEGIN:VEVENT
UID:ride-abc123-outbound@handcovoiturage
DTSTART;TZID=Europe/Paris:20250117T171500
DTEND;TZID=Europe/Paris:20250117T180000
SUMMARY:🚗 Aller — Papa Martin (Lucas, Emma, Tom)
LOCATION:Gymnase Malraux, 15 rue André Malraux, Paris
DESCRIPTION:Chauffeur: Jean Martin — 06 12 34 56 78\n
 Passagers:\n
 - Emma Petit — 12 rue des Lilas\, Paris\n
 - Tom Bernard — 8 av du Parc\, Paris\n
 (Lucas Martin embarque depuis son domicile)
STATUS:CONFIRMED
END:VEVENT

END:VCALENDAR
```

---

## Format CSV import — Exemple

```csv
prenom_enfant;prenom_parent1;email_parent1;adresse1_rue;adresse1_cp;adresse1_ville;label_adresse1;prenom_parent2;email_parent2;adresse2_rue;adresse2_cp;adresse2_ville;label_adresse2
Lucas;Jean;jean.martin@email.fr;12 rue de la Paix;75001;Paris;Chez Papa;Marie;marie.martin@email.fr;45 avenue Gambetta;75020;Paris;Chez Maman
Emma;Sophie;sophie.petit@email.fr;8 rue des Roses;75015;Paris;Domicile;;;;;;
Tom B;Alex;alex.b@email.fr;3 rue du Moulin;75011;Paris;Domicile;;;;;;
```

- Pas de nom de famille, pas de téléphone, pas de capacité voiture
- Famille monoparentale : colonnes parent2 / adresse2 laissées vides
- Adresse unique (parents même toit) : laisser adresse2 vide

---

## Commandes utiles

```bash
# Dev local
npm run dev

# Build
npm run build

# Deploy Firebase Hosting
firebase deploy --only hosting

# Deploy Functions
firebase deploy --only functions

# Firestore rules
firebase deploy --only firestore:rules

# Emulateurs locaux (dev sans Firebase réel)
firebase emulators:start

# Seed données de test
npm run seed
```

---

## Pièges à éviter

1. **Ne jamais stocker la clé Brevo dans le code ou .env côté client** — elle est dans Firestore `config/app` et lue uniquement par les Cloud Functions
2. **Toujours vérifier l'heure de l'événement avant toute modification** — utiliser une fonction utilitaire `isEventEditable(event)`
3. **L'export ICS est public** (pas d'auth) — ne jamais inclure d'infos sensibles (emails, téléphones complets) dans les descriptions ICS
4. **Les listeners onSnapshot doivent être unsubscribed** dans le return du useEffect
5. **Dédupliquer les events ICS** via `icsUid` — un même match peut apparaître plusieurs fois dans le flux FFHB si modifié
6. **date-fns toujours avec locale fr** pour l'affichage — importer `{ fr } from 'date-fns/locale'`
7. **Les places disponibles se calculent dynamiquement** (ne pas stocker `availableSeats` comme valeur fixe — la calculer depuis les rides associés)

---

## Contact & ressources

- Calendrier FFHB ICS : `https://competition-calendar.ffhandball.fr/c-29681/s-3309.ics`
- Firebase console : https://console.firebase.google.com
- Brevo : https://app.brevo.com
- Spécifications complètes : `SPECS.md`
