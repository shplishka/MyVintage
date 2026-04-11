import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import api from '../api/axiosInstance'
import { login as apiLogin, LoginPayload } from '../api/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  _id: string
  username: string
  email: string
  profilePicture?: string | null
  biography?: string | null
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  tokenExpiry: Date | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login(payload: LoginPayload): Promise<AuthUser>
  logout(): void
  refreshUser(): Promise<void>
}

// ── JWT decode (no external library needed) ───────────────────────────────────

interface JwtPayload {
  userId: string
  email: string
  exp: number
}

function decodeToken(token: string): JwtPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as JwtPayload
  } catch {
    return null
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    tokenExpiry: null,
    isLoading: true,
  })

  // Fetch the full user object for a given userId
  const fetchUser = useCallback(async (userId: string): Promise<AuthUser> => {
    const { data } = await api.get<AuthUser>(`/api/users/${userId}`)
    return data
  }, [])

  // Sync context state from the token currently in localStorage
  const syncFromStorage = useCallback(async () => {
    const stored = localStorage.getItem('accessToken')
    if (!stored) {
      setState({ user: null, accessToken: null, tokenExpiry: null, isLoading: false })
      return
    }

    const payload = decodeToken(stored)
    if (!payload) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setState({ user: null, accessToken: null, tokenExpiry: null, isLoading: false })
      return
    }

    const expiry = new Date(payload.exp * 1000)

    // Token already expired — clear and bail
    if (expiry <= new Date()) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setState({ user: null, accessToken: null, tokenExpiry: null, isLoading: false })
      return
    }

    try {
      const user = await fetchUser(payload.userId)
      setState({ user, accessToken: stored, tokenExpiry: expiry, isLoading: false })
    } catch {
      // Could not fetch user (e.g. network down) — keep token, no user object
      setState({ user: null, accessToken: stored, tokenExpiry: expiry, isLoading: false })
    }
  }, [fetchUser])

  // Bootstrap on mount
  useEffect(() => {
    syncFromStorage()
  }, [syncFromStorage])

  // When the refresh interceptor rotates the access token it dispatches this
  // event so the context stays in sync without a circular dependency
  useEffect(() => {
    const handler = (e: Event) => {
      const { accessToken } = (e as CustomEvent<{ accessToken: string }>).detail
      const payload = decodeToken(accessToken)
      if (!payload) return
      setState((prev) => ({
        ...prev,
        accessToken,
        tokenExpiry: new Date(payload.exp * 1000),
      }))
    }
    window.addEventListener('token:refreshed', handler)
    return () => window.removeEventListener('token:refreshed', handler)
  }, [])

  // ── Public API ──────────────────────────────────────────────────────────────

  const login = useCallback(
    async (payload: LoginPayload): Promise<AuthUser> => {
      const { accessToken } = await apiLogin(payload)
      const decoded = decodeToken(accessToken)
      if (!decoded) throw new Error('Malformed token received')

      const expiry = new Date(decoded.exp * 1000)
      const user = await fetchUser(decoded.userId)
      setState({ user, accessToken, tokenExpiry: expiry, isLoading: false })
      return user
    },
    [fetchUser],
  )

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setState({ user: null, accessToken: null, tokenExpiry: null, isLoading: false })
    window.location.href = '/login'
  }, [])

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem('accessToken')
    if (!stored) return
    const payload = decodeToken(stored)
    if (!payload) return
    const user = await fetchUser(payload.userId)
    setState((prev) => ({ ...prev, user }))
  }, [fetchUser])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
