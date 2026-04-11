
export interface RegisterPayload {
  fullName: string
  username: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    fullName: string
    username: string
    email: string
  }
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  // TODO: replace with real API call to POST register
  console.log('[auth] register payload:', payload)
  return { token: 'mock-token', user: { id: '1', fullName: payload.fullName, username: payload.username, email: payload.email } }
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  // TODO: replace with real API call to POST login
  console.log('[auth] login payload:', payload)
  return { token: 'mock-token', user: { id: '1', fullName: 'Mock User', username: 'mockuser', email: payload.email } }
}
