import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Flame, Beef, Sparkles, Maximize2,
  Clock, ShieldCheck, Tag, RefreshCw, AlertCircle
} from "lucide-react"
import { api, type TvCutItem, type TvCutsResponse } from "../../api"

export default function CarniceriaTvDigitalPage() {
  const [searchParams] = useSearchParams()
  const companyId = searchParams.get("company_id") || undefined

  const [tvData, setTvData] = useState<TvCutsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())
  const [lastSync, setLastSync] = useState<Date>(new Date())

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Carga de precios y ofertas desde el backend
  const fetchTvCuts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const data = await api.supermer.butchery.tvCuts(companyId)
      if (data && Array.isArray(data.cuts)) {
        setTvData(data)
        setLastSync(new Date())
        setError(null)
      }
    } catch (err: any) {
      if (!tvData) {
        setError(err?.message || "No se pudo conectar con el servidor de precios")
      }
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [companyId, tvData])

  // Polling automático cada 20 segundos para reflejar cambios en tiempo real
  useEffect(() => {
    fetchTvCuts(false)
    const interval = setInterval(() => fetchTvCuts(true), 20000)
    return () => clearInterval(interval)
  }, [fetchTvCuts])

  // Filtrar solo los cortes que están marcados como visibles en la tablet
  const visibleCortes = useMemo(() => {
    if (!tvData?.cuts) return []
    return tvData.cuts.filter((c) => c.visible_en_tv)
  }, [tvData])

  // Agrupar cortes por categoría
  const groupedCortes = useMemo(() => {
    const groups: Record<string, TvCutItem[]> = {
      "Cortes Vacunos": [],
      "Cerdo Seleccionado": [],
      "Aves y Pollos": [],
      "Embutidos y Elaborados": [],
    }

    for (const c of visibleCortes) {
      const cat = (c.categoria || "").toLowerCase()
      if (cat.includes("cerdo") || cat.includes("porcino")) {
        groups["Cerdo Seleccionado"].push(c)
      } else if (cat.includes("ave") || cat.includes("pollo")) {
        groups["Aves y Pollos"].push(c)
      } else if (cat.includes("embutido") || cat.includes("elaborado") || cat.includes("chorizo")) {
        groups["Embutidos y Elaborados"].push(c)
      } else {
        groups["Cortes Vacunos"].push(c)
      }
    }

    // Filtrar grupos vacíos
    return Object.entries(groups).filter(([_, items]) => items.length > 0)
  }, [visibleCortes])

  // Pantalla completa
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  // Formato paraguayo
  const formatPYG = (amount: number) => {
    return Math.round(amount || 0).toLocaleString("es-PY")
  }

  // Hora y fecha formateada local
  const formattedDate = useMemo(() => {
    return time.toLocaleDateString("es-PY", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }, [time])

  const formattedTime = useMemo(() => {
    return time.toLocaleTimeString("es-PY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }, [time])

  return (
    <div className="min-h-screen w-full bg-[#070A0F] text-slate-100 flex flex-col justify-between select-none overflow-hidden font-sans p-6">
      {/* ── CABECERA INSTITUCIONAL ── */}
      <header className="shrink-0 flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 flex items-center justify-center shadow-lg shadow-red-600/20 border border-red-500/30">
            <Flame className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black tracking-widest uppercase bg-red-600 text-white px-2.5 py-0.5 rounded-md shadow-sm">
                EXTRA SUPERMERCADO
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-0.5 rounded-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                PRECIOS EN VIVO
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mt-1 flex items-center gap-2">
              <Beef className="w-7 h-7 text-amber-400 inline" />
              PIZARRA DE CARNICERÍA & CORTES
            </h1>
          </div>
        </div>

        {/* Reloj y Estado */}
        <div className="text-right flex items-center gap-6">
          <div className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">
              {formattedDate}
            </p>
            <p className="text-3xl font-mono font-bold tracking-tight text-amber-400">
              {formattedTime}
            </p>
          </div>
          <button
            onClick={toggleFullScreen}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Pantalla Completa"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL: PIZARRA DE PRECIOS ── */}
      <main className="flex-1 flex flex-col justify-start">
        {loading && !tvData ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 text-slate-400">
            <RefreshCw className="w-12 h-12 animate-spin text-amber-400" />
            <p className="text-xl font-medium">Cargando pizarra de cortes y ofertas...</p>
          </div>
        ) : error && !visibleCortes.length ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-red-400">
            <AlertCircle className="w-12 h-12" />
            <p className="text-xl font-bold">Error al sincronizar pizarra</p>
            <p className="text-sm text-slate-400">{error}</p>
          </div>
        ) : visibleCortes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <Tag className="w-12 h-12 text-slate-600" />
            <p className="text-xl font-bold">No hay cortes configurados para mostrar en TV</p>
            <p className="text-sm text-slate-500">Seleccioná los cortes a exhibir desde la tablet en el Hub de Carnicería.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 h-full items-start">
            {groupedCortes.map(([catTitle, items]) => (
              <div
                key={catTitle}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm flex flex-col gap-2"
              >
                {/* Encabezado de Categoría */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                  <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    {catTitle}
                  </h2>
                  <span className="text-xs font-mono font-medium text-slate-500">
                    {items.length} {items.length === 1 ? "corte" : "cortes"}
                  </span>
                </div>

                {/* Lista de Cortes */}
                <div className="flex flex-col gap-2">
                  {items.map((corte) => {
                    const isPromo = corte.en_promo
                    return (
                      <div
                        key={corte.producto_id}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition border ${
                          isPromo
                            ? "bg-gradient-to-r from-amber-950/40 via-red-950/20 to-slate-900/80 border-amber-500/40 shadow-md shadow-amber-950/30"
                            : "bg-slate-950/50 border-slate-800/60 hover:border-slate-700"
                        }`}
                      >
                        {/* Nombre y PLU */}
                        <div className="flex items-center gap-2.5 min-w-0 pr-3">
                          {corte.plu ? (
                            <span className="shrink-0 font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              PLU {corte.plu}
                            </span>
                          ) : null}
                          <div className="truncate">
                            <span
                              className={`font-black text-base truncate block ${
                                isPromo ? "text-amber-200" : "text-white"
                              }`}
                            >
                              {corte.nombre}
                            </span>
                            {isPromo && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[10px] tracking-wider uppercase animate-pulse">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  {corte.badge_promo || "OFERTA"}
                                </span>
                                {corte.precio_anterior && (
                                  <span className="text-xs font-mono line-through text-slate-500">
                                    ₲ {formatPYG(Number(corte.precio_anterior))}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Precio por Kilo */}
                        <div className="text-right shrink-0">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-xs font-bold text-slate-400">₲</span>
                            <span
                              className={`font-mono font-black text-2xl tracking-tight ${
                                isPromo
                                  ? "text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.3)]"
                                  : "text-white"
                              }`}
                            >
                              {formatPYG(Number(corte.precio))}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">/kg</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── PIE INSTITUCIONAL / TICKER ── */}
      <footer className="shrink-0 border-t border-slate-800/80 pt-3 mt-4 flex items-center justify-between text-xs text-slate-400 font-medium">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Faena del Día y Cortes Seleccionados
          </span>
          <span className="hidden md:inline-flex items-center gap-2 text-slate-400">
            <Tag className="w-4 h-4 text-amber-400" />
            Pesaje Exacto en Balanzas Balmak Edge Calibradas
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
          <span>Última sincronización: {lastSync.toLocaleTimeString("es-PY")}</span>
        </div>
      </footer>
    </div>
  )
}
