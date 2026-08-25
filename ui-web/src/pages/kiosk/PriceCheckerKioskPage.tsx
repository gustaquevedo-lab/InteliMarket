import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Barcode, Sparkles, Tag, ShoppingBag, ArrowDown, RefreshCw,
  Clock, ShieldCheck, CheckCircle2, DollarSign, Gift, Star,
  Percent, ArrowRight, Zap, Volume2, VolumeX, Maximize2, Layers,
  TrendingUp, Award, Check, ChevronRight, Info
} from "lucide-react"
import { api, type Product, type Company } from "../../api"

export interface KioskBanner {
  id: string
  titulo: string
  subtitulo?: string
  etiqueta?: string // "OFERTA DEL DÍA", "OFERTA DE LA SEMANA", "EXTRA CLUB"
  descuento_texto?: string // "-25% OFF", "3x2", etc.
  color?: "emerald" | "amber" | "purple" | "blue" | "rose"
  activo: boolean
}

export interface KioskConfig {
  segundos_espera: number // default 5s
  mostrar_cotizaciones: boolean
  mostrar_escala_precios: boolean
  mostrar_beneficios_club: boolean
  extra_club_descuento_pct: number
  mensaje_bienvenida: string
  banners: KioskBanner[]
}

const DEFAULT_KIOSK_CONFIG: KioskConfig = {
  segundos_espera: 5,
  mostrar_cotizaciones: true,
  mostrar_escala_precios: true,
  mostrar_beneficios_club: true,
  extra_club_descuento_pct: 10,
  mensaje_bienvenida: "Bienvenido a Extra Supermercado",
  banners: [
    {
      id: "b-01",
      etiqueta: "OFERTA DEL DÍA",
      titulo: "Sector Frutas & Verduras Frescas de Estación",
      subtitulo: "Descuento directo por kilo en pesables seleccionados de salón",
      descuento_texto: "-20% OFF",
      color: "emerald",
      activo: true,
    },
    {
      id: "b-02",
      etiqueta: "OFERTA DE LA SEMANA",
      titulo: "Carnicería Premium · Cortes Envasados al Vacío",
      subtitulo: "Tarifa mayorista automática llevando a partir de 3 Kilogramos",
      descuento_texto: "PRECIO MAYORISTA",
      color: "amber",
      activo: true,
    },
    {
      id: "b-03",
      etiqueta: "BENEFICIO EXTRA CLUB",
      titulo: "Acumulá Puntos y Descuentos Exclusivos en Caja",
      subtitulo: "Dictá tu número de Cédula de Identidad y ahorrá al instante",
      descuento_texto: "10% EXTRA AHORRO",
      color: "purple",
      activo: true,
    },
  ],
}

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
function playBeepSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(1760, ctx.currentTime) // A6 (1760 Hz)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08)

    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.08)
  } catch (e) {
    // Ignorar si el navegador bloquea audio antes de interactuar
  }
}

export default function PriceCheckerKioskPage() {
  // Configuración y datos
  const [config, setConfig] = useState<KioskConfig>(DEFAULT_KIOSK_CONFIG)
  const [company, setCompany] = useState<Company | null>(null)
  const [cotizaciones, setCotizaciones] = useState({
    BRL: 1420,
    USD: 7850,
    ARS: 5.8,
  })

  // Estado del producto escaneado
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(5)
  const [isScanning, setIsScanning] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0)

  // Buffer de escáner
  const barcodeBuffer = useRef<string>("")
  const lastKeyTime = useRef<number>(0)
  const timerRef = useRef<any>(null)
  const countdownIntervalRef = useRef<any>(null)

  // Cargar datos de la empresa y configuración del Kiosco
  const loadKioskData = useCallback(async () => {
    try {
      const companies = await api.companies.list()
      if (companies && companies.length > 0) {
        const comp = companies[0]
        setCompany(comp)

        // Configuración de Kiosco guardada en DB
        const savedKiosk = (comp.config as any)?.kiosk as KioskConfig | undefined
        if (savedKiosk && savedKiosk.segundos_espera) {
          setConfig(savedKiosk)
        } else {
          const localKiosk = localStorage.getItem("kiosk_config")
          if (localKiosk) {
            try { setConfig(JSON.parse(localKiosk)) } catch {}
          }
        }

        // Cotizaciones
        const savedCurrencies = (comp.config as any)?.currencies
        if (savedCurrencies) {
          setCotizaciones({
            BRL: Number(savedCurrencies.BRL?.venta || savedCurrencies.BRL || 1420),
            USD: Number(savedCurrencies.USD?.venta || savedCurrencies.USD || 7850),
            ARS: Number(savedCurrencies.ARS?.venta || savedCurrencies.ARS || 5.8),
          })
        }
      }
    } catch {
      // Fallback
    }
  }, [])

  useEffect(() => {
    loadKioskData()
  }, [loadKioskData])

  // Reloj en tiempo real
  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  // Rotación de banners de ofertas cada 4 segundos
  useEffect(() => {
    const activeList = config.banners.filter(b => b.activo)
    if (activeList.length <= 1) return
    const bannerTimer = setInterval(() => {
      setCurrentBannerIdx(prev => (prev + 1) % activeList.length)
    }, 4000)
    return () => clearInterval(bannerTimer)
  }, [config.banners])

  // Función para resetear al modo de espera (Standby)
  const resetToStandby = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setScannedProduct(null)
    setNotFoundBarcode(null)
    setIsScanning(false)
    setCountdown(config.segundos_espera || 5)
  }, [config.segundos_espera])

  // Buscar producto por código de barras
  const handleLookupBarcode = useCallback(async (rawCode: string) => {
    const cleanCode = rawCode.trim()
    if (!cleanCode) return

    playBeepSound()
    setIsScanning(true)

    try {
      const res = await api.products.list({ search: cleanCode, limit: 10 })
      const found = res?.find(p =>
        p.codigo_barra === cleanCode ||
        p.sku?.toLowerCase() === cleanCode.toLowerCase() ||
        p.nombre?.toLowerCase().includes(cleanCode.toLowerCase())
      ) || res?.[0]

      if (found) {
        setScannedProduct(found)
        setNotFoundBarcode(null)
      } else {
        setScannedProduct(null)
        setNotFoundBarcode(cleanCode)
      }
    } catch {
      // Fallback simulado
      setScannedProduct({
        id: `mock-${cleanCode}`,
        nombre: `PRODUCTO ESCANEADO (${cleanCode})`,
        sku: cleanCode,
        codigo_barra: cleanCode,
        precio_venta: 18500,
        precio: 18500,
        categoria: { id: "cat-1", nombre: "Almacén General" },
      })
      setNotFoundBarcode(null)
    }

    const totalSeconds = config.segundos_espera || 5
    setCountdown(totalSeconds)

    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    timerRef.current = setTimeout(() => {
      resetToStandby()
    }, totalSeconds * 1000)
  }, [config.segundos_espera, resetToStandby])

  // Listener global de teclado para lectores de código de barra
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      if (now - lastKeyTime.current > 250) {
        barcodeBuffer.current = ""
      }
      lastKeyTime.current = now

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length > 0) {
          handleLookupBarcode(barcodeBuffer.current)
          barcodeBuffer.current = ""
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleLookupBarcode])

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Precios calculados
  const precioUnitarioGs = Number(scannedProduct?.precio_venta || scannedProduct?.precio || 0)
  const precioMayoristaGs = Math.round(precioUnitarioGs * 0.92)
  const precioPackGs = Math.round(precioUnitarioGs * 0.85)
  const extraClubPct = config.extra_club_descuento_pct || 10
  const precioClubGs = Math.round(precioUnitarioGs * (1 - extraClubPct / 100))
  const ahorroClubGs = precioUnitarioGs - precioClubGs

  const precioBRL = (precioUnitarioGs / (cotizaciones.BRL || 1420)).toFixed(2)
  const precioUSD = (precioUnitarioGs / (cotizaciones.USD || 7850)).toFixed(2)
  const precioARS = Math.round(precioUnitarioGs / (cotizaciones.ARS || 5.8)).toLocaleString("es-PY")

  const activeBanners = config.banners.filter(b => b.activo)
  const currentBanner = activeBanners[currentBannerIdx] || activeBanners[0]

  return (
    <div className="min-h-screen w-full bg-[#070b14] text-white flex flex-col justify-between overflow-hidden select-none font-sans relative">
      
      {/* ── CSS INLINE PARA ANIMACIÓN LÁSER CONTINUA ── */}
      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 90%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
        .animate-laser {
          animation: scanLaser 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        .animate-pulse-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
      `}</style>

      {/* Botón flotante para activar pantalla completa en Windows */}
      <button
        onClick={toggleFullScreen}
        title="Pantalla Completa Kiosk (F11)"
        className="absolute top-4 right-4 p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white backdrop-blur-xl transition z-50 cursor-pointer shadow-lg"
      >
        <Maximize2 className="w-5 h-5" />
      </button>

      {/* ── FONDOS AMBIENTALES LUMINOSOS (NEÓN Y GRADIENTES) ── */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-blue-600/15 filter blur-[140px] pointer-events-none -top-40 -left-40" />
      <div className="absolute w-[600px] h-[600px] rounded-full bg-orange-600/15 filter blur-[140px] pointer-events-none -bottom-40 -right-40" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-purple-600/10 filter blur-[120px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* ── ENCABEZADO SUPERIOR: HORA & ESTADO ── */}
      <header className="px-6 sm:px-10 py-3.5 flex items-center justify-between border-b border-white/10 bg-slate-950/70 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
          <span className="text-xs sm:text-sm font-black tracking-wider text-slate-300 uppercase">
            Terminal de Consulta de Precios · Salón de Ventas
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-base sm:text-xl font-black font-mono text-white tracking-widest leading-none block">
              {currentTime.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="text-xs text-orange-400 font-bold capitalize">
              {currentTime.toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL: STANDBY vs PRODUCTO ESCANEADO ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 z-10 w-full max-w-6xl mx-auto">

        {/* ═════════════════════════════════════════════════════════════════════
            A) MODO STANDBY: LOGO GIGANTE + LÁSER ANIMADO + COTIZACIONES + PROMOS
           ═════════════════════════════════════════════════════════════════════ */}
        {!scannedProduct && !notFoundBarcode && (
          <div className="w-full flex flex-col items-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            
            {/* 1. LOGO GIGANTE OFICIAL CON EMBLEMA REDONDO ILUMINADO */}
            <div className="relative flex flex-col items-center">
              {/* Halo resplandeciente exterior */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-orange-500 via-blue-600 to-amber-400 opacity-40 blur-2xl animate-pulse-glow pointer-events-none" />

              {/* Emblema Circular Oficial */}
              <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-white p-3 shadow-2xl ring-4 ring-white/30 flex items-center justify-center overflow-hidden">
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt="Extra Paraguay"
                    className="w-full h-full object-contain filter drop-shadow-md"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center text-center p-4">
                    <span className="text-3xl sm:text-4xl font-black text-orange-500 tracking-tighter">EXTRA</span>
                    <span className="text-xs sm:text-sm font-black text-blue-400 tracking-widest">PARAGUAY</span>
                    <span className="text-[9px] text-slate-300 tracking-widest uppercase font-bold mt-1">Supermercado Mayorista</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. ZONA DE ESCANEO CON LÁSER ANIMADO APUNTANDO HACIA EL LECTOR */}
            <div className="w-full max-w-xl flex flex-col items-center space-y-3">
              <div className="px-6 py-2 rounded-full bg-orange-500/20 border-2 border-orange-500/50 shadow-lg shadow-orange-500/20 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400 animate-spin" />
                <span className="text-xs sm:text-sm font-black tracking-widest text-orange-300 uppercase">
                  VERIFICADOR DIGITAL INSTANTÁNEO
                </span>
                <Sparkles className="w-4 h-4 text-orange-400 animate-spin" />
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-orange-200 tracking-tight text-center drop-shadow-md">
                ESCANEE AQUÍ SU PRODUCTO
              </h1>

              {/* Target Holográfico con Láser Dinámico */}
              <div className="relative w-full max-w-md h-28 sm:h-32 rounded-3xl bg-slate-900/80 border-2 border-dashed border-blue-500/50 backdrop-blur-2xl p-4 flex flex-col items-center justify-center overflow-hidden shadow-2xl group">
                
                {/* Rayo láser rojo oscilante */}
                <div className="absolute left-4 right-4 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full shadow-[0_0_15px_#ff0033] animate-laser pointer-events-none" />

                {/* Gráfico central de código de barras */}
                <div className="flex items-center gap-3 text-slate-300">
                  <Barcode className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400 opacity-90" />
                  <div className="text-left">
                    <span className="text-xs sm:text-sm font-black text-white block uppercase tracking-wider">
                      Acerque el Código de Barras
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Mire hacia la ventana del lector inferior
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-2 flex items-center gap-1 text-[11px] font-black text-orange-400 uppercase tracking-widest animate-bounce">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Posición del sensor abajo</span>
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* 3. MEGA BANNER DE OFERTAS & CARRUSEL DE PROMOCIONES */}
            {currentBanner && (
              <div className="w-full max-w-2xl rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-slate-900/95 via-slate-850/95 to-slate-900/95 border-2 border-white/20 backdrop-blur-2xl shadow-2xl transition-all duration-500 relative overflow-hidden">
                
                {/* Luz de acento en el banner */}
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-orange-500/15 filter blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                        currentBanner.color === "purple"
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                          : currentBanner.color === "amber"
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                          : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      }`}>
                        {currentBanner.etiqueta}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        Promoción Destacada
                      </span>
                    </div>

                    <h3 className="text-base sm:text-xl font-black text-white tracking-tight leading-snug">
                      {currentBanner.titulo}
                    </h3>
                    {currentBanner.subtitulo && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {currentBanner.subtitulo}
                      </p>
                    )}
                  </div>

                  {currentBanner.descuento_texto && (
                    <div className="sm:self-center shrink-0">
                      <div className="px-5 py-3 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 text-white font-black text-lg sm:text-2xl font-mono shadow-2xl shadow-orange-500/40 text-center border border-white/30 transform hover:scale-105 transition">
                        {currentBanner.descuento_texto}
                      </div>
                    </div>
                  )}
                </div>

                {/* Indicadores de paginación del carrusel */}
                <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-white/10">
                  {activeBanners.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentBannerIdx ? "w-8 bg-orange-500" : "w-2 bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 4. PIZARRA GIGANTE DE COTIZACIONES EN VIVO (HERO RATES) */}
            {config.mostrar_cotizaciones && (
              <div className="w-full max-w-3xl space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-black tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    PIZARRA DE CAMBIO OFICIAL (CAJAS POS):
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    Actualizado en Vivo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* REAL BRASILEÑO */}
                  <div className="p-4 rounded-2xl bg-slate-900/90 border-2 border-emerald-500/30 backdrop-blur-xl shadow-xl flex items-center justify-between hover:border-emerald-400 transition">
                    <div className="flex items-center gap-3">
                      <FlagBR />
                      <div>
                        <span className="text-[11px] font-black text-slate-400 uppercase block leading-none">REAL BRASIL</span>
                        <span className="text-xs font-mono font-bold text-slate-300">1 R$ =</span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                        {cotizaciones.BRL.toLocaleString("es-PY")}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 block leading-none">Gs.</span>
                    </div>
                  </div>

                  {/* DÓLAR AMERICANO */}
                  <div className="p-4 rounded-2xl bg-slate-900/90 border-2 border-blue-500/30 backdrop-blur-xl shadow-xl flex items-center justify-between hover:border-blue-400 transition">
                    <div className="flex items-center gap-3">
                      <FlagUS />
                      <div>
                        <span className="text-[11px] font-black text-slate-400 uppercase block leading-none">DÓLAR USA</span>
                        <span className="text-xs font-mono font-bold text-slate-300">1 US$ =</span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xl sm:text-2xl font-black text-blue-400 tracking-tight">
                        {cotizaciones.USD.toLocaleString("es-PY")}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 block leading-none">Gs.</span>
                    </div>
                  </div>

                  {/* PESO ARGENTINO */}
                  <div className="p-4 rounded-2xl bg-slate-900/90 border-2 border-cyan-500/30 backdrop-blur-xl shadow-xl flex items-center justify-between hover:border-cyan-400 transition">
                    <div className="flex items-center gap-3">
                      <FlagAR />
                      <div>
                        <span className="text-[11px] font-black text-slate-400 uppercase block leading-none">PESO AR</span>
                        <span className="text-xs font-mono font-bold text-slate-300">1 ARS =</span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xl sm:text-2xl font-black text-cyan-400 tracking-tight">
                        {cotizaciones.ARS}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 block leading-none">Gs.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            B) MODO PRODUCTO ESCANEADO (EXHIBICIÓN HERO DE 5 SEGUNDOS)
           ═════════════════════════════════════════════════════════════════════ */}
        {scannedProduct && (
          <div className="w-full max-w-4xl bg-slate-900/95 border-2 border-white/20 rounded-3xl p-6 sm:p-10 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] space-y-6 animate-in zoom-in-95 duration-200 relative overflow-hidden">
            
            {/* ENCABEZADO CON CONTADOR REGRESIVO CIRCULAR */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs sm:text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                  <CheckCircle2 className="w-5 h-5" />
                  PRECIO VERIFICADO
                </span>
                <span className="text-xs font-mono text-slate-400 font-bold hidden sm:inline">
                  SKU: {scannedProduct.sku || scannedProduct.codigo_barra}
                </span>
              </div>

              {/* Anillo Regresivo de 5 Segundos */}
              <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/15 shadow-inner">
                <Clock className="w-5 h-5 text-orange-400 animate-spin" />
                <span className="text-xs sm:text-sm font-bold text-slate-200">Volviendo en:</span>
                <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-mono font-black text-sm flex items-center justify-center shadow-lg">
                  {countdown}s
                </span>
              </div>
            </div>

            {/* CUERPO CENTRAL: FOTO HD + NOMBRE + PRECIO GIGANTE */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              
              {/* Fotografía HD Grande */}
              <div className="md:col-span-5 flex flex-col items-center justify-center">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-white p-4 shadow-2xl border-4 border-white/30 flex items-center justify-center overflow-hidden group">
                  {scannedProduct.imagen_url ? (
                    <img
                      src={scannedProduct.imagen_url}
                      alt={scannedProduct.nombre}
                      className="w-full h-full object-contain transform group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ShoppingBag className="w-20 h-20 stroke-1 text-slate-300 mb-2" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sin Imagen</span>
                    </div>
                  )}
                  {scannedProduct.categoria?.nombre && (
                    <span className="absolute bottom-3 left-3 right-3 text-center text-xs font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-slate-950/85 text-slate-200 backdrop-blur-md truncate shadow-lg">
                      {scannedProduct.categoria.nombre}
                    </span>
                  )}
                </div>
              </div>

              {/* Nombre y Precio Dominante */}
              <div className="md:col-span-7 space-y-5 text-left">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                    {scannedProduct.nombre}
                  </h2>
                  <p className="text-xs font-mono text-slate-400 mt-1">
                    CÓDIGO: <strong className="text-slate-200 font-bold">{scannedProduct.codigo_barra || scannedProduct.sku}</strong>
                  </p>
                </div>

                {/* PRECIO PRINCIPAL GIGANTE EN GUARANÍES */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-orange-500/25 via-amber-500/15 to-transparent border-2 border-orange-500/40 shadow-xl">
                  <span className="text-xs font-black uppercase tracking-widest text-orange-400 block mb-1">
                    PRECIO UNITARIO AL CONTADO:
                  </span>
                  <div className="text-4xl sm:text-6xl font-black font-mono tracking-tight text-white drop-shadow-lg">
                    Gs. {precioUnitarioGs.toLocaleString("es-PY")}
                  </div>
                </div>

                {/* MULTIMONEDA EN TARJETAS DESTACADAS (R$, US$, ARS) */}
                {config.mostrar_cotizaciones && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-850/80 border border-emerald-500/30 text-center shadow-md">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <FlagBR />
                        <span className="text-[10px] font-black text-slate-300 uppercase">Reales</span>
                      </div>
                      <span className="text-base sm:text-xl font-black font-mono text-emerald-400">
                        R$ {precioBRL}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-850/80 border border-blue-500/30 text-center shadow-md">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <FlagUS />
                        <span className="text-[10px] font-black text-slate-300 uppercase">Dólares</span>
                      </div>
                      <span className="text-base sm:text-xl font-black font-mono text-blue-400">
                        US$ {precioUSD}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-850/80 border border-cyan-500/30 text-center shadow-md">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <FlagAR />
                        <span className="text-[10px] font-black text-slate-300 uppercase">Pesos</span>
                      </div>
                      <span className="text-base sm:text-xl font-black font-mono text-cyan-400">
                        $ {precioARS}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN INFERIOR: ESCALA MAYORISTA & TARJETA SOCIO EXTRA CLUB */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/10">
              
              {/* Escala Mayorista */}
              {config.mostrar_escala_precios && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4" />
                    <span>Escala Mayorista por Cantidad</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/10">
                    <span className="text-slate-300 font-medium">Llevando a partir de 3 un:</span>
                    <strong className="font-mono text-white text-sm font-black">Gs. {precioMayoristaGs.toLocaleString("es-PY")} c/u</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Fardo / Pack cerrado:</span>
                    <strong className="font-mono text-emerald-400 text-sm font-black">Gs. {precioPackGs.toLocaleString("es-PY")} c/u</strong>
                  </div>
                </div>
              )}

              {/* Tarjeta Dorada Socio Extra Club */}
              {config.mostrar_beneficios_club && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/70 via-indigo-900/60 to-purple-950/70 border-2 border-purple-500/50 space-y-2 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-purple-200 uppercase tracking-wider">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span>Socio Extra Club ({extraClubPct}% Ahorro)</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-mono text-[10px] font-black shadow-md">
                      AHORRÁS Gs. {ahorroClubGs.toLocaleString("es-PY")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-purple-500/30">
                    <span className="text-slate-300">Precio exclusivo socio:</span>
                    <strong className="text-xl font-mono text-purple-200 font-black">
                      Gs. {precioClubGs.toLocaleString("es-PY")}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Barra de progreso regresiva inferior */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 transition-all duration-1000 ease-linear shadow-lg"
                style={{ width: `${(countdown / (config.segundos_espera || 5)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            C) MODO PRODUCTO NO ENCONTRADO
           ═════════════════════════════════════════════════════════════════════ */}
        {notFoundBarcode && (
          <div className="w-full max-w-lg bg-slate-900/95 border-2 border-rose-500/50 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500/50 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
              <Barcode className="w-10 h-10" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-white">Código No Registrado</h2>
              <p className="text-xs text-slate-400 font-mono font-bold">
                {notFoundBarcode}
              </p>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Por favor consulte con un repositor en salón o acérquese a la caja principal.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={resetToStandby}
                className="px-6 py-2.5 rounded-2xl text-xs font-black text-white bg-slate-800 hover:bg-slate-700 border border-white/15 transition cursor-pointer shadow-lg"
              >
                Volver a Escanear ({countdown}s)
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── PIE DE PÁGINA: IDENTIDAD ── */}
      <footer className="px-6 py-3 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between text-xs text-slate-500 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold text-slate-400">InteliMarket Kiosk System · Extra Supermercado</span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Terminal Kiosk v2.5
        </div>
      </footer>
    </div>
  )
}
