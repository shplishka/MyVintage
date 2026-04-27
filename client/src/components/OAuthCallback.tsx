import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './OAuthCallback.css'

function decodeUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.userId ?? null
  } catch {
    return null
  }
}

export default function OAuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken  = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    const err          = params.get('error')

    if (err || !accessToken || !refreshToken) {
      setError('Google login failed. Please try again.')
      return
    }

    localStorage.setItem('accessToken',  accessToken)
    localStorage.setItem('refreshToken', refreshToken)

    const userId = decodeUserId(accessToken)
    navigate(userId ? `/profile/${userId}` : '/', { replace: true })
  }, [navigate])

  if (error) {
    return (
      <div className="oauth-callback-page">
        <div className="oauth-callback-card">
          <p className="oauth-callback-error">{error}</p>
          <a href="/login" className="oauth-callback-link">Back to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="oauth-callback-page">
      <div className="oauth-callback-card">
        <p className="oauth-callback-loading">Signing you in…</p>
      </div>
    </div>
  )
}
