import { Link } from 'react-router-dom'
import {
  UserPlus,
  Calendar,
  Baby,
  Car,
  Users,
  CalendarPlus,
  User as UserIcon,
  ArrowRight,
  Lightbulb,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

/**
 * Guide d'utilisation en une page — public (sans connexion), pour être
 * partagé par lien aux parents.
 */
export default function Aide() {
  const { firebaseUser } = useAuth()

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl">
            🤾
          </div>
          <h1 className="text-2xl font-bold text-secondary">HandCovoiturage — mode d'emploi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organiser les trajets de l'équipe en 2 minutes par entraînement.
          </p>
          <Link
            to={firebaseUser ? '/planning' : '/login'}
            className="btn-primary mt-4"
          >
            {firebaseUser ? 'Aller au planning' : 'Créer mon compte / me connecter'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <div className="space-y-4">
          <Step n={1} icon={<UserPlus className="h-5 w-5" />} title="Créer son compte">
            <p>
              Sur l'écran de connexion, onglet <b>Créer un compte</b> : entrez{' '}
              <b>l'email que vous avez communiqué au club</b> et choisissez un mot de passe
              (6 caractères minimum). Vous pouvez aussi utiliser <b>Continuer avec Google</b> si
              c'est une adresse Gmail.
            </p>
            <Tip>
              Seul l'email connu du club fonctionne : c'est lui qui relie automatiquement votre
              enfant à votre compte. Si vous voyez « Cet email n'est pas déclaré au club », prévenez
              l'organisateur. Mot de passe oublié → lien sous le formulaire.
            </Tip>
          </Step>

          <Step n={2} icon={<Calendar className="h-5 w-5" />} title="Le planning">
            <p>
              La liste des entraînements et matchs des <b>4 prochaines semaines</b>. Sous chaque
              événement : la situation de votre enfant (<i>à déclarer</i>, <i>aller ✔ retour ✔</i>)
              et le nombre de voitures. Touchez un événement pour l'ouvrir.
            </p>
          </Step>

          <Step n={3} icon={<Baby className="h-5 w-5" />} title="Inscrire son enfant">
            <p>
              Dans l'événement, bloc <b>Mes enfants</b> : cochez <b>Aller</b> et/ou{' '}
              <b>Retour</b> selon la présence, puis choisissez l'adresse de prise en charge ou de
              dépose. Pour une adresse exceptionnelle, <b>Autre adresse…</b>. C'est enregistré
              immédiatement.
            </p>
          </Step>

          <Step n={4} icon={<Car className="h-5 w-5" />} title="Proposer sa voiture">
            <p>
              Bloc <b>Ma voiture</b> : <b>J'emmène</b> et/ou <b>Je ramène</b>. Votre enfant est
              automatiquement à bord. Pas de nombre de places à saisir : le compteur passe en orange
              quand la voiture se remplit (5 enfants).
            </p>
          </Step>

          <Step n={5} icon={<Users className="h-5 w-5" />} title="Remplir les voitures — tous ensemble">
            <p>
              Le tableau <b>Qui va dans quelle voiture</b> : une ligne par enfant, une colonne par
              voiture, aller et retour côte à côte. Touchez un rond pour placer un enfant dans une
              voiture — <b>n'importe qui peut placer n'importe quel enfant</b>, c'est collaboratif.
              <b> Tout prendre</b> remplit une voiture d'un coup. La colonne <b>Sans voiture</b> et
              le bandeau d'alerte montrent ce qui reste à organiser.
            </p>
            <Tip>
              Seul un parent inscrit ou désinscrit son enfant, seul un chauffeur ajoute ou retire sa
              voiture. Tout est figé à l'heure de départ.
            </Tip>
          </Step>

          <Step n={6} icon={<CalendarPlus className="h-5 w-5" />} title="Le calendrier partagé">
            <p>
              Dans <b>Profil</b>, bouton <b>S'abonner</b> : chaque entraînement apparaît dans votre
              calendrier (iPhone, Google, Outlook) avec, dans les notes, qui emmène et ramène qui, et
              à quelle adresse. Il se met à jour tout seul.
            </p>
            <Tip>
              L'application fait foi ; le calendrier est un miroir. Sur iPhone, régler
              l'actualisation sur « Toutes les heures » (Réglages → Apps → Calendrier → Comptes).
            </Tip>
          </Step>

          <Step n={7} icon={<UserIcon className="h-5 w-5" />} title="Le profil">
            <p>
              Votre prénom affiché (celui que les autres voient en tête de colonne), les adresses de
              vos enfants (par défaut, et une deuxième si besoin), le lien du calendrier.
            </p>
          </Step>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-400">
          Prénoms uniquement, jamais d'email affiché.
          {' · '}
          <Link to={firebaseUser ? '/planning' : '/login'} className="text-primary hover:underline">
            {firebaseUser ? 'Retour au planning' : 'Se connecter'}
          </Link>
        </footer>
      </div>
    </div>
  )
}

function Step({
  n,
  icon,
  title,
  children,
}: {
  n: number
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="card space-y-2">
      <h2 className="flex items-center gap-2 font-semibold text-secondary">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white">
          {n}
        </span>
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="space-y-2 text-sm text-slate-600">{children}</div>
    </section>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
