import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { accessToken, isLoading } = useAuth()

  if (isLoading) return null

  return accessToken ? <Outlet /> : <Navigate to="/login" replace />
}
