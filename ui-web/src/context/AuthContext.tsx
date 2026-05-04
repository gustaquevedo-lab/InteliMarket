import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { api } from "../api"

interface User {
  id: string
  email: string
  nombre: string
  rol: string
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
    const token = localStorage.getItem("access_token")
    const email = localStorage.getItem("user_email")
    if (token && email) {
      api.auth.me(email).then(setUser).catch(() => {
        localStorage.removeItem("access_token")
        localStorage.removeItem("user_email")
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const data = await api.auth.login({ email, password })
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    localStorage.setItem("user_email", email)
    const me = await api.auth.me(email)
    setUser(me)
  }

  const register = async (email: string, password: string, nombre: string, tenant_nombre: string) => {
    const data = await api.auth.register({ email, password, nombre, tenant_nombre })
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    localStorage.setItem("user_email", email)
    const me = await api.auth.me(email)
    setUser(me)
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
