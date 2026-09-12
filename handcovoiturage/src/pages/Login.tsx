import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LogIn, UserPlus } from 'lucide-react'
import { registerWithEmail, signInWithEmail, signInWithGoogle } from '../services/auth'
import { Spinner } from '../components/ui/Spinner'

type Mode = 'login' | 'register'

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Email ou mot de passe incorrect',
  'auth/user-not-found': 'Aucun compte avec cet email — créez-en un',
  'auth/wrong-password': 'Email ou mot de passe incorrect',
  'auth/email-already-in-use': 'Un compte existe déjà avec cet email — connectez-vous, ou « Mot de passe oublié »',
  'app/not-declared': "Cet email n'est pas déclaré au club — contactez l'administrateur",
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum)',
  'auth/invalid-email': 'Email invalide',
  'auth/too-many-requests': 'Trop de tentatives, réessayez dans quelques minutes',
}

function errorMessage(e: unknown, fallback: string): string {
  const code = (e as { code?: string })?.code ?? ''
  return AUTH_ERRORS[code] ?? fallback
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setLoading(true)
    try {
      await fn()
      navigate(from, { replace: true })
    } catch (e) {
      toast.error(errorMessage(e, fallback))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'register') {
      if (password !== confirm) return toast.error('Les deux mots de passe diffèrent')
      void run(() => registerWithEmail(email, password), 'Impossible de créer le compte')
    } else {
      void run(() => signInWithEmail(email, password), 'Email ou mot de passe incorrect')
    }
  }

  const isRegister = mode === 'register'

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl">
            🤾
          </div>
          <h1 className="text-2xl font-bold text-secondary">HandCovoiturage</h1>
          <p className="mt-1 text-sm text-slate-500">Organisez les trajets de l'équipe</p>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-200 p-1">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                mode === m ? 'bg-white text-secondary shadow-sm' : 'text-slate-500'
              }`}
            >
              {m === 'login' ? 'Se connecter' : 'Créer un compte'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@email.fr"
            />
            {isRegister && (
              <p className="mt-1 text-xs text-slate-400">
                Uniquement l'email communiqué au club : c'est lui qui vous relie à votre enfant.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
            <input
              type="password"
              required
              minLength={isRegister ? 6 : undefined}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {isRegister && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : isRegister ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {isRegister ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          OU
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={() => run(signInWithGoogle, 'Échec de la connexion Google')}
          disabled={loading}
          className="btn w-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z" />
            <path fill="#EA4335" d="M12 4.7c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.1 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-5 6.7-5z" />
          </svg>
          Continuer avec Google
        </button>

        <p className="mt-6 flex justify-center gap-4 text-center text-sm text-slate-500">
          <Link to="/reset-password" className="text-primary hover:underline">
            Mot de passe oublié ?
          </Link>
          <Link to="/aide" className="text-primary hover:underline">
            Comment ça marche ?
          </Link>
        </p>
      </div>
    </div>
  )
}
