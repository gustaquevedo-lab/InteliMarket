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
  foto_url?: string | null
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
    if (!token) {
      setLoading(false)
      return
    }

    // Una estacion (etiquetas) no tiene a nadie que sepa una contrasena. Si el
    // API esta caido, mandarla al login es un callejon sin salida: el operador
    // ve una pantalla que no puede completar. Se reintenta hasta que vuelva.
    const esEstacion = !!localStorage.getItem("station_token")
    let cancelado = false
    let reintento: ReturnType<typeof setTimeout> | undefined

    const identificar = async () => {
      try {
        const u = await api.auth.me()
        if (cancelado) return
        const claims = decodeToken(token)
        setUser({
          id: u.id, email: u.email, nombre: u.nombre, rol: u.rol,
          is_superadmin: claims.is_superadmin === true,
          tenant_id: u.tenant_id, tenant_slug: u.tenant_slug,
          foto_url: (u as any).foto_url,
        })
        setLoading(false)
      } catch {
        if (cancelado) return
        if (esEstacion) {
          // Se conserva la credencial y se vuelve a intentar. No se apaga
          // "loading": mostrar el cargador es mas honesto que un login que el
          // gondolero no puede resolver.
          reintento = setTimeout(identificar, 5000)
          return
        }
        localStorage.removeItem("access_token")
        localStorage.removeItem("user_email")
        setLoading(false)
      }
    }

    identificar()
    return () => {
      cancelado = true
      if (reintento) clearTimeout(reintento)
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
      foto_url: (me as any).foto_url,
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
    // Salir a proposito si desarma la estacion: es un acto deliberado de una
    // persona, a diferencia de un 401 pasajero.
    localStorage.removeItem("station_token")
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
