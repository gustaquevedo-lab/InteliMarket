import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Flame, Beef, Sparkles, Maximize2,
  ShieldCheck, Tag, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, Pause, Play,
  TrendingDown, Sun, Moon
} from "lucide-react"
import { api, type TvCutItem, type TvCutsResponse } from "../../api"

const ITEMS_PER_PAGE = 9 // 3 columnas x 3 filas = 9 tarjetas grandes
const SLIDE_DURATION_SEC = 9 // 9 segundos por diapositiva

// Componente para renderizar el Thumbnail del corte con soporte Dark/Light
function CutThumbnail({ corte, isLight }: { corte: TvCutItem; isLight: boolean }) {
  const [imgError, setImgError] = useState(false)
  const cat = (corte.categoria || "").toLowerCase()
  const isCerdo = cat.includes("cerdo") || cat.includes("porcino")
  const isAve = cat.includes("ave") || cat.includes("pollo")
  const isEmbutido = cat.includes("embutido") || cat.includes("chorizo")

  if (corte.imagen_url && !imgError) {
    return (
      <div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden border shadow-md shrink-0 ${
        isLight ? "border-slate-200 bg-slate-100" : "border-slate-700/80 bg-slate-950"
      }`}>
        <img
          src={corte.imagen_url}
          alt={corte.nombre}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  // Fallback gourmet con siluetas temáticas según especie
  return (
    <div
      className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl flex flex-col items-center justify-center shrink-0 border shadow-md relative overflow-hidden ${
        isLight
          ? isCerdo
            ? "bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 border-amber-300 text-amber-800"
            : isAve
            ? "bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-200 border-yellow-300 text-yellow-800"
            : isEmbutido
            ? "bg-gradient-to-br from-rose-100 via-red-50 to-rose-200 border-rose-300 text-rose-800"
            : "bg-gradient-to-br from-red-100 via-rose-50 to-red-200 border-red-300 text-red-800"
          : isCerdo
          ? "bg-gradient-to-br from-amber-950/80 via-orange-950/50 to-slate-900 border-amber-800/60 text-amber-400"
          : isAve
          ? "bg-gradient-to-br from-yellow-950/80 via-amber-950/50 to-slate-900 border-yellow-800/60 text-yellow-400"
          : isEmbutido
          ? "bg-gradient-to-br from-rose-950/80 via-red-950/50 to-slate-900 border-rose-800/60 text-rose-400"
          : "bg-gradient-to-br from-red-950/90 via-rose-950/50 to-slate-900 border-red-800/60 text-red-400"
      }`}
    >
      <div className={`absolute inset-0 pointer-events-none ${isLight ? "bg-gradient-to-t from-white/40 to-transparent" : "bg-gradient-to-t from-black/60 to-transparent"}`} />
      <Beef className="w-10 h-10 drop-shadow-sm relative z-10" />
      <span className={`text-[10px] font-black uppercase tracking-wider relative z-10 mt-1 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
        {isCerdo ? "CERDO" : isAve ? "POLLO" : isEmbutido ? "EMBUTIDO" : "BOVINO"}
      </span>
    </div>
  )
}

export default function CarniceriaTvDigitalPage() {
  const [searchParams] = useSearchParams()
  const companyId = searchParams.get("company_id") || undefined

  // Modo claro / oscuro: detecta url ?theme=light/dark o persiste en localStorage
  const [isLight, setIsLight] = useState<boolean>(() => {
    const p = searchParams.get("theme")
    if (p === "light") return true
    if (p === "dark") return false
    try {
      return localStorage.getItem("tv_carniceria_theme") === "light"
    } catch {
      return false
    }
  })

  const toggleTheme = () => {
    setIsLight((prev) => {
      const next = !prev
      try {
        localStorage.setItem("tv_carniceria_theme", next ? "light" : "dark")
      } catch {}
      return next
    })
  }

  const [tvData, setTvData] = useState<TvCutsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())
  const [lastSync, setLastSync] = useState<Date>(new Date())

  // Estado del carrusel rotativo
  const [currentPage, setCurrentPage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

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

  // Filtrar solo los cortes visibles configurados
  const visibleCortes = useMemo(() => {
    if (!tvData?.cuts) return []
    return tvData.cuts.filter((c) => c.visible_en_tv)
  }, [tvData])

  // Dividir los cortes en páginas de 9 cortes
  const pages = useMemo(() => {
    if (!visibleCortes.length) return []
    const chunks: TvCutItem[][] = []
    for (let i = 0; i < visibleCortes.length; i += ITEMS_PER_PAGE) {
      chunks.push(visibleCortes.slice(i, i + ITEMS_PER_PAGE))
    }
    return chunks
  }, [visibleCortes])

  const totalPages = pages.length || 1

  // Asegurar que la página actual esté dentro de rango
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(0)
      setProgress(0)
    }
  }, [currentPage, totalPages])

  // Timer de rotación fluida con barra de progreso
  useEffect(() => {
    if (totalPages <= 1) return

    const tickInterval = 100 // ms
    const step = (tickInterval / (SLIDE_DURATION_SEC * 1000)) * 100

    const timer = setInterval(() => {
      if (isPausedRef.current) return

      setProgress((prev) => {
        if (prev + step >= 100) {
          setCurrentPage((curr) => (curr + 1) % totalPages)
          return 0
        }
        return prev + step
      })
    }, tickInterval)

    return () => clearInterval(timer)
  }, [totalPages])

  // Navegación manual
  const goToPage = (idx: number) => {
    setCurrentPage(idx)
    setProgress(0)
  }

  const prevPage = () => {
    setCurrentPage((curr) => (curr - 1 + totalPages) % totalPages)
    setProgress(0)
  }

  const nextPage = () => {
    setCurrentPage((curr) => (curr + 1) % totalPages)
    setProgress(0)
  }

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

  // Formato paraguayo (PYG)
  const formatPYG = (amount: number) => {
    return Math.round(amount || 0).toLocaleString("es-PY")
  }

  // Formato brasileño (BRL)
  const formatBRL = (amount?: number) => {
    if (!amount || amount <= 0) return null
    return Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  // Cortes de la página actual
  const currentCortes = pages[currentPage] || []

  // Conteo de ofertas en la página actual
  const currentOffersCount = useMemo(() => {
    return currentCortes.filter((c) => c.en_promo).length
  }, [currentCortes])

  const cotizacionBrl = tvData?.cotizacion_brl || 1100

  return (
    <div
      className={`h-screen w-screen flex flex-col justify-between select-none overflow-hidden font-sans p-6 transition-colors duration-300 ${
        isLight ? "bg-slate-100 text-slate-800" : "bg-[#070A0F] text-slate-100"
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ── CABECERA INSTITUCIONAL ULTRA 1080P ── */}
      <header className={`shrink-0 flex items-center justify-between border-b pb-4 mb-3 transition-colors ${
        isLight ? "border-slate-200" : "border-slate-800/90"
      }`}>
        {/* Lado izquierdo: Branding & Título */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 flex items-center justify-center shadow-2xl shadow-red-600/40 border border-red-500/40 shrink-0">
            <Flame className="w-9 h-9 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-black tracking-widest uppercase bg-red-600 text-white px-3 py-1 rounded-md shadow-md">
                EXTRA SUPERMERCADO
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md border ${
                isLight
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-emerald-950/70 text-emerald-400 border-emerald-800/60"
              }`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                PRECIOS EN VIVO
              </span>
              {/* Badge de Cotización Oficial BRL */}
              <span className={`flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-md shadow-sm border ${
                isLight
                  ? "bg-white text-emerald-800 border-emerald-300"
                  : "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
              }`}>
                <span className="text-sm">🇧🇷</span> R$ 1 = ₲ {formatPYG(cotizacionBrl)}
              </span>
              {currentOffersCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white border border-amber-400/80 px-3 py-1 rounded-md animate-bounce shadow-lg shadow-red-600/30">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
                  {currentOffersCount} {currentOffersCount === 1 ? "OFERTA IMPERDIBLE" : "OFERTAS IMPERDIBLES"}
                </span>
              )}
            </div>
            <h1 className={`text-3xl lg:text-4xl font-black tracking-tight mt-1.5 flex items-center gap-3 ${
              isLight ? "text-slate-900" : "text-white"
            }`}>
              <Beef className="w-8 h-8 text-amber-500 inline shrink-0" />
              PIZARRA DE CARNICERÍA & CORTES
            </h1>
          </div>
        </div>

        {/* Lado derecho: Paginador, Modo Claro/Oscuro, Reloj y Fullscreen */}
        <div className="text-right flex items-center gap-4 lg:gap-6">
          {/* Indicador de Páginas / Carrusel */}
          {totalPages > 1 && (
            <div className={`flex flex-col items-end gap-1.5 px-4 py-2 rounded-2xl shadow-lg border ${
              isLight ? "bg-white border-slate-200" : "bg-slate-900/90 border-slate-800"
            }`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevPage}
                  className={`p-1 rounded-lg transition ${
                    isLight ? "hover:bg-slate-100 text-slate-600" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-xs font-black font-mono tracking-wider uppercase ${
                  isLight ? "text-red-600" : "text-amber-400"
                }`}>
                  PÁGINA {currentPage + 1} DE {totalPages}
                </span>
                <button
                  onClick={nextPage}
                  className={`p-1 rounded-lg transition ${
                    isLight ? "hover:bg-slate-100 text-slate-600" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title="Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPaused((p) => !p)}
                  className={`p-1 rounded-lg transition ml-1 ${
                    isLight ? "hover:bg-slate-100 text-slate-500" : "hover:bg-slate-800 text-slate-500 hover:text-amber-400"
                  }`}
                  title={isPaused ? "Reanudar rotación" : "Pausar rotación"}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Barra de progreso */}
              <div className={`w-36 h-1.5 rounded-full overflow-hidden ${isLight ? "bg-slate-200" : "bg-slate-800"}`}>
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-500 rounded-full transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Dots */}
              <div className="flex items-center gap-1.5 mt-0.5">
                {pages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToPage(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentPage
                        ? isLight
                          ? "w-6 bg-red-600 shadow-sm"
                          : "w-6 bg-amber-400 shadow-sm shadow-amber-400/50"
                        : isLight
                        ? "w-2 bg-slate-300 hover:bg-slate-400"
                        : "w-2 bg-slate-700 hover:bg-slate-500"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Toggle Modo Claro / Oscuro */}
          <button
            onClick={toggleTheme}
            className={`p-3.5 rounded-2xl border shadow-md transition flex items-center justify-center ${
              isLight
                ? "bg-white border-slate-200 text-amber-600 hover:bg-slate-50 shadow-slate-200"
                : "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800 shadow-slate-950"
            }`}
            title={isLight ? "Cambiar a Modo Oscuro" : "Cambiar a Modo Claro"}
          >
            {isLight ? <Moon className="w-5 h-5 text-indigo-600" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>

          {/* Reloj local paraguayo */}
          <div className="hidden lg:block text-right">
            <p className={`text-xs font-bold uppercase tracking-wider capitalize ${
              isLight ? "text-slate-500" : "text-slate-400"
            }`}>
              {formattedDate}
            </p>
            <p className={`text-3xl lg:text-4xl font-mono font-black tracking-tight ${
              isLight ? "text-slate-900" : "text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.2)]"
            }`}>
              {formattedTime}
            </p>
          </div>

          <button
            onClick={toggleFullScreen}
            className={`p-3.5 rounded-2xl border shadow-md transition ${
              isLight
                ? "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Pantalla Completa"
          >
            <Maximize2 className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL: GRID 3x3 DUAL THEME (LIGHT & DARK) ── */}
      <main className="flex-1 min-h-0 flex flex-col justify-center">
        {loading && !tvData ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 text-slate-400">
            <RefreshCw className="w-14 h-14 animate-spin text-amber-500" />
            <p className="text-2xl font-bold">Cargando pizarra de cortes y ofertas...</p>
          </div>
        ) : error && !visibleCortes.length ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-red-500">
            <AlertCircle className="w-14 h-14" />
            <p className="text-2xl font-bold">Error al sincronizar pizarra</p>
            <p className="text-base text-slate-500">{error}</p>
          </div>
        ) : visibleCortes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <Tag className="w-14 h-14 text-slate-400" />
            <p className="text-2xl font-bold">No hay cortes configurados para mostrar en TV</p>
            <p className="text-base text-slate-500">Seleccioná los cortes a exhibir desde la tablet en el Hub de Carnicería.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-rows-3 gap-4 lg:gap-5 h-full w-full">
            {currentCortes.map((corte) => {
              const isPromo = corte.en_promo
              const precioBrlFormatted = formatBRL(Number(corte.precio_brl || (Number(corte.precio) / cotizacionBrl)))

              return (
                <div
                  key={corte.producto_id}
                  className={`rounded-3xl p-4 lg:p-5 flex flex-col justify-between transition-all duration-300 border relative overflow-hidden ${
                    isLight
                      ? isPromo
                        ? "bg-gradient-to-br from-red-50 via-white to-amber-50/80 border-2 border-red-500 shadow-xl shadow-red-500/10 ring-2 ring-red-400/40 animate-[pulse_3s_ease-in-out_infinite]"
                        : "bg-white border-slate-200 shadow-lg shadow-slate-200/50 hover:border-slate-300"
                      : isPromo
                      ? "bg-gradient-to-br from-red-950/70 via-slate-900/95 to-amber-950/60 border-amber-500/80 shadow-[0_0_35px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/60 animate-[pulse_3s_ease-in-out_infinite]"
                      : "bg-slate-900/80 border-slate-800/90 hover:border-slate-700 shadow-xl shadow-slate-950/60"
                  }`}
                >
                  {/* Animación de halo de luz para ofertas */}
                  {isPromo && (
                    <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none animate-pulse ${
                      isLight ? "bg-red-400/20" : "bg-gradient-to-br from-amber-500/25 via-red-500/20 to-transparent"
                    }`} />
                  )}

                  {/* Fila Superior: Badges, PLU y Ribbon de Oferta */}
                  <div className="flex items-center justify-between gap-2 z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      {corte.plu ? (
                        <span className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${
                          isLight
                            ? "bg-slate-100 text-slate-800 border-slate-300"
                            : "bg-slate-800 text-amber-300 border-slate-700 shadow-inner"
                        }`}>
                          PLU {corte.plu}
                        </span>
                      ) : null}
                      {corte.categoria && (
                        <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isLight
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-slate-800/80 text-slate-300 border-slate-700/60"
                        }`}>
                          {corte.categoria}
                        </span>
                      )}
                    </div>

                    {isPromo && (
                      <div className="flex items-center gap-1.5">
                        {corte.porcentaje_descuento && Number(corte.porcentaje_descuento) > 0 ? (
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-black text-xs uppercase shadow-sm ${
                            isLight
                              ? "bg-red-600 text-white"
                              : "bg-amber-500 text-slate-950"
                          }`}>
                            <TrendingDown className="w-3 h-3" />
                            -{Math.round(Number(corte.porcentaje_descuento))}%
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-black text-xs tracking-wider uppercase shadow-lg shadow-red-600/40 animate-pulse border border-amber-300/40">
                          <Flame className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                          {corte.badge_promo || "OFERTA"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Fila Central: Thumbnail + Nombre del Corte */}
                  <div className="my-auto py-2 flex items-center gap-4 z-10">
                    {/* Thumbnail del corte */}
                    <CutThumbnail corte={corte} isLight={isLight} />

                    {/* Nombre y datos */}
                    <div className="flex-1 min-w-0">
                      <h2
                        className={`font-black text-2xl lg:text-3xl uppercase tracking-tight line-clamp-2 leading-tight ${
                          isLight
                            ? isPromo
                              ? "text-red-950"
                              : "text-slate-900"
                            : isPromo
                            ? "text-amber-100 drop-shadow-[0_2px_8px_rgba(251,191,36,0.3)]"
                            : "text-white"
                        }`}
                      >
                        {corte.nombre}
                      </h2>
                      {isPromo && corte.ahorro_gs && Number(corte.ahorro_gs) > 0 ? (
                        <p className={`text-xs font-black mt-1 flex items-center gap-1 ${
                          isLight ? "text-red-600" : "text-amber-300"
                        }`}>
                          <Sparkles className="w-3 h-3 text-amber-500 inline" />
                          Ahorrás ₲ {formatPYG(Number(corte.ahorro_gs))} por kilo
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Fila Inferior: Precios (Gs. Gigante + R$ Secundario) */}
                  <div className={`pt-2 border-t flex items-end justify-between z-10 ${
                    isLight ? "border-slate-200" : "border-slate-800/80"
                  }`}>
                    {/* Lado izquierdo: Precio anterior tachado (si oferta) o Pesaje balanza */}
                    <div>
                      {isPromo && corte.precio_anterior ? (
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${
                            isLight ? "text-slate-500" : "text-slate-400"
                          }`}>
                            Precio Normal
                          </p>
                          <p className={`text-base lg:text-lg font-mono font-bold line-through ${
                            isLight ? "text-slate-400" : "text-rose-300/80"
                          }`}>
                            ₲ {formatPYG(Number(corte.precio_anterior))}
                          </p>
                        </div>
                      ) : (
                        <div className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 ${
                          isLight ? "text-slate-500" : "text-slate-400"
                        }`}>
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          Pesaje Balanza
                        </div>
                      )}
                    </div>

                    {/* Lado derecho: Precios en Gs. (Gigante) y en R$ (Secundario) */}
                    <div className="text-right">
                      {/* Precio en Guaraníes (GIGANTE) */}
                      <div className="flex items-baseline justify-end gap-1.5">
                        <span className={`text-xl lg:text-2xl font-black ${
                          isLight
                            ? isPromo
                              ? "text-red-600"
                              : "text-slate-700"
                            : isPromo
                            ? "text-amber-400"
                            : "text-slate-300"
                        }`}>
                          ₲
                        </span>
                        <span
                          className={`font-mono font-black text-4xl lg:text-5xl xl:text-6xl tracking-tight leading-none ${
                            isLight
                              ? isPromo
                                ? "text-red-600 drop-shadow-sm"
                                : "text-slate-900"
                              : isPromo
                              ? "text-amber-400 drop-shadow-[0_4px_25px_rgba(251,191,36,0.5)]"
                              : "text-white"
                          }`}
                        >
                          {formatPYG(Number(corte.precio))}
                        </span>
                        <span className={`text-sm lg:text-base font-extrabold ${
                          isLight ? "text-slate-500" : "text-slate-400"
                        }`}>
                          /kg
                        </span>
                      </div>

                      {/* Precio en Reales (R$ un poco más pequeño para frontera brasileña) */}
                      {precioBrlFormatted && (
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[11px] font-bold text-emerald-600">🇧🇷</span>
                          <span className={`text-base lg:text-lg font-black font-mono tracking-tight px-2 py-0.5 rounded-md border shadow-inner ${
                            isLight
                              ? "text-emerald-800 bg-emerald-50 border-emerald-300"
                              : "text-emerald-300 bg-emerald-950/60 border-emerald-800/60"
                          }`}>
                            R$ {precioBrlFormatted}
                          </span>
                          <span className={`text-[11px] font-semibold ${isLight ? "text-emerald-700" : "text-emerald-400/80"}`}>
                            /kg
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── PIE INSTITUCIONAL / TICKER ── */}
      <footer className={`shrink-0 border-t pt-3 mt-3 flex items-center justify-between text-xs lg:text-sm font-semibold transition-colors ${
        isLight ? "border-slate-200 text-slate-600" : "border-slate-800/90 text-slate-400"
      }`}>
        <div className="flex items-center gap-8">
          <span className={`flex items-center gap-2 ${isLight ? "text-slate-800" : "text-slate-200"}`}>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Faena del Día y Cortes Seleccionados de Primera Calidad
          </span>
          <span className="hidden md:inline-flex items-center gap-2 text-slate-500">
            <Tag className="w-5 h-5 text-amber-500" />
            Pesaje Directo en Balanzas Balmak Edge Calibradas
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-500 font-mono text-xs">
          {totalPages > 1 && (
            <span className={`px-3 py-1 rounded-xl border ${
              isLight ? "bg-white border-slate-200 text-slate-700" : "text-slate-300 bg-slate-900 border-slate-800"
            }`}>
              Cortes {currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, visibleCortes.length)} de {visibleCortes.length}
            </span>
          )}
          <span>Última sinc: {lastSync.toLocaleTimeString("es-PY")}</span>
        </div>
      </footer>
    </div>
  )
}
