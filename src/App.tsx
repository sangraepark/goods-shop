import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AdminRoute } from './routes/AdminRoute'
import { AuthPage } from './pages/AuthPage'
import { ProductsPage } from './pages/ProductsPage'
import { PaymentSuccessPage } from './pages/PaymentSuccessPage'
import { PaymentFailPage } from './pages/PaymentFailPage'
import { MyPaymentsPage } from './pages/MyPaymentsPage'
import { AdminPaymentsPage } from './pages/AdminPaymentsPage'
import { supabase } from './lib/supabaseClient'

function NavBar() {
  const { user, isAdmin } = useAuth()

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link to="/products" className="font-semibold text-slate-900">
          굿즈샵
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          {user ? (
            <>
              <Link to="/products" className="hover:text-slate-900">
                상품
              </Link>
              <Link to="/my-payments" className="hover:text-slate-900">
                내 결제 내역
              </Link>
              {isAdmin && (
                <Link to="/admin" className="hover:text-slate-900">
                  관리자
                </Link>
              )}
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="hover:text-slate-900"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link to="/login" className="hover:text-slate-900">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

function AppRoutes() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/fail" element={<PaymentFailPage />} />
        <Route
          path="/my-payments"
          element={
            <ProtectedRoute>
              <MyPaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPaymentsPage />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}

export default App
