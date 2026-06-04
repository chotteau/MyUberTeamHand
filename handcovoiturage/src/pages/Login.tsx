import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LogIn } from 'lucide-react'
import { signInWithEmail, signInWithGoogle } from '../services/auth'
import { Spinner } from '../components/ui/Spinner'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      toast.success('Connexion réussie')
      navigate(from, { replace: true })
    } catch {
      toast.error('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      await signInWithGoogle()
      toast.success('Connexion réussie')
      navigate(from, { replace: true })
    } catch {
      toast.error('Échec de la connexion Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl">
            🤾
          </div>
          <h1 className="text-2xl font-bold text-secondary">HandCovoiturage</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organisez les trajets de l'équipe
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@email.fr"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? <Spinner className="h-4 w-4 text-white" /> : <LogIn className="h-4 w-4" />}
            Se connecter
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          OU
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="btn w-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <img src="https://www.google.com/favicon.ico" alt="" className="h-4 w-4" />
          Continuer avec Google
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/reset-password" className="text-primary hover:underline">
            Mot de passe oublié ?
          </Link>
        </p>
      </div>
    </div>
  )
}
