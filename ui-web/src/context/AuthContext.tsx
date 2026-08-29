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
  mustChangePassword: boolean
  login: (email: string, password: string) => Promise<void>
  loginCedula: (cedula: string, password: string) => Promise<void>
  register: (email: string, password: string, nombre: string, tenant_nombre: string) => Promise<void>
  logout: () => void
  loginDemo: () => void
  clearMustChangePassword: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (token === "demo-token") {
      setUser({ id: "00000000-0000-0000-0000-0000000000d1", email: "demo@intelimarket.py", nombre: "Demo", rol: "admin", is_superadmin: true, tenant_id: "00000000-0000-0000-0000-000000000001", tenant_slug: "supermercado-demo" })
      setLoading(false)
    } else if (token) {
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
    setMustChangePassword(data.must_change_password === true)
    setUser({
      id: me.id, email: me.email, nombre: me.nombre, rol: me.rol,
      is_superadmin: claims.is_superadmin === true,
      tenant_id: me.tenant_id, tenant_slug: me.tenant_slug,
    })
  }

  const loginCedula = async (cedula: string, password: string) => {
    const data = await api.auth.loginCedula({ cedula, password })
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    localStorage.setItem("user_email", cedula)
    const me = await api.auth.me()
    const claims = decodeToken(data.access_token)
    setMustChangePassword(data.must_change_password === true)
    setUser({
      id: me.id, email: me.email, nombre: me.nombre, rol: me.rol,
      is_superadmin: claims.is_superadmin === true,
      tenant_id: me.tenant_id, tenant_slug: me.tenant_slug,
    })
  }

  const clearMustChangePassword = () => setMustChangePassword(false)

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
    setMustChangePassword(false)
  }

  const loginDemo = () => {
    localStorage.setItem("access_token", "demo-token")
    localStorage.setItem("user_email", "demo@intelimarket.py")
    setUser({ id: "00000000-0000-0000-0000-0000000000d1", email: "demo@intelimarket.py", nombre: "Demo", rol: "admin", tenant_id: "00000000-0000-0000-0000-000000000001", tenant_slug: "supermercado-demo" })
  }

  return (
    <AuthContext.Provider value={{ user, loading, mustChangePassword, login, loginCedula, register, logout, loginDemo, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    return {
      user: null,
      loading: false,
      mustChangePassword: false,
      login: async () => {},
      loginCedula: async () => {},
      register: async () => {},
      logout: () => {},
      loginDemo: () => {},
      clearMustChangePassword: () => {},
    }
  }
  return ctx
}
