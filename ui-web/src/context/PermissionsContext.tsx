import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api } from "../api"
import { useAuth } from "./AuthContext"

interface PermissionsContextType {
  permissions: string[]
  isAdministrador: boolean
  loading: boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (...permissions: string[]) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

function isValidJWT(token: string): boolean {
  if (!token) return false
  const parts = token.split(".")
  return parts.length === 3
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<string[]>([])
  const [isAdministrador, setIsAdministrador] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    if (!user?.tenant_id) {
      setPermissions([])
      setIsAdministrador(false)
      setLoaded(false)
      setLoading(false)
      return
    }
    const token = localStorage.getItem("access_token") || ""
    if (!isValidJWT(token)) {
      setPermissions([])
      setIsAdministrador(false)
      setLoaded(false)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await api.rbac.myPermissions()
      setPermissions(res.permissions || [])
      setIsAdministrador(!!res.is_administrador)
      setLoaded(true)
    } catch (err) {
      console.error("Error fetching user permissions:", err)
      setPermissions([])
      setIsAdministrador(false)
      setLoaded(false)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  // Ocultar por permiso es UX, no seguridad -- el backend es el que de
  // verdad bloquea. Mientras no se pudo cargar (recien logueado, error de
  // red) se deja ver todo para no romper pantallas de roles que todavia no
  // tienen ningun modulo cerrado por permiso especifico.
  const hasPermission = useCallback(
    (permission: string) => {
      if (isAdministrador) return true
      if (!loaded) return true
      return permissions.includes(permission)
    },
    [permissions, isAdministrador, loaded]
  )

  const hasAnyPermission = useCallback(
    (...perms: string[]) => {
      if (isAdministrador) return true
      if (!loaded) return true
      return perms.some(p => permissions.includes(p))
    },
    [permissions, isAdministrador, loaded]
  )

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        isAdministrador,
        loading,
        hasPermission,
        hasAnyPermission,
        refreshPermissions: fetchPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider")
  return ctx
}
