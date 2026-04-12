import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import api from '../api/axiosInstance'
import { login as apiLogin } from '../api/auth'
import type { LoginPayload } from '../api/auth'

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


const AuthContext = createContext<AuthContextValue | null>(null)


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    tokenExpiry: null,
    isLoading: true,
  })

  const fetchUser = useCallback(async (userId: string): Promise<AuthUser> => {
    const { data } = await api.get<AuthUser>(`/api/users/${userId}`)
    return data
  }, [])

  const syncFromStorage = useCallback(async () => {
    const stored = localStorage.getItem('accessToken')
    if (!stored) {
      setState({ user: null, accessToken: null, tokenExpiry: null, isLoading: false })
      return
    }

    const payload = decodeToken(stored)
    if (!payload || new Date(payload.exp * 1000) <= new Date()) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setState({ user: null, accessToken: null, tokenExpiry: null, isLoading: false })
      return
    }

    const expiry = new Date(payload.exp * 1000)

    try {
      const { data: user } = await api.get<AuthUser>('/api/auth/me')
      setState({ user, accessToken: stored, tokenExpiry: expiry, isLoading: false })
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setState({ user: null, accessToken: null, tokenExpiry: null, isLoading: false })
    }
  }, [])

  useEffect(() => {
    syncFromStorage()
  }, [syncFromStorage])


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

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refreshToken })
      } catch {
      }
    }
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
