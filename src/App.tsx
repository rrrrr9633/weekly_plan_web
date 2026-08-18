import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { getRoleHomePath } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { LoginPage } from '@/pages/LoginPage'
import { PersonalPage } from '@/pages/PersonalPage'
import { BoardPage } from '@/pages/BoardPage'
import { UserManagementPage } from '@/pages/UserManagementPage'
import { ProjectManagementPage } from '@/pages/ProjectManagementPage'
import { ArchivedPlansPage } from '@/pages/ArchivedPlansPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { CompanyManagementPage } from '@/pages/CompanyManagementPage'
import { AiAssistant } from '@/components/AiAssistant'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin' && user.role !== 'super_admin') return <Navigate to={getRoleHomePath(user)} replace />
  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore()
  if (user && token) return <Navigate to={getRoleHomePath(user)} replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen">
      {user && <Sidebar />}
      {user && <AiAssistant />}
      <AnimatePresence mode="wait">
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/personal"
            element={
              <ProtectedRoute>
                <PersonalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/board"
            element={
              <ProtectedRoute>
                <BoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/companies"
            element={
              <AdminRoute>
                <CompanyManagementPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagementPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <AdminRoute>
                <ProjectManagementPage />
              </AdminRoute>
            }
          />
          <Route
            path="/archived"
            element={
              <ProtectedRoute>
                <ArchivedPlansPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={getRoleHomePath(user)} replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
