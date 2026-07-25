import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api } from "../api"
import { useAuth } from "./AuthContext"

interface FeatureContextType {
  features: string[]
  paymentGateways: string[]
  verticalSlug: string | null
  plan: string
  loading: boolean
  isFullMode: boolean
  hasFeature: (feature: string) => boolean
  hasAnyFeature: (...features: string[]) => boolean
  refreshFeatures: () => Promise<void>
  switchVertical: (verticalSlug: string) => Promise<void>
  enableFullMode: () => Promise<void>
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined)

function isValidJWT(token: string): boolean {
  if (!token || token === "demo-token") return false
  const parts = token.split(".")
  return parts.length === 3
}

export function FeatureProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [features, setFeatures] = useState<string[]>([])
  const [paymentGateways, setPaymentGateways] = useState<string[]>([])
  const [verticalSlug, setVerticalSlug] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>("enterprise")
  const [loading, setLoading] = useState(true)
  const [isFullMode, setIsFullMode] = useState(() => localStorage.getItem("full_mode") === "true")

  const fetchFeatures = useCallback(async () => {
    if (!user?.tenant_id) {
      setFeatures([])
      setLoading(false)
      return
    }

    const token = localStorage.getItem("access_token") || ""
    if (!isValidJWT(token)) {
      setFeatures([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const config = user.is_superadmin
        ? await api.admin.getTenantConfig(user.tenant_id)
        : await api.admin.getMyTenantConfig()
      setFeatures(config.enabled_features || [])
      setPaymentGateways(config.payment_gateways || [])
      setVerticalSlug(config.vertical_slug)
      setPlan(config.plan || "enterprise")
      setIsFullMode(config.vertical_slug === "full")
      localStorage.setItem("full_mode", config.vertical_slug === "full" ? "true" : "false")
    } catch (err) {
      console.error("Error fetching tenant features:", err)
      setFeatures([])
    } finally {
      setLoading(false)
    }
  }, [user])

  const switchVertical = useCallback(async (slug: string) => {
    if (!user?.tenant_id) return
    const token = localStorage.getItem("access_token") || ""
    if (!isValidJWT(token)) return
    await api.admin.updateTenantConfig(user.tenant_id, {
      vertical_slug: slug,
      custom_features: false,
    })
    await fetchFeatures()
  }, [user, fetchFeatures])

  const enableFullMode = useCallback(async () => {
    if (!user?.tenant_id) return
    const token = localStorage.getItem("access_token") || ""
    if (!isValidJWT(token)) return
    const allFeatures = (await api.admin.features()).map(f => f.key)
    await api.admin.updateTenantConfig(user.tenant_id, {
      vertical_slug: "full",
      enabled_features: allFeatures,
      custom_features: true,
    })
    setIsFullMode(true)
    localStorage.setItem("full_mode", "true")
    await fetchFeatures()
  }, [user, fetchFeatures])

  useEffect(() => {
    fetchFeatures()
  }, [fetchFeatures])

  const hasFeature = useCallback(
    (feature: string) => {
      // If no features loaded yet, allow everything (graceful degradation)
      if (features.length === 0) return true
      return features.includes(feature)
    },
    [features]
  )

  const hasAnyFeature = useCallback(
    (...featList: string[]) => {
      if (features.length === 0) return true
      return featList.some((f) => features.includes(f))
    },
    [features]
  )

  return (
    <FeatureContext.Provider
      value={{
        features,
        paymentGateways,
        verticalSlug,
        plan,
        loading,
        isFullMode,
        hasFeature,
        hasAnyFeature,
        refreshFeatures: fetchFeatures,
        switchVertical,
        enableFullMode,
      }}
    >
      {children}
    </FeatureContext.Provider>
  )
}

export function useFeatures() {
  const ctx = useContext(FeatureContext)
  if (!ctx) throw new Error("useFeatures must be used within FeatureProvider")
  return ctx
}
