import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  Smartphone,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

/**
 * Guide d'utilisation en une page — public (sans connexion), pour être
 * partagé par lien aux parents.
 */
export default function Aide() {
  const { firebaseUser } = useAuth()
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

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
          <Step n={1} id="compte" icon={<UserPlus className="h-5 w-5" />} title="Créer son compte">
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

          <Step n={2} id="planning" icon={<Calendar className="h-5 w-5" />} title="Le planning">
            <p>
              La liste des entraînements et matchs des <b>4 prochaines semaines</b>. Sous chaque
              événement : la situation de votre enfant (<i>à déclarer</i>, <i>aller ✔ retour ✔</i>)
              et le nombre de voitures. Touchez un événement pour l'ouvrir.
            </p>
          </Step>

          <Step n={3} id="enfants" icon={<Baby className="h-5 w-5" />} title="Inscrire son enfant">
            <p>
              Dans l'événement, bloc <b>Mes enfants</b> : cochez <b>Aller</b> et/ou{' '}
              <b>Retour</b> selon la présence, puis choisissez l'adresse de prise en charge ou de
              dépose. Pour une adresse exceptionnelle, <b>Autre adresse…</b>. C'est enregistré
              immédiatement.
            </p>
            <p>
              Sous les adresses, un <b>commentaire</b> pour l'enfant si besoin (« a son sac de sport
              avec lui ») : il apparaît dans le calendrier partagé.
            </p>
          </Step>

          <Step n={4} id="voiture" icon={<Car className="h-5 w-5" />} title="Proposer sa voiture">
            <p>
              Bloc <b>Ma voiture</b> : <b>J'emmène</b> et/ou <b>Je ramène</b>, et le nombre de{' '}
              <b>places</b> disponibles pour les enfants (4 par défaut, réglable de 2 à 6 — sans
              vous compter, votre enfant en occupe une). Votre enfant monte avec vous — sauf s'il est
              déjà placé chez quelqu'un d'autre, auquel cas l'app vous demande s'il y reste ; et si
              une autre voiture a de la place, elle vous demande s'il monte avec vous ou avec l'autre.
            </p>
            <p>
              Facultatif, une fois déclaré : un <b>lieu de rendez-vous</b> par direction (chez vous,
              votre adresse secondaire ou une autre) si vous préférez que les enfants viennent à vous
              plutôt que de passer les chercher, et un <b>commentaire</b> (« RDV 17h05 devant chez
              moi »). Les deux apparaissent dans le calendrier partagé.
            </p>
            <Tip>
              Si vous retirez votre voiture, vos passagers sont automatiquement rebasculés dans les
              autres voitures qui ont de la place ; sinon ils passent « Sans voiture » et le tableau
              le signale.
            </Tip>
          </Step>

          <Step n={5} id="matrice" icon={<Users className="h-5 w-5" />} title="Remplir les voitures — tous ensemble">
            <p>
              Le tableau <b>Qui va dans quelle voiture</b> se lit comme un plan de table : une{' '}
              <b>ligne par enfant</b>, une <b>colonne par voiture</b> (le prénom du chauffeur en
              haut), la partie gauche pour l'<b>aller</b>, la droite pour le <b>retour</b>. Le rond
              plein indique la voiture de l'enfant ; la ligne <b>Total</b> compte les enfants par
              voiture.
            </p>
            <p>
              <b>Vous n'avez normalement rien à faire</b> : dès qu'un enfant est inscrit, l'app le
              place dans la première voiture déclarée qui a encore une place. Pour changer,
              touchez le rond d'une autre colonne — <b>n'importe qui peut déplacer n'importe quel
              enfant</b>, c'est collaboratif. <b>Tout prendre</b> remplit une voiture d'un coup.
            </p>
            <p>
              La ligne <b>Total</b> affiche « 3/4 » (enfants / places) : <b>vert</b> quand la voiture
              est pleine. On peut forcer un enfant de plus à la main (l'app demande confirmation) :
              le total passe en <b>rouge</b> et le bandeau le signale. La colonne{' '}
              <b>Sans voiture</b> et le bandeau montrent ce qui reste à organiser ; « plus de
              place » signifie que toutes les voitures sont pleines : un chauffeur de plus est
              nécessaire.
            </p>
            <Tip>
              Seul un parent inscrit ou désinscrit son enfant, seul un chauffeur ajoute ou retire sa
              voiture. Tout est figé à l'heure de départ.
            </Tip>
          </Step>

          <Step n={6} id="calendrier" icon={<CalendarPlus className="h-5 w-5" />} title="Le calendrier partagé">
            <p>
              Dans <b>Profil</b>, bouton <b>S'abonner</b> : chaque entraînement apparaît dans votre
              calendrier (iPhone, Google, Outlook) avec, dans les notes, qui emmène et ramène qui, à
              quelle adresse (ou au lieu de rendez-vous fixé par le chauffeur), et les commentaires
              des chauffeurs et des parents. Il se met à jour tout seul.
            </p>
            <Tip>
              L'application fait foi ; le calendrier est un miroir. Sur iPhone, régler
              l'actualisation sur « Toutes les heures » (Réglages → Apps → Calendrier → Comptes).
            </Tip>
          </Step>

          <Step n={7} id="profil" icon={<UserIcon className="h-5 w-5" />} title="Le profil">
            <p>
              Votre prénom affiché (celui que les autres voient en tête de colonne), les adresses de
              vos enfants (par défaut, et une deuxième si besoin), le lien du calendrier.
            </p>
          </Step>

          <Step n={8} id="installer" icon={<Smartphone className="h-5 w-5" />} title="L'installer sur son téléphone">
            <p>
              Pas d'application à télécharger : ajoutez le site à l'écran d'accueil, il s'ouvre
              ensuite comme une app, plein écran, avec son icône 🤾.
            </p>
            <ul className="space-y-1.5 pl-1">
              <li>
                <b>iPhone / iPad (Safari)</b> : ouvrez <span className="font-mono text-xs">myuberteamhand.web.app</span>,
                touchez le bouton <b>Partager</b> (le carré avec la flèche, en bas de l'écran), puis{' '}
                <b>Sur l'écran d'accueil</b> → <b>Ajouter</b>.
              </li>
              <li>
                <b>Android (Chrome)</b> : ouvrez le site, touchez le menu <b>⋮</b> en haut à droite,
                puis <b>Ajouter à l'écran d'accueil</b> (ou <b>Installer l'application</b>) →{' '}
                <b>Installer</b>.
              </li>
            </ul>
            <Tip>
              Sur iPhone, il faut passer par Safari : depuis Chrome ou le navigateur intégré de WhatsApp,
              l'option n'apparaît pas. Copiez le lien et ouvrez-le dans Safari.
            </Tip>
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
  id,
  icon,
  title,
  children,
}: {
  n: number
  id: string
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="card scroll-mt-4 space-y-2">
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
