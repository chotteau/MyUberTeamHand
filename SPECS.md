# HandCovoiturage — Spécifications Détaillées v1.1

## Vue d'ensemble

Application web de gestion de covoiturage pour une équipe de handball jeunes.
Permet aux parents de coordonner les trajets (entraînements + matchs) de manière collaborative.

- **Stack** : React + TypeScript + Firebase (Auth + Firestore + Hosting) + Brevo (emails)
- **Langue** : 100% Français
- **Interface** : Mobile-first + Desktop compatible
- **Rôles** : Admin / Driver (Parent)

---

## 1. Modèle de données (Firestore)

### Collection `users`
```typescript
{
  uid: string,                    // Firebase Auth UID
  email: string,
  displayName: string,            // prénom seul ou "Prénom B" si ambiguïté — pas de nom complet
  role: 'admin' | 'driver',
  childId: string,                // référence → children/{id}
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection `children`
```typescript
{
  id: string,
  firstName: string,              // prénom seul (ex: "Lucas") ou avec initiale (ex: "Lucas M") — pas de nom de famille
  parentIds: string[],            // 1 ou 2 UIDs — famille monoparentale supportée
  addresses: [
    {
      id: string,
      label: string,              // ex: "Chez Papa", "Chez Maman", "Domicile"
      street: string,
      city: string,
      zipCode: string,
      parentUid: string           // à quel parent appartient cette adresse
    }
  ],
  // Note : si les 2 parents vivent à la même adresse, une seule adresse est saisie
  active: boolean,
  createdAt: Timestamp
}
```

### Collection `events`
```typescript
{
  id: string,
  type: 'training' | 'match',
  title: string,                  // ex: "Entraînement Lundi", "Match vs Montpellier"
  date: Timestamp,
  departureTime: Timestamp,       // heure départ aller
  returnTime?: Timestamp,         // heure départ retour (optionnel)
  location: {
    name: string,
    address: string,
    city: string
  },
  status: 'scheduled' | 'cancelled' | 'vacances' | 'completed',
  // 'cancelled'  → annulé (raison quelconque)
  // 'vacances'   → annulé spécifiquement car vacances scolaires
  // 'completed'  → passé — figé, alimente les stats, non modifiable
  source: 'manual' | 'ics_ffhb' | 'generated', // 'generated' = entraînement auto-généré
  icsUid?: string,               // UID de l'event ICS source (déduplication)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection `needs`
```typescript
{
  id: string,
  eventId: string,               // référence → events/{id}
  childId: string,               // référence → children/{id}
  declaredByUid: string,         // parent qui déclare le besoin
  direction: 'outbound' | 'return' | 'both',
  pickupAddressId: string,       // adresse active pour l'aller
  dropoffAddressId?: string,     // adresse active pour le retour (si différente)
  status: 'pending' | 'assigned' | 'cancelled',
  assignedRideId?: string,       // référence → rides/{id}
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection `offers`
```typescript
{
  id: string,
  eventId: string,
  driverUid: string,
  childId: string,               // enfant du chauffeur (toujours embarqué)
  direction: 'outbound' | 'return' | 'both',
  vehicleCapacity: number,       // saisi au moment de la déclaration (pas stocké sur la famille)
  // Places disponibles = vehicleCapacity - 1 (son enfant occupe 1 place)
  // Calculé dynamiquement depuis les rides associés, jamais stocké
  departureAddressId: string,    // adresse de départ du chauffeur
  status: 'open' | 'full' | 'cancelled',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection `rides`
```typescript
{
  id: string,
  eventId: string,
  offerId: string,               // référence → offers/{id}
  driverUid: string,
  direction: 'outbound' | 'return',
  passengers: [
    {
      childId: string,
      needId: string,
      pickupAddress: string,     // adresse complète snapshot
      confirmedAt?: Timestamp
    }
  ],
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection `config`
```typescript
// Document unique : config/app
{
  season: string,                // ex: "2024-2025"
  seasonStart: Timestamp,        // 1er jour de la saison (génération du calendrier)
  seasonEnd: Timestamp,          // dernier jour de la saison
  // Le calendrier complet est généré entre seasonStart et seasonEnd.
  // L'affichage par défaut montre les 2 prochaines semaines glissantes.

  trainingDays: [
    {
      dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 0,  // 1=Lundi … 0=Dimanche (ISO)
      label: string,             // ex: "Lundi soir", "Vendredi"
      departureTime: string,     // "HH:mm" heure départ aller
      returnTime: string,        // "HH:mm" heure départ retour
      location: {
        name: string,
        address: string,
        city: string
      }
    }
  ],
  // Exactement 2 jours configurables. Chaque jour peut être modifié
  // individuellement sur un event précis (déplacé du lundi au mardi par ex.)
  // sans toucher au pattern récurrent.

  icsUrl: string,                // URL calendrier FFHB
  icsLastSync: Timestamp,
  reminderHoursBefore: number,   // défaut: 24 (J-1)
  brevoApiKey: string,           // clé API Brevo (stockée côté admin)
  emailFrom: string,             // adresse expéditeur
  calendarName: string           // nom du calendrier ICS exporté
}
```

### Collection `notifications`
```typescript
{
  id: string,
  type: 'reminder' | 'missing_driver' | 'assignment_confirmed' | 'schedule_change',
  recipientUid: string,
  eventId: string,
  message: string,
  sentAt?: Timestamp,
  status: 'pending' | 'sent' | 'failed'
}
```

---

## 2. Fonctionnalités détaillées

### 2.1 Authentification

- Email / password (Firebase Auth)
- Google OAuth (Firebase Auth)
- Récupération de mot de passe par email
- Première connexion → profil incomplet → redirection vers complétion profil
- L'admin lie manuellement un compte à un enfant (ou via CSV)
- Un parent ne peut voir que ses données + les infos covoiturage des événements

### 2.2 Import CSV

Format attendu (encodage UTF-8, séparateur `;`) :
```
prenom_enfant;prenom_parent1;email_parent1;adresse1_rue;adresse1_cp;adresse1_ville;label_adresse1;prenom_parent2;email_parent2;adresse2_rue;adresse2_cp;adresse2_ville;label_adresse2
```

Règles de parsing :
- **Pas de nom de famille** — le prénom seul suffit. En cas d'ambiguïté, l'admin saisit manuellement une initiale (ex : "Lucas M")
- **Pas de numéro de téléphone** — inutile dans ce contexte
- **Pas de capacité voiture dans le CSV** — chaque parent possède une voiture mais la capacité n'est connue qu'au moment de la déclaration d'offre
- **Famille monoparentale** : les colonnes parent2 / adresse2 sont entièrement optionnelles
- **Adresse unique** : si les 2 parents vivent à la même adresse, laisser adresse2 vide — l'adresse1 sera partagée
- Import crée les enfants + envoie invitation email aux parents
- Si email parent existe déjà → liaison au nouvel enfant sans recréer le compte
- Rapport d'import : nb créés / mis à jour / erreurs

### 2.3 Gestion des événements

#### Entraînements automatiques
- Générés automatiquement selon `config.trainingDays` pour **toute la saison** (de `seasonStart` à `seasonEnd`)
- **Pas de calendrier de vacances** — l'admin gère manuellement chaque entraînement concerné :
  - Statut `vacances` → annulé car vacances scolaires
  - Statut `cancelled` → annulé pour une autre raison
- **Modification d'un jour ponctuel** : l'admin peut déplacer un entraînement (ex : Lundi → Mardi) et/ou changer le lieu, sans toucher au pattern récurrent de la saison
- **Affichage par défaut** : 2 semaines glissantes — le calendrier complet reste consultable
- Admin peut annuler / modifier / déplacer un entraînement spécifique
- **Events passés** : tout event dont `departureTime < now()` passe automatiquement en `completed` — grisé dans l'UI, non modifiable, alimente les stats

#### Import matchs FFHB (ICS)
- **Sync automatique toutes les 24h** (Cloud Function) — c'est le mode principal
- **Bouton sync manuelle** disponible en admin pour forcer une mise à jour immédiate
- Déduplication par `icsUid`
- Nouveaux matchs → création event + notification email admin
- Matchs annulés dans le flux ICS → event marqué `cancelled` + notification groupe
- Affichage : date, heure, lieu, équipe adverse

#### Création manuelle d'événements (onglet Événements admin)
L'onglet Événements sert à créer des événements **hors-automatisme** :
- Entraînement ponctuel non récurrent (date exceptionnelle)
- Match ou tournoi **absent du flux ICS FFHB**
- Tout autre événement d'équipe nécessitant un covoiturage

> Les entraînements récurrents sont générés automatiquement et ne passent pas par ce formulaire, sauf pour une modification/annulation ponctuelle.

### 2.4 Déclarations

#### Déclarer un besoin (parent)
1. Choisir l'événement
2. Choisir direction : aller / retour / les deux
3. Si l'enfant a 2 adresses : choisir l'adresse active pour ce trajet
4. Valider → `need` créé avec status `pending`
5. Visible immédiatement sur le planning collaboratif

#### Déclarer une offre (chauffeur)
1. Choisir l'événement
2. Choisir direction : aller / retour / les deux
3. Saisir la capacité de la voiture utilisée ce jour-là (nombre de places totales)
   - La capacité n'est **pas pré-remplie** depuis le profil : chaque parent peut prendre une voiture différente selon les jours
4. Places disponibles = capacité - 1 (son propre enfant toujours compté)
5. Valider → `offer` créée avec status `open`

### 2.5 Attribution collaborative

- Vue planning de l'événement : liste des besoins + liste des offres
- **Chauffeur** : voit les enfants sans voiture → bouton "Prendre [Prénom]"
- **Parent** : voit les voitures disponibles → bouton "Mettre [Prénom] dans cette voiture"
- Contraintes vérifiées automatiquement :
  - Places disponibles dans la voiture
  - Direction compatible (aller / retour)
- Modification possible jusqu'à l'heure de l'événement
- Tout changement → notification email aux parties concernées

#### Alertes manque chauffeur
- Déclenchée si : nb enfants avec besoin > places offertes (aller ou retour séparément)
- Email à tous les parents sans offre déclarée pour cet événement
- Message incitatif personnalisé

### 2.6 Calendrier partagé (export ICS)

Un fichier ICS unique accessible via URL publique (ex: `/api/calendar/handcovoiturage.ics`)

Structure des events ICS générés :
```
VEVENT par voiture × direction × événement
SUMMARY: 🚗 Aller - Voiture Papa Martin (Lucas, Emma, Tom)
DTSTART: date + heure départ
DTEND: date + heure arrivée estimée (+45min)
LOCATION: adresse du gymnase / stade
DESCRIPTION: Chauffeur: Jean Martin (06 12 34 56 78)
             Passagers: Lucas Dupont (✓), Emma Petit (✓), Tom Bernard (✓)
             Adresses de prise en charge:
             - Emma: 12 rue des Lilas, Paris
             - Tom: 8 avenue du Parc, Paris
```

- URL stable, re-générée à chaque modification
- Subscribable depuis Google Cal / Apple Cal
- Seuls les events confirmés (au moins 1 ride) apparaissent

### 2.7 Notifications email (Brevo)

#### Templates à créer dans Brevo :

**`reminder_parent`** — Rappel J-1 besoin non déclaré
```
Objet: 🤾 [Prénom enfant] — Covoiturage [jour] non organisé
Corps: Il reste moins de 24h avant [événement].
       Vous n'avez pas encore déclaré si [prénom] a besoin d'un trajet.
       → [Bouton: Déclarer maintenant]
```

**`reminder_driver`** — Rappel J-1 pas assez de chauffeurs
```
Objet: 🚗 Besoin d'un chauffeur pour [jour]
Corps: Il manque [N] place(s) pour [événement] demain.
       Pouvez-vous conduire ?
       → [Bouton: Je conduis]
```

**`assignment_confirmed`** — Attribution confirmée
```
Objet: ✅ Covoiturage confirmé — [événement]
Corps: Le covoiturage est organisé pour [événement].
       Aller: [Prénom enfant] avec [Chauffeur] — départ [heure]
       Retour: [Prénom enfant] avec [Chauffeur] — départ [heure]
       → [Bouton: Voir le planning]
```

**`schedule_change`** — Modification de planning
```
Objet: ⚠️ Modification covoiturage — [événement]
Corps: Le planning de covoiturage a été modifié.
       [Détails du changement]
       → [Bouton: Voir le nouveau planning]
```

**`invitation`** — Invitation nouveau parent
```
Objet: 🤾 Bienvenue sur HandCovoiturage
Corps: Votre compte a été créé pour [prénom enfant].
       → [Bouton: Créer mon mot de passe]
```

### 2.8 Statistiques

Page stats accessible à tous (admin + drivers) — **vue saison uniquement** (pas de filtre semaine/mois).

#### Podium Top 3 (bloc ludique en haut de page)
- 🥇 🥈 🥉 Les 3 chauffeurs les plus assidus mis en avant visuellement (podium ou cartes colorées)
- Affiche : prénom, nb total de trajets, % de participation sur les events de la saison
- Ton encourageant : "Les héros du covoiturage 🚗"

#### Tableau de bord saison
- **Graphique en barres horizontales** : nb de trajets par chauffeur, trié du plus au moins actif
- Barres bicolores : part aller (couleur primaire) / part retour (couleur secondaire)
- **Tableau détaillé** :
  - Prénom chauffeur
  - Nb trajets aller
  - Nb trajets retour
  - Total
  - % de participation (trajets réalisés / events de la saison)
- **Mise en évidence** : le(s) chauffeur(s) le(s) moins actif(s) affiché(s) avec un indicateur discret (ex : badge "À ton tour 😉")
- Pas de données personnelles exposées (prénoms uniquement, pas d'emails ni de téléphones)

---

## 3. Structure des écrans

### 3.1 Écrans publics
- `/login` — Connexion email/password + Google OAuth
- `/reset-password` — Récupération mot de passe
- `/invitation/:token` — Création compte depuis invitation CSV

### 3.2 Écrans Driver (parent)
- `/` → redirect vers `/planning`
- `/planning` — Vue calendrier des événements à venir (2 semaines)
  - Badges : "À déclarer" / "En attente" / "Confirmé"
  - Quick actions : déclarer besoin / offre
- `/event/:id` — Détail événement
  - Onglet Aller / Retour
  - Section "Besoins" : qui a besoin d'un trajet
  - Section "Voitures" : offres disponibles + places restantes
  - Actions : déclarer, s'attribuer, modifier
- `/mon-profil` — Modifier infos personnelles, adresses enfant
- `/stats` — Tableau de bord équité chauffeurs

### 3.3 Écrans Admin (en plus des écrans driver)
- `/admin` — Dashboard admin
  - Résumé : events cette semaine, alertes manque chauffeur, dernière sync ICS
- `/admin/evenements` — Gestion événements
  - Liste tous les events (2 semaines glissantes par défaut, calendrier complet accessible)
  - Events passés : grisés, lecture seule
  - Bouton "Sync ICS FFHB" (forçage manuel — la sync auto tourne toutes les 24h)
  - Créer un event ponctuel (entraînement exceptionnel ou match hors ICS)
  - Sur chaque event futur : modifier / déplacer / annuler (`cancelled` ou `vacances`)
- `/admin/familles` — Gestion enfants + parents
  - Liste des enfants avec leur(s) parent(s) lié(s) — prénoms uniquement
  - Import CSV (format sans téléphone ni nom de famille)
  - Ajouter / modifier / désactiver une famille manuellement
  - Envoyer invitation email
- `/admin/config` — Configuration
  - **Dates de saison** : date de début et date de fin (génère le calendrier complet)
  - **2 jours d'entraînement** configurables : jour de la semaine, heure aller, heure retour, lieu
  - URL ICS FFHB
  - Config email Brevo
  - Bouton "Regénérer le calendrier" (après modification des dates ou des jours)

---

## 4. Règles métier critiques

1. **Un chauffeur emmène toujours son enfant** — son enfant est automatiquement passager de son ride
2. **Aller et retour sont indépendants** — une offre peut couvrir les deux mais les rides sont distincts
3. **L'attribution est collaborative** — tout parent peut attribuer n'importe quel enfant à n'importe quelle voiture (dans la limite des places)
4. **Modifications possibles jusqu'à l'heure H** — après, l'event passe en `completed`, plus de modification
5. **Places dispo = capacité - 1** (le chauffeur lui-même ne compte pas dans les passagers déclarés, mais son enfant oui)
6. **Un enfant = 1 besoin par direction par événement** — pas de doublon possible
7. **Un parent = 1 offre par direction par événement** — pas de doublon possible
8. **Events passés = figés et grisés** — tout événement dont `departureTime < now()` est affiché en lecture seule (grisé dans l'UI), non modifiable, non annulable. Son statut final alimente les statistiques de la saison.
9. **Capacité voiture déclarée à l'offre** — elle n'est pas stockée sur le profil parent car un même parent peut utiliser des véhicules différents selon les jours

---

## 5. Architecture technique

```
handcovoiturage/
├── src/
│   ├── components/
│   │   ├── ui/               # Composants génériques (boutons, modals, badges...)
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
│   │   ├── useAuth.ts
│   │   ├── useEvent.ts
│   │   ├── useRides.ts
│   │   └── useStats.ts
│   ├── services/
│   │   ├── firebase.ts       # Init Firebase
│   │   ├── auth.ts           # Auth service
│   │   ├── events.ts         # CRUD events
│   │   ├── rides.ts          # CRUD needs/offers/rides
│   │   ├── ics.ts            # Import ICS FFHB + Export ICS
│   │   ├── email.ts          # Brevo integration
│   │   ├── csv.ts            # Import/export CSV
│   │   └── notifications.ts  # Gestion notifications
│   ├── types/
│   │   └── index.ts          # Tous les types TypeScript
│   ├── utils/
│   │   ├── dates.ts          # Helpers dates (date-fns)
│   │   ├── ics.ts            # Parser/générateur ICS
│   │   └── validation.ts     # Schémas Zod
│   └── contexts/
│       ├── AuthContext.tsx
│       └── AppContext.tsx
├── functions/                # Firebase Cloud Functions
│   ├── src/
│   │   ├── syncIcs.ts        # Sync auto ICS FFHB (scheduled)
│   │   ├── sendReminders.ts  # Envoi rappels J-1 (scheduled)
│   │   ├── calendarExport.ts # Endpoint HTTP export ICS
│   │   └── onRideChange.ts   # Trigger Firestore → notifications
├── firestore.rules           # Règles de sécurité Firestore
├── firestore.indexes.json    # Index Firestore
└── firebase.json             # Config Firebase
```

---

## 6. Règles de sécurité Firestore

```
// users : lecture/écriture sur son propre doc
// children : lecture si parentId contient son uid
// events : lecture pour tous les authentifiés / écriture admin only
// needs : lecture/écriture si uid = declaredByUid ou parentIds contient uid
// offers : lecture/écriture si uid = driverUid
// rides : lecture pour tous les auth / écriture si driverUid ou passager
// config : lecture admin only / écriture admin only
// stats : lecture pour tous les auth (agrégats uniquement)
```

---

## 7. Dépendances npm recommandées

```json
{
  "dependencies": {
    "react": "^18",
    "react-router-dom": "^6",
    "firebase": "^10",
    "date-fns": "^3",
    "ical.js": "^2",
    "ics": "^3",
    "papaparse": "^5",
    "zod": "^3",
    "recharts": "^2",
    "@tanstack/react-query": "^5",
    "react-hot-toast": "^2",
    "lucide-react": "^0.400"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^5",
    "tailwindcss": "^3",
    "firebase-tools": "^13"
  }
}
```

---

## 8. Variables d'environnement

```env
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# App
VITE_APP_URL=https://handcovoiturage.web.app
```

Les clés Brevo sont stockées dans Firestore `config/app` (côté admin), pas dans les variables d'env.

---

## 9. Données de test (seed)

Créer un script `seed.ts` avec :
- 1 admin : admin@hand.fr / Admin123!
- 6 enfants avec 2 parents chacun (12 comptes drivers)
- 3 événements : 2 entraînements + 1 match
- Quelques needs et offers pour tester l'attribution

---

## 10. Checklist de livraison

- [ ] Auth email/password + Google OAuth fonctionnelle
- [ ] Import CSV avec rapport d'erreurs
- [ ] Génération automatique entraînements (8 semaines)
- [ ] Import ICS FFHB (manuel + auto)
- [ ] Déclaration besoin avec sélection adresse
- [ ] Déclaration offre avec capacité voiture
- [ ] Attribution collaborative temps réel (Firestore listeners)
- [ ] Export ICS calendrier partagé
- [ ] Emails Brevo (5 templates)
- [ ] Stats visuelles
- [ ] Règles Firestore sécurisées
- [ ] Responsive mobile-first
- [ ] Données de test (seed)
- [ ] Déploiement Firebase Hosting
