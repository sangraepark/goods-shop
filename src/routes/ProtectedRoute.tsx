import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-slate-500">로딩 중...</div>
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
