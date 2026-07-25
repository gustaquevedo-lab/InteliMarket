import { useState, useEffect, useRef } from "react"
import { 
  ScanLine, Trash2, Plus, Minus, ShoppingCart, Banknote, CreditCard, 
  QrCode, User, Pause, Play, Percent, X, CheckCircle, Printer, 
  RefreshCw, WifiOff, Search, Sparkles, AlertTriangle, ShieldCheck,
  Award, Gift, Tag, Check, Loader2
} from "lucide-react"
import { api, type Product, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useOffline } from "../../context/OfflineContext"
import { formatPYG } from "../../utils/format"
import { roundPY } from "../../utils/posUtils"

interface CartItem {
  id: string
  nombre: string
  precio: number
  sku: string
  quantity: number
  iva_tasa: number
}

const MOCK_PRODUCTS: (Product & { category: string; color: string })[] = [
  { id: "p1", nombre: "Leche Entera UHT 1L", precio_venta: 6500, sku: "7891234567890", codigo_barra: "7891234567890", iva_tasa: 10, category: "almacen", color: "rgba(59,130,246,0.15)" } as any,
  { id: "p2", nombre: "Pan Felipe (Bolsa 500g)", precio_venta: 5000, sku: "7891234567891", codigo_barra: "7891234567891", iva_tasa: 5, category: "panaderia", color: "rgba(245,158,11,0.15)" } as any,
  { id: "p3", nombre: "Queso Paraguay (kg)", precio_venta: 38000, sku: "7891234567892", codigo_barra: "7891234567892", iva_tasa: 5, category: "almacen", color: "rgba(14,165,233,0.15)" } as any,
  { id: "p4", nombre: "Yerba Mate Clásica 500g", precio_venta: 12000, sku: "7891234567893", codigo_barra: "7891234567893", iva_tasa: 10, category: "almacen", color: "rgba(16,185,129,0.15)" } as any,
  { id: "p5", nombre: "Gaseosa Cola 2L", precio_venta: 9000, sku: "7891234567894", codigo_barra: "7891234567894", iva_tasa: 10, category: "almacen", color: "rgba(99,102,241,0.15)" } as any,
  { id: "p6", nombre: "Arroz Tipo 1 1kg", precio_venta: 7000, sku: "7891234567895", codigo_barra: "7891234567895", iva_tasa: 5, category: "almacen", color: "rgba(148,163,184,0.15)" } as any,
  { id: "p7", nombre: "Tomate Perita (kg)", precio_venta: 8500, sku: "7891234567896", codigo_barra: "7891234567896", iva_tasa: 5, category: "fruver", color: "rgba(239,68,68,0.15)" } as any,
  { id: "p8", nombre: "Manzana Roja (kg)", precio_venta: 14000, sku: "7891234567897", codigo_barra: "7891234567897", iva_tasa: 5, category: "fruver", color: "rgba(244,63,94,0.15)" } as any,
  { id: "p9", nombre: "Banana de Oro (kg)", precio_venta: 6000, sku: "7891234567898", codigo_barra: "7891234567898", iva_tasa: 5, category: "fruver", color: "rgba(245,158,11,0.15)" } as any,
  { id: "p10", nombre: "Costilla de Primera (kg)", precio_venta: 32000, sku: "7891234567899", codigo_barra: "7891234567899", iva_tasa: 5, category: "carnes", color: "rgba(249,115,22,0.15)" } as any,
  { id: "p11", nombre: "Peceto Vacuno (kg)", precio_venta: 48000, sku: "7891234567900", codigo_barra: "7891234567900", iva_tasa: 5, category: "carnes", color: "rgba(239,68,68,0.15)" } as any,
  { id: "p12", nombre: "Medialunas de Manteca (Doz)", precio_venta: 24000, sku: "7891234567901", codigo_barra: "7891234567901", iva_tasa: 10, category: "panaderia", color: "rgba(234,179,8,0.15)" } as any
]

const MOCK_CUSTOMERS: Customer[] = [
  { id: "c1", nombre: "Juan Pérez", razon_social: "Juan Pérez", ruc: "4444444-1", ci: "4444444", activo: true } as any,
  { id: "c2", nombre: "María Rodríguez", razon_social: "María Rodríguez", ruc: "5555555-2", ci: "5555555", activo: true } as any,
]

// Mock Fidelity Database Linked to CRM
const FIDELITY_DATA: Record<string, { tier: string; points: number; cashback: number; coupons: { id: string; code: string; label: string; applied: boolean; value: number; type: "percent" | "fixed"; targetCategory?: string; targetProduct?: string }[] }> = {
  "c1": {
    tier: "Platino",
    points: 4200,
    cashback: 15000,
    coupons: [
      { id: "cp1", code: "MIL-20", label: "20% en Lácteos", applied: false, value: 20, type: "percent", targetCategory: "almacen", targetProduct: "Leche" },
      { id: "cp2", code: "PAN-5", label: "Gs 5.000 Regalo en Panadería", applied: false, value: 5000, type: "fixed", targetCategory: "panaderia" }
    ]
  },
  "c2": {
    tier: "Gold Elite",
    points: 8500,
    cashback: 35000,
    coupons: [
      { id: "cp3", code: "MEAT-15", label: "15% en Carnes (Costilla)", applied: false, value: 15, type: "percent", targetCategory: "carnes", targetProduct: "Costilla" },
      { id: "cp4", code: "FRU-3", label: "Gs 10.000 Regalo en Verdulería", applied: false, value: 10000, type: "fixed", targetCategory: "fruver" }
    ]
  }
}

export default function CajaRapidaPage() {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS)
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS)
  const [cart, setCart] = useState<CartItem[]>([])
  const [barcode, setBarcode] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [discountPct, setDiscountPct] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastTotal, setLastTotal] = useState(0)
  const [pausedSales, setPausedSales] = useState<{ id: string; items: CartItem[]; customer: Customer | null; discountPct: number; applyCashback: boolean; appliedCoupons: string[]; fidelityProfile: any; timestamp: Date }[]>([])
  const [accumulatedCash, setAccumulatedCash] = useState(3450000)
  const [searchText, setSearchText] = useState("")
  const [showPausedSalesPanel, setShowPausedSalesPanel] = useState(false)

  // Supervisor Override security states
  const [pendingAuthAction, setPendingAuthAction] = useState<{ type: string; payload: any } | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [remoteRequestSent, setRemoteRequestSent] = useState(false)
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null)

  // Fidelity / Club Supermercado states
  const [fidelityProfile, setFidelityProfile] = useState<any>(null)
  const [applyCashback, setApplyCashback] = useState(false)
  const [appliedCoupons, setAppliedCoupons] = useState<string[]>([])
  const [activeFidelityAlerts, setActiveFidelityAlerts] = useState<string[]>([])
  const [showFidelityAlertModal, setShowFidelityAlertModal] = useState(false)

  const selectCustomerById = (customer: Customer) => {
    setSelectedCustomer(customer)
    const data = FIDELITY_DATA[customer.id]
    if (data) {
      const alerts: string[] = []
      if (data.coupons && data.coupons.length > 0) {
        data.coupons.forEach(cp => {
          alerts.push(`Este cliente tiene un cupón de ${cp.label} por ser miembro del Club`)
        })
      }
      if (data.cashback > 0) {
        alerts.push(`Acumuló Gs ${data.cashback.toLocaleString("es-PY")} de saldo para pagar hoy`)
      }
      if (alerts.length > 0) {
        setActiveFidelityAlerts(alerts)
        setShowFidelityAlertModal(true)
        toast.success("¡Club Supermercado!", `Cliente ${customer.nombre} identificado con éxito.`)
      }
    } else {
      setActiveFidelityAlerts([])
      setShowFidelityAlertModal(false)
    }
  }

  const barcodeRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const { isOnline, pendingSalesCount, cachedProducts, addPendingSale } = useOffline()

  useEffect(() => { fetchData() }, [])

  // Sync fidelity profile when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      const data = FIDELITY_DATA[selectedCustomer.id]
      if (data) {
        // Deep copy coupons so we don't mutate mock DB directly during runtime
        setFidelityProfile({
          ...data,
          coupons: data.coupons.map(c => ({ ...c }))
        })
      } else {
        setFidelityProfile(null)
      }
    } else {
      setFidelityProfile(null)
      setApplyCashback(false)
      setAppliedCoupons([])
    }
  }, [selectedCustomer])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.allSettled([
        api.products.list({ activo: true }),
        api.customers.list({ activo: true }),
      ])
      if (p.status === "fulfilled") {
        const merged = p.value.map((item: any) => {
          const match = MOCK_PRODUCTS.find(m => m.id === item.id || m.nombre === item.nombre)
          return {
            ...item,
            category: match?.category || "almacen",
            color: match?.color || "rgba(59,130,246,0.15)"
          }
        })
        setProducts(merged)
      } else if (cachedProducts.length > 0) {
        setProducts(cachedProducts.map(x => x.data as Product))
      }
      if (c.status === "fulfilled") setCustomers(c.value)
    } catch {
      if (cachedProducts.length > 0) setProducts(cachedProducts.map(x => x.data as Product))
    } finally {
      setLoading(false)
    }
  }

  const handleResolveAuth = (supervisorName: string) => {
    if (!pendingAuthAction) return

    setAuthorizedBy(supervisorName)

    if (pendingAuthAction.type === "remove_item") {
      const itemId = pendingAuthAction.payload.itemId
      const item = cart.find(c => c.id === itemId)
      setCart(cart.filter(c => c.id !== itemId))
      toast.success("Anulación Aprobada", `Se eliminó "${item?.nombre}" por supervisor: ${supervisorName}`)
    } else if (pendingAuthAction.type === "apply_discount") {
      const pct = pendingAuthAction.payload.percent
      setDiscountPct(pct)
      toast.success("Descuento Autorizado", `Se aplicó descuento de ${pct}% por supervisor: ${supervisorName}`)
    } else if (pendingAuthAction.type === "void_sale") {
      setCart([])
      setDiscountPct(0)
      setSelectedCustomer(null)
      toast.info("Venta Cancelada", `El supervisor ${supervisorName} autorizó cancelar la venta.`)
    } else if (pendingAuthAction.type === "drop_cash") {
      setAccumulatedCash(500000)
      toast.success("Drop Cash Exitoso", `Fondo de caja depurado por supervisor: ${supervisorName}`)
    } else if (pendingAuthAction.type === "discard_paused") {
      const pId = pendingAuthAction.payload.pausedId
      setPausedSales(pausedSales.filter(p => p.id !== pId))
      toast.info("Venta Descartada", `Venta suspendida eliminada por supervisor: ${supervisorName}`)
    }

    setPendingAuthAction(null)
    setAuthModalOpen(false)
    setRemoteRequestSent(false)
  }

  const triggerRemoteAuthRequest = () => {
    setRemoteRequestSent(true)
    toast.info("Solicitud Enviada", "Esperando aprobación remota de supervisor...")
    setTimeout(() => {
      handleResolveAuth("CARLOS (PWA Móvil)")
    }, 5000)
  }

  const pauseCurrentSale = () => {
    if (cart.length === 0) {
      toast.error("Carrito Vacío", "No hay productos para pausar.")
      return
    }
    const newPaused = {
      id: "P-" + Date.now(),
      items: [...cart],
      customer: selectedCustomer,
      discountPct: discountPct,
      applyCashback: applyCashback,
      appliedCoupons: [...appliedCoupons],
      fidelityProfile: fidelityProfile ? { ...fidelityProfile } : null,
      timestamp: new Date()
    }
    setPausedSales([newPaused, ...pausedSales])
    setCart([])
    setDiscountPct(0)
    setSelectedCustomer(null)
    toast.success("Venta en Pausa", "La transacción actual se ha suspendido temporalmente.")
  }

  const resumeSale = (id: string) => {
    const target = pausedSales.find(p => p.id === id)
    if (!target) return

    if (cart.length > 0) {
      const activeAsPaused = {
        id: "P-" + Date.now(),
        items: [...cart],
        customer: selectedCustomer,
        discountPct: discountPct,
        applyCashback: applyCashback,
        appliedCoupons: [...appliedCoupons],
        fidelityProfile: fidelityProfile ? { ...fidelityProfile } : null,
        timestamp: new Date()
      }
      setPausedSales(pausedSales.map(p => p.id === id ? activeAsPaused : p))
    } else {
      setPausedSales(pausedSales.filter(p => p.id !== id))
    }

    setCart(target.items)
    setSelectedCustomer(target.customer)
    setDiscountPct(target.discountPct)
    setApplyCashback(target.applyCashback)
    setAppliedCoupons(target.appliedCoupons)
    setFidelityProfile(target.fidelityProfile)
    setShowPausedSalesPanel(false)
    toast.success("Venta Recuperada", "Se restauró la transacción pausada.")
  }

  const discardPausedSale = (id: string) => {
    setPendingAuthAction({ type: "discard_paused", payload: { pausedId: id } })
    setAuthModalOpen(true)
  }

  // Calculate dynamic totals including Fidelity Discounts
  const baseSubtotal = cart.reduce((s, i) => s + i.precio * i.quantity, 0)
  
  // Calculate coupon discounts
  let couponDiscounts = 0
  if (fidelityProfile) {
    fidelityProfile.coupons.forEach((cp: any) => {
      if (appliedCoupons.includes(cp.id)) {
        if (cp.type === "percent") {
          // Find matching products in cart (e.g. Leche for Lácteos, Costilla for Carnes)
          cart.forEach(item => {
            const matchesCategory = cp.targetCategory === "all" || item.id === "p1" || item.id === "p3" || item.id === "p10"
            if (matchesCategory && (!cp.targetProduct || item.nombre.toLowerCase().includes(cp.targetProduct.toLowerCase()))) {
              couponDiscounts += Math.round(item.precio * item.quantity * cp.value / 100)
            }
          })
        } else if (cp.type === "fixed") {
          // Apply flat discount if category present in cart
          const hasCategory = cart.some(item => item.id === "p2" || item.id === "p12" || item.id === "p7" || item.id === "p8" || item.id === "p9")
          if (hasCategory) {
            couponDiscounts += cp.value
          }
        }
      }
    })
  }

  const subtotal = baseSubtotal - couponDiscounts
  const discountAmount = Math.round(subtotal * discountPct / 100)
  const cashbackAmount = applyCashback && fidelityProfile ? fidelityProfile.cashback : 0
  
  const total = subtotal - discountAmount - cashbackAmount
  const roundedTotal = Math.max(0, roundPY(total))

  const iva10 = cart.filter(i => i.iva_tasa === 10).reduce((s, i) => s + (i.precio * i.quantity * 10) / 110, 0)
  const iva5 = cart.filter(i => i.iva_tasa === 5).reduce((s, i) => s + (i.precio * i.quantity * 5) / 105, 0)

  const addToCart = (product: Product) => {
    addToCartWithQty(product, 1)
  }

  const addToCartWithQty = (product: Product, qty: number) => {
    const existing = cart.find(i => i.id === product.id)
    if (existing) {
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: Number((i.quantity + qty).toFixed(3)) } : i))
    } else {
      setCart([...cart, {
        id: product.id,
        nombre: product.nombre,
        precio: product.precio_venta ?? product.precio ?? 0,
        sku: product.sku || product.codigo_barra || product.id,
        quantity: qty,
        iva_tasa: product.iva_tasa ?? 10,
      }])
    }
    toast.success("Añadido", `${qty}x ${product.nombre}`)
  }

  const handleBarcode = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    const code = barcode.trim()
    if (!code) return

    // Intercept Supervisor QR Badge Scans
    if (code.startsWith("SUP-QR-")) {
      const parts = code.split("-")
      const supervisorName = parts[3] || parts[2] || "Supervisor"
      handleResolveAuth(supervisorName)
      setBarcode("")
      return
    }

    // CRM Fidelity Customer Identification by CI/RUC in Checkout/Barcode field
    const cleanInput = code.replace(/[-.\s]/g, "").toLowerCase()
    const matchedCustomer = customers.find(c => {
      const cleanCI = (c.ci || "").replace(/[-.\s]/g, "").toLowerCase()
      const cleanRUC = (c.ruc || "").replace(/[-.\s]/g, "").toLowerCase()
      return (cleanCI === cleanInput || cleanRUC === cleanInput)
    })

    if (matchedCustomer) {
      selectCustomerById(matchedCustomer)
      setBarcode("")
      return
    }

    // EAN-13 PLU Parser
    if (code.length === 13 && (code.startsWith("20") || code.startsWith("21"))) {
      const plu = code.substring(2, 7) 
      const valueStr = code.substring(7, 12) 
      const weightKg = Number(valueStr) / 1000

      const product = products.find(p => 
        p.sku?.toLowerCase() === plu.toLowerCase() ||
        p.codigo_barra?.toLowerCase() === plu.toLowerCase() ||
        p.sku?.toLowerCase().endsWith(plu.toLowerCase())
      )

      if (product) {
        addToCartWithQty(product, weightKg)
        setBarcode("")
        return
      }
    }

    const product = products.find(p =>
      p.sku?.toLowerCase() === code.toLowerCase() ||
      p.codigo_barra?.toLowerCase() === code.toLowerCase() ||
      p.nombre.toLowerCase().includes(code.toLowerCase())
    )
    if (product) {
      addToCartWithQty(product, 1)
      setBarcode("")
    } else {
      toast.error("No encontrado", `Código: ${code}`)
      setBarcode("")
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))
  }

  const handlePay = async (method: string) => {
    if (cart.length === 0) { toast.error("Carrito vacío", ""); return }
    if (method === "efectivo" && accumulatedCash > 3000000) {
      toast.error("Límite de Efectivo Superado", "Debe realizar un Drop Cash para continuar.")
      setPendingAuthAction({ type: "drop_cash", payload: {} })
      setAuthModalOpen(true)
      return
    }
    if (method === "credito_cliente" && !selectedCustomer) {
      toast.error("Seleccione un cliente", "El cobro a crédito requiere asociar un cliente específico.")
      return
    }
    setSubmitting(true)
    try {
      const saleData = {
        customer_id: selectedCustomer?.id,
        condicion: method === "credito_cliente" ? "credito" : "contado",
        items: cart.map(i => ({ product_id: i.id, cantidad: i.quantity, precio_unitario: i.precio })),
      }
      if (isOnline) {
        await api.sales.create(saleData)
      } else {
        await addPendingSale(saleData)
      }
      if (method === "efectivo") {
        setAccumulatedCash(prev => prev + roundedTotal)
      }
      setLastTotal(roundedTotal)
      setCart([])
      setDiscountPct(0)
      setSelectedCustomer(null)
      setShowSuccess(true)
      setTimeout(() => { setShowSuccess(false); barcodeRef.current?.focus() }, 2000)
    } catch (err: any) {
      toast.error("Error al cobrar", err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCoupon = (couponId: string, label: string) => {
    if (appliedCoupons.includes(couponId)) {
      setAppliedCoupons(prev => prev.filter(id => id !== couponId))
      toast.info("Cupón Removido", `Se quitó el descuento del cupón: ${label}`)
    } else {
      setAppliedCoupons(prev => [...prev, couponId])
      toast.success("Cupón Aplicado", `Descuento del cupón "${label}" aplicado correctamente.`)
    }
  }

  const toggleCashback = () => {
    if (!fidelityProfile) return
    if (applyCashback) {
      setApplyCashback(false)
      toast.info("Cashback Removido", "Se canceló la redención de saldo acumulado.")
    } else {
      setApplyCashback(true)
      toast.success("Cashback Redimido", `Se aplicó Gs ${fidelityProfile.cashback.toLocaleString("es-PY")} de saldo a favor.`)
    }
  }

  const fallbackProducts = products.filter(p => {
    if (!searchText) return true 
    return (
      p.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
      p.codigo_barra?.toLowerCase().includes(searchText.toLowerCase())
    )
  }).slice(0, 15)

  return (
    <div style={{ height: "calc(100vh - 6.5rem)", display: "flex", flexDirection: "column", background: "#020817", borderRadius: "24px", padding: "16px", gap: "12px", border: "1px solid #1e293b", overflow: "hidden", boxSizing: "border-box" }}>
      
      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center", justifyContent: "center", background: "rgba(2,8,23,0.97)", backdropFilter: "blur(12px)" }}>
          <div style={{ padding: "24px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "50%", marginBottom: "24px" }}>
            <CheckCircle style={{ width: 96, height: 96, color: "#10b981" }} />
          </div>
          <p style={{ fontSize: "48px", fontWeight: 900, color: "white", letterSpacing: "-1px" }}>¡VENTA COMPLETA!</p>
          <p style={{ fontSize: "32px", fontWeight: 800, color: "#34d399", marginTop: "8px", fontFamily: "monospace" }}>{formatPYG(lastTotal)}</p>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(15,23,42,0.6)", padding: "10px 16px", borderRadius: "16px", border: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", background: "linear-gradient(to top right, #10b981, #059669)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingCart style={{ width: "20px", height: "20px", color: "white" }} />
          </div>
          <div>
            <h1 style={{ color: "white", fontWeight: 800, fontSize: "15px", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
              Caja de Supermercado <span style={{ fontSize: "9px", background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", padding: "1px 6px", borderRadius: "999px", fontWeight: 900 }}>TERMINAL</span>
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "10px", margin: "2px 0 0 0" }}>Optimizado para escáner físico de código de barras y teclado</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {pausedSales.length > 0 && (
            <button 
              onClick={() => setShowPausedSalesPanel(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc", padding: "6px 12px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
            >
              <Pause style={{ width: "14px", height: "14px" }} /> Pausadas ({pausedSales.length})
            </button>
          )}
          {accumulatedCash > 3000000 && (
            <button 
              onClick={() => {
                setPendingAuthAction({ type: "drop_cash", payload: {} })
                setAuthModalOpen(true)
              }}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24", padding: "6px 12px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
            >
              <AlertTriangle style={{ width: "14px", height: "14px" }} /> Drop Cash requerido
            </button>
          )}
          {!isOnline && <span style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "6px 12px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}><WifiOff style={{ width: "14px", height: "14px" }} /> Sin conexión</span>}
          {pendingSalesCount > 0 && <span style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", padding: "6px 12px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}><RefreshCw style={{ width: "14px", height: "14px" }} /> {pendingSalesCount} cola</span>}
          <span style={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", padding: "6px 12px", borderRadius: "10px", fontSize: "11px", fontFamily: "monospace", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}><ShieldCheck style={{ width: "14px", height: "14px", color: "#10b981" }} /> Caja: #002</span>
        </div>
      </div>

      {/* CORE 2-COLUMN LAYOUT: MAIN LIST EXPANDED, SEARCH PANEL AS SIDEBAR */}
      <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0, overflow: "hidden" }}>
        
        {/* LEFT COLUMN: THE TICKET / SCANNING LIST (TAKES ALMOST THE WHOLE SCREEN - FLEX: 1) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "24px", overflow: "hidden" }}>
          
          {/* Giant high-visibility total box at the top */}
          <div style={{ background: "#020817", padding: "18px 24px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1.5px" }}>Total de la Venta</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "52px", fontWeight: 900, color: "#10b981", fontFamily: "monospace", letterSpacing: "-2px", lineHeight: 1 }}>{formatPYG(roundedTotal)}</span>
                {discountPct > 0 && <span style={{ fontSize: "12px", fontWeight: "bold", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", padding: "2px 8px", borderRadius: "6px" }}>Desc. -{discountPct}%</span>}
              </div>
            </div>
            
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#e2e8f0", fontFamily: "monospace" }}>Subtotal: {formatPYG(baseSubtotal)}</span>
              {couponDiscounts > 0 && <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "bold", fontFamily: "monospace" }}>Desc. Cupones: -{formatPYG(couponDiscounts)}</span>}
              {applyCashback && <span style={{ fontSize: "12px", color: "#a855f7", fontWeight: "bold", fontFamily: "monospace" }}>Redimido Cashback: -{formatPYG(cashbackAmount)}</span>}
              <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>IVA 10%: {formatPYG(Math.round(iva10))} | IVA 5%: {formatPYG(Math.round(iva5))}</span>
            </div>
          </div>

          {/* Dynamic Fidelity Alerts linked to CRM */}
          {fidelityProfile && (
            <div style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(99,102,241,0.15) 100%)", borderBottom: "1px solid rgba(168,85,247,0.3)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "38px", height: "38px", background: "rgba(168,85,247,0.2)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(168,85,247,0.3)" }}>
                  <Award style={{ width: "20px", height: "20px", color: "#c084fc" }} />
                </div>
                <div>
                  <p style={{ color: "white", fontSize: "13px", fontWeight: "extrabold", margin: 0 }}>
                    Miembro del Club: <span style={{ color: "#c084fc" }}>{selectedCustomer?.nombre}</span> ({fidelityProfile.tier})
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "11px", margin: "2px 0 0 0" }}>
                    Acumulado: <span style={{ color: "white", fontWeight: "bold" }}>{fidelityProfile.points.toLocaleString()} pts</span> | Saldo Cashback disponible: <span style={{ color: "#34d399", fontWeight: "bold" }}>{formatPYG(fidelityProfile.cashback)}</span>
                  </p>
                </div>
              </div>

              {/* Coupons and Cashback Redemeer */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {fidelityProfile.coupons.map((cp: any) => {
                  const isActive = appliedCoupons.includes(cp.id)
                  return (
                    <button
                      key={cp.id}
                      onClick={() => toggleCoupon(cp.id, cp.label)}
                      style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: isActive ? "#3b82f6" : "rgba(15,23,42,0.6)", border: `1px solid ${isActive ? "#3b82f6" : "rgba(168,85,247,0.4)"}`, color: isActive ? "white" : "#c084fc", borderRadius: "10px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                    >
                      <Tag style={{ width: "12px", height: "12px" }} />
                      {cp.label} {isActive && <Check style={{ width: "12px", height: "12px", marginLeft: "2px" }} />}
                    </button>
                  )
                })}
                
                <button
                  onClick={toggleCashback}
                  style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: applyCashback ? "#a855f7" : "rgba(16,185,129,0.15)", border: `1px solid ${applyCashback ? "#a855f7" : "#10b981"}`, color: applyCashback ? "white" : "#34d399", borderRadius: "10px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                >
                  <Gift style={{ width: "12px", height: "12px" }} />
                  Usar Saldo {applyCashback ? "[Aplicado]" : `(${formatPYG(fidelityProfile.cashback)})`}
                </button>
              </div>
            </div>
          )}

          {/* Scanned Items list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {cart.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#334155" }}>
                <div style={{ padding: "32px", background: "rgba(30,41,59,0.2)", border: "1px solid rgba(30,41,59,0.4)", borderRadius: "50%", marginBottom: "16px" }}>
                  <ScanLine style={{ width: "64px", height: "64px", opacity: 0.3 }} />
                </div>
                <p style={{ fontSize: "18px", fontWeight: "extrabold", textTransform: "uppercase", letterSpacing: "3px", opacity: 0.5, color: "#94a3b8" }}>Terminal Lista para Escanear</p>
                <p style={{ fontSize: "13px", opacity: 0.4, marginTop: "4px" }}>Pase los productos por el lector de código de barras físico</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "12px 20px", background: "rgba(30,41,59,0.5)", border: "1px solid #1e293b", borderRadius: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold", color: "#64748b", fontFamily: "monospace" }}>#{index + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ color: "white", fontWeight: "extrabold", fontSize: "16px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</p>
                      <p style={{ color: "#475569", fontSize: "11px", fontFamily: "monospace", margin: "2px 0 0 0" }}>EAN: {item.sku}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#020817", padding: "4px", borderRadius: "12px", border: "1px solid #1e293b" }}>
                    <button onClick={() => updateQty(item.id, -1)} style={{ width: "28px", height: "28px", background: "#1e293b", border: "none", color: "white", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Minus style={{ width: 14, height: 14 }} /></button>
                    <span style={{ width: "36px", textAlign: "center", fontWeight: "bold", color: "white", fontFamily: "monospace", fontSize: "15px" }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} style={{ width: "28px", height: "28px", background: "#1e293b", border: "none", color: "white", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus style={{ width: 14, height: 14 }} /></button>
                  </div>

                  <div style={{ width: "120px", textAlign: "right" }}>
                    <p style={{ color: "white", fontWeight: "900", fontFamily: "monospace", fontSize: "18px", margin: 0 }}>{formatPYG(item.precio * item.quantity)}</p>
                    <p style={{ color: "#475569", fontSize: "11px", fontFamily: "monospace", margin: "2px 0 0 0" }}>
                      {item.quantity % 1 === 0 ? item.quantity : `${item.quantity.toFixed(3)} kg`} × {formatPYG(item.precio)}
                    </p>
                  </div>

                  <button onClick={() => { setPendingAuthAction({ type: "remove_item", payload: { itemId: item.id } }); setAuthModalOpen(true); }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "8px", borderRadius: "8px" }}><X style={{ width: 20, height: 20 }} /></button>
                </div>
              ))
            )}
          </div>

          {/* Scanner Manual Entry at the bottom */}
          <div style={{ background: "#020817", padding: "16px 20px", borderTop: "1px solid #1e293b", display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "8px 12px", color: "#10b981", fontSize: "11px", fontWeight: "bold" }}>
              <ScanLine style={{ width: "16px", height: "16px" }} /> LECTOR ESCÁNER ACTIVO
            </div>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                ref={barcodeRef}
                autoFocus
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={handleBarcode}
                placeholder="Esperando escaneo de código de barra..."
                style={{ width: "100%", background: "#0f172a", border: "2px solid #1e293b", color: "white", borderRadius: "14px", padding: "14px 16px 14px 16px", outline: "none", fontFamily: "monospace", fontWeight: "bold", fontSize: "16px", boxSizing: "border-box" }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SEARCH PANEL WITH MANY FALLBACKS & COBROS (WIDTH: 380px) */}
        <div style={{ width: "380px", display: "flex", flexDirection: "column", gap: "12px" }}>
          
          {/* SEARCH ENGINE & FALLBACKS LIST */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", overflow: "hidden" }}>
            <div style={{ padding: "14px", background: "#020817", borderBottom: "1px solid #1e293b" }}>
              <p style={{ color: "#475569", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px 0" }}>Buscador Manual de Productos</p>
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#64748b" }} />
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Buscar por Nombre, PLU o SKU..."
                  style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "8px 8px 8px 30px", outline: "none", fontSize: "12px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Scrollable search results list (The Fallbacks) */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {fallbackProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  style={{ width: "100%", background: "rgba(30,41,59,0.3)", border: "1px solid #1e293b", borderRadius: "12px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "background 0.15s", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,41,59,0.7)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(30,41,59,0.3)" }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: "8px" }}>
                    <span style={{ fontSize: "9px", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: "4px", color: "#94a3b8", fontFamily: "monospace" }}>{p.sku?.slice(-4) || "PLU"}</span>
                    <span style={{ color: "white", fontSize: "12px", fontWeight: "bold", marginLeft: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#10b981", fontFamily: "monospace" }}>{formatPYG(p.precio_venta ?? p.precio ?? 0)}</span>
                </button>
              ))}
              {fallbackProducts.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: "#475569", fontSize: "11px" }}>No se encontraron coincidencias</div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <button 
              onClick={() => setShowCustomerModal(true)}
              style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: "8px", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "12px", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "12px", overflow: "hidden" }}
            >
              <User style={{ width: "16px", height: "16px", color: "#3b82f6", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedCustomer ? (selectedCustomer.razon_social || selectedCustomer.nombre) : "Cliente Gral."}</span>
            </button>
            
            <button 
              onClick={() => {
                if (discountPct > 0) {
                  setDiscountPct(0)
                  toast.info("Descuento Removido", "")
                } else {
                  const val = window.prompt("Ingrese porcentaje de descuento manual (1-99):", "10")
                  if (val === null) return
                  const pct = Number(val)
                  if (isNaN(pct) || pct <= 0 || pct > 100) {
                    toast.error("Error", "Porcentaje de descuento inválido.")
                    return
                  }
                  setPendingAuthAction({ type: "apply_discount", payload: { percent: pct } })
                  setAuthModalOpen(true)
                }
              }}
              style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: "8px", background: discountPct > 0 ? "rgba(245,158,11,0.15)" : "#1e293b", border: `1px solid ${discountPct > 0 ? "#f59e0b" : "#334155"}`, color: discountPct > 0 ? "#f59e0b" : "white", padding: "12px", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}
            >
              <Percent style={{ width: "16px", height: "16px" }} />
              <span>Descuento</span>
            </button>

            <button 
              onClick={pauseCurrentSale}
              disabled={cart.length === 0}
              style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: "8px", background: "#1e293b", border: "1px solid #334155", color: "white", padding: "12px", borderRadius: "12px", cursor: cart.length === 0 ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "12px", opacity: cart.length === 0 ? 0.5 : 1 }}
            >
              <Pause style={{ width: "16px", height: "16px", color: "#a855f7" }} />
              <span>Pausar</span>
            </button>
          </div>

          {/* FACTURACIÓN & COBROS PANEL */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ color: "#475569", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 6px 0" }}>Centro de Cobros & Factura</p>
            
            <button
              onClick={() => handlePay("efectivo")}
              disabled={submitting || cart.length === 0}
              style={{ width: "100%", background: cart.length === 0 ? "#166534" : "#16a34a", color: "white", border: "none", padding: "14px 20px", borderRadius: "14px", fontSize: "15px", fontWeight: 900, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 12px rgba(22,163,74,0.2)" }}
            >
              <Banknote style={{ width: 20, height: 20 }} /> COBRAR EFECTIVO (F8)
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              <button
                onClick={() => handlePay("tarjeta")}
                disabled={submitting || cart.length === 0}
                style={{ background: cart.length === 0 ? "#1e40af" : "#2563eb", color: "white", border: "none", padding: "10px 4px", borderRadius: "10px", fontSize: "10px", fontWeight: 800, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              >
                <CreditCard style={{ width: 12, height: 12 }} /> TARJETA (F9)
              </button>

              <button
                onClick={() => handlePay("qr_spi")}
                disabled={submitting || cart.length === 0}
                style={{ background: cart.length === 0 ? "#155e75" : "#0891b2", color: "white", border: "none", padding: "10px 4px", borderRadius: "10px", fontSize: "10px", fontWeight: 800, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              >
                <QrCode style={{ width: 12, height: 12 }} /> QR BCP (F10)
              </button>

              <button
                onClick={() => handlePay("credito_cliente")}
                disabled={submitting || cart.length === 0}
                style={{ background: cart.length === 0 ? "#78350f" : "#d97706", color: "white", border: "none", padding: "10px 4px", borderRadius: "10px", fontSize: "10px", fontWeight: 800, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: cart.length === 0 ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              >
                <User style={{ width: 12, height: 12 }} /> CRÉDITO (F11)
              </button>
            </div>

            <button 
              onClick={() => {
                if (cart.length > 0) {
                  setPendingAuthAction({ type: "void_sale", payload: {} })
                  setAuthModalOpen(true)
                }
              }}
              disabled={cart.length === 0}
              style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "#64748b", cursor: cart.length === 0 ? "not-allowed" : "pointer", padding: "8px", borderRadius: "12px", fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginTop: "4px" }}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Vaciar Carrito (Esc)
            </button>
          </div>
        </div>

      </div>

      {/* CUSTOMER SELECTOR MODAL */}
      {showCustomerModal && (
        <div 
          onClick={() => setShowCustomerModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ background: "#0f172a", borderRadius: "24px", border: "1px solid #1e293b", padding: "24px", width: "420px", maxHeight: "70vh", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: "white", fontWeight: 800, fontSize: "16px", margin: 0 }}>Seleccionar Cliente</h3>
              <button onClick={() => setShowCustomerModal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X style={{ width: 20, height: 20 }} /></button>
            </div>
            
            <input 
              autoFocus 
              type="text" 
              placeholder="Buscar por nombre o RUC..."
              value={customerSearch} 
              onChange={e => setCustomerSearch(e.target.value)} 
              style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "10px", padding: "10px 12px", marginBottom: "12px", outline: "none", fontSize: "12px", boxSizing: "border-box" }}
            />

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
              <button 
                onClick={() => { setSelectedCustomer(null); setShowCustomerModal(false) }} 
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontWeight: "bold", fontSize: "11px", textTransform: "uppercase", textAlign: "left" }}
              >
                Cliente General / Ocasional
              </button>
              {customers.filter(c => (c.razon_social || c.nombre).toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 20).map(c => (
                <button 
                  key={c.id} 
                  onClick={() => { selectCustomerById(c); setShowCustomerModal(false); setCustomerSearch("") }} 
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "none", border: "none", color: "white", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}
                >
                  <span style={{ fontWeight: "bold", fontSize: "13px" }}>{c.razon_social || c.nombre}</span>
                  <span style={{ color: "#475569", fontSize: "10px", fontFamily: "monospace" }}>{c.ruc || c.ci}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FIDELITY ALERTS MODAL */}
      {showFidelityAlertModal && (
        <div 
          onClick={() => setShowFidelityAlertModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(2,8,23,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ 
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", 
              borderRadius: "24px", 
              border: "2px solid #8b5cf6", 
              boxShadow: "0 0 30px rgba(139, 92, 246, 0.4)", 
              padding: "28px", 
              width: "480px", 
              maxWidth: "100%", 
              display: "flex", 
              flexDirection: "column",
              gap: "20px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "48px", height: "48px", background: "rgba(168,85,247,0.2)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(168,85,247,0.4)" }}>
                <Award style={{ width: "28px", height: "28px", color: "#c084fc" }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: "white", fontWeight: 900, fontSize: "20px", margin: 0, letterSpacing: "-0.5px" }}>
                  ¡ALERTA CLUB SUPERMERCADO!
                </h3>
                <p style={{ color: "#a5b4fc", fontSize: "12px", margin: "2px 0 0 0", fontWeight: "bold" }}>
                  Cliente: {selectedCustomer?.nombre} ({fidelityProfile?.tier || "Miembro"})
                </p>
              </div>
              <button 
                onClick={() => setShowFidelityAlertModal(false)} 
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
              >
                <X style={{ width: 24, height: 24 }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {activeFidelityAlerts.map((alert, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    background: "rgba(139, 92, 246, 0.12)", 
                    border: "1px solid rgba(139, 92, 246, 0.3)", 
                    borderRadius: "14px", 
                    padding: "14px 18px", 
                    color: "white", 
                    fontSize: "14px", 
                    lineHeight: "1.5", 
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "10px"
                  }}
                >
                  <Sparkles style={{ width: "18px", height: "18px", color: "#c084fc", flexShrink: 0 }} />
                  <span>{alert}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
              <button 
                onClick={() => {
                  if (fidelityProfile) {
                    setAppliedCoupons(fidelityProfile.coupons.map((c: any) => c.id))
                    toast.success("Cupones Aplicados", "Se aplicaron todos los cupones disponibles.")
                  }
                  setShowFidelityAlertModal(false)
                }}
                style={{ 
                  background: "#8b5cf6", 
                  color: "white", 
                  border: "none", 
                  padding: "12px", 
                  borderRadius: "12px", 
                  fontWeight: "extrabold", 
                  fontSize: "13px", 
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <Tag style={{ width: "16px", height: "16px" }} /> Aplicar Beneficios
              </button>

              <button 
                onClick={() => {
                  toggleCashback()
                  setShowFidelityAlertModal(false)
                }}
                style={{ 
                  background: "rgba(16,185,129,0.2)", 
                  color: "#34d399", 
                  border: "1px solid rgba(16,185,129,0.4)", 
                  padding: "12px", 
                  borderRadius: "12px", 
                  fontWeight: "extrabold", 
                  fontSize: "13px", 
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <Gift style={{ width: "16px", height: "16px" }} /> Redimir Cashback
              </button>
            </div>

            <button 
              onClick={() => setShowFidelityAlertModal(false)}
              style={{ 
                background: "none", 
                border: "1px solid #334155", 
                color: "#94a3b8", 
                padding: "10px", 
                borderRadius: "12px", 
                fontWeight: "bold", 
                fontSize: "12px", 
                cursor: "pointer" 
              }}
            >
              Cerrar y Continuar Venta
            </button>
          </div>
        </div>
      )}

      {/* SUPERVISOR OVERRIDE MODAL */}
      {authModalOpen && pendingAuthAction && (
        <div 
          onClick={() => { setAuthModalOpen(false); setPendingAuthAction(null); setRemoteRequestSent(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ background: "#0b0f19", border: "2px solid #3b82f6", boxShadow: "0 0 25px rgba(59,130,246,0.3)", borderRadius: "24px", padding: "24px", width: "400px", display: "flex", flexDirection: "column", gap: "16px", textAlign: "center", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#3b82f6", fontSize: "14px", fontWeight: "bold" }}>
                <ShieldCheck style={{ width: 18, height: 18 }} /> SEGURIDAD: AUTORIZACIÓN
              </span>
              <button 
                onClick={() => { setAuthModalOpen(false); setPendingAuthAction(null); setRemoteRequestSent(false); }} 
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ marginTop: "10px" }}>
              <h3 style={{ color: "white", fontSize: "18px", fontWeight: 800, margin: 0 }}>
                {pendingAuthAction.type === "remove_item" && "Anulación de Ítem"}
                {pendingAuthAction.type === "apply_discount" && "Descuento Manual Especial"}
                {pendingAuthAction.type === "void_sale" && "Anulación Completa de Venta"}
                {pendingAuthAction.type === "drop_cash" && "Retiro de Efectivo (Drop Cash)"}
                {pendingAuthAction.type === "discard_paused" && "Eliminar Venta Pausada"}
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                Esta acción requiere la validación de un supervisor para continuar.
              </p>
            </div>

            {remoteRequestSent ? (
              <div style={{ padding: "30px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <Loader2 style={{ width: 36, height: 36, color: "#3b82f6", animation: "spin 1s linear infinite" }} />
                <p style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>Solicitud enviada al celular del Supervisor...</p>
                <p style={{ color: "#64748b", fontSize: "11px" }}>Esperando confirmación remota PWA (Simulado 5s)...</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ background: "rgba(59,130,246,0.05)", border: "1px dashed rgba(59,130,246,0.3)", padding: "16px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <ScanLine style={{ width: 24, height: 24, color: "#3b82f6", margin: "0 auto" }} />
                  <p style={{ color: "white", fontSize: "13px", fontWeight: "bold", margin: 0 }}>ESCANEÉ CREDENCIAL QR</p>
                  <p style={{ color: "#64748b", fontSize: "10px", margin: 0 }}>Acerque el código QR de su credencial al lector láser de caja</p>
                </div>

                <div style={{ color: "#475569", fontSize: "11px", fontWeight: "bold" }}>o también</div>

                <button 
                  type="button"
                  onClick={triggerRemoteAuthRequest}
                  style={{ width: "100%", background: "rgba(59,130,246,0.1)", border: "1px solid #3b82f6", color: "#60a5fa", padding: "12px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Sparkles style={{ width: 14, height: 14 }} /> Solicitar Aprobación Remota (PWA)
                </button>
              </div>
            )}

            <div style={{ background: "#020817", padding: "10px", borderRadius: "10px", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: "10px", color: "#64748b" }}>Teclado del Escáner Activo para entrada directa</span>
            </div>
          </div>
        </div>
      )}

      {/* VENTAS EN PAUSA PANEL */}
      {showPausedSalesPanel && (
        <div 
          onClick={() => setShowPausedSalesPanel(false)}
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            style={{ width: "400px", height: "100%", background: "#0b0f19", borderLeft: "1px solid #1e293b", padding: "24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "-5px 0 25px rgba(0,0,0,0.5)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "white", fontSize: "18px", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Pause style={{ width: 18, height: 18, color: "#a855f7" }} /> Ventas Suspendidas
              </h3>
              <button 
                onClick={() => setShowPausedSalesPanel(false)} 
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <p style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>
              Seleccione una venta suspendida para recuperarla o requiera validación para descartarla.
            </p>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              {pausedSales.map((ps) => {
                const totalAmount = ps.items.reduce((s: number, i: any) => s + i.precio * i.quantity, 0)
                const elapsedSecs = Math.round((Date.now() - new Date(ps.timestamp).getTime()) / 1000)
                const timeText = elapsedSecs < 60 ? `hace ${elapsedSecs} seg` : `hace ${Math.round(elapsedSecs / 60)} min`
                return (
                  <div key={ps.id} style={{ background: "rgba(30,41,59,0.3)", border: "1px solid #1e293b", borderRadius: "16px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: "10px", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold", fontFamily: "monospace" }}>{ps.id}</span>
                        <h4 style={{ color: "white", fontSize: "13px", fontWeight: "bold", margin: "6px 0 0 0" }}>
                          {ps.customer ? ps.customer.nombre : "Cliente Ocasional / General"}
                        </h4>
                      </div>
                      <span style={{ fontSize: "10px", color: "#64748b" }}>{timeText}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e293b", paddingTop: "10px", fontSize: "12px" }}>
                      <span style={{ color: "#94a3b8" }}>{ps.items.length} productos</span>
                      <span style={{ color: "#10b981", fontWeight: "bold", fontFamily: "monospace" }}>{formatPYG(totalAmount)}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                      <button 
                        onClick={() => resumeSale(ps.id)}
                        style={{ background: "#2563eb", border: "none", color: "white", padding: "8px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Recuperar
                      </button>
                      <button 
                        onClick={() => discardPausedSale(ps.id)}
                        style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", padding: "8px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )
              })}
              {pausedSales.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: "12px" }}>
                  No hay transacciones en pausa.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
