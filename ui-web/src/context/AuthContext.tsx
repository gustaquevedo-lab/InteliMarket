import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { api } from "../api"

interface User {
  id: string
  email: string
  nombre: string
  rol: string
  is_superadmin?: boolean
  tenant_id?: string
  tenant_slug?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nombre: string, tenant_nombre: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI
    if (isElectron) {
      // En modo POS / Electron SIEMPRE requerir contraseña al abrir la aplicación
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      setUser(null)
      setLoading(false)
      return
    }

    const token = localStorage.getItem("access_token")
    if (token) {
      api.auth.me().then((u) => {
        const claims = decodeToken(token)
        setUser({
          id: u.id, email: u.email, nombre: u.nombre, rol: u.rol,
          is_superadmin: claims.is_superadmin === true,
          tenant_id: u.tenant_id, tenant_slug: u.tenant_slug,
        })
      }).catch(() => {
        localStorage.removeItem("access_token")
        localStorage.removeItem("user_email")
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const decodeToken = (token: string): Record<string, unknown> => {
    try {
      const payload = token.split(".")[1]
      const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
      return JSON.parse(decoded)
    } catch { return {} }
  }

  const login = async (email: string, password: string) => {
    const data = await api.auth.login({ email, password })
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    localStorage.setItem("user_email", email)
    const me = await api.auth.me()
    const claims = decodeToken(data.access_token)
    setUser({
      id: me.id, email: me.email, nombre: me.nombre, rol: me.rol,
      is_superadmin: claims.is_superadmin === true,
      tenant_id: me.tenant_id, tenant_slug: me.tenant_slug,
    })
  }

  const register = async (email: string, password: string, nombre: string, tenant_nombre: string) => {
    const data = await api.auth.register({ email, password, nombre, tenant_nombre })
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    localStorage.setItem("user_email", email)
    const me = await api.auth.me()
    const claims = decodeToken(data.access_token)
    setUser({
      id: me.id, email: me.email, nombre: me.nombre, rol: me.rol,
      is_superadmin: claims.is_superadmin === true,
      tenant_id: me.tenant_id, tenant_slug: me.tenant_slug,
    })
  }

  const logout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("user_email")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
