import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Changer cette clé (ex. le pathname) réinitialise la barrière. */
  resetKey?: string
}
interface State {
  error: Error | null
}

/**
 * Évite la page blanche : une erreur de rendu affiche son message et un
 * bouton de rechargement. Se réinitialise quand `resetKey` change.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur de rendu', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="card mx-auto mt-8 max-w-md space-y-3 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
        <h1 className="font-semibold text-secondary">Oups, quelque chose a cassé</h1>
        <p className="text-sm text-slate-500">
          Envoyez ce message à l'administrateur :
        </p>
        <code className="block overflow-x-auto rounded-lg bg-slate-100 p-2 text-left text-xs text-red-700">
          {error.name}: {error.message}
        </code>
        <button onClick={() => window.location.reload()} className="btn-primary w-full">
          Recharger la page
        </button>
      </div>
    )
  }
}
