import { useState, useEffect } from "react"
import { Store, Truck, Pill, ShoppingCart, Wrench, Shirt, Cog, Sparkles, Check, Loader2, RefreshCw } from "lucide-react"
import { api, type Vertical } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useFeatures } from "../../context/FeatureContext"
import { useToast } from "../../context/ToastContext"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  store: Store,
  truck: Truck,
  pill: Pill,
  "shopping-cart": ShoppingCart,
  wrench: Wrench,
  briefcase: Wrench,
  shirt: Shirt,
  cog: Cog,
}

export default function VerticalsPage() {
  const { user } = useAuth()
  const { verticalSlug, switchVertical, enableFullMode, isFullMode, features: activeFeatures, refreshFeatures } = useFeatures()
  const toast = useToast()
  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)

  useEffect(() => {
    const fetchVerticals = async () => {
      try {
        const data = await api.admin.verticals()
        setVerticals(data)
      } catch {
        toast.error("Error", "No se pudieron cargar las verticales")
      } finally {
        setLoading(false)
      }
    }
    fetchVerticals()
  }, [])

  const handleApply = async (slug: string) => {
    setApplying(slug)
    try {
      await switchVertical(slug)
      toast.success("Vertical aplicada", `Se activó "${verticals.find(v => v.slug === slug)?.nombre}"`)
    } catch {
      toast.error("Error", "No se pudo aplicar la vertical")
    } finally {
      setApplying(null)
    }
  }

  const handleFullMode = async () => {
    setApplying("full")
    try {
      await enableFullMode()
      toast.success("Modo Full activado", "Todas las funcionalidades están habilitadas")
    } catch {
      toast.error("Error", "No se pudo activar el modo full")
    } finally {
      setApplying(null)
    }
  }

  const handleReset = async () => {
    if (!user?.tenant_id) return
    setApplying("reset")
    try {
      await api.admin.resetTenantConfig(user.tenant_id)
      await refreshFeatures()
      toast.success("Configuración restablecida", "Se aplicaron los valores por defecto del plan")
    } catch {
      toast.error("Error", "No se pudo restablecer la configuración")
    } finally {
      setApplying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Gestión de Verticales
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Seleccioná la vertical que mejor se adapte a tu negocio. Cada vertical activa un conjunto de módulos y funcionalidades específicas.
        </p>
        {user?.tenant_id && (
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>Tenant: <strong className="text-gray-700 dark:text-gray-300">{user.tenant_slug}</strong></span>
            {verticalSlug && <span>Vertical actual: <strong className="text-blue-600 dark:text-blue-400">{verticalSlug}</strong></span>}
            {isFullMode && <span className="text-green-600 dark:text-green-400 font-semibold">Modo Full activo</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {verticals.map((v) => {
          const Icon = ICON_MAP[v.icon] || Store
          const isActive = v.slug === verticalSlug && !isFullMode
          const isApplying = applying === v.slug

          return (
            <button
              key={v.slug}
              onClick={() => handleApply(v.slug)}
              disabled={isApplying}
              className={`
                relative p-5 rounded-xl border-2 text-left transition-all duration-200
                ${isActive
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm"
                }
                ${isApplying ? "opacity-60 cursor-wait" : "cursor-pointer"}
              `}
            >
              {isActive && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{v.nombre}</h3>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{v.descripcion}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{v.features.length} módulos</span>
                {isApplying && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
              </div>
            </button>
          )
        })}

        {/* Full Mode Card */}
        <button
          onClick={handleFullMode}
          disabled={applying === "full"}
          className={`
            relative p-5 rounded-xl border-2 text-left transition-all duration-200
            ${isFullMode
              ? "border-green-500 bg-green-50 dark:bg-green-900/20 shadow-md"
              : "border-dashed border-gray-300 dark:border-gray-600 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/10 dark:to-blue-900/10 hover:border-green-400 dark:hover:border-green-500 hover:shadow-sm"
            }
            ${applying === "full" ? "opacity-60 cursor-wait" : "cursor-pointer"}
          `}
        >
          {isFullMode && (
            <div className="absolute top-3 right-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isFullMode ? "bg-green-500 text-white" : "bg-gradient-to-br from-green-400 to-blue-500 text-white"}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Modo Full</h3>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Habilita TODAS las funcionalidades del sistema sin restricción de vertical.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">57+ módulos</span>
            {applying === "full" && <Loader2 className="w-4 h-4 animate-spin text-green-500" />}
          </div>
        </button>
      </div>

      {verticalSlug && !isFullMode && (
        <div className="mt-8 p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Módulos activos ({activeFeatures.length})
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {activeFeatures.slice(0, 20).join(", ")}{activeFeatures.length > 20 ? ` y ${activeFeatures.length - 20} más...` : ""}
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={applying === "reset"}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              {applying === "reset" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Restablecer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
