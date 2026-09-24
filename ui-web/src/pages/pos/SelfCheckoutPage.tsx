import { useState, useEffect, useRef, useCallback } from "react"
import { api } from "../../api"
import {
  Scan, ShoppingBag, CreditCard, QrCode, X, ChevronRight,
  CheckCircle, RefreshCw, ShieldAlert, Trash2, Plus, Minus,
  Wifi, WifiOff, Volume2, VolumeX, Sun, Moon, Package,
  Banknote, Smartphone, ArrowLeft, Clock, Star, Gift, Zap
} from "lucide-react"
import { formatPYG } from "../../utils/format"
import { roundPY } from "../../utils/posUtils"
import { useToast } from "../../context/ToastContext"
import { useTheme } from "../../context/ThemeContext"

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS & CONSTANTES
═══════════════════════════════════════════════════════════════════════════ */
interface CartItem {
  id: string
  nombre: string
  precio: number
  quantity: number
  weightKg: number
  categoria?: string
  ean?: string
}

type Step = "welcome" | "scanning" | "bagging_wait" | "payment" | "success"
type PayMethod = "cash" | "card" | "qr" | "extraclub" | null

const RATES = { BRL: 250, USD: 7550 }

const MOCK_ITEMS = [
  { id: "p1", nombre: "Leche Entera UHT 1L", precio: 6500, barcode: "7891234567890", weight: 1.0, categoria: "LÁCTEOS" },
  { id: "p2", nombre: "Pan Felipe Bolsa 500g", precio: 5000, barcode: "7891234567891", weight: 0.5, categoria: "PANADERÍA" },
  { id: "p3", nombre: "Queso Paraguay Kg", precio: 38000, barcode: "7891234567892", weight: 1.2, categoria: "LÁCTEOS" },
  { id: "p4", nombre: "Yerba Mate Clásica 500g", precio: 12000, barcode: "7891234567893", weight: 0.5, categoria: "BEBIDAS" },
  { id: "p5", nombre: "Gaseosa Cola 2L", precio: 9000, barcode: "7891234567894", weight: 2.1, categoria: "BEBIDAS" },
  { id: "p6", nombre: "Aceite Vegetal 900ml", precio: 14500, barcode: "7891234567895", weight: 0.9, categoria: "ACEITES" },
  { id: "p7", nombre: "Arroz Largo Fino 1kg", precio: 7200, barcode: "7891234567896", weight: 1.0, categoria: "GRANOS" },
]

/* ═══════════════════════════════════════════════════════════════════════════
   UTILIDADES FORMATO
═══════════════════════════════════════════════════════════════════════════ */
function fmtPyg(v: number) {
  return "₲ " + Math.round(v).toLocaleString("es-PY")
}
function fmtBrl(v: number) {
  return "R$ " + v.toFixed(2).replace(".", ",")
}
function fmtUsd(v: number) {
  return "USD " + v.toFixed(2)
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════════════════ */
export default function SelfCheckoutPage() {
  const { dark } = useTheme()
  const toast = useToast()
  const barcodeRef = useRef<HTMLInputElement>(null)
  const cashPygRef = useRef<HTMLInputElement>(null)
  const cashBrlRef = useRef<HTMLInputElement>(null)
  const cashUsdRef = useRef<HTMLInputElement>(null)

  // ── CARRITO & FLUJO ─────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcode, setBarcode] = useState("")
  const [step, setStep] = useState<Step>("welcome")
  const [idleTimer, setIdleTimer] = useState(60)
  const [soundOn, setSoundOn] = useState(true)

  // ── BALANZA USB ANTI-FRAUDE ──────────────────────────────────────────────
  const [scaleWeight, setScaleWeight] = useState(0)
  const [expectedWeight, setExpectedWeight] = useState(0)
  const [usbPort, setUsbPort] = useState<any>(null)
  const [usbConnected, setUsbConnected] = useState(false)

  // ── SUPERVISOR LOCK ──────────────────────────────────────────────────────
  const [isLocked, setIsLocked] = useState(false)
  const [supervisorEmail, setSupervisorEmail] = useState("")
  const [supervisorPassword, setSupervisorPassword] = useState("")
  const [verifyingSupervisor, setVerifyingSupervisor] = useState(false)

  // ── PAGO ─────────────────────────────────────────────────────────────────
  const [payMethod, setPayMethod] = useState<PayMethod>(null)
  const [cashPygStr, setCashPygStr] = useState("")
  const [cashBrlStr, setCashBrlStr] = useState("")
  const [cashUsdStr, setCashUsdStr] = useState("")
  const [qrCountdown, setQrCountdown] = useState(60)
  const [showQr, setShowQr] = useState(false)
  const [extraclubRut, setExtraclubRut] = useState("")
  const [extraclubPoints, setExtraclubPoints] = useState<number | null>(null)

  // ── COMPROBANTE ───────────────────────────────────────────────────────────
  const [puntoEmision] = useState("001-005")
  const [tipoComprobante, setTipoComprobante] = useState<"factura_autoimpresa" | "ticket_caja">("factura_autoimpresa")
  const [timbradoNumero] = useState("18545636")
  const [numeroFactura, setNumeroFactura] = useState("")
  const [extraclubLookup, setExtraclubLookup] = useState(false)

  /* ── TOTALES ─────────────────────────────────────────────────────────── */
  const subtotal = cart.reduce((s, i) => s + i.precio * i.quantity, 0)
  const total = roundPY(subtotal)
  const totalBrl = total / RATES.BRL
  const totalUsd = total / RATES.USD

  const cashPyg = parseInt(cashPygStr.replace(/\D/g, "") || "0")
  const cashBrl = parseFloat(cashBrlStr.replace(",", ".") || "0")
  const cashUsd = parseFloat(cashUsdStr.replace(",", ".") || "0")
  const totalPaid = cashPyg + Math.round(cashBrl * RATES.BRL) + Math.round(cashUsd * RATES.USD)
  const remainPyg = Math.max(0, total - totalPaid)
  const remainBrl = remainPyg / RATES.BRL
  const remainUsd = remainPyg / RATES.USD
  const vuelto = Math.max(0, totalPaid - total)
  const vueltoBrl = vuelto / RATES.BRL
  const vueltoUsd = vuelto / RATES.USD

  /* ── AUDIO ────────────────────────────────────────────────────────────── */
  const playBeep = useCallback((type: "scan" | "error" | "success" = "scan") => {
    if (!soundOn) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = "sine"
      const freqs = { scan: 880, error: 300, success: [660, 880, 1100] }
      if (type === "success") {
        const f = freqs.success
        f.forEach((freq, i) => {
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
        })
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        osc.start(); setTimeout(() => { osc.stop(); ctx.close() }, 500)
      } else {
        osc.frequency.setValueAtTime(freqs[type], ctx.currentTime)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        osc.start(); setTimeout(() => { osc.stop(); ctx.close() }, type === "error" ? 300 : 120)
      }
    } catch { /* blocked */ }
  }, [soundOn])

  /* ── IDLE RESET (pantalla de bienvenida) ─────────────────────────────── */
  useEffect(() => {
    if (step !== "welcome") return
    const t = setInterval(() => setIdleTimer(p => {
      if (p <= 1) { clearInterval(t); return 60 }
      return p - 1
    }), 1000)
    return () => clearInterval(t)
  }, [step])

  /* ── WEB SERIAL BALANZA BCK30 ────────────────────────────────────────── */
  const connectUsb = async () => {
    if (!("serial" in navigator)) { toast.error("No soportado", "Web Serial API no disponible"); return }
    try {
      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" })
      setUsbPort(port)
      setUsbConnected(true)
      toast.success("Balanza conectada", "Balmak BCK30 activa en el área de bolsas")
      const reader = port.readable.getReader()
      let buf = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += new TextDecoder().decode(value)
        if (buf.includes("\r") || buf.includes("\n")) {
          const line = buf.trim()
          buf = ""
          const m = line.match(/(\d+\.\d{3})/)
          if (m) setScaleWeight(parseFloat(m[1]))
        }
      }
    } catch (e: any) {
      if (e?.name !== "NotFoundError") toast.error("Error USB", e?.message || "No se pudo conectar")
      setUsbConnected(false)
    }
  }

  /* ── WEIGHT LOCK DETECTOR ────────────────────────────────────────────── */
  useEffect(() => {
    if (step === "scanning" && cart.length > 0 && usbConnected) {
      if (Math.abs(scaleWeight - expectedWeight) > 0.08) {
        setIsLocked(true)
        playBeep("error")
      }
    }
  }, [scaleWeight, expectedWeight, step, cart, usbConnected])

  /* ── QR COUNTDOWN ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!showQr) return
    if (qrCountdown <= 0) { setShowQr(false); setPayMethod(null); return }
    const t = setInterval(() => setQrCountdown(p => p - 1), 1000)
    return () => clearInterval(t)
  }, [showQr, qrCountdown])

  /* ── ESCANEO DE CÓDIGO ───────────────────────────────────────────────── */
  const handleScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const code = barcode.trim()
    if (!code) return
    const match = MOCK_ITEMS.find(i => i.barcode === code || i.nombre.toLowerCase().includes(code.toLowerCase()))
    if (!match) {
      playBeep("error")
      toast.error("Código no reconocido", "Intente nuevamente o solicite asistencia")
      setBarcode(""); return
    }
    playBeep("scan")
    const existing = cart.find(i => i.id === match.id)
    setExpectedWeight(p => Number((p + match.weight).toFixed(3)))
    if (existing) {
      setCart(cart.map(i => i.id === match.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setCart(c => [...c, { id: match.id, nombre: match.nombre, precio: match.precio, quantity: 1, weightKg: match.weight, categoria: match.categoria, ean: match.barcode }])
    }
    setBarcode("")
    setStep("bagging_wait")
    setTimeout(() => {
      setScaleWeight(p => Number((p + match.weight).toFixed(3)))
      setStep("scanning")
      barcodeRef.current?.focus()
    }, 1500)
  }

  const removeItem = (id: string) => {
    const item = cart.find(i => i.id === id)
    if (item) setExpectedWeight(p => Math.max(0, Number((p - item.weightKg * item.quantity).toFixed(3))))
    setCart(c => c.filter(i => i.id !== id))
  }

  /* ── CAMBIO CANTIDAD ─────────────────────────────────────────────────── */
  const changeQty = (id: string, delta: number) => {
    const item = cart.find(i => i.id === id)
    if (!item) return
    const newQty = item.quantity + delta
    if (newQty <= 0) { removeItem(id); return }
    setExpectedWeight(p => Number((p + delta * item.weightKg).toFixed(3)))
    setCart(c => c.map(i => i.id === id ? { ...i, quantity: newQty } : i))
  }

  /* ── SUPERVISOR UNLOCK ───────────────────────────────────────────────── */
  const handleSupervisor = async () => {
    if (!supervisorEmail || !supervisorPassword) return
    setVerifyingSupervisor(true)
    try {
      const result = await api.auth.verifySupervisor({ email: supervisorEmail, password: supervisorPassword })
      if (result.valid) {
        setIsLocked(false)
        setExpectedWeight(scaleWeight)
        setSupervisorEmail(""); setSupervisorPassword("")
        toast.success("Autorizado", "Bolsa validada por " + (result.nombre || "supervisor"))
      } else {
        playBeep("error")
        toast.error("Credenciales inválidas", "Usuario o contraseña incorrectos")
        setSupervisorPassword("")
      }
    } catch {
      toast.error("Error de conexión", "No se pudo verificar al supervisor")
    } finally { setVerifyingSupervisor(false) }
  }

  /* ── PAGO EN EFECTIVO - Enter inteligente ─────────────────────────────── */
  const handleEnterPyg = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    const paid = parseInt(cashPygStr.replace(/\D/g, "") || "0")
    const rem = total - paid
    if (paid >= total) { confirmSale(); return }
    // saldo en reales
    const brlStr = (rem / RATES.BRL).toFixed(2)
    setCashBrlStr(brlStr)
    setTimeout(() => { cashBrlRef.current?.focus(); cashBrlRef.current?.select() }, 80)
  }

  const handleEnterBrl = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    const pygPaid = parseInt(cashPygStr.replace(/\D/g, "") || "0")
    const brlPaid = parseFloat(cashBrlStr.replace(",", ".") || "0")
    const totalNow = pygPaid + Math.round(brlPaid * RATES.BRL)
    if (totalNow >= total) { confirmSale(); return }
    const rem = total - totalNow
    const usdStr = (rem / RATES.USD).toFixed(2)
    setCashUsdStr(usdStr)
    setTimeout(() => { cashUsdRef.current?.focus(); cashUsdRef.current?.select() }, 80)
  }

  const handleEnterUsd = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    confirmSale()
  }

  /* ── CONFIRMAR VENTA ─────────────────────────────────────────────────── */
  const confirmSale = () => {
    playBeep("success")
    const num = `${puntoEmision}-${String(Date.now()).slice(-6)}`
    setNumeroFactura(num)
    setStep("success")
    setTimeout(() => {
      setCart([]); setScaleWeight(0); setExpectedWeight(0)
      setCashPygStr(""); setCashBrlStr(""); setCashUsdStr("")
      setPayMethod(null); setShowQr(false); setQrCountdown(60)
      setExtraclubRut(""); setExtraclubPoints(null)
      setStep("welcome"); setIdleTimer(60)
    }, 6000)
  }

  const lookupExtraclub = async () => {
    if (!extraclubRut) return
    setExtraclubLookup(true)
    try {
      // Buscar cliente por RUC/CI via search
      const customers = await api.customers.list({ search: extraclubRut })
      const customer = Array.isArray(customers) ? customers[0] : null
      if (customer?.id) {
        const res = await api.loyalty.balance(customer.id, (customer as any).company_id || "")
        const pts = res?.total_puntos ?? 0
        setExtraclubPoints(pts)
        toast.success("Extra Club", `Hola ${(customer as any).nombre || "cliente"}! Tenés ${pts} puntos.`)
      } else {
        setExtraclubPoints(0)
        toast.error("No encontrado", "No se encontró socio con ese RUC/CI")
      }
    } catch {
      setExtraclubPoints(0)
    } finally { setExtraclubLookup(false) }
  }

  /* ── FORMATEO GUARANÍES al tipear ────────────────────────────────────── */
  const handlePygInput = (v: string) => {
    const digits = v.replace(/\D/g, "")
    if (!digits) { setCashPygStr(""); return }
    const n = parseInt(digits)
    setCashPygStr(n.toLocaleString("es-PY"))
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TOKENS DE TEMA
  ═══════════════════════════════════════════════════════════════════════ */
  const T = {
    bg: dark ? "#0f172a" : "#f1f5f9",
    bgCard: dark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
    bgCardSolid: dark ? "#1e293b" : "#ffffff",
    bgInput: dark ? "#020617" : "#f8fafc",
    border: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    borderStrong: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
    text: dark ? "#f8fafc" : "#0f172a",
    textMuted: dark ? "#94a3b8" : "#64748b",
    textSubtle: dark ? "#475569" : "#94a3b8",
    surface: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
    surfaceHover: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    green: "#10b981",
    greenBg: dark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
    blue: "#3b82f6",
    blueBg: dark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)",
    amber: "#f59e0b",
    red: "#ef4444",
    redBg: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
    purple: "#8b5cf6",
    purpleBg: dark ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.08)",
    glow1: dark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.04)",
    glow2: dark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)",
    shadow: dark ? "0 25px 50px rgba(0,0,0,0.6)" : "0 25px 50px rgba(0,0,0,0.12)",
    shadowCard: dark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)",
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: dark ? `radial-gradient(ellipse at top left, #0f172a 0%, #020617 100%)` : `radial-gradient(ellipse at top left, #e0f2fe 0%, #f1f5f9 100%)`, fontFamily: "'Inter', system-ui, sans-serif", color: T.text, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* GLOWS */}
      <div style={{ position: "absolute", top: "-15%", left: "-10%", width: "50%", height: "50%", background: `radial-gradient(circle, ${T.glow1} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: "60%", height: "60%", background: `radial-gradient(circle, ${T.glow2} 0%, transparent 70%)`, pointerEvents: "none" }} />

      {/* ── SUPERVISOR LOCK OVERLAY ─────────────────────────────────────── */}
      {isLocked && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: dark ? "rgba(2,6,23,0.95)" : "rgba(15,23,42,0.85)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: T.bgCard, border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 32, padding: 48, maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 25px 60px rgba(239,68,68,0.15)", display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ width: 88, height: 88, borderRadius: "50%", background: T.redBg, border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", animation: "pulse 2s infinite" }}>
              <ShieldAlert style={{ width: 44, height: 44, color: "#ef4444" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.5px", color: "#ef4444" }}>CAJA BLOQUEADA</h2>
              <p style={{ color: T.textMuted, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>Diferencia de peso detectada en el área de bolsas.<br />Aguarde al asistente de tienda para continuar.</p>
            </div>
            <div style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.textSubtle, textTransform: "uppercase", letterSpacing: 1.5 }}>Desbloqueo de Supervisor</p>
              <input type="email" value={supervisorEmail} onChange={e => setSupervisorEmail(e.target.value)} placeholder="Email del supervisor" style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, padding: 14, outline: "none", fontSize: 14, textAlign: "center", width: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={supervisorPassword} onChange={e => setSupervisorPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSupervisor()} placeholder="Contraseña" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, padding: 14, outline: "none", fontSize: 14, textAlign: "center" }} />
                <button onClick={handleSupervisor} disabled={verifyingSupervisor} style={{ background: "#ef4444", border: "none", color: "white", borderRadius: 12, padding: "0 24px", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: verifyingSupervisor ? 0.6 : 1, whiteSpace: "nowrap" }}>
                  {verifyingSupervisor ? "..." : "Validar"}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: T.textSubtle }}>Código de caja: <b style={{ color: T.text, fontFamily: "monospace" }}>SCO-{puntoEmision}</b></p>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header style={{ padding: "16px 32px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: dark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(16,185,129,0.35)" }}>
            <ShoppingBag style={{ width: 22, height: 22, color: "white" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.5px" }}>AUTO-PAGO</h1>
            <p style={{ fontSize: 9, color: T.green, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" }}>Caja de Autogestión • {puntoEmision}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* USB Status */}
          <button onClick={connectUsb} title="Conectar Balanza USB Balmak BCK30" style={{ display: "flex", alignItems: "center", gap: 6, background: usbConnected ? T.greenBg : T.surface, border: `1px solid ${usbConnected ? "rgba(16,185,129,0.3)" : T.border}`, borderRadius: 10, padding: "6px 12px", cursor: "pointer", color: usbConnected ? T.green : T.textMuted, fontSize: 11, fontWeight: 700 }}>
            {usbConnected ? <Wifi style={{ width: 13, height: 13 }} /> : <WifiOff style={{ width: 13, height: 13 }} />}
            {usbConnected ? `${scaleWeight.toFixed(3)} kg` : "USB"}
          </button>

          {/* Sound */}
          <button onClick={() => setSoundOn(p => !p)} style={{ width: 36, height: 36, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textMuted }}>
            {soundOn ? <Volume2 style={{ width: 15, height: 15 }} /> : <VolumeX style={{ width: 15, height: 15 }} />}
          </button>

          {/* Timbrado */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.greenBg, border: `1px solid rgba(16,185,129,0.2)`, borderRadius: 10, padding: "6px 12px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: "0 0 6px rgba(16,185,129,0.8)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: T.green }}>DNIT {timbradoNumero}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 20, maxWidth: 720, margin: "0 auto", width: "100%" }}>

        {/* ════════════════ STEP: BIENVENIDA ════════════════ */}
        {step === "welcome" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: "24px 0" }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 140, height: 140, borderRadius: "50%", background: T.greenBg, border: `3px solid rgba(16,185,129,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 60px rgba(16,185,129,0.15)" }}>
                <ShoppingBag style={{ width: 64, height: 64, color: T.green }} />
              </div>
              <div style={{ position: "absolute", bottom: 4, right: 4, width: 36, height: 36, borderRadius: "50%", background: T.blue, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(59,130,246,0.4)" }}>
                <Scan style={{ width: 18, height: 18, color: "white" }} />
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-1px", marginBottom: 8 }}>¡Bienvenido!</h2>
              <p style={{ color: T.textMuted, fontSize: 16, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>Toque la pantalla o escanee el primer artículo para comenzar su compra en la caja de autogestión.</p>
            </div>

            <button onClick={() => { setStep("scanning"); setTimeout(() => barcodeRef.current?.focus(), 200) }} style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", borderRadius: 20, padding: "20px 48px", fontSize: 20, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 30px rgba(16,185,129,0.35)", display: "flex", alignItems: "center", gap: 12, transition: "transform 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              <Scan style={{ width: 24, height: 24 }} />
              COMENZAR COMPRA
            </button>

            {/* Idle timer */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.textSubtle, fontSize: 12 }}>
              <Clock style={{ width: 14, height: 14 }} />
              <span>Pantalla disponible · reiniciando en <b style={{ color: T.amber }}>{idleTimer}s</b></span>
            </div>
          </div>
        )}

        {/* ════════════════ STEP: ESCANEO ════════════════ */}
        {step === "scanning" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Scanner input */}
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 24, padding: 20, backdropFilter: "blur(12px)" }}>
              <form onSubmit={handleScan} style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: T.bgInput, border: `2px solid ${T.green}`, borderRadius: 14, padding: "12px 16px" }}>
                  <Scan style={{ width: 18, height: 18, color: T.green, flexShrink: 0 }} />
                  <input
                    ref={barcodeRef}
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    placeholder="Escanee código de barras o EAN..."
                    autoFocus
                    style={{ flex: 1, background: "none", border: "none", color: T.text, outline: "none", fontSize: 15, fontWeight: 500 }}
                  />
                </div>
                <button type="submit" style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "white", borderRadius: 14, padding: "0 22px", fontWeight: 800, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
                  OK
                </button>
              </form>

              {/* Quick demo items */}
              <div style={{ marginTop: 14 }}>
                <p style={{ color: T.textSubtle, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Atajos de demostración</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {MOCK_ITEMS.map(i => (
                    <button key={i.id} onClick={() => { setBarcode(i.barcode); setTimeout(() => handleScan(), 50) }}
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.color = T.text }}
                      onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.color = T.textMuted }}>
                      {i.nombre.split(" ").slice(0, 2).join(" ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 24, padding: 20, backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1.5 }}>Carrito · {cart.reduce((s, i) => s + i.quantity, 0)} artículo{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}</p>
                  {usbConnected && <p style={{ fontSize: 11, color: T.textMuted }}>{scaleWeight.toFixed(3)} kg / {expectedWeight.toFixed(3)} kg esperado</p>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, background: T.surface, borderRadius: 14, padding: "10px 14px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.greenBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Package style={{ width: 17, height: 17, color: T.green }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</p>
                        <p style={{ color: T.textMuted, fontSize: 11 }}>{item.categoria} · {fmtPyg(item.precio)} c/u</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => changeQty(item.id, -1)} style={{ width: 26, height: 26, borderRadius: 7, background: T.surface, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus style={{ width: 12, height: 12 }} /></button>
                        <span style={{ fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                        <button onClick={() => changeQty(item.id, 1)} style={{ width: 26, height: 26, borderRadius: 7, background: T.greenBg, border: `1px solid rgba(16,185,129,0.3)`, color: T.green, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus style={{ width: 12, height: 12 }} /></button>
                      </div>
                      <p style={{ fontWeight: 800, fontSize: 13, minWidth: 72, textAlign: "right", color: T.green }}>{fmtPyg(item.precio * item.quantity)}</p>
                      <button onClick={() => removeItem(item.id)} style={{ width: 28, height: 28, borderRadius: 8, background: T.redBg, border: "none", color: T.red, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 style={{ width: 13, height: 13 }} /></button>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>TOTAL A PAGAR</p>
                    <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-1px" }}>{fmtPyg(total)}</p>
                    <p style={{ fontSize: 11, color: T.textMuted }}>{fmtBrl(totalBrl)} · {fmtUsd(totalUsd)}</p>
                  </div>
                  <button onClick={() => setStep("payment")} style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", borderRadius: 18, padding: "16px 28px", fontSize: 16, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 6px 24px rgba(16,185,129,0.35)" }}>
                    IR A PAGAR <ChevronRight style={{ width: 20, height: 20 }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ STEP: BOLSA WAIT ════════════════ */}
        {step === "bagging_wait" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "32px 0" }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "rgba(245,158,11,0.12)", border: "2px solid #f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw style={{ width: 44, height: 44, color: "#f59e0b", animation: "spin 1.5s linear infinite" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 900 }}>Coloque el artículo en la bolsa</h3>
              <p style={{ color: T.textMuted, fontSize: 14, marginTop: 8 }}>Aguardando verificación de peso en el área de bolsas...</p>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
          </div>
        )}

        {/* ════════════════ STEP: PAGO ════════════════ */}
        {step === "payment" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Resumen */}
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 24, padding: 20, backdropFilter: "blur(12px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Total · {cart.reduce((s, i) => s + i.quantity, 0)} artículo{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}</p>
                <p style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-1.5px" }}>{fmtPyg(total)}</p>
                <p style={{ fontSize: 12, color: T.textMuted }}>{fmtBrl(totalBrl)} · {fmtUsd(totalUsd)}</p>
              </div>
              <button onClick={() => setStep("scanning")} style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 16px", color: T.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <ArrowLeft style={{ width: 14, height: 14 }} /> Volver
              </button>
            </div>

            {/* Tipo comprobante */}
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20, padding: 16, backdropFilter: "blur(12px)", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginRight: 4 }}>Comprobante:</span>
              {(["factura_autoimpresa", "ticket_caja"] as const).map(tc => (
                <button key={tc} onClick={() => setTipoComprobante(tc)} style={{ background: tipoComprobante === tc ? T.greenBg : T.surface, border: `1px solid ${tipoComprobante === tc ? "rgba(16,185,129,0.4)" : T.border}`, borderRadius: 10, padding: "6px 14px", color: tipoComprobante === tc ? T.green : T.textMuted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                  {tc === "factura_autoimpresa" ? "Factura Autoimpresa" : "Ticket de Caja"}
                </button>
              ))}
            </div>

            {/* Métodos de pago */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Extra Club lookup */}
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20, padding: 16, backdropFilter: "blur(12px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Star style={{ width: 17, height: 17, color: T.purple }} />
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 13 }}>¿Tenés Tarjeta Extra Club?</p>
                  {extraclubPoints !== null && <span style={{ background: T.purpleBg, color: T.purple, border: `1px solid rgba(139,92,246,0.3)`, borderRadius: 8, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>{extraclubPoints} pts</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={extraclubRut} onChange={e => setExtraclubRut(e.target.value)} onKeyDown={e => e.key === "Enter" && lookupExtraclub()} placeholder="RUC / CI del socio" style={{ flex: 1, background: T.bgInput, border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, padding: "10px 14px", outline: "none", fontSize: 13 }} />
                  <button onClick={lookupExtraclub} disabled={extraclubLookup || !extraclubRut} style={{ background: T.purpleBg, border: `1px solid rgba(139,92,246,0.3)`, color: T.purple, borderRadius: 12, padding: "0 18px", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                    {extraclubLookup ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              {/* EFECTIVO */}
              <div style={{ background: T.bgCard, border: `1px solid ${payMethod === "cash" ? "rgba(16,185,129,0.5)" : T.border}`, borderRadius: 20, overflow: "hidden", backdropFilter: "blur(12px)", transition: "border-color 0.2s" }}>
                <button onClick={() => { setPayMethod("cash"); setTimeout(() => { cashPygRef.current?.focus(); cashPygRef.current?.select() }, 100) }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", padding: 18, cursor: "pointer", color: T.text }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Banknote style={{ width: 22, height: 22, color: T.green }} />
                  </div>
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: 14 }}>Efectivo</p>
                    <p style={{ color: T.textMuted, fontSize: 11 }}>Guaraníes · Reales · Dólares</p>
                  </div>
                  <ChevronRight style={{ width: 18, height: 18, color: T.textMuted, transform: payMethod === "cash" ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>

                {payMethod === "cash" && (
                  <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

                    {/* Guaraníes */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Guaraníes ₲ <span style={{ color: T.textSubtle, fontWeight: 400 }}>· Precargado: {fmtPyg(total)}</span></label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <input ref={cashPygRef} value={cashPygStr} onChange={e => handlePygInput(e.target.value)} onKeyDown={handleEnterPyg} placeholder={total.toLocaleString("es-PY")} inputMode="numeric" style={{ flex: 1, background: T.bgInput, border: `2px solid ${T.green}`, color: T.text, borderRadius: 12, padding: "12px 14px", outline: "none", fontSize: 18, fontWeight: 800, fontFamily: "monospace" }} />
                        <button onClick={() => setCashPygStr(total.toLocaleString("es-PY"))} style={{ background: T.greenBg, border: `1px solid rgba(16,185,129,0.3)`, color: T.green, borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>Exacto</button>
                      </div>
                    </div>

                    {/* Reales */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Reales R$ <span style={{ color: T.textSubtle, fontWeight: 400 }}>· {fmtBrl(remainBrl)} restante</span></label>
                      <input ref={cashBrlRef} value={cashBrlStr} onChange={e => setCashBrlStr(e.target.value)} onKeyDown={handleEnterBrl} placeholder={remainBrl.toFixed(2)} inputMode="decimal" style={{ width: "100%", marginTop: 4, background: T.bgInput, border: `2px solid ${T.blue}`, color: T.text, borderRadius: 12, padding: "12px 14px", outline: "none", fontSize: 18, fontWeight: 800, fontFamily: "monospace", boxSizing: "border-box" }} />
                    </div>

                    {/* Dólares */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Dólares USD <span style={{ color: T.textSubtle, fontWeight: 400 }}>· {fmtUsd(remainUsd)} restante</span></label>
                      <input ref={cashUsdRef} value={cashUsdStr} onChange={e => setCashUsdStr(e.target.value)} onKeyDown={handleEnterUsd} placeholder={remainUsd.toFixed(2)} inputMode="decimal" style={{ width: "100%", marginTop: 4, background: T.bgInput, border: `2px solid rgba(245,158,11,0.6)`, color: T.text, borderRadius: 12, padding: "12px 14px", outline: "none", fontSize: 18, fontWeight: 800, fontFamily: "monospace", boxSizing: "border-box" }} />
                    </div>

                    {/* Resumen pago */}
                    {totalPaid > 0 && (
                      <div style={{ background: T.surface, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.textMuted }}>Pagado</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.green }}>{fmtPyg(totalPaid)}</span>
                        </div>
                        {remainPyg > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.textMuted }}>Saldo restante</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.red }}>{fmtPyg(remainPyg)} · {fmtBrl(remainBrl)} · {fmtUsd(remainUsd)}</span>
                        </div>}
                        {vuelto > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.textMuted }}>Vuelto</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: T.amber }}>{fmtPyg(vuelto)} · {fmtBrl(vueltoBrl)} · {fmtUsd(vueltoUsd)}</span>
                        </div>}
                      </div>
                    )}

                    {totalPaid >= total && (
                      <button onClick={confirmSale} style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", borderRadius: 16, padding: 18, fontSize: 16, fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 24px rgba(16,185,129,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        <CheckCircle style={{ width: 20, height: 20 }} /> CONFIRMAR Y EMITIR FACTURA
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* TARJETA */}
              <button onClick={() => { setPayMethod("card"); setTimeout(confirmSale, 2000) }}
                style={{ display: "flex", alignItems: "center", gap: 14, background: T.bgCard, border: `1px solid ${payMethod === "card" ? "rgba(59,130,246,0.5)" : T.border}`, borderRadius: 20, padding: 18, cursor: "pointer", color: T.text, backdropFilter: "blur(12px)", transition: "all 0.2s", textAlign: "left" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: T.blueBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CreditCard style={{ width: 22, height: 22, color: T.blue }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: 14 }}>Tarjeta de Crédito / Débito</p>
                  <p style={{ color: T.textMuted, fontSize: 11 }}>Chip · Contactless · Banda magnética</p>
                </div>
                {payMethod === "card" && <RefreshCw style={{ width: 18, height: 18, color: T.blue, animation: "spin 1s linear infinite" }} />}
              </button>

              {/* QR DINÁMICO */}
              <div style={{ background: T.bgCard, border: `1px solid ${payMethod === "qr" ? "rgba(16,185,129,0.5)" : T.border}`, borderRadius: 20, overflow: "hidden", backdropFilter: "blur(12px)" }}>
                <button onClick={() => { setPayMethod("qr"); setShowQr(true); setQrCountdown(60) }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", padding: 18, cursor: "pointer", color: T.text, textAlign: "left" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T.greenBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <QrCode style={{ width: 22, height: 22, color: T.green }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: 14 }}>QR Dinámico BCP / SIPAP / Pix</p>
                    <p style={{ color: T.textMuted, fontSize: 11 }}>Escaneá desde tu app bancaria o billetera digital</p>
                  </div>
                </button>
                {showQr && payMethod === "qr" && (
                  <div style={{ borderTop: `1px solid ${T.border}`, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    <div style={{ background: "white", padding: 14, borderRadius: 16, width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=intelimarket_sco_${total}_${Date.now()}`} alt="QR" style={{ width: "100%", height: "100%" }} />
                    </div>
                    <p style={{ fontSize: 13, color: T.textMuted }}>Código expira en <b style={{ color: T.amber }}>{qrCountdown}s</b></p>
                    <button onClick={confirmSale} style={{ background: T.greenBg, border: `1px solid rgba(16,185,129,0.3)`, color: T.green, borderRadius: 12, padding: "10px 24px", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>
                      ✓ Simular Aprobación
                    </button>
                  </div>
                )}
              </div>

              {/* SIPAP TRANSFERENCIA */}
              <button onClick={() => { setPayMethod("card"); setTimeout(confirmSale, 1500) }}
                style={{ display: "flex", alignItems: "center", gap: 14, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20, padding: 18, cursor: "pointer", color: T.text, backdropFilter: "blur(12px)", textAlign: "left" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: T.purpleBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Smartphone style={{ width: 22, height: 22, color: T.purple }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: 14 }}>Transferencia SIPAP</p>
                  <p style={{ color: T.textMuted, fontSize: 11 }}>Pago bancario instantáneo entre cuentas</p>
                </div>
                <Zap style={{ width: 16, height: 16, color: T.purple }} />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ STEP: ÉXITO ════════════════ */}
        {step === "success" && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 28, padding: "24px 0" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", background: T.greenBg, border: "3px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 60px rgba(16,185,129,0.25)" }}>
              <CheckCircle style={{ width: 56, height: 56, color: T.green }} />
            </div>
            <div>
              <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-1px", color: T.green }}>¡PAGO PROCESADO!</h2>
              <p style={{ color: T.textMuted, fontSize: 15, marginTop: 10, lineHeight: 1.7 }}>
                Su factura DNIT ha sido emitida correctamente.<br />
                <b style={{ color: T.text, fontFamily: "monospace" }}>{puntoEmision}-{numeroFactura}</b>
              </p>
              <p style={{ color: T.textMuted, fontSize: 13, marginTop: 6 }}>Timbrado Nº {timbradoNumero} · {tipoComprobante === "factura_autoimpresa" ? "Factura Autoimpresa" : "Ticket de Caja"}</p>
            </div>
            {extraclubPoints !== null && (
              <div style={{ background: T.purpleBg, border: `1px solid rgba(139,92,246,0.3)`, borderRadius: 16, padding: "14px 28px", display: "flex", alignItems: "center", gap: 10 }}>
                <Gift style={{ width: 20, height: 20, color: T.purple }} />
                <p style={{ fontWeight: 700, fontSize: 14, color: T.purple }}>¡Puntos Extra Club acreditados en tu tarjeta!</p>
              </div>
            )}
            <p style={{ fontSize: 12, color: T.textSubtle }}>Reiniciando en 6 segundos...</p>
          </div>
        )}
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ padding: "10px 32px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: dark ? "rgba(15,23,42,0.4)" : "rgba(255,255,255,0.5)", backdropFilter: "blur(8px)" }}>
        <p style={{ fontSize: 10, color: T.textSubtle }}>InteliMarket Self Checkout · Timbrado DNIT {timbradoNumero} · Vence 31/12/2026</p>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 10, color: T.textSubtle }}>🇧🇷 R$ 1 = ₲ {RATES.BRL}</span>
          <span style={{ fontSize: 10, color: T.textSubtle }}>·</span>
          <span style={{ fontSize: 10, color: T.textSubtle }}>🇺🇸 USD 1 = ₲ {RATES.USD}</span>
        </div>
      </footer>
    </div>
  )
}
