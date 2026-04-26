import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.185l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { login, user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      navigate(`/profile/${user._id}`, { replace: true })
    }
  }, [user, navigate])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ email, password })
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message ?? 'Login failed.')
      } else {
        setError(err instanceof Error ? err.message : 'Login failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1 className="login-logo">MyVintage</h1>
          <p className="login-tagline">Discover rare. Sell beloved.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && <p className="login-error">{error}</p>}

          <div className="field">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <a href="/api/auth/google" className="google-btn">
          <GoogleIcon />
          Continue with Google
        </a>

        <p className="login-signup-link">
          Don't have an account?{' '}
          <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
