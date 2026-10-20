import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Flame, Beef, Sparkles, Maximize2,
  ShieldCheck, Tag, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, Pause, Play,
  TrendingDown, Sun, Moon
} from "lucide-react"
import { api, type TvCutItem, type TvCutsResponse } from "../../api"

const ITEMS_PER_PAGE = 9
const SLIDE_DURATION_SEC = 9

// Fallback temático gourmet conciso
function CutThumbnail({ corte, isLight }: { corte: TvCutItem; isLight: boolean }) {
  const [imgError, setImgError] = useState(false)
  const isCerdo = (corte.categoria || "").toLowerCase().includes("cerdo")
  const label = isCerdo ? "CERDO" : "BOVINO"

  if (corte.imagen_url && !imgError) {
    return (
      <div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden border shadow-md shrink-0 ${
        isLight ? "border-slate-200 bg-slate-100" : "border-slate-700/80 bg-slate-950"
      }`}>
        <img src={corte.imagen_url} alt={corte.nombre} onError={() => setImgError(true)} className="w-full h-full object-cover" />
      </div>
    )
  }

  const bgGradient = isLight
    ? isCerdo ? "from-amber-100 via-orange-50 to-amber-200 border-amber-300 text-amber-800" : "from-red-100 via-rose-50 to-red-200 border-red-300 text-red-800"
    : isCerdo ? "from-amber-950/80 via-orange-950/50 to-slate-900 border-amber-800/60 text-amber-400" : "from-red-950/90 via-rose-950/50 to-slate-900 border-red-800/60 text-red-400"

  return (
    <div className={`w-20 h-20 lg:w-24 lg:h-24 rounded-2xl flex flex-col items-center justify-center shrink-0 border shadow-md relative overflow-hidden bg-gradient-to-br ${bgGradient}`}>
      <Beef className="w-10 h-10 drop-shadow-sm relative z-10" />
      <span className={`text-[10px] font-black uppercase tracking-wider relative z-10 mt-1 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
        {label}
      </span>
    </div>
  )
}

export default function CarniceriaTvDigitalPage() {
  const [searchParams] = useSearchParams()
  const companyId = searchParams.get("company_id") || undefined

  // Modo Claro / Oscuro con soporte en URL y persistencia local
  const [isLight, setIsLight] = useState<boolean>(() => {
    const p = searchParams.get("theme")
    if (p === "light") return true
    if (p === "dark") return false
    try { return localStorage.getItem("tv_carniceria_theme") === "light" } catch { return false }
  })

  const toggleTheme = () => {
    setIsLight((prev) => {
      const next = !prev
      try { localStorage.setItem("tv_carniceria_theme", next ? "light" : "dark") } catch {}
      return next
    })
  }

  const [tvData, setTvData] = useState<TvCutsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())
  const [lastSync, setLastSync] = useState<Date>(new Date())

  // Carrusel
  const [currentPage, setCurrentPage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Carga de datos
  const fetchTvCuts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const data = await api.supermer.butchery.tvCuts(companyId)
      if (data?.cuts) {
        setTvData(data)
        setLastSync(new Date())
        setError(null)
      }
    } catch (err: any) {
      if (!tvData) setError(err?.message || "No se pudo conectar con el servidor de precios")
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [companyId, tvData])

  useEffect(() => {
    fetchTvCuts(false)
    const interval = setInterval(() => fetchTvCuts(true), 20000)
    return () => clearInterval(interval)
  }, [fetchTvCuts])

  const visibleCortes = useMemo(() => tvData?.cuts?.filter((c) => c.visible_en_tv) || [], [tvData])

  const pages = useMemo(() => {
    const chunks: TvCutItem[][] = []
    for (let i = 0; i < visibleCortes.length; i += ITEMS_PER_PAGE) {
      chunks.push(visibleCortes.slice(i, i + ITEMS_PER_PAGE))
    }
    return chunks
  }, [visibleCortes])

  const totalPages = pages.length || 1

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(0)
      setProgress(0)
    }
  }, [currentPage, totalPages])

  // Temporizador de rotación
  useEffect(() => {
    if (totalPages <= 1) return
    const tick = 100
    const step = (tick / (SLIDE_DURATION_SEC * 1000)) * 100

    const timer = setInterval(() => {
      if (isPausedRef.current) return
      setProgress((prev) => {
        if (prev + step >= 100) {
          setCurrentPage((curr) => (curr + 1) % totalPages)
          return 0
        }
        return prev + step
      })
    }, tick)

    return () => clearInterval(timer)
  }, [totalPages])

  const formatPYG = (n: number) => Math.round(n || 0).toLocaleString("es-PY")
  const formatBRL = (n?: number) => n && n > 0 ? Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null

  const formattedDate = useMemo(() => time.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long", year: "numeric" }), [time])
  const formattedTime = useMemo(() => time.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), [time])

  const currentCortes = pages[currentPage] || []
  const currentOffersCount = useMemo(() => currentCortes.filter((c) => c.en_promo).length, [currentCortes])
  const cotizacionBrl = tvData?.cotizacion_brl || 1100

  // Clases semánticas por tema
  const t = {
    bg: isLight ? "bg-slate-100 text-slate-800" : "bg-[#070A0F] text-slate-100",
    border: isLight ? "border-slate-200" : "border-slate-800/90",
    headerTitle: isLight ? "text-slate-900" : "text-white",
    cardNormal: isLight ? "bg-white border-slate-200 shadow-lg shadow-slate-200/50" : "bg-slate-900/80 border-slate-800/90 shadow-xl shadow-slate-950/60",
    cardPromo: isLight
      ? "bg-gradient-to-br from-red-50 via-white to-amber-50/80 border-2 border-red-500 shadow-xl ring-2 ring-red-400/40 animate-[pulse_3s_ease-in-out_infinite]"
      : "bg-gradient-to-br from-red-950/70 via-slate-900/95 to-amber-950/60 border-amber-500/80 shadow-[0_0_35px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/60 animate-[pulse_3s_ease-in-out_infinite]",
    priceNormal: isLight ? "text-slate-950" : "text-white",
    pricePromo: isLight ? "text-red-600 drop-shadow-sm" : "text-amber-400 drop-shadow-[0_4px_25px_rgba(251,191,36,0.5)]",
    cutName: (isPromo: boolean) => isLight ? (isPromo ? "text-red-950" : "text-slate-900") : (isPromo ? "text-amber-100" : "text-white"),
    brlBadge: isLight ? "text-emerald-800 bg-emerald-50 border-emerald-300" : "text-emerald-300 bg-emerald-950/60 border-emerald-800/60",
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col justify-between select-none overflow-hidden font-sans p-6 transition-colors duration-300 ${t.bg}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ── CABECERA ── */}
      <header className={`shrink-0 flex items-center justify-between border-b pb-4 mb-3 ${t.border}`}>
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
                isLight ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-emerald-950/70 text-emerald-400 border-emerald-800/60"
              }`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                PRECIOS EN VIVO
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-md shadow-sm border ${
                isLight ? "bg-white text-emerald-800 border-emerald-300" : "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
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
            <h1 className={`text-3xl lg:text-4xl font-black tracking-tight mt-1.5 flex items-center gap-3 ${t.headerTitle}`}>
              <Beef className="w-8 h-8 text-amber-500 inline shrink-0" />
              PIZARRA DE CARNICERÍA & CORTES
            </h1>
          </div>
        </div>

        {/* Lado derecho: Paginador, Switch Theme, Reloj y Fullscreen */}
        <div className="text-right flex items-center gap-4 lg:gap-6">
          {totalPages > 1 && (
            <div className={`flex flex-col items-end gap-1.5 px-4 py-2 rounded-2xl shadow-lg border ${
              isLight ? "bg-white border-slate-200" : "bg-slate-900/90 border-slate-800"
            }`}>
              <div className="flex items-center gap-2">
                <button onClick={() => { setCurrentPage((c) => (c - 1 + totalPages) % totalPages); setProgress(0) }} className="p-1 rounded-lg hover:opacity-80 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-xs font-black font-mono tracking-wider uppercase ${isLight ? "text-red-600" : "text-amber-400"}`}>
                  PÁGINA {currentPage + 1} DE {totalPages}
                </span>
                <button onClick={() => { setCurrentPage((c) => (c + 1) % totalPages); setProgress(0) }} className="p-1 rounded-lg hover:opacity-80 transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setIsPaused((p) => !p)} className="p-1 rounded-lg hover:opacity-80 transition ml-1">
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className={`w-36 h-1.5 rounded-full overflow-hidden ${isLight ? "bg-slate-200" : "bg-slate-800"}`}>
                <div className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-500 rounded-full transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {pages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setCurrentPage(idx); setProgress(0) }}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentPage ? (isLight ? "w-6 bg-red-600" : "w-6 bg-amber-400 shadow-sm") : (isLight ? "w-2 bg-slate-300" : "w-2 bg-slate-700")
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Toggle Modo Claro / Oscuro */}
          <button
            onClick={toggleTheme}
            className={`p-3.5 rounded-2xl border shadow-md transition ${
              isLight ? "bg-white border-slate-200 text-amber-600 hover:bg-slate-50" : "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800"
            }`}
            title={isLight ? "Cambiar a Modo Oscuro" : "Cambiar a Modo Claro"}
          >
            {isLight ? <Moon className="w-5 h-5 text-indigo-600" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>

          <div className="hidden lg:block text-right">
            <p className={`text-xs font-bold uppercase tracking-wider capitalize ${isLight ? "text-slate-500" : "text-slate-400"}`}>{formattedDate}</p>
            <p className={`text-3xl lg:text-4xl font-mono font-black tracking-tight ${isLight ? "text-slate-900" : "text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.2)]"}`}>{formattedTime}</p>
          </div>

          <button
            onClick={() => (!document.fullscreenElement ? document.documentElement.requestFullscreen().catch(() => {}) : document.exitFullscreen?.().catch(() => {}))}
            className={`p-3.5 rounded-2xl border shadow-md transition ${isLight ? "bg-white border-slate-200 text-slate-600 hover:text-slate-900" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"}`}
            title="Pantalla Completa"
          >
            <Maximize2 className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ── CUADRÍCULA 3x3 ── */}
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
              const precioBrl = formatBRL(Number(corte.precio_brl || (Number(corte.precio) / cotizacionBrl)))

              return (
                <div
                  key={corte.producto_id}
                  className={`rounded-3xl p-4 lg:p-5 flex flex-col justify-between transition-all duration-300 border relative overflow-hidden ${
                    isPromo ? t.cardPromo : t.cardNormal
                  }`}
                >
                  {/* Fila Superior: Badges */}
                  <div className="flex items-center justify-between gap-2 z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      {corte.plu ? (
                        <span className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${
                          isLight ? "bg-slate-100 text-slate-800 border-slate-300" : "bg-slate-800 text-amber-300 border-slate-700 shadow-inner"
                        }`}>
                          PLU {corte.plu}
                        </span>
                      ) : null}
                      {corte.categoria && (
                        <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          isLight ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-slate-800/80 text-slate-300 border-slate-700/60"
                        }`}>
                          {corte.categoria}
                        </span>
                      )}
                    </div>

                    {isPromo && (
                      <div className="flex items-center gap-1.5">
                        {corte.porcentaje_descuento && Number(corte.porcentaje_descuento) > 0 ? (
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-black text-xs uppercase shadow-sm ${
                            isLight ? "bg-red-600 text-white" : "bg-amber-500 text-slate-950"
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

                  {/* Fila Central: Thumbnail + Nombre */}
                  <div className="my-auto py-2 flex items-center gap-4 z-10">
                    <CutThumbnail corte={corte} isLight={isLight} />
                    <div className="flex-1 min-w-0">
                      <h2 className={`font-black text-2xl lg:text-3xl uppercase tracking-tight line-clamp-2 leading-tight ${t.cutName(isPromo)}`}>
                        {corte.nombre}
                      </h2>
                      {isPromo && corte.ahorro_gs && Number(corte.ahorro_gs) > 0 ? (
                        <p className={`text-xs font-black mt-1 flex items-center gap-1 ${isLight ? "text-red-600" : "text-amber-300"}`}>
                          <Sparkles className="w-3 h-3 text-amber-500 inline" />
                          Ahorrás ₲ {formatPYG(Number(corte.ahorro_gs))} por kilo
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Fila Inferior: Precios Gs. y R$ */}
                  <div className={`pt-2 border-t flex items-end justify-between z-10 ${t.border}`}>
                    <div>
                      {isPromo && corte.precio_anterior ? (
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>Precio Normal</p>
                          <p className={`text-base lg:text-lg font-mono font-bold line-through ${isLight ? "text-slate-400" : "text-rose-300/80"}`}>
                            ₲ {formatPYG(Number(corte.precio_anterior))}
                          </p>
                        </div>
                      ) : (
                        <div className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          Pesaje Balanza
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1.5">
                        <span className={`text-xl lg:text-2xl font-black ${isPromo ? (isLight ? "text-red-600" : "text-amber-400") : (isLight ? "text-slate-700" : "text-slate-300")}`}>
                          ₲
                        </span>
                        <span className={`font-mono font-black text-4xl lg:text-5xl xl:text-6xl tracking-tight leading-none ${isPromo ? t.pricePromo : t.priceNormal}`}>
                          {formatPYG(Number(corte.precio))}
                        </span>
                        <span className={`text-sm lg:text-base font-extrabold ${isLight ? "text-slate-500" : "text-slate-400"}`}>/kg</span>
                      </div>

                      {precioBrl && (
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[11px] font-bold text-emerald-600">🇧🇷</span>
                          <span className={`text-base lg:text-lg font-black font-mono tracking-tight px-2 py-0.5 rounded-md border shadow-inner ${t.brlBadge}`}>
                            R$ {precioBrl}
                          </span>
                          <span className={`text-[11px] font-semibold ${isLight ? "text-emerald-700" : "text-emerald-400/80"}`}>/kg</span>
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

      {/* ── PIE ── */}
      <footer className={`shrink-0 border-t pt-3 mt-3 flex items-center justify-between text-xs lg:text-sm font-semibold ${isLight ? "border-slate-200 text-slate-600" : "border-slate-800/90 text-slate-400"}`}>
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
            <span className={`px-3 py-1 rounded-xl border ${isLight ? "bg-white border-slate-200 text-slate-700" : "text-slate-300 bg-slate-900 border-slate-800"}`}>
              Cortes {currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, visibleCortes.length)} de {visibleCortes.length}
            </span>
          )}
          <span>Última sinc: {lastSync.toLocaleTimeString("es-PY")}</span>
        </div>
      </footer>
    </div>
  )
}
