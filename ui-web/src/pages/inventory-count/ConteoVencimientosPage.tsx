import { useState, useEffect, useRef, useCallback } from "react"
import {
  Camera, CameraOff, Loader2, Package, Check, X, Plus,
  Calendar, Hash, ImagePlus, ChevronRight, ClipboardList,
  AlertTriangle, CheckCircle2, Search, Download,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { api, type Product } from "../../api"
import { formatPYG } from "../../utils/format"

// ── App movil (Capacitor "Extra Conteo") para el salon de ventas ───────────
// Dos funciones en una sola pantalla, pedidas explicitamente asi: contar
// stock fisico y, si el producto lleva vencimiento, registrar lote + fecha.
// Reutiliza el backend de Conteo Ciclico (api.inventory.sessions.*,
// tabla supermer_count_items) que ya tenia estos campos -- no se creo
// ninguna tabla nueva, solo esta pantalla mobile-first.

interface AreaPreset { key: string; label: string }
const AREAS: AreaPreset[] = [
  { key: "salon_general", label: "Salón general" },
  { key: "almacen", label: "Almacén / secos" },
  { key: "lacteos", label: "Lácteos y fiambres" },
  { key: "bebidas", label: "Bebidas" },
  { key: "limpieza", label: "Limpieza / perfumería" },
  { key: "panaderia", label: "Panadería" },
]

interface CountSession {
  id: string
  codigo: string
  area: string
  ubicacion?: string | null
  estado: string
  total_items_contados: number
  total_discrepancias: number
}

interface CountedItem {
  id: string
  producto_id: string
  producto_nombre?: string
  cantidad_sistema: number
  cantidad_contada?: number | null
  diferencia?: number | null
  lote?: string | null
  fecha_vencimiento?: string | null
  foto_evidencia_url?: string | null
}

export default function ConteoVencimientosPage() {
  const { user } = useAuth()
  const toast = useToast()

  // ── Sesion activa ──
  const [session, setSession] = useState<CountSession | null>(null)
  const [openSessions, setOpenSessions] = useState<CountSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [selectedArea, setSelectedArea] = useState(AREAS[0].key)
  const [ubicacion, setUbicacion] = useState("")
  const [startingSession, setStartingSession] = useState(false)

  // ── Items ya contados en esta sesion ──
  const [items, setItems] = useState<CountedItem[]>([])

  // ── Camara / escaneo ──
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanLoopRef = useRef<number | null>(null)
  const isProcessing = useRef(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState("")
  const [searching, setSearching] = useState(false)

  // ── Producto identificado, a la espera de guardar el conteo ──
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [cantidadSistema, setCantidadSistema] = useState<number>(0)
  const [cantidadContada, setCantidadContada] = useState("")
  const [tieneVencimiento, setTieneVencimiento] = useState(false)
  const [lote, setLote] = useState("")
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Cargar sesiones abiertas al entrar ──
  useEffect(() => {
    let cancelled = false
    setLoadingSessions(true)
    api.inventory.sessions
      .list({ estado: "abierta" })
      .then((list) => {
        if (cancelled) return
        setOpenSessions((Array.isArray(list) ? list : []) as CountSession[])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSessions(false) })
    return () => { cancelled = true }
  }, [])

  // ── Refrescar items de la sesion activa ──
  const refreshItems = useCallback(async (sessionId: string) => {
    try {
      const list = await api.inventory.sessions.items.list(sessionId)
      setItems((Array.isArray(list) ? list : []) as CountedItem[])
    } catch {}
  }, [])

  const startSession = async () => {
    setStartingSession(true)
    try {
      const codigo = `SAL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const areaLabel = AREAS.find((a) => a.key === selectedArea)?.label || selectedArea
      const created = await api.inventory.sessions.create({
        codigo,
        area: areaLabel,
        ubicacion: ubicacion.trim() || undefined,
        tipo: "salon",
        contador_principal: user?.id,
      })
      setSession(created as CountSession)
      setItems([])
      toast.success("Sesión iniciada", `Conteo ${codigo} en ${areaLabel}.`)
    } catch (e: any) {
      toast.error("No se pudo iniciar", e?.message || "Reintentá en un momento.")
    } finally {
      setStartingSession(false)
    }
  }

  const resumeSession = async (s: CountSession) => {
    setSession(s)
    await refreshItems(s.id)
  }

  // ── Buscar producto por codigo (local + servidor, igual que POS/Salon) ──
  const lookupProduct = useCallback(async (raw: string) => {
    const code = raw.trim()
    if (!code) return
    setSearching(true)
    try {
      const res = await api.products.list({ search: code, limit: 5 })
      const found = (res || []).find((p) => p.codigo_barra === code || p.sku === code) || (res || [])[0]
      if (!found) {
        toast.warning("Producto no encontrado", `Código '${code}' no está en el catálogo.`)
        return
      }
      setScannedProduct(found)
      setCantidadContada("")
      setLote("")
      setFechaVencimiento("")
      setTieneVencimiento(false)
      setFotoFile(null)
      setFotoPreview(null)
      try {
        const stock = await api.inventory.getProductStock(found.id)
        setCantidadSistema(Number((stock as any)?.cantidad_disponible ?? 0))
      } catch {
        setCantidadSistema(0)
      }
      if (navigator.vibrate) navigator.vibrate(50)
    } catch (e: any) {
      toast.error("Error al buscar", e?.message || "No se pudo consultar el producto.")
    } finally {
      setSearching(false)
    }
  }, [toast])

  // ── Camara con BarcodeDetector nativo (mismo patron que el Hub de Salon) ──
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    scanLoopRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)

      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "upc_a", "code_39"],
        })
        let lastCode = ""
        const loop = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            scanLoopRef.current = requestAnimationFrame(loop)
            return
          }
          if (!isProcessing.current) {
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0 && codes[0].rawValue && codes[0].rawValue !== lastCode) {
                lastCode = codes[0].rawValue
                isProcessing.current = true
                await lookupProduct(codes[0].rawValue)
                setTimeout(() => { isProcessing.current = false }, 1800)
              }
            } catch {}
          }
          scanLoopRef.current = requestAnimationFrame(loop)
        }
        scanLoopRef.current = requestAnimationFrame(loop)
      } else {
        toast.info("Escaneo visual no disponible", "Este navegador no tiene lector de código nativo. Usá la búsqueda manual.")
      }
    } catch (err: any) {
      setCameraActive(false)
      const name = err?.name || ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Permiso de cámara denegado. Habilitalo en los ajustes de la app.")
      } else if (location.protocol !== "https:" && location.hostname !== "localhost") {
        setCameraError("La cámara requiere una conexión segura (HTTPS). Contactá a soporte.")
      } else {
        setCameraError(err?.message || "No se pudo iniciar la cámara. Probá con búsqueda manual.")
      }
    }
  }, [lookupProduct, toast])

  useEffect(() => () => stopCamera(), [stopCamera])

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFotoFile(f)
    setFotoPreview(URL.createObjectURL(f))
  }

  const cancelScanned = () => {
    setScannedProduct(null)
    setCantidadContada("")
    setLote("")
    setFechaVencimiento("")
    setTieneVencimiento(false)
    setFotoFile(null)
    setFotoPreview(null)
  }

  const saveCount = async () => {
    if (!session || !scannedProduct) return
    const cantidad = parseFloat(cantidadContada.replace(",", "."))
    if (isNaN(cantidad) || cantidad < 0) {
      toast.warning("Cantidad inválida", "Ingresá la cantidad contada.")
      return
    }
    if (tieneVencimiento && !fechaVencimiento) {
      toast.warning("Falta la fecha", "Marcaste que tiene vencimiento: ingresá la fecha.")
      return
    }
    setSaving(true)
    try {
      let fotoUrl: string | undefined
      if (fotoFile) {
        const up = await api.inventory.uploadEvidenciaConteo(fotoFile)
        fotoUrl = up.url
      }
      await api.inventory.sessions.items.create(session.id, {
        producto_id: scannedProduct.id,
        codigo_barra: scannedProduct.codigo_barra || undefined,
        cantidad_sistema: cantidadSistema,
        cantidad_contada: cantidad,
        lote: tieneVencimiento && lote.trim() ? lote.trim() : undefined,
        fecha_vencimiento: tieneVencimiento ? fechaVencimiento : undefined,
        foto_evidencia_url: fotoUrl,
      })
      toast.success("Registrado", `${scannedProduct.nombre}: ${cantidad} contadas.`)
      cancelScanned()
      refreshItems(session.id)
    } catch (e: any) {
      toast.error("No se pudo guardar", e?.message || "Reintentá en un momento.")
    } finally {
      setSaving(false)
    }
  }

  const finishSession = async () => {
    if (!session) return
    if (!confirm(`¿Cerrar el conteo ${session.codigo}? Las diferencias quedarán a revisión de un supervisor.`)) return
    try {
      await api.inventory.sessions.complete(session.id)
      toast.success("Conteo cerrado", "Las diferencias quedaron a revisión.")
      stopCamera()
      setSession(null)
      setScannedProduct(null)
    } catch (e: any) {
      toast.error("No se pudo cerrar", e?.message || "Reintentá en un momento.")
    }
  }

  // ═══════════════════════════════ UI ═══════════════════════════════

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <div className="p-4 pt-6 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-cyan-400" />
              <h1 className="text-lg font-black">Conteo & Vencimientos</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">Extra Salón — recorré la góndola, contá y registrá vencimientos.</p>
          </div>
          <a
            href="/download/extra-conteo.apk"
            download="extra-conteo.apk"
            title="Descargar APK Nativo Android Extra Conteo"
            className="px-2.5 py-1.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/25 active:scale-95 transition cursor-pointer flex items-center gap-1.5 text-xs font-black shadow-sm shrink-0"
          >
            <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">DESCARGAR APK</span>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loadingSessions ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
          ) : openSessions.length > 0 ? (
            <div>
              <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Sesiones abiertas — retomar</p>
              <div className="space-y-2">
                {openSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => resumeSession(s)}
                    className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-left active:scale-[0.98] transition"
                  >
                    <div>
                      <div className="font-bold text-sm">{s.area}</div>
                      <div className="text-xs text-slate-400">{s.codigo} · {s.total_items_contados} contados</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Nueva sesión</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {AREAS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setSelectedArea(a.key)}
                  className={`px-3 py-3 rounded-xl text-sm font-bold border transition ${
                    selectedArea === a.key
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-300"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ubicación puntual (opcional) — ej: pasillo 4, góndola derecha"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={startSession}
            disabled={startingSession}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl py-4 font-black text-sm flex items-center justify-center gap-2"
          >
            {startingSession ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Iniciar conteo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="font-bold text-sm">{session.area}</div>
          <div className="text-[11px] text-slate-400">{session.codigo} · {items.length} contados</div>
        </div>
        <button
          onClick={finishSession}
          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2 flex items-center gap-1"
        >
          <CheckCircle2 className="w-4 h-4" /> Finalizar
        </button>
      </div>

      {!scannedProduct ? (
        <div className="flex-1 flex flex-col">
          <div className="relative bg-black aspect-square max-h-[50vh]">
            {cameraActive ? (
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                <Camera className="w-10 h-10" />
                <button
                  onClick={startCamera}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg"
                >
                  Activar cámara
                </button>
                {cameraError && <p className="text-xs text-amber-400 max-w-[80%] text-center">{cameraError}</p>}
              </div>
            )}
            {cameraActive && (
              <button
                onClick={stopCamera}
                className="absolute top-3 right-3 bg-black/60 rounded-full p-2"
              >
                <CameraOff className="w-5 h-5" />
              </button>
            )}
            {searching && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
          </div>

          <div className="p-4 space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); lookupProduct(manualCode); setManualCode("") }} className="relative">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Código de barra o SKU manual"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-blue-500"
              />
              <button type="submit" className="absolute right-2 top-2 bottom-2 px-2 text-slate-400">
                <Search className="w-5 h-5" />
              </button>
            </form>

            {items.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Contados en esta sesión</p>
                <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                  {items.slice().reverse().map((it) => (
                    <div key={it.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{it.producto_nombre}</div>
                        <div className="text-slate-500">
                          Sistema {it.cantidad_sistema} · Contado {it.cantidad_contada}
                          {it.fecha_vencimiento ? ` · Vence ${it.fecha_vencimiento}` : ""}
                        </div>
                      </div>
                      {!!it.diferencia && Math.abs(it.diferencia) > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3">
            <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              {scannedProduct.imagen_url ? (
                <img src={scannedProduct.imagen_url} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-7 h-7 text-slate-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{scannedProduct.nombre}</div>
              <div className="text-xs text-slate-400">{scannedProduct.sku} · {formatPYG(scannedProduct.precio_venta || 0)}</div>
              <div className="text-xs text-blue-400 mt-1">Sistema: {cantidadSistema} unidades</div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">Cantidad contada</label>
            <input
              type="number"
              inputMode="decimal"
              value={cantidadContada}
              onChange={(e) => setCantidadContada(e.target.value)}
              autoFocus
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => setTieneVencimiento((v) => !v)}
            className={`w-full flex items-center gap-2 rounded-xl px-4 py-3 border text-sm font-bold transition ${
              tieneVencimiento ? "bg-amber-600/20 border-amber-600 text-amber-300" : "bg-slate-900 border-slate-800 text-slate-300"
            }`}
          >
            <Calendar className="w-4 h-4" />
            {tieneVencimiento ? "Lleva vencimiento — registrando lote y fecha" : "¿Tiene fecha de vencimiento?"}
          </button>

          {tieneVencimiento && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block flex items-center gap-1"><Hash className="w-3 h-3" /> Lote</label>
                <input
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block">Vencimiento</label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="w-full flex items-center gap-2 bg-slate-900 border border-slate-800 border-dashed rounded-xl px-4 py-3 text-sm text-slate-300 cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              {fotoPreview ? "Foto lista — tocá para cambiarla" : "Sacar foto de respaldo (opcional)"}
              <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" />
            </label>
            {fotoPreview && (
              <img src={fotoPreview} className="mt-2 w-full max-h-40 object-contain rounded-xl border border-slate-800" />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={cancelScanned}
              className="flex-1 bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-1"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              onClick={saveCount}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-1"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
