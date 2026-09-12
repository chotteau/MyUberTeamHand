# HandCovoiturage

Covoiturage collaboratif pour une équipe de handball jeunes — React + TypeScript + Firebase.

- **Parents** : inscrivent leur enfant (aller / retour, adresse du jour), déclarent « j'emmène » /
  « je ramène », et remplissent la matrice enfants × voitures. Tout le monde peut déplacer n'importe
  quel enfant ; seul le chauffeur gère sa voiture, seul le parent gère son enfant.
- **Admin** : familles (import CSV), entraînements générés sur la saison, matchs FFHB synchronisés,
  configuration.
- **Sortie** : un calendrier partagé (ICS) dont chaque événement décrit qui emmène / ramène qui.
  Aucun email applicatif.

Spécifications : [`../SPECS.md`](../SPECS.md) · Conventions : [`../CLAUDE.md`](../CLAUDE.md) ·
Déploiement : [`DEPLOYMENT.md`](DEPLOYMENT.md)

## Développement

```bash
npm install
cp .env.local.example .env.local   # clés Firebase (VITE_FIREBASE_*)
npm run dev                        # http://localhost:5173
npm run lint && npm run build
```

Émulateurs + données de test :

```bash
firebase emulators:start
npm run seed                       # admin@hand.fr / password123, parents jean@, sophie@… / password123
```

## Format CSV familles

```
prenom_enfant;prenom_parent1;email_parent1;adresse1_rue;adresse1_cp;adresse1_ville;label_adresse1;prenom_parent2;email_parent2;adresse2_rue;adresse2_cp;adresse2_ville;label_adresse2
```

Pas de nom de famille, pas de téléphone. `adresse2` = adresse secondaire (parents séparés), vide sinon.
