import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "./context/ThemeContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Layout from "./components/Layout"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import SifenPage from "./pages/SifenPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-body-light dark:bg-body-dark">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pos" element={<div className="text-center py-20 text-gray-400">POS — en desarrollo</div>} />
        <Route path="sales" element={<div className="text-center py-20 text-gray-400">Ventas — en desarrollo</div>} />
        <Route path="products" element={<div className="text-center py-20 text-gray-400">Productos — en desarrollo</div>} />
        <Route path="inventory" element={<div className="text-center py-20 text-gray-400">Inventario — en desarrollo</div>} />
        <Route path="purchases" element={<div className="text-center py-20 text-gray-400">Compras — en desarrollo</div>} />
        <Route path="customers" element={<div className="text-center py-20 text-gray-400">Clientes — en desarrollo</div>} />
        <Route path="logistics" element={<div className="text-center py-20 text-gray-400">Distribuci\u00f3n — en desarrollo</div>} />
        <Route path="reports" element={<div className="text-center py-20 text-gray-400">Reportes — en desarrollo</div>} />
        <Route path="settings" element={<div className="text-center py-20 text-gray-400">Configuraci\u00f3n — en desarrollo</div>} />
        <Route path="sifen" element={<SifenPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
