import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail } from 'lucide-react'
import { resetPassword } from '../services/auth'
import { Spinner } from '../components/ui/Spinner'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      toast.success('Email de réinitialisation envoyé')
    } catch {
      // Pour des raisons de sécurité on n'indique pas si l'email existe
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold text-secondary">
          Mot de passe oublié
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Saisissez votre email, nous vous enverrons un lien de
          réinitialisation.
        </p>

        {sent ? (
          <div className="card text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-success" />
            <p className="text-sm text-slate-600">
              Si un compte est associé à <strong>{email}</strong>, un email vient
              d'être envoyé. Pensez à vérifier vos spams.
            </p>
          </div>
        ) : (
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
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? <Spinner className="h-4 w-4 text-white" /> : null}
              Envoyer le lien
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
