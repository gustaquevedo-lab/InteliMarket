import { useState, useEffect, useRef } from "react"
import { api } from "../../api"
import { Scan, ShoppingBag, CreditCard, QrCode, AlertOctagon, HelpCircle, X, ChevronRight, CheckCircle, RefreshCw, Volume2, ShieldAlert } from "lucide-react"
import { formatPYG } from "../../utils/format"
import { roundPY } from "../../utils/posUtils"
import { useToast } from "../../context/ToastContext"

interface CartItem {
  id: string
  nombre: string
  precio: number
  quantity: number
  weightKg?: number
}

const MOCK_ITEMS = [
  { id: "p1", nombre: "Leche Entera UHT 1L", precio: 6500, barcode: "7891234567890", weight: 1.0 },
  { id: "p2", nombre: "Pan Felipe (Bolsa 500g)", precio: 5000, barcode: "7891234567891", weight: 0.5 },
  { id: "p3", nombre: "Queso Paraguay (kg)", precio: 38000, barcode: "7891234567892", weight: 1.2 },
  { id: "p4", nombre: "Yerba Mate Clásica 500g", precio: 12000, barcode: "7891234567893", weight: 0.5 },
  { id: "p5", nombre: "Gaseosa Cola 2L", precio: 9000, barcode: "7891234567894", weight: 2.1 },
]

export default function SelfCheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcode, setBarcode] = useState("")
  const [activeStep, setActiveStep] = useState<"welcome" | "scanning" | "bagging_wait" | "payment" | "success">("welcome")
  const [paymentMethod, setPaymentMethod] = useState<"card" | "qr" | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [supervisorEmail, setSupervisorEmail] = useState("")
  const [supervisorPassword, setSupervisorPassword] = useState("")
  const [verifyingSupervisor, setVerifyingSupervisor] = useState(false)
  const [scaleWeight, setScaleWeight] = useState(0) // actual scale weight in kg
  const [expectedWeight, setExpectedWeight] = useState(0)
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCountdown, setQrCountdown] = useState(60)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // Play audio beep simulation using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime) // A5 frequency
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
      oscillator.start()
      setTimeout(() => { oscillator.stop(); audioCtx.close() }, 120)
    } catch {
      console.warn("Web Audio API not supported or blocked by browser gesture policies.")
    }
  }

  const subtotal = cart.reduce((s, i) => s + i.precio * i.quantity, 0)
  const total = roundPY(subtotal)

  // Handle barcode simulation
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const code = barcode.trim()
    if (!code) return

    const match = MOCK_ITEMS.find(i => i.barcode === code || i.nombre.toLowerCase().includes(code.toLowerCase()))
    if (match) {
      playBeep()
      const existing = cart.find(i => i.id === match.id)
      const itemWeight = match.weight
      
      setExpectedWeight(prev => Number((prev + itemWeight).toFixed(3)))

      if (existing) {
        setCart(cart.map(i => i.id === match.id ? { ...i, quantity: i.quantity + 1 } : i))
      } else {
        setCart([...cart, { id: match.id, nombre: match.nombre, precio: match.precio, quantity: 1, weightKg: itemWeight }])
      }

      setBarcode("")
      // Move to bagging simulation wait
      setActiveStep("bagging_wait")
      setTimeout(() => {
        // Automatically simulate placing item on bag scale
        setScaleWeight(prev => Number((prev + itemWeight).toFixed(3)))
        setActiveStep("scanning")
      }, 1500)
    } else {
      toast.error("Código no reconocido", "Por favor, intente con otro ítem de demostración o busque por nombre.")
      setBarcode("")
    }
  }

  // Monitor weight match. In a real store, mismatch locks the POS.
  useEffect(() => {
    if (activeStep === "scanning" && cart.length > 0 && Math.abs(scaleWeight - expectedWeight) > 0.05) {
      setIsLocked(true)
    }
  }, [scaleWeight, expectedWeight, activeStep, cart])

  // Timer for QR code simulation
  useEffect(() => {
    let timer: any
    if (showQrCode && qrCountdown > 0) {
      timer = setInterval(() => setQrCountdown(c => c - 1), 1000)
    } else if (qrCountdown === 0) {
      setShowQrCode(false)
      setPaymentMethod(null)
    }
    return () => clearInterval(timer)
  }, [showQrCode, qrCountdown])

  const handlePayComplete = () => {
    playBeep()
    setActiveStep("success")
    setTimeout(() => {
      setCart([])
      setScaleWeight(0)
      setExpectedWeight(0)
      setActiveStep("welcome")
      setPaymentMethod(null)
      setShowQrCode(false)
    }, 4000)
  }

  const handleSupervisorBypass = async () => {
    if (!supervisorEmail || !supervisorPassword) return
    setVerifyingSupervisor(true)
    try {
      const result = await api.auth.verifySupervisor({ email: supervisorEmail, password: supervisorPassword })
      if (result.valid) {
        setIsLocked(false)
        setExpectedWeight(scaleWeight) // sync weight
        setSupervisorEmail(""); setSupervisorPassword("")
        toast.success("Autorizado", "Bolsas validadas por " + (result.nombre || "supervisor") + ".")
      } else {
        toast.error("Credenciales invalidas", "El usuario y contrasena no corresponden a una cuenta activa.")
        setSupervisorPassword("")
      }
    } catch {
      toast.error("Error", "No se pudo verificar al supervisor")
    } finally {
      setVerifyingSupervisor(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, #0f172a, #020617)", fontFamily: "system-ui, sans-serif", color: "white", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      
      {/* GLOWS */}
      <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* SUPERVISOR LOCK OVERLAY */}
      {isLocked && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(2,6,23,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 32, padding: 40, maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(220,38,38,0.15)", border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <ShieldAlert style={{ width: 42, height: 42, color: "#ef4444" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px" }}>CAJA BLOQUEADA</h2>
              <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 8 }}>Diferencia de peso detectada en la bolsa.<br/>Por favor, aguarde al asistente de tienda.</p>
            </div>
            <div style={{ background: "rgba(15,23,42,0.6)", border: "1px solid #1e293b", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Desbloqueo de Supervisor</p>
              <input
                type="email"
                value={supervisorEmail}
                onChange={e => setSupervisorEmail(e.target.value)}
                placeholder="Email del supervisor"
                style={{ background: "#020617", border: "1px solid #334155", color: "white", borderRadius: 12, padding: 12, outline: "none", textAlign: "center", fontSize: 14 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="password"
                  value={supervisorPassword}
                  onChange={e => setSupervisorPassword(e.target.value)}
                  placeholder="Contrasena"
                  style={{ flex: 1, background: "#020617", border: "1px solid #334155", color: "white", borderRadius: 12, padding: 12, outline: "none", textAlign: "center", fontSize: 14 }}
                />
                <button onClick={handleSupervisorBypass} disabled={verifyingSupervisor} style={{ background: "#ef4444", border: "none", color: "white", borderRadius: 12, padding: "0 20px", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: verifyingSupervisor ? 0.6 : 1 }}>{verifyingSupervisor ? "..." : "Validar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{ padding: "20px 40px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,23,42,0.2)", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}>
            <ShoppingBag style={{ width: 20, height: 20, color: "white" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px" }}>AUTO-PAGO</h1>
            <p style={{ fontSize: 10, color: "#10b981", fontWeight: 700, letterSpacing: 2 }}>CAJA DE AUTOGESTIÓN</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
            <Volume2 style={{ width: 14, height: 14, color: "#10b981" }} /> Audio Guía Activo
          </div>
          <button onClick={() => window.history.back()} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>Volver a Caja</button>
        </div>
      </header>

      {/* STEP 1: WELCOME SCREEN */}
      {activeStep === "welcome" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div onClick={() => setActiveStep("scanning")} style={{ width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)", border: "2px dashed rgba(16,185,129,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 16, transition: "transform 0.3s", boxShadow: "0 0 40px rgba(16,185,129,0.1)" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            <Scan style={{ width: 80, height: 80, color: "#10b981", animation: "pulse 2s infinite" }} />
            <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Tocar para comenzar</div>
          </div>
          <p style={{ marginTop: 24, color: "#64748b", fontSize: 14, maxWidth: 360 }}>Coloque su bolsa en el área de embolsado y toque la pantalla para iniciar el escaneo de sus productos.</p>
        </div>
      )}

      {/* STEP 2: SCANNING AND CART SYSTEM */}
      {(activeStep === "scanning" || activeStep === "bagging_wait" || activeStep === "payment" || activeStep === "success") && (
        <div style={{ flex: 1, display: "flex", padding: 32, gap: 32, overflow: "hidden", minHeight: 0 }}>
          
          {/* LEFT: CART TICKET */}
          <div style={{ flex: 1, background: "rgba(15,23,42,0.4)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 24, padding: 24, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
              <span>Tus productos</span>
              <span>{cart.reduce((s,i) => s + i.quantity, 0)} items</span>
            </h2>

            {/* Scanned Items list */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 6 }}>
              {cart.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#334155" }}>
                  <Scan style={{ width: 64, height: 64, opacity: 0.3, marginBottom: 16 }} />
                  <p style={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>El carrito está vacío</p>
                  <p style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Comience a escanear productos de prueba</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, background: "rgba(30,41,59,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: "14px 20px" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 800, fontSize: 16 }}>{item.nombre}</p>
                      <p style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>Peso unitario: {item.weightKg} kg</p>
                    </div>
                    <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 700 }}>{item.quantity} ud(s)</div>
                    <div style={{ fontSize: 18, fontWeight: 900, textAlign: "right" }}>{formatPYG(item.precio * item.quantity)}</div>
                  </div>
                ))
              )}
            </div>

            {/* Total display */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 20, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }}>Total a pagar</p>
                <p style={{ fontSize: 44, fontWeight: 950, color: "#10b981", letterSpacing: "-1.5px" }}>{formatPYG(total)}</p>
              </div>
              
              {/* Balanza de seguridad status */}
              <div style={{ textAlign: "right", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: "12px 18px" }}>
                <p style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>Peso de Bolsa (Balanza de Seguridad)</p>
                <p style={{ fontSize: 18, fontWeight: 900, color: Math.abs(scaleWeight - expectedWeight) < 0.05 ? "#10b981" : "#f59e0b", marginTop: 4 }}>{scaleWeight.toFixed(3)} kg <span style={{ fontSize: 12, color: "#475569" }}>/ exp. {expectedWeight.toFixed(3)} kg</span></p>
              </div>
            </div>
          </div>

          {/* RIGHT: CONTROLS & CHECKOUT */}
          <div style={{ width: 420, display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* INSTRUCTIONS SCREEN */}
            <div style={{ background: "linear-gradient(135deg, rgba(30,41,59,0.6), rgba(15,23,42,0.6))", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 24, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              
              {activeStep === "scanning" && (
                <>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textTransform: "uppercase" }}>Listo para escanear</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>Por favor escanee un artículo</h3>
                  <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>Pase el código de barras por el lector o ingrese el nombre del producto de demostración en el campo de abajo.</p>
                  
                  {/* SCAN SIMULATOR INPUT */}
                  <form onSubmit={handleBarcodeSubmit} style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="Ej: 7891234567890 o Coca Cola..."
                      value={barcode}
                      onChange={e => setBarcode(e.target.value)}
                      style={{ flex: 1, background: "#020617", border: "1px solid #1e293b", color: "white", borderRadius: 12, padding: 12, outline: "none", fontSize: 14 }}
                    />
                    <button type="submit" style={{ background: "#10b981", border: "none", color: "white", borderRadius: 12, padding: "0 18px", fontWeight: 700, cursor: "pointer" }}>Escanear</button>
                  </form>

                  {/* QUICK DEMO SCAN ITEMS */}
                  <div style={{ marginTop: 12 }}>
                    <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Atajos de simulación de escaneo</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {MOCK_ITEMS.map(i => (
                        <button key={i.id} onClick={() => { setBarcode(i.barcode); setTimeout(() => barcodeInputRef.current?.focus(), 100) }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 11, padding: "6px 12px", borderRadius: 10, cursor: "pointer" }}>{i.nombre.split(" ")[0]}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeStep === "bagging_wait" && (
                <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
                  <RefreshCw style={{ width: 48, height: 48, color: "#f59e0b", animation: "spin 2s infinite linear", margin: "0 auto" }} />
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>Coloque el artículo en la bolsa</h3>
                    <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>Esperando la balanza de seguridad... la validación del peso tarda 1.5s.</p>
                  </div>
                </div>
              )}

              {activeStep === "payment" && (
                <>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>Seleccione su método de pago</h3>
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>Acerque su tarjeta de crédito o escanee el código QR desde su celular para facturar.</p>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    <button onClick={() => { setPaymentMethod("card"); handlePayComplete() }} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><CreditCard style={{ width: 22, height: 22, color: "#3b82f6" }} /></div>
                      <div style={{ textAlign: "left" }}><p style={{ fontWeight: 800, fontSize: 14 }}>Tarjeta de Crédito / Débito</p><p style={{ color: "#64748b", fontSize: 11 }}>Chip, Contactless o Banda magnética</p></div>
                    </button>

                    <button onClick={() => { setPaymentMethod("qr"); setShowQrCode(true); setQrCountdown(60) }} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><QrCode style={{ width: 22, height: 22, color: "#10b981" }} /></div>
                      <div style={{ textAlign: "left" }}><p style={{ fontWeight: 800, fontSize: 14 }}>Código QR Dinámico BCP</p><p style={{ color: "#64748b", fontSize: 11 }}>Pago al instante sin contacto</p></div>
                    </button>
                  </div>
                </>
              )}

              {activeStep === "success" && (
                <div style={{ textAlign: "center", padding: "30px 0", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "2px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                    <CheckCircle style={{ width: 36, height: 36, color: "#10b981" }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 900 }}>¡PAGO PROCESADO!</h3>
                    <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>Su factura electrónica ha sido enviada a SIFEN.<br/>Gracias por su compra.</p>
                  </div>
                </div>
              )}
            </div>

            {/* QR CODE OVERLAY MODAL */}
            {showQrCode && (
              <div style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 24, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 0 30px rgba(16,185,129,0.05)" }}>
                <p style={{ fontSize: 13, color: "#10b981", fontWeight: 700, textTransform: "uppercase" }}>Escanee con su app bancaria</p>
                <div style={{ background: "white", padding: 14, borderRadius: 16, width: 160, height: 160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=intelimarket_sale_${total}`} alt="QR Code" style={{ width: "100%", height: "100%" }} />
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>El código QR expira en <b style={{ color: "#f59e0b" }}>{qrCountdown}s</b></div>
                <button onClick={handlePayComplete} style={{ background: "#10b981", border: "none", color: "white", borderRadius: 12, padding: 12, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Simular Aprobación Bancaria</button>
              </div>
            )}

            {/* ACTION FOOTER BUTTONS */}
            {activeStep === "scanning" && (
              <button
                onClick={() => setActiveStep("payment")}
                disabled={cart.length === 0}
                style={{ background: cart.length === 0 ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #10b981, #059669)", color: cart.length === 0 ? "#475569" : "white", border: "none", padding: 22, borderRadius: 24, fontSize: 18, fontWeight: 900, cursor: cart.length === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: cart.length === 0 ? "none" : "0 8px 30px rgba(16,185,129,0.3)", transition: "transform 0.2s" }}
              >
                IR A PAGAR
                <ChevronRight style={{ width: 22, height: 22 }} />
              </button>
            )}

            {activeStep === "payment" && (
              <button onClick={() => { setActiveStep("scanning"); setPaymentMethod(null); setShowQrCode(false) }} style={{ background: "#1e293b", border: "1px solid #334155", color: "white", padding: 18, borderRadius: 20, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Volver a escanear productos</button>
            )}
            
            {/* SIMULATE SECURITY WEIGHT CRITICAL ERROR */}
            {activeStep === "scanning" && cart.length > 0 && (
              <button onClick={() => { setScaleWeight(prev => prev + 0.3) }} style={{ background: "none", border: "none", color: "#475569", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>⚠️ Simular Diferencia de Peso en Bolsa</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
