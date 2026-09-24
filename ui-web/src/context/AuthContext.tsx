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
    const electronSessionActive = typeof window !== "undefined" && !!sessionStorage.getItem("electron_session_initialized")

    // En Electron, solo requerir login en el inicio en frío de la aplicación si no hay sesión iniciada en esta ventana
    if (isElectron && !electronSessionActive && !localStorage.getItem("current_cash_session")) {
      const existingToken = localStorage.getItem("access_token")
      if (!existingToken) {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        setUser(null)
        setLoading(false)
        return
      }
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
        const userObj: User = {
          id: u.id, email: u.email, nombre: u.nombre, rol: u.rol,
          is_superadmin: claims.is_superadmin === true,
          tenant_id: u.tenant_id, tenant_slug: u.tenant_slug,
          foto_url: (u as any).foto_url,
        }
        setUser(userObj)
        localStorage.setItem("cached_user_profile", JSON.stringify(userObj))
        if (isElectron) sessionStorage.setItem("electron_session_initialized", "true")
        setLoading(false)
      } catch (err: any) {
        if (cancelado) return
        if (esEstacion) {
          reintento = setTimeout(identificar, 5000)
          return
        }

        // Si el fallo es por caída de red, reinicio del backend o 502/503/504:
        // Mantener la sesión local activa con los claims locales
        const errMsg = String(err?.message || "").toLowerCase()
        const isTransientError =
          errMsg.includes("conexión") ||
          errMsg.includes("servidor central") ||
          errMsg.includes("failed to fetch") ||
          errMsg.includes("502") ||
          errMsg.includes("503") ||
          errMsg.includes("504") ||
          err?.name === "TypeError"

        const cachedStr = localStorage.getItem("cached_user_profile")
        let cachedUser: User | null = null
        if (cachedStr) {
          try { cachedUser = JSON.parse(cachedStr) } catch {}
        }

        const claims = decodeToken(token)
        const tokenUser: User | null = (claims.sub && (claims.user_email || claims.email)) ? {
          id: String(claims.sub),
          email: String(claims.user_email || claims.email || ""),
          nombre: String(claims.user_nombre || claims.nombre || cachedUser?.nombre || "Cajero POS"),
          rol: String(claims.rol || cachedUser?.rol || "cajero"),
          is_superadmin: claims.is_superadmin === true,
          tenant_id: claims.tenant_id ? String(claims.tenant_id) : cachedUser?.tenant_id,
          tenant_slug: claims.tenant_slug ? String(claims.tenant_slug) : cachedUser?.tenant_slug,
          foto_url: cachedUser?.foto_url || null,
        } : null

        const restoredUser = cachedUser || tokenUser
        if (isTransientError && restoredUser) {
          console.warn("[AuthContext] Servidor no disponible o reiniciando. Conservando sesión local:", restoredUser.email)
          setUser(restoredUser)
          if (isElectron) sessionStorage.setItem("electron_session_initialized", "true")
          setLoading(false)
          // Reintentar en segundo plano periódicamente sin molestar a la cajera
          reintento = setTimeout(identificar, 10000)
          return
        }

        // 401 explícito o token realmente inválido
        localStorage.removeItem("access_token")
        localStorage.removeItem("user_email")
        localStorage.removeItem("cached_user_profile")
        if (isElectron) sessionStorage.removeItem("electron_session_initialized")
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
    const userObj: User = {
      id: me.id, email: me.email, nombre: me.nombre, rol: me.rol,
      is_superadmin: claims.is_superadmin === true,
      tenant_id: me.tenant_id, tenant_slug: me.tenant_slug,
      foto_url: (me as any).foto_url,
    }
    setUser(userObj)
    localStorage.setItem("cached_user_profile", JSON.stringify(userObj))
    sessionStorage.setItem("electron_session_initialized", "true")
  }

  const register = async (email: string, password: string, nombre: string, tenant_nombre: string) => {
    const data = await api.auth.register({ email, password, nombre, tenant_nombre })
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    localStorage.setItem("user_email", email)
    const me = await api.auth.me()
    const claims = decodeToken(data.access_token)
    const userObj: User = {
      id: me.id, email: me.email, nombre: me.nombre, rol: me.rol,
      is_superadmin: claims.is_superadmin === true,
      tenant_id: me.tenant_id, tenant_slug: me.tenant_slug,
    }
    setUser(userObj)
    localStorage.setItem("cached_user_profile", JSON.stringify(userObj))
    sessionStorage.setItem("electron_session_initialized", "true")
  }

  const logout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("user_email")
    localStorage.removeItem("cached_user_profile")
    sessionStorage.removeItem("electron_session_initialized")
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
