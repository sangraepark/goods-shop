import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// UI 방어선일 뿐입니다. 실제 데이터 접근 제어는 Postgres RLS 정책이 담당합니다.
// (supabase/migrations/0004_rls_policies.sql 참고)
export function AdminRoute({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAuth()

  if (loading) return <div className="p-8 text-center text-slate-500">로딩 중...</div>
  if (!isAdmin) return <Navigate to="/products" replace />

  return <>{children}</>
}
