import { useState, useEffect, useRef, useCallback } from "react"
import {
  Barcode, Sparkles, ShoppingBag, ArrowDown, Clock, CheckCircle2, DollarSign,
  Star, Layers, Maximize2, Sun, Moon, WifiOff, XCircle,
} from "lucide-react"
import { api, type KioskProductLookup, type KioskBanner, type Company } from "../../api"
import { useTheme } from "../../context/ThemeContext"

// Banderas SVG en alta definición
function FlagBR() {
  return (
    <svg className="w-6 h-4 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 720 504">
      <rect width="720" height="504" fill="#009b3a" />
      <polygon points="360,42 678,252 360,462 42,252" fill="#fedf00" />
      <circle cx="360" cy="252" r="126" fill="#002776" />
      <path d="M 234,252 A 126,126 0 0,0 486,252" stroke="#ffffff" strokeWidth="18" fill="none" />
    </svg>
  )
}
function FlagUS() {
  return (
    <svg className="w-6 h-4 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 741 390">
      <rect width="741" height="390" fill="#b22234" />
      <path d="M0,30H741M0,90H741M0,150H741M0,210H741M0,270H741M0,330H741" stroke="#ffffff" strokeWidth="30" />
      <rect width="296.4" height="210" fill="#3c3b6e" />
    </svg>
  )
}
function FlagAR() {
  return (
    <svg className="w-6 h-4 rounded-sm shadow-sm inline-block shrink-0" viewBox="0 0 720 480">
      <rect width="720" height="160" fill="#74acdf" />
      <rect y="160" width="720" height="160" fill="#ffffff" />
      <rect y="320" width="720" height="160" fill="#74acdf" />
      <circle cx="360" cy="240" r="35" fill="#f6b40e" />
    </svg>
  )
}

// Generador de sonido sintético de escáner (Web Audio API)
function playBeepSound(ok: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    if (ok) {
      osc.frequency.setValueAtTime(1760, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08)
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime)
    }
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (ok ? 0.08 : 0.18))
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.18))
  } catch { /* audio bloqueado antes de interactuar -- ignorar */ }
}

const SEGUNDOS_ESPERA = 8
const BANNER_ROTATE_MS = 7000

const monoFont = { fontFamily: "'IBM Plex Mono', monospace" }

export default function PriceCheckerKioskPage() {
  const { dark, setTheme } = useTheme()
  // Toggle de 2 estados nomas -- en un kiosco fijo no tiene sentido un
  // tercer estado "sistema" que la mayoria de las veces resuelve a claro
  // sin que nadie lo haya elegido. Un toque cambia entre claro y oscuro,
  // sin estados intermedios ambiguos en una pantalla tactil.
  const toggleTheme = () => setTheme(dark ? "light" : "dark")

  // Nunca arrancar con una cotizacion inventada en pantalla -- null hasta
  // que llegue la configuracion real del tenant. Mientras tanto no se
  // muestra ninguna cifra de cambio, ni una de referencia "por las dudas".
  const [cotizaciones, setCotizaciones] = useState<{
    BRL: { venta: number; activo: boolean }
    USD: { venta: number; activo: boolean }
    ARS: { venta: number; activo: boolean }
  } | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [banners, setBanners] = useState<KioskBanner[]>([])
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0)

  const [scannedProduct, setScannedProduct] = useState<KioskProductLookup | null>(null)
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null)
  const [connError, setConnError] = useState(false)
  const [countdown, setCountdown] = useState(SEGUNDOS_ESPERA)
  const [currentTime, setCurrentTime] = useState(new Date())

  const barcodeBuffer = useRef("")
  const lastKeyTime = useRef(0)
  const timerRef = useRef<any>(null)
  const countdownIntervalRef = useRef<any>(null)

  // Logo real de la empresa y cotizaciones -- antes se pedian UNA sola
  // vez al montar, sin reintento; si ese pedido fallaba por cualquier corte
  // de red pasajero, la pantalla quedaba sin logo ni cotizaciones para
  // siempre hasta que alguien la recargara a mano. Ahora, si falla (o la
  // empresa todavia no esta disponible), reintenta a los 5 segundos en vez
  // de esperar el ciclo normal de 5 minutos -- un corte pasajero se
  // autorepara en segundos, no queda la pantalla en blanco mientras tanto.
  const fetchCompanyAndCurrencies = useCallback(() => {
    api.companies.list().then((list) => {
      const comp = list?.[0]
      if (!comp) {
        setTimeout(fetchCompanyAndCurrencies, 5000)
        return
      }
      setCompany(comp)
      const dbCurrencies = (comp.config as any)?.currencies
      const base = { BRL: { venta: 0, activo: false }, USD: { venta: 0, activo: false }, ARS: { venta: 0, activo: false } }
      if (dbCurrencies) {
        for (const code of ["BRL", "USD", "ARS"] as const) {
          const val = dbCurrencies[code]
          if (val && typeof val === "object") {
            base[code] = {
              venta: Number(val.venta ?? 0),
              activo: typeof val.activo === "boolean" ? val.activo : false,
            }
          }
        }
      }
      setCotizaciones(base)
    }).catch(() => setTimeout(fetchCompanyAndCurrencies, 5000))
  }, [])

  useEffect(() => {
    fetchCompanyAndCurrencies()
    const interval = setInterval(fetchCompanyAndCurrencies, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCompanyAndCurrencies])

  // Banners reales, cargados desde el panel de marketing -- sin fallback
  // inventado: si no hay ninguno cargado, simplemente no se muestra nada ahí.
  // Mismo reintento rapido que arriba ante un corte pasajero.
  const fetchBanners = useCallback(() => {
    api.kiosk.banners.active().then(setBanners).catch(() => setTimeout(fetchBanners, 5000))
  }, [])

  useEffect(() => {
    fetchBanners()
    const interval = setInterval(fetchBanners, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchBanners])

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => setCurrentBannerIdx((p) => (p + 1) % banners.length), BANNER_ROTATE_MS)
    return () => clearInterval(t)
  }, [banners.length])

  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  // Auto-recarga de madrugada -- estas terminales quedan encendidas dias
  // enteros sin que nadie las toque. Recargar solo una vez, a una hora sin
  // clientes y solo si no hay nadie mirando un precio en pantalla, asegura
  // que cualquier cambio que se publique llegue solo, sin depender de que
  // un repositor reinicie el equipo a mano.
  const reloadedRef = useRef(false)
  useEffect(() => {
    const hour = currentTime.getHours()
    const minute = currentTime.getMinutes()
    const idle = !scannedProduct && !notFoundCode && !connError
    if (hour === 4 && minute === 0 && idle && !reloadedRef.current) {
      reloadedRef.current = true
      window.location.reload()
    }
    if (hour !== 4) reloadedRef.current = false
  }, [currentTime, scannedProduct, notFoundCode, connError])

  const resetToStandby = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setScannedProduct(null)
    setNotFoundCode(null)
    setConnError(false)
    setCountdown(SEGUNDOS_ESPERA)
  }, [])

  const armAutoReset = useCallback(() => {
    setCountdown(SEGUNDOS_ESPERA)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    timerRef.current = setTimeout(resetToStandby, SEGUNDOS_ESPERA * 1000)
  }, [resetToStandby])

  // Buscar producto por código de barras -- SIEMPRE match exacto contra el
  // backend. Nunca se inventa un producto ni un precio: si la API falla,
  // se avisa que hay un problema de conexión; si no existe, se avisa que
  // no está registrado. Un verificador de precios que miente es peor que
  // uno que está apagado.
  const handleLookupCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return

    try {
      const product = await api.kiosk.lookup(code)
      playBeepSound(true)
      setScannedProduct(product)
      setNotFoundCode(null)
      setConnError(false)
    } catch (e: any) {
      playBeepSound(false)
      setScannedProduct(null)
      if (e?.message?.includes("404") || e?.message?.toLowerCase().includes("no encontrado")) {
        setNotFoundCode(code)
        setConnError(false)
      } else {
        setNotFoundCode(null)
        setConnError(true)
      }
    }
    armAutoReset()
  }, [armAutoReset])

  // Listener global de teclado para lectores de código de barra
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      if (now - lastKeyTime.current > 250) barcodeBuffer.current = ""
      lastKeyTime.current = now

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length > 0) {
          handleLookupCode(barcodeBuffer.current)
          barcodeBuffer.current = ""
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleLookupCode])

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  const precioUnitarioGs = scannedProduct?.precio_venta || 0
  const currentBanner = banners[currentBannerIdx]

  const CURRENCY_META = {
    BRL: { label: "Reales", labelBoard: "REAL BRASIL", prefix: "1 R$ =", symbol: "R$", flag: <FlagBR />, color: "emerald" },
    USD: { label: "Dólares", labelBoard: "DÓLAR USA", prefix: "1 US$ =", symbol: "US$", flag: <FlagUS />, color: "blue" },
    ARS: { label: "Pesos", labelBoard: "PESO AR", prefix: "1 ARS =", symbol: "$", flag: <FlagAR />, color: "cyan" },
  } as const

  const activeCurrencies = cotizaciones
    ? (Object.keys(CURRENCY_META) as (keyof typeof CURRENCY_META)[])
        .filter((code) => cotizaciones[code].activo)
        .map((code) => ({ code, rate: cotizaciones[code].venta, ...CURRENCY_META[code] }))
    : []

  const colorText: Record<string, string> = { emerald: "text-emerald-600 dark:text-emerald-400", blue: "text-blue-600 dark:text-blue-400", cyan: "text-cyan-600 dark:text-cyan-400" }
  const colorBorder: Record<string, string> = { emerald: "border-emerald-300 dark:border-emerald-500/30", blue: "border-blue-300 dark:border-blue-500/30", cyan: "border-cyan-300 dark:border-cyan-500/30" }

  const convert = (gs: number, rate: number) => (gs / (rate || 1))

  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-600 text-white shadow-emerald-600/30",
    amber: "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/30",
    purple: "bg-purple-600 text-white shadow-purple-600/30",
    blue: "bg-blue-600 text-white shadow-blue-600/30",
    rose: "bg-rose-600 text-white shadow-rose-600/30",
    orange: "bg-brand-orange text-[#1C1710] shadow-orange-500/30",
  }

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-white flex flex-col justify-between overflow-hidden select-none font-sans relative transition-colors">
      <style>{`
        @keyframes scanLaser { 0% { top: 0%; opacity: 0.8; } 50% { top: 90%; opacity: 1; } 100% { top: 0%; opacity: 0.8; } }
        .animate-laser { animation: scanLaser 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        @keyframes pulseGlow { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.04); opacity: 1; } }
        .animate-pulse-glow { animation: pulseGlow 3s ease-in-out infinite; }
      `}</style>

      {/* ── FONDOS AMBIENTALES LUMINOSOS ── */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-blue-600/10 dark:bg-blue-600/15 filter blur-[140px] pointer-events-none -top-40 -left-40" />
      <div className="absolute w-[600px] h-[600px] rounded-full bg-orange-600/10 dark:bg-orange-600/15 filter blur-[140px] pointer-events-none -bottom-40 -right-40" />

      {/* ── ENCABEZADO -- botones de tema/pantalla completa DENTRO del flujo,
          nunca flotando encima del reloj (se superponian en pantallas de
          1366x768, resolucion real de las terminales del salon). ── */}
      <header className="px-4 sm:px-8 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-400/50 shrink-0" />
          <span className="text-[11px] sm:text-sm font-black tracking-wider text-slate-500 dark:text-slate-300 uppercase truncate">
            Terminal de Consulta de Precios · Salón de Ventas
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-sm sm:text-lg font-black font-mono text-slate-900 dark:text-white tracking-widest leading-none block">
              {currentTime.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="text-[10px] text-orange-500 dark:text-orange-400 font-bold capitalize">
              {currentTime.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <button
            onClick={toggleTheme}
            title="Cambiar tema"
            className="p-2 rounded-xl bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullScreen}
            title="Pantalla Completa (F11)"
            className="p-2 rounded-xl bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 sm:p-3 lg:p-4 z-10 w-full max-w-6xl mx-auto overflow-hidden">

        {/* A) STANDBY -- layout de 2 columnas. Izquierda: identidad + escaneo +
            cotizaciones. Derecha: banner de marketing solo, mostrado entero */}
        {!scannedProduct && !notFoundCode && !connError && (
          <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-stretch animate-in fade-in zoom-in-95 duration-300">

            {/* COLUMNA IZQUIERDA -- identidad + llamado a escanear + cotizaciones */}
            <div className="lg:col-span-5 h-full min-h-0 flex flex-col items-center justify-center gap-2.5">
              <div className="relative flex flex-col items-center shrink-0">
                <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-orange-500 via-blue-600 to-amber-400 opacity-30 dark:opacity-40 blur-2xl animate-pulse-glow pointer-events-none" />
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-white p-2.5 shadow-2xl ring-4 ring-slate-200 dark:ring-white/30 flex items-center justify-center overflow-hidden">
                  {company?.logo_url ? (
                    <img src={company.logo_url} alt={company.nombre || "Logo"} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center text-center p-3">
                      <span className="text-xl sm:text-2xl font-black text-orange-500 tracking-tighter">EXTRA</span>
                      <span className="text-[10px] sm:text-xs font-black text-blue-400 tracking-widest">PARAGUAY</span>
                      <span className="text-[7px] text-slate-300 tracking-widest uppercase font-bold mt-0.5">Supermercado Mayorista</span>
                    </div>
                  )}
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-orange-600 dark:from-white dark:via-slate-100 dark:to-orange-200 tracking-tight text-center shrink-0">
                ESCANEE AQUÍ SU PRODUCTO
              </h1>

              <div className="relative w-full max-w-md h-16 sm:h-18 rounded-2xl bg-white dark:bg-slate-900/80 border-2 border-dashed border-blue-400/50 dark:border-blue-500/50 backdrop-blur-2xl p-2.5 flex flex-col items-center justify-center overflow-hidden shadow-xl shrink-0">
                <div className="absolute left-4 right-4 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full shadow-[0_0_15px_#ff0033] animate-laser pointer-events-none" />
                <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                  <Barcode className="w-8 h-8 sm:w-9 sm:h-9 text-blue-500 dark:text-blue-400 opacity-90" />
                  <div className="text-left">
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block uppercase tracking-wider">
                      Acerque el Código de Barras
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Mire hacia la ventana del lector inferior
                    </span>
                  </div>
                </div>
              </div>

              {/* COTIZACIONES */}
              <div className="w-full max-w-md space-y-1.5 shrink-0">
                <span className="text-[10px] sm:text-xs font-black tracking-widest text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5 px-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  PIZARRA DE CAMBIO OFICIAL (CAJAS POS)
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {activeCurrencies.map((c) => (
                    <div key={c.code} className={`px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900/90 border-2 ${colorBorder[c.color]} shadow-md flex items-center justify-between`}>
                      <div className="flex items-center gap-2.5">
                        {c.flag}
                        <div><span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block leading-none">{c.labelBoard}</span><span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{c.prefix}</span></div>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`text-lg sm:text-xl font-black ${colorText[c.color]}`}>{c.rate.toLocaleString("es-PY")}</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block leading-none">Gs.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA -- banner marketing */}
            <div className="lg:col-span-7 h-full min-h-0 flex flex-col">
              {currentBanner ? (
                <div className="w-full flex-1 min-h-0 flex flex-col rounded-3xl border-2 border-slate-200 dark:border-white/20 shadow-2xl relative overflow-hidden bg-slate-100 dark:bg-slate-900/95">
                  {currentBanner.imagen_url ? (
                    <div className="relative w-full flex-1 min-h-0 flex items-center justify-center bg-slate-100 dark:bg-black/40 p-2">
                      <img src={currentBanner.imagen_url} alt={currentBanner.titulo} className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="p-5 sm:p-6 flex-1 min-h-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-2">
                        {currentBanner.etiqueta && (
                          <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg ${colorClasses[currentBanner.color || "orange"] || colorClasses.orange}`}>
                            {currentBanner.etiqueta}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">{currentBanner.titulo}</h3>
                      {currentBanner.subtitulo && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 mt-1">{currentBanner.subtitulo}</p>}
                      {currentBanner.descuento_texto && (
                        <div className="mt-3 inline-block w-fit px-5 py-2.5 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 text-white font-black text-lg font-mono shadow-xl">
                          {currentBanner.descuento_texto}
                        </div>
                      )}
                    </div>
                  )}
                  {banners.length > 1 && (
                    <div className="flex items-center justify-center gap-2 py-1.5 border-t border-slate-100 dark:border-white/10 shrink-0">
                      {banners.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentBannerIdx ? "w-7 bg-orange-500" : "w-2 bg-slate-300 dark:bg-white/20"}`} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full flex-1 min-h-[200px] rounded-3xl border-2 border-dashed border-slate-300 dark:border-white/15 flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 dark:bg-white/5">
                  <Sparkles className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-1.5" />
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Sin ofertas cargadas todavía</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">Marketing puede subir creativos desde Gerente de Marketing IA</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* B) PRODUCTO ENCONTRADO (1024x768 OPTIMIZADO) */}
        {scannedProduct && (
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900/95 border-2 border-slate-200 dark:border-white/20 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl space-y-2 sm:space-y-2.5 animate-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* Header Tarjeta */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-1.5">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 text-xs font-black flex items-center gap-1.5 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> PRECIO VERIFICADO
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold hidden sm:inline">
                  SKU: {scannedProduct.sku || scannedProduct.codigo_barra}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/10 px-3 py-1 rounded-xl border border-slate-200 dark:border-white/15">
                <Clock className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-200">Volviendo:</span>
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-mono font-black text-xs flex items-center justify-center shadow-md">{countdown}s</span>
              </div>
            </div>

            {/* Cuerpo del Producto */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
              
              {/* Imagen Producto */}
              <div className="md:col-span-4 flex flex-col items-center justify-center">
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-white dark:bg-slate-800 p-2 shadow-xl border-2 border-slate-100 dark:border-white/30 flex items-center justify-center overflow-hidden">
                  {scannedProduct.imagen_url ? (
                    <img src={scannedProduct.imagen_url} alt={scannedProduct.nombre} className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ShoppingBag className="w-12 h-12 stroke-1 text-slate-300 mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin Imagen</span>
                    </div>
                  )}
                  {scannedProduct.categoria_nombre && (
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-950/85 text-slate-200 backdrop-blur-md truncate shadow-sm">
                      {scannedProduct.categoria_nombre}
                    </span>
                  )}
                </div>
              </div>

              {/* Información y Precios */}
              <div className="md:col-span-8 space-y-2 text-left min-w-0">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
                    {scannedProduct.nombre.trim()}
                  </h2>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    CÓDIGO: <strong className="text-slate-700 dark:text-slate-200 font-bold">{scannedProduct.codigo_barra || scannedProduct.sku}</strong>
                  </p>
                </div>

                {scannedProduct.en_promocion ? (
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border-2 border-emerald-500 dark:border-emerald-400 shadow-xl space-y-2">
                    
                    {/* Header Promocional & Precios */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" /> {scannedProduct.badge_promo || "🏷️ OFERTA EXTRA"}
                      </span>
                      {scannedProduct.promocion_nombre && (
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate max-w-xs">
                          {scannedProduct.promocion_nombre}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-3 flex-wrap">
                      <div className="text-3xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 drop-shadow-sm">
                        Gs. {Math.round(scannedProduct.precio_venta).toLocaleString("es-PY")}
                      </div>
                      {scannedProduct.precio_regular && (
                        <div className="text-sm sm:text-lg font-mono line-through text-slate-400 dark:text-slate-500 font-bold">
                          Gs. {Math.round(scannedProduct.precio_regular).toLocaleString("es-PY")}
                        </div>
                      )}
                    </div>

                    {/* 🌟 BANNER COMPACTO DE AHORRO DIRECTO */}
                    {scannedProduct.ahorro_unitario && scannedProduct.ahorro_unitario > 0 && (
                      <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-100">
                            ¡AHORRO DIRECTO EN CAJA!
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-2xl font-black font-mono tracking-tight text-amber-300">
                            Gs. {Math.round(scannedProduct.ahorro_unitario).toLocaleString("es-PY")}
                          </span>
                          <span className="text-[10px] font-black bg-black/30 px-1.5 py-0.5 rounded-md text-emerald-100">
                            -{Math.round(scannedProduct.ahorro_porcentaje || 0)}% OFF
                          </span>
                        </div>
                      </div>
                    )}

                    {scannedProduct.limite_por_compra && (
                      <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        * Máximo {scannedProduct.limite_por_compra} un. en oferta por compra.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border-2 border-orange-300 dark:border-orange-500/40 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 block mb-0.5">
                        PRECIO UNITARIO AL CONTADO:
                      </span>
                      {scannedProduct.mensaje_dias && (
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">
                          📅 {scannedProduct.mensaje_dias}
                        </span>
                      )}
                    </div>
                    <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                      Gs. {Math.round(precioUnitarioGs).toLocaleString("es-PY")}
                    </div>
                  </div>
                )}

                {/* Multimoneda */}
                {activeCurrencies.length > 0 && (
                  <div className={`grid gap-2 ${activeCurrencies.length === 1 ? "grid-cols-1" : activeCurrencies.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {activeCurrencies.map((c) => (
                      <div key={c.code} className={`p-1.5 sm:p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border ${colorBorder[c.color]} text-center shadow-xs`}>
                        <div className="flex items-center justify-center gap-1 mb-0.5">{c.flag}<span className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase">{c.label}</span></div>
                        <span className={`text-base sm:text-lg font-black font-mono ${colorText[c.color]}`}>{c.symbol} {convert(Math.round(precioUnitarioGs), c.rate).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 📦 PRECIOS MAYORISTAS POR CANTIDAD (EXTRA MAYORISTA) */}
            {scannedProduct.escalas.length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-white/15">
                <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-orange-500" />
                    <span>PRECIOS MAYORISTAS POR CANTIDAD</span>
                  </div>
                  {scannedProduct.en_promocion ? (
                    <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/40 flex items-center gap-1">
                      <span>⏸️ ESCALAS EN HOLD POR PROMOCIÓN ACTIVA</span>
                    </span>
                  ) : (
                    <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                      ¡LLEVÁ MÁS, PAGÁ MENOS!
                    </span>
                  )}
                </div>
                <div className={`grid grid-cols-1 gap-2 ${scannedProduct.escalas.length >= 3 ? "sm:grid-cols-3" : scannedProduct.escalas.length === 2 ? "sm:grid-cols-2" : ""}`}>
                  {scannedProduct.escalas.map((t, i) => {
                    const unitGs = Math.round(t.precio_unitario)
                    const baseGs = Math.round(precioUnitarioGs)
                    const ahorroMay = baseGs > unitGs ? baseGs - unitGs : 0
                    return (
                      <div key={i} className="rounded-xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-orange-950/40 border-2 border-amber-400 dark:border-amber-500/50 shadow-md overflow-hidden">
                        <div className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[11px] sm:text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-1">
                          <span>📦 {t.max_qty ? `De ${t.min_qty} a ${t.max_qty} un.` : `Mayorista: ${t.min_qty}+ un.`}</span>
                        </div>
                        <div className="p-2 sm:p-2.5 text-center space-y-0.5">
                          <div className="font-mono text-slate-900 dark:text-white text-2xl sm:text-3xl font-black tracking-tight" style={monoFont}>
                            Gs. {unitGs.toLocaleString("es-PY")}
                          </div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-300 font-extrabold uppercase">
                            Precio Mayorista / un.
                          </div>
                          {ahorroMay > 0 && (
                            <div className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                              Ahorrás Gs. {ahorroMay.toLocaleString("es-PY")}
                            </div>
                          )}
                          {activeCurrencies.length > 0 && (
                            <div className="flex items-center justify-center gap-2 pt-1 border-t border-amber-200 dark:border-amber-500/20">
                              {activeCurrencies.map((c) => (
                                <span key={c.code} className={`text-sm sm:text-base font-mono font-black ${colorText[c.color]}`}>
                                  {c.symbol} {convert(unitGs, c.rate).toFixed(2)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Barra de Tiempo */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 transition-all duration-1000 ease-linear" style={{ width: `${(countdown / SEGUNDOS_ESPERA) * 100}%` }} />
            </div>
          </div>
        )}

        {/* C) NO ENCONTRADO */}
        {notFoundCode && (
          <div className="w-full max-w-lg bg-white dark:bg-slate-900/95 border-2 border-rose-300 dark:border-rose-500/50 rounded-3xl p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-500/20 border-2 border-rose-300 dark:border-rose-500/50 text-rose-500 dark:text-rose-400 flex items-center justify-center mx-auto shadow-lg">
              <Barcode className="w-10 h-10" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Código No Registrado</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">{notFoundCode}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
                Por favor consulte con un repositor en salón o acérquese a la caja principal.
              </p>
            </div>
            <button onClick={resetToStandby} className="px-6 py-2.5 rounded-2xl text-xs font-black text-white bg-slate-800 hover:bg-slate-700 border border-white/15 transition cursor-pointer shadow-lg">
              Volver a Escanear ({countdown}s)
            </button>
          </div>
        )}

        {/* D) ERROR DE CONEXIÓN -- nunca se inventa un producto acá */}
        {connError && (
          <div className="w-full max-w-lg bg-white dark:bg-slate-900/95 border-2 border-amber-300 dark:border-amber-500/50 rounded-3xl p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-500/20 border-2 border-amber-300 dark:border-amber-500/50 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto shadow-lg">
              <WifiOff className="w-10 h-10" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Sin Conexión</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
                No se pudo consultar el precio en este momento. Por favor consulte con un repositor o acérquese a la caja principal.
              </p>
            </div>
            <button onClick={resetToStandby} className="px-6 py-2.5 rounded-2xl text-xs font-black text-white bg-slate-800 hover:bg-slate-700 border border-white/15 transition cursor-pointer shadow-lg flex items-center gap-2 mx-auto">
              <XCircle className="w-4 h-4" /> Volver a Intentar ({countdown}s)
            </button>
          </div>
        )}
      </main>

      <footer className="px-6 py-3 border-t border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl flex items-center justify-between text-xs text-slate-500 dark:text-slate-500 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-bold text-slate-500 dark:text-slate-400">InteliMarket Kiosk System · Extra Supermercado</span>
        </div>
        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">Terminal Kiosk v3.0</div>
      </footer>
    </div>
  )
}
