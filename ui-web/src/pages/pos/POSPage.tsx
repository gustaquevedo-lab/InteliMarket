import { useState, useEffect } from "react"
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Send, ScanLine, X, Loader2, User, WifiOff, Warehouse, Link as LinkIcon, ExternalLink, Copy, CheckCheck, QrCode, Wallet, Printer, RefreshCw, Pause, Play, Percent, Undo2, Divide, ShoppingCart } from "lucide-react"
import { api, type Product, type Customer, type Warehouse as WarehouseType, type ScaleConfig } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useOffline } from "../../context/OfflineContext"
import { formatPYG } from "../../utils/format"
import { startCartAutoSave, stopCartAutoSave, restoreCart } from "../../utils/syncManager"
import { usePOSKeyboard, roundPY, playSuccess, playError, playBeep, useSessionTimeout } from "../../utils/posUtils"
import { generateShiftReport, formatShiftReport, type ShiftReport, applyPromotions, calculatePoints, pointsToDiscount } from "../../utils/posAdvanced"
import type { CachedProduct } from "../../utils/offlineDB"
import { useFeatures } from "../../context/FeatureContext"
import { pharmaApi, type PharmaMedication } from "../../api/pharma"
import { usePharmaPOSIntegration, type PharmaCartInfo } from "../../hooks/usePharmaPOSIntegration"

interface CartItem {
  id: string
  nombre: string
  precio: number
  categoria: string
  sku: string
  quantity: number
  iva_tasa: number
  costo_unitario?: number
  medication_id?: string
  es_controlado?: boolean
  requiere_cadena_frio?: boolean
  es_generico?: boolean
  concentracion?: string
  forma_farmaceutica?: string
  laboratorio?: string | null
  registro_sanitario?: string | null
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")
  const [search, setSearch] = useState("")
  const [barcode, setBarcode] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [categoria, setCategoria] = useState("Todas")
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("")
  const [showCustomerSelect, setShowCustomerSelect] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPagoparLink, setShowPagoparLink] = useState(false)
  const [pagoparUrl, setPagoparUrl] = useState("")
  const [pagoparOrderId, setPagoparOrderId] = useState("")
  const [showKuapayLink, setShowKuapayLink] = useState(false)
  const [kuapayQrUrl, setKuapayQrUrl] = useState<string | null>(null)
  const [kuapayCheckoutUrl, setKuapayCheckoutUrl] = useState("")
  const [kuapayOrderId, setKuapayOrderId] = useState("")
  const [copied, setCopied] = useState(false)
  const [showBancardModal, setShowBancardModal] = useState(false)
  const [bancardUrl, setBancardUrl] = useState("")
  const [bancardOrderId, setBancardOrderId] = useState("")
  const [showSpiQr, setShowSpiQr] = useState(false)
  const [spiQrImage, setSpiQrImage] = useState("")
  const [spiOrderId, setSpiOrderId] = useState("")
  const [spiPaymentId, setSpiPaymentId] = useState("")
  const [spiStatus, setSpiStatus] = useState("pending")
  const [spiVerifying, setSpiVerifying] = useState(false)
  const [showDinelcoModal, setShowDinelcoModal] = useState(false)
  const [dinelcoUrl, setDinelcoUrl] = useState("")
  const [dinelcoOrderId, setDinelcoOrderId] = useState("")
  const [showSplitPayment, setShowSplitPayment] = useState(false)
  const [splitAmount1, setSplitAmount1] = useState(0)
  const [splitMethod1, setSplitMethod1] = useState("efectivo")
  const [splitMethod2, setSplitMethod2] = useState("tarjeta")
  const [heldSale, setHeldSale] = useState<{ cart: CartItem[]; customer: Customer | null } | null>(null)
  const [discountPct, setDiscountPct] = useState(0)
  const [lastCompletedSale, setLastCompletedSale] = useState<{ items: CartItem[]; total: number } | null>(null)
  const [priceCheck, setPriceCheck] = useState(false)
  const [showCustomerDisplay, setShowCustomerDisplay] = useState(false)
  const [showShiftReport, setShowShiftReport] = useState(false)
  const [shiftReport, setShiftReport] = useState<ShiftReport | null>(null)
  const [cashInDrawer, setCashInDrawer] = useState(0)
  const [completedSales, setCompletedSales] = useState<Array<{ total: number; payment_method: string; iva_10: number; iva_5: number; estado: string; descuento: number }>>([])
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false)
  const [redeemAmount, setRedeemAmount] = useState(0)
  const [showKitchen, setShowKitchen] = useState(false)
  const [kitchenOrders, setKitchenOrders] = useState<Array<{ id: string; items: CartItem[]; timestamp: string; estado: string }>>([])
  const [favorites, setFavorites] = useState<CartItem[]>([])
  const toast = useToast()
  const { isOnline, pendingSalesCount, saveCartOffline, addPendingSale, cachedProducts, cachedCustomers, syncCatalog, generateReceipt, saveReceipt } = useOffline()
  const { pharmaEnabled, getMedicationInfo, handlePharmaPostSale, expirationAlerts } = usePharmaPOSIntegration()
  const { verticalSlug } = useFeatures()
  const [showEquivalents, setShowEquivalents] = useState<string | null>(null)
  const [equivalentMeds, setEquivalentMeds] = useState<PharmaMedication[]>([])

  // Scale weighing state
  const [showScaleModal, setShowScaleModal] = useState(false)
  const [scaleProduct, setScaleProduct] = useState<Product | null>(null)
  const [scales, setScales] = useState<ScaleConfig[]>([])
  const [selectedScaleId, setSelectedScaleId] = useState("")
  const [scaleWeight, setScaleWeight] = useState(0)
  const [scalePrecioUnitario, setScalePrecioUnitario] = useState(0)
  const [scaleSubtotal, setScaleSubtotal] = useState(0)
  const [scaleReading, setScaleReading] = useState(false)
  const [scaleEstable, setScaleEstable] = useState(true)
  const [scaleLoadingScales, setScaleLoadingScales] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [productsData, customersData, warehousesData] = await Promise.allSettled([
        api.products.list({ activo: true }),
        api.customers.list({ activo: true }),
        api.warehouses.list(),
      ])
      if (productsData.status === "fulfilled") setProducts(productsData.value)
      else if (cachedProducts.length > 0) {
        setProducts(cachedProducts.map(p => p.data as Product))
      }
      if (customersData.status === "fulfilled") setCustomers(customersData.value)
      else if (cachedCustomers.length > 0) {
        setCustomers(cachedCustomers as unknown as Customer[])
      }
      if (warehousesData.status === "fulfilled") {
        setWarehouses(warehousesData.value)
        if (warehousesData.value.length > 0 && !selectedWarehouse) {
          setSelectedWarehouse(warehousesData.value[0].id)
        }
      }
    } catch {
      if (cachedProducts.length > 0) setProducts(cachedProducts.map(p => p.data as Product))
      if (cachedCustomers.length > 0) setCustomers(cachedCustomers as unknown as Customer[])
    } finally {
      setLoading(false)
    }
  }

  const loadScales = async () => {
    setScaleLoadingScales(true)
    try {
      const data = await api.scales.configs.list()
      setScales(data.filter(s => s.activa))
      if (data.length > 0 && !selectedScaleId) setSelectedScaleId(data[0].id)
    } catch {
      // scales unavailable — non-blocking
    } finally {
      setScaleLoadingScales(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Crash recovery — restore cart if browser crashed
  useEffect(() => {
    restoreCart().then(items => {
      if (items.length > 0) setCart(items.map(i => ({
        id: i.id, nombre: i.nombre, precio: i.precio, categoria: i.categoria,
        sku: i.sku, quantity: i.quantity, iva_tasa: i.iva_tasa,
      })))
    })
    startCartAutoSave(() => cart)
    return () => stopCartAutoSave()
  }, [])

  // Computed values
  const subtotal = cart.reduce((sum, item) => sum + item.precio * item.quantity, 0)
  const iva10 = cart.filter(i => i.iva_tasa === 10).reduce((sum, i) => sum + Math.round(i.precio * i.quantity * 0.1 / 1.1), 0)
  const iva5 = cart.filter(i => i.iva_tasa === 5).reduce((sum, i) => sum + Math.round(i.precio * i.quantity * 0.05 / 1.05), 0)
  const total = subtotal
  const roundedTotal = roundPY(total)
  const discountAmount = Math.round(total * discountPct / 100)
  const totalAfterDiscount = total - discountAmount

  // Handlers first, then shortcuts (need declared functions)
  const openScaleModal = (product: Product) => {
    setScaleProduct(product)
    setScaleWeight(0)
    setScalePrecioUnitario(product.precio || 0)
    setScaleSubtotal(0)
    setScaleEstable(true)
    setSelectedScaleId(scales.length > 0 ? scales[0].id : "")
    setShowScaleModal(true)
    if (scales.length === 0) loadScales()
  }

  const addToCart = (product: Product) => {
        if (product.tipo_venta === "pesable") {
      openScaleModal(product)
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      const medInfo = pharmaEnabled ? getMedicationInfo(product.id) : null
      return [...prev, {
        id: product.id, nombre: product.nombre, precio: 0,
        categoria: product.categoria?.nombre || "", sku: product.sku,
        quantity: 1, iva_tasa: product.iva_tasa || 10,
        ...(medInfo ? {
          medication_id: medInfo.medication_id, es_controlado: medInfo.es_controlado,
          requiere_cadena_frio: medInfo.requiere_cadena_frio, es_generico: medInfo.es_generico,
          concentracion: medInfo.concentracion, forma_farmaceutica: medInfo.forma_farmaceutica,
          laboratorio: medInfo.laboratorio, registro_sanitario: medInfo.registro_sanitario,
        } : {}),
      }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id)
      if (!item) return prev
      const newQty = item.quantity + delta
      if (newQty <= 0) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, quantity: newQty } : i)
    })
  }

  const updatePrice = (id: string, price: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, precio: price } : i))
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id))
  const handleBarcode = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && barcode.trim()) {
      const product = products.find(p =>
        p.codigo_barra === barcode.trim() ||
        p.sku === barcode.trim()
      )
      if (product) {
        if (priceCheck) {
          toast.info(product.nombre, `Precio: ${formatPYG(product.precio || 0)} | Stock: ${product.stock || 0}`)
          playBeep(600, 100)
          setBarcode("")
          return
        }
    if (product.tipo_venta === "pesable") {
          addToCart(product)
          setBarcode("")
          playBeep(600, 100)
          return
        }
        addToCart(product)
        setBarcode("")
        playSuccess()
        toast.success(product.nombre, "Agregado")
      } else {
        playError()
        toast.error("No encontrado", "Código no existe")
      }
    }
  }

  // Discount handlers
  const applyDiscount = (pct: number) => { setDiscountPct(discountPct === pct ? 0 : pct) }

  // Hold sale (F5)
  const holdSale = () => {
    if (cart.length === 0) return
    setHeldSale({ cart: [...cart], customer: selectedCustomer })
    setCart([])
    setSelectedCustomer(null)
    toast.success("Venta estacionada", "Presioná F6 para recuperar")
  }

  // Recover sale (F6)
  const recoverSale = () => {
    if (!heldSale) return
    setCart(heldSale.cart)
    setSelectedCustomer(heldSale.customer)
    setHeldSale(null)
    playSuccess()
    toast.success("Venta recuperada", `${heldSale.cart.length} productos`)
  }

  // Undo last sale (Ctrl+Z)
  const undoLastSale = () => {
    if (!lastCompletedSale) { toast.info("Nada para deshacer", ""); return }
    setCart(lastCompletedSale.items)
    setLastCompletedSale(null)
    playSuccess()
    toast.success("Venta restaurada", "Productos devueltos al carrito")
  }

  // Split payment
  const handleSplitPayment = async () => {
    const remaining = totalAfterDiscount - splitAmount1
    if (splitAmount1 <= 0 || remaining <= 0) {
      toast.error("Error", "Montos inválidos para pago dividido")
      return
    }
    setSubmitting(true)
    try {
      await api.sales.create({
        customer_id: selectedCustomer?.id,
        condicion: "contado",
        items: cart.map(item => ({ product_id: item.id, cantidad: item.quantity, precio_unitario: item.precio })),
      })
      playSuccess()
      setLastCompletedSale({ items: [...cart], total: totalAfterDiscount })
      setCart([])
      setDiscountPct(0)
      setShowSplitPayment(false)
      toast.success("Pago dividido", `${formatPYG(splitAmount1)} ${splitMethod1} + ${formatPYG(remaining)} ${splitMethod2}`)
    } catch { toast.error("Error", "No se pudo procesar el pago") }
    finally { setSubmitting(false) }
  }

  const topProducts = products.filter(p => (p.stock || 0) > 0).slice(0, 8)

  const categorias = ["Todas", ...Array.from(new Set(products.map(p => p.categoria?.nombre || p.sku.split("-")[0])))]

  const filtered = products.filter(p => {
    const catNombre = p.categoria?.nombre || p.sku.split("-")[0]
    return (!search || p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || (p.codigo_barra?.toLowerCase().includes(search.toLowerCase()) ?? false)) && (categoria === "Todas" || catNombre === categoria)
  })

  const filteredCustomers = customers.filter(c =>
    !customerSearch || (c.razon_social || "").toLowerCase().includes(customerSearch.toLowerCase()) || (c.ruc?.includes(customerSearch) ?? false) || (c.ci?.includes(customerSearch) ?? false)
  )

  const toggleCustomerDisplay = () => { setShowCustomerDisplay(!showCustomerDisplay) }

  const generateReport = (tipo: "X" | "Z") => {
    const report = generateShiftReport(tipo, completedSales, cashInDrawer, "Cajero", "InteliMarket", new Date())
    setShiftReport(report)
    setShowShiftReport(true)
  }

  const sendToKitchen = () => {
    if (cart.length === 0) return
    const order = { id: crypto.randomUUID(), items: [...cart], timestamp: new Date().toISOString(), estado: "pendiente" }
    setKitchenOrders(prev => [order, ...prev])
    playSuccess()
    toast.success("Enviado", "Pedido enviado a cocina")
    setCart([])
  }

  usePOSKeyboard({
    onEfectivo: () => handlePay("efectivo"),
    onTarjeta: () => handlePay("tarjeta"),
    onCustomer: () => setShowCustomerSelect(true),
    onSearch: () => document.querySelector<HTMLInputElement>('[placeholder="Buscar producto..."]')?.focus(),
    onBarcode: () => document.querySelector<HTMLInputElement>('[placeholder="Código barras"]')?.focus(),
    onDiscount: () => applyDiscount(10),
    onHold: holdSale,
    onRecover: recoverSale,
    onUndo: undoLastSale,
    onNewSale: () => { setCart([]); setDiscountPct(0); setSelectedCustomer(null) },
    onQuantityDouble: () => { if (cart.length > 0) updateQuantity(cart[cart.length-1].id, 1) },
    onQuantityTriple: () => { if (cart.length > 0) updateQuantity(cart[cart.length-1].id, 2) },
    onCancelar: () => { if (showPayment) setShowPayment(false); else if (showCustomerSelect) setShowCustomerSelect(false) },
    onPayment: () => setShowPayment(true),
  })

  const handlePay = async (method: string) => {
    if (cart.length === 0) {
      toast.error("Error", "El carrito está vacío")
      return
    }
    if (method === "credito") {
      if (!selectedCustomer) {
        toast.error("Error", "Seleccioná un cliente para venta a crédito")
        return
      }
      try {
        const account = await api.creditAccounts.getByCustomer(selectedCustomer.id)
        if (!account || !account.activo) {
          toast.error("Error", "El cliente no tiene cuenta de crédito activa")
          return
        }
        if ((account.saldo_disponible || 0) < total) {
          toast.error("Error", `Crédito insuficiente. Disponible: ${formatPYG(account.saldo_disponible)}`)
          return
        }
      } catch {
        toast.info("Info", "No se pudo verificar el crédito. Continuando...")
      }
    }
    setPaymentMethod(method)
    setShowPayment(true)
  }

  const handleConfirmPayment = async () => {
    setSubmitting(true)
    const saleNumber = `POS-${Date.now()}`
    try {
      const saleData = {
        customer_id: selectedCustomer?.id,
        condicion: paymentMethod === "credito" ? "credito" : "contado",
        items: cart.map(item => ({
          product_id: item.id,
          cantidad: item.quantity,
          precio_unitario: item.precio,
        })),
      }

      if (!isOnline) {
        const saleId = await addPendingSale(saleData)
        const receipt = generateReceipt(
          saleNumber,
          cart.map(i => ({ nombre: i.nombre, cantidad: i.quantity, precio: i.precio, total: i.precio * i.quantity })),
          roundedTotal, iva10, iva5, paymentMethod,
          selectedCustomer?.razon_social || null, "InteliMarket"
        )
        await saveReceipt(saleId, saleNumber, receipt.html)
        receipt.print()
        if (pharmaEnabled) await handlePharmaPostSale(saleId, cart, selectedCustomer?.id)
        playSuccess()
        toast.success(roundPY(roundedTotal) === roundedTotal ? `Cobrado: ${formatPYG(roundedTotal)}` : `Cobrado: ${formatPYG(roundedTotal)} (redondeado)`, "Se sincronizará al reconectar")
      } else {
        const result = await api.sales.create(saleData)
        if ((result as any).estado === "pend_aprob_credito") {
          // Excede el limite de credito del cliente: la venta queda
          // retenida (sin stock descontado, sin recibo) hasta que
          // Supervisor y Gerente la aprueben desde "Aprobaciones de crédito".
          toast.error(
            "Venta pendiente de aprobación",
            `Excede el límite de crédito de ${selectedCustomer?.razon_social || "el cliente"}. Un Supervisor y un Gerente deben aprobarla antes de despachar.`
          )
        } else {
          const saleId = (result as any).id || saleNumber
          if (pharmaEnabled) await handlePharmaPostSale(saleId, cart, selectedCustomer?.id)
          const receipt = generateReceipt(
            (result as any).numero || saleNumber,
            cart.map(i => ({ nombre: i.nombre, cantidad: i.quantity, precio: i.precio, total: i.precio * i.quantity })),
            roundedTotal, iva10, iva5, paymentMethod,
            selectedCustomer?.razon_social || null, "InteliMarket"
          )
          receipt.print()
          playSuccess()
          toast.success("Venta completada", `${formatPYG(roundedTotal)} - ${paymentMethod}`)
        }
      }
      setLastCompletedSale({ items: [...cart], total: roundedTotal })
      setCart([])
      setDiscountPct(0)
      setShowPayment(false)
      setPaymentMethod("")
    } catch {
      toast.error("Error", "No se pudo procesar la venta")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePagoparLink = async () => {
    if (cart.length === 0) {
      toast.error("Error", "El carrito está vacío")
      return
    }
    setSubmitting(true)
    try {
      const orderId = `POS-${Date.now()}`
      const result = await api.pagopar.checkout({
        amount: total,
        descripcion: `Venta POS - ${cart.map(i => i.nombre).slice(0, 3).join(", ")}${cart.length > 3 ? "..." : ""}`,
        order_id: orderId,
        customer_email: selectedCustomer?.email || "cliente@intelimarket.py",
        customer_name: selectedCustomer?.razon_social || "Cliente",
        customer_phone: selectedCustomer?.telefono || undefined,
        customer_ci: selectedCustomer?.ruc || selectedCustomer?.ci || undefined,
      })
      setPagoparUrl(result.checkout_url)
      setPagoparOrderId(orderId)
      setShowPagoparLink(true)
      setShowPayment(false)
    } catch {
      toast.error("Error", "No se pudo generar el link de pago")
    } finally {
      setSubmitting(false)
    }
  }

  const handleKuapayLink = async () => {
    if (cart.length === 0) {
      toast.error("Error", "El carrito está vacío")
      return
    }
    setSubmitting(true)
    try {
      const orderId = `POS-K-${Date.now()}`
      const result = await api.kuapay.checkout({
        amount: total,
        description: `Venta POS - ${cart.map(i => i.nombre).slice(0, 3).join(", ")}${cart.length > 3 ? "..." : ""}`,
        order_id: orderId,
        customer_email: selectedCustomer?.email || "cliente@intelimarket.py",
        customer_name: selectedCustomer?.razon_social || "Cliente",
        customer_phone: selectedCustomer?.telefono || undefined,
        customer_ci: selectedCustomer?.ruc || selectedCustomer?.ci || undefined,
        payment_method: "qr",
      })
      setKuapayQrUrl(result.qr_image_url)
      setKuapayCheckoutUrl(result.checkout_url || "")
      setKuapayOrderId(orderId)
      setShowKuapayLink(true)
      setShowPayment(false)
      if (result.checkout_url) window.open(result.checkout_url, "_blank")
    } catch {
      toast.error("Error", "No se pudo generar el QR de pago")
    } finally {
      setSubmitting(false)
    }
  }

  const handleBancardLink = async () => {
    if (cart.length === 0) { toast.error("Error", "El carrito está vacío"); return }
    setSubmitting(true)
    try {
      const orderId = `POS-BC-${Date.now()}`
      const desc = `Venta POS - ${cart.map(i => i.nombre).slice(0, 2).join(", ")}`
      const result = await api.bancard.checkout(total, desc, orderId)
      setBancardUrl(result.checkout_url ?? "")
      setBancardOrderId(orderId)
      setShowBancardModal(true)
      if (result.checkout_url) window.open(result.checkout_url, "_blank")
    } catch { toast.error("Error", "No se pudo procesar con Bancard") }
    finally { setSubmitting(false) }
  }

  const handleDinelcoLink = async () => {
    if (cart.length === 0) { toast.error("Error", "El carrito está vacío"); return }
    setSubmitting(true)
    try {
      const orderId = `POS-DL-${Date.now()}`
      const result = await api.dinelco.checkout(total, "Venta POS", orderId, selectedCustomer?.email || "", selectedCustomer?.razon_social || "")
      setDinelcoUrl(result.checkout_url ?? "")
      setDinelcoOrderId(orderId)
      setShowDinelcoModal(true)
      if (result.checkout_url) window.open(result.checkout_url, "_blank")
    } catch { toast.error("Error", "No se pudo procesar con Dinelco") }
    finally { setSubmitting(false) }
  }

  const handleSpiQr = async () => {
    if (cart.length === 0) { toast.error("Error", "El carrito está vacío"); return }
    setSubmitting(true)
    try {
      const orderId = `POS-SPI-${Date.now()}`
      const result = await api.spi.generateQr(total, orderId, "Venta POS")
      setSpiQrImage(result.qr_image_url ?? result.qr_image_base64 ?? "")
      setSpiOrderId(result.order_id ?? orderId)
      setSpiPaymentId(result.payment_id ?? result.id ?? "")
      setSpiStatus("pending")
      setShowSpiQr(true)
    } catch { toast.error("Error", "No se pudo generar QR BCP") }
    finally { setSubmitting(false) }
  }

  const handleVerifySpi = async () => {
    if (!spiOrderId) return
    setSpiVerifying(true)
    try {
      const result = await api.spi.verify(spiOrderId)
      setSpiStatus(result.estado ?? result.status ?? "pending")
      if (result.status === "approved" || result.estado === "approved") {
        toast.success("Pago confirmado", "El pago SPI QR fue confirmado")
      }
    } catch { toast.error("Error", "No se pudo verificar el pago") }
    finally { setSpiVerifying(false) }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pagoparUrl)
    setCopied(true)
    toast.success("Link copiado", "El link de pago fue copiado al portapapeles")
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    const offlineCart = cart.map(i => ({
      id: i.id,
      nombre: i.nombre,
      precio: i.precio,
      quantity: i.quantity,
      iva_tasa: i.iva_tasa,
      sku: i.sku,
      categoria: i.categoria,
    }))
    saveCartOffline(offlineCart)
  }, [cart])

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
      {/* Offline Banner */}
      {!isOnline ? (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2 text-red-700 dark:text-red-400">
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-bold">Sin conexión</span>
          <span className="text-xs">Catálogo local activo</span>
          {pendingSalesCount > 0 && (
            <span className="ml-auto text-xs font-bold bg-red-200 dark:bg-red-800 px-2 py-0.5 rounded-full">{pendingSalesCount} pendiente(s)</span>
          )}
          <button onClick={syncCatalog} className="ml-2 p-1 rounded-lg hover:bg-red-200 dark:hover:bg-red-800"><RefreshCw className="w-3 h-3" /></button>
        </div>
      ) : pendingSalesCount > 0 ? (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 text-amber-700 dark:text-amber-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm font-bold">Sincronizando</span>
          <span className="text-xs">{pendingSalesCount} venta(s) pendiente(s)</span>
        </div>
      ) : null}

      {/* Pharma expiration alerts */}
      {pharmaEnabled && expirationAlerts.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2 text-red-700 dark:text-red-400">
          <span className="text-sm font-bold">Vencimientos críticos: {expirationAlerts.length}</span>
          <span className="text-xs">{expirationAlerts.slice(0, 3).map(a => `Lote ${a.lote} (${a.dias_restantes}d)`).join(", ")}{expirationAlerts.length > 3 ? "..." : ""}</span>
        </div>
      )}


      {verticalSlug === 'supermercado' ? (
        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* LEFT: Huge Receipt & Scanner */}
          <div className="flex-1 flex flex-col bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">CAJA RÁPIDA</h2>
                  <p className="text-xs text-emerald-400 font-bold tracking-widest uppercase">InteliMarket POS</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-emerald-400 tracking-tighter drop-shadow-md">{formatPYG(roundedTotal)}</div>
                <div className="text-xs text-slate-400 font-bold">TOTAL A COBRAR</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                  <ScanLine className="w-20 h-20 mb-4 opacity-20" />
                  <p className="text-2xl font-black opacity-40 uppercase tracking-widest">Caja Lista</p>
                  <p className="text-sm font-medium opacity-40">Escanee un producto</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={item.id + index} className="flex flex-col bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-lg font-bold text-white truncate leading-tight">{item.nombre}</p>
                        <p className="text-xs font-mono text-slate-400">{item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">{formatPYG(item.precio * item.quantity)}</p>
                        <p className="text-xs font-mono text-slate-400">{item.quantity} x {formatPYG(item.precio)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-white"><Minus className="w-4 h-4" /></button>
                        <span className="w-10 text-center text-lg font-bold font-mono text-white">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-white"><Plus className="w-4 h-4" /></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-red-400 p-2"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-950 p-4 border-t border-slate-800 z-10">
              <div className="relative">
                <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
                <input 
                  autoFocus
                  className="w-full bg-slate-900 border-2 border-slate-700 text-white text-xl p-4 pl-14 rounded-2xl focus:border-emerald-500 focus:ring-0 outline-none font-mono placeholder-slate-600 transition-colors" 
                  placeholder="Escanear código de barras..." 
                  value={barcode} 
                  onChange={(e) => setBarcode(e.target.value)} 
                  onKeyDown={handleBarcode} 
                />
              </div>
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none"></div>
          </div>

          {/* RIGHT: Keypad & Actions */}
          <div className="w-[400px] flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowCustomerSelect(true)} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-2xl border border-slate-700 transition-all font-bold">
                <User className="w-5 h-5 text-blue-400" />
                <span className="truncate max-w-[120px]">{selectedCustomer ? selectedCustomer.razon_social : "Cliente Gral"}</span>
              </button>
              <button onClick={() => setCart([])} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-900/30 text-white p-4 rounded-2xl border border-slate-700 transition-all font-bold">
                <Trash2 className="w-5 h-5 text-red-400" />
                Anular Ticket
              </button>
            </div>

            <div className="flex-1 bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-4 flex flex-col justify-between">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "00", 0, "."].map((num) => (
                  <button key={num} onClick={() => {
                    // Simulating a numpad for barcode or quantity entry.
                    // For now, it just appends to the barcode input.
                    setBarcode(prev => prev + num)
                  }} className="bg-slate-800 hover:bg-slate-700 text-white text-2xl font-bold py-5 rounded-xl border border-slate-700 active:bg-emerald-600 active:border-emerald-500 transition-colors">
                    {num}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <button onClick={() => handlePay("efectivo")} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-black py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95">
                  <Banknote className="w-6 h-6" />
                  COBRAR EFECTIVO (F1)
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handlePay("tarjeta")} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95">
                    <CreditCard className="w-5 h-5" />
                    Tarjeta (F2)
                  </button>
                  <button onClick={handleSpiQr} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95">
                    <QrCode className="w-5 h-5" />
                    QR BCP
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setPriceCheck(!priceCheck)} className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 border transition-colors ${priceCheck ? "bg-amber-900/50 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"}`}>
                <ScanLine className="w-5 h-5" />
                <span className="text-[10px] font-bold">Verificar</span>
              </button>
              <button onClick={holdSale} className="p-3 rounded-xl flex flex-col items-center justify-center gap-1 border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <Pause className="w-5 h-5" />
                <span className="text-[10px] font-bold">Pausa (F5)</span>
              </button>
              <button onClick={recoverSale} className="p-3 rounded-xl flex flex-col items-center justify-center gap-1 border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <Play className="w-5 h-5" />
                <span className="text-[10px] font-bold">Recup. (F6)</span>
              </button>
              <button onClick={() => applyDiscount(10)} className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1 border transition-colors ${discountPct === 10 ? "bg-green-900/50 border-green-500 text-green-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"}`}>
                <Percent className="w-5 h-5" />
                <span className="text-[10px] font-bold">-10% (F8)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="flex gap-4 flex-1">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Actions bar */}
          <div className="flex gap-2 overflow-x-auto">
            <button onClick={() => generateReport("X")} className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-500 hover:bg-gray-50 font-bold">Reporte X</button>
            <button onClick={() => generateReport("Z")} className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-500 hover:bg-gray-50 font-bold">Reporte Z</button>
            <button onClick={sendToKitchen} disabled={cart.length === 0} className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-amber-100 dark:bg-amber-900/20 border border-amber-200 text-amber-600 hover:bg-amber-200 font-bold disabled:opacity-30">Cocina</button>
            {selectedCustomer && (
              <button onClick={() => setShowLoyaltyModal(true)} className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-purple-100 dark:bg-purple-900/20 border border-purple-200 text-purple-600 font-bold">Pts: {loyaltyPoints}</button>
            )}
            <button onClick={() => setShowKitchen(!showKitchen)} className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-bold ${showKitchen ? "bg-amber-500 text-white" : "bg-white dark:bg-gray-800 border dark:border-gray-700 text-gray-500"}`}>
              Cocina {kitchenOrders.length > 0 ? `(${kitchenOrders.length})` : ""}
            </button>
          </div>

          {/* Barcode + Search + Warehouse */}
          <div className="flex gap-3">
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10 w-48" placeholder="Código barras" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={handleBarcode} />
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {warehouses.length > 1 && (
              <select className="input-field w-40" value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}
              </select>
            )}
            <button onClick={() => setShowCustomerSelect(true)} className="btn-outline flex items-center gap-2">
              <User className="w-4 h-4" />
              {selectedCustomer ? selectedCustomer.razon_social : "Cliente"}
            </button>
            <button onClick={() => setPriceCheck(!priceCheck)} className={`btn-outline flex items-center gap-2 text-xs ${priceCheck ? "bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-700" : ""}`}>
              <ScanLine className="w-4 h-4" />
              {priceCheck ? "Verif. ON" : "Verif."}
            </button>
            <button onClick={toggleCustomerDisplay} className={`btn-outline flex items-center gap-2 text-xs ${showCustomerDisplay ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400 text-blue-700" : ""}`}>
              {showCustomerDisplay ? "Display ON" : "Display"}
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categorias.map((c) => (
              <button key={c} onClick={() => setCategoria(c)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${categoria === c ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Favorites / Quick products */}
          {topProducts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 self-center mr-1">Favoritos</span>
              {topProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${p.tipo_venta === "pesable" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-primary/10 hover:bg-primary/20 text-primary"}`}>
                  {p.tipo_venta === "pesable" ? "⚖ " : ""}{p.nombre.length > 15 ? p.nombre.slice(0, 15) + "..." : p.nombre}
                </button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((p) => (
                  <button key={p.id} onClick={() => addToCart(p)} className="card p-4 text-left hover:shadow-md transition-all hover:border-primary/30 group">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                      <span className="text-lg font-bold text-primary">{p.nombre.charAt(0)}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2">{p.nombre}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{p.sku}</p>
                    {pharmaEnabled && (() => {
                      const medInfo = getMedicationInfo(p.id)
                      return medInfo ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {medInfo.es_controlado && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Ctrl</span>}
                          {medInfo.requiere_cadena_frio && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">❄</span>}
                          {medInfo.es_generico && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Gen</span>}
                          {medInfo.concentracion && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{medInfo.concentracion}</span>}
                        </div>
                      ) : null
                    })()}
                    {p.stock !== undefined && <p className="text-xs text-gray-400 mt-1">{p.stock} disponibles</p>}
                    <div className="flex items-center justify-between mt-2">
                      {p.precio ? <p className="text-base font-bold text-primary">{formatPYG(p.precio)}</p> : <span />}
                      {p.tipo_venta === "pesable" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                          Pesar
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-96 card flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Carrito ({cart.reduce((a, i) => a + i.quantity, 0)})</h2>
              {selectedCustomer && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold truncate max-w-32">{selectedCustomer.razon_social}</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <span className="text-4xl mb-3">🛒</span>
                <p className="text-sm font-bold">Carrito vacío</p>
                <p className="text-xs mt-1">Agrega productos para comenzar</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.nombre}</p>
                    <p className="text-xs font-mono text-gray-400">{item.sku}</p>
                    {item.medication_id && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.es_controlado && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Ctrl</span>}
                        {item.requiere_cadena_frio && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">❄ Cadena</span>}
                        {item.es_generico && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Gen</span>}
                        {item.concentracion && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{item.concentracion}</span>}
                        {item.medication_id && (
                          <button onClick={() => { pharmaApi.medications.equivalents(item.medication_id!).then(setEquivalentMeds).catch(() => {}); setShowEquivalents(item.medication_id!) }}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold">
                            Equiv.
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><Minus className="w-3 h-3" /></button>
                    <span className="w-8 text-center text-sm font-bold font-mono">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><Plus className="w-3 h-3" /></button>
                  </div>
                  <input
                    type="number"
                    className="input-field text-sm w-24 text-right font-mono"
                    placeholder="Precio"
                    value={item.precio || ""}
                    onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm font-bold font-mono w-20 text-right">{formatPYG(item.precio * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span className="font-mono">{formatPYG(subtotal)}</span></div>
              {discountPct > 0 && <div className="flex justify-between text-sm text-green-500"><span>Desc. {discountPct}%</span><span className="font-mono">-{formatPYG(discountAmount)}</span></div>}
              {iva10 > 0 && <div className="flex justify-between text-sm text-gray-500"><span>IVA 10%</span><span className="font-mono">{formatPYG(iva10)}</span></div>}
              {iva5 > 0 && <div className="flex justify-between text-sm text-gray-500"><span>IVA 5%</span><span className="font-mono">{formatPYG(iva5)}</span></div>}
              {roundedTotal !== totalAfterDiscount && <div className="flex justify-between text-xs text-amber-500"><span>Redondeo</span><span className="font-mono">{formatPYG(roundedTotal - totalAfterDiscount)}</span></div>}
              <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-100 dark:border-gray-700"><span>Total</span><span className="font-mono">{formatPYG(roundedTotal)}</span></div>
            </div>

            {/* Discount quick buttons */}
            <div className="flex gap-1">
              {[5, 10, 15, 20].map(pct => (
                <button key={pct} onClick={() => applyDiscount(pct)} className={`px-2 py-1 text-xs rounded-lg font-bold transition-colors ${discountPct === pct ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-green-100 dark:hover:bg-green-900/30"}`}>-{pct}%</button>
              ))}
              {discountPct > 0 && <button onClick={() => setDiscountPct(0)} className="px-2 py-1 text-xs rounded-lg bg-red-100 dark:bg-red-900/20 text-red-500 font-bold"><X className="w-3 h-3" /></button>}
            </div>

            {heldSale && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-600">
                <Pause className="w-3 h-3" /> Venta estacionada ({heldSale.cart.length} prod.) — <button onClick={recoverSale} className="underline font-bold flex items-center gap-1"><Play className="w-3 h-3" /> F6</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handlePay("efectivo")} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                <Banknote className="w-5 h-5 text-green-600" />
                <span className="text-xs font-bold text-green-600">Efectivo</span>
              </button>
              <button onClick={() => handlePay("tarjeta")} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span className="text-xs font-bold text-blue-600">Tarjeta</span>
              </button>
              <button onClick={() => handlePay("transferencia")} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                <Send className="w-5 h-5 text-purple-600" />
                <span className="text-xs font-bold text-purple-600">Transfer.</span>
              </button>
              <button onClick={handlePagoparLink} disabled={submitting || !isOnline} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 className="w-5 h-5 text-orange-600 animate-spin" /> : <LinkIcon className="w-5 h-5 text-orange-600" />}
                <span className="text-xs font-bold text-orange-600">Link pago</span>
              </button>
              <button onClick={handleKuapayLink} disabled={submitting || !isOnline} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 className="w-5 h-5 text-teal-600 animate-spin" /> : <QrCode className="w-5 h-5 text-teal-600" />}
                <span className="text-xs font-bold text-teal-600">Kuapay QR</span>
              </button>
              <button onClick={() => handlePay("credito")} disabled={!selectedCustomer} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Wallet className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-600">Crédito</span>
              </button>
              <button onClick={handleBancardLink} disabled={submitting || !isOnline} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 className="w-5 h-5 text-red-600 animate-spin" /> : <CreditCard className="w-5 h-5 text-red-600" />}
                <span className="text-xs font-bold text-red-600">Bancard</span>
              </button>
              <button onClick={handleDinelcoLink} disabled={submitting || !isOnline} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 className="w-5 h-5 text-rose-600 animate-spin" /> : <CreditCard className="w-5 h-5 text-rose-600" />}
                <span className="text-xs font-bold text-rose-600">Dinelco</span>
              </button>
              <button onClick={handleSpiQr} disabled={submitting || !isOnline} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 className="w-5 h-5 text-cyan-600 animate-spin" /> : <QrCode className="w-5 h-5 text-cyan-600" />}
                <span className="text-xs font-bold text-cyan-600">QR BCP</span>
              </button>
              <button onClick={() => cart.length >= 2 && setShowSplitPayment(true)} disabled={cart.length < 2} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <Divide className="w-5 h-5 text-gray-600" />
                <span className="text-xs font-bold text-gray-600">Dividir</span>
              </button>
            </div>

            {/* Shortcuts hint */}
            <div className="grid grid-cols-4 gap-1 text-[9px] text-gray-400 font-mono text-center">
              <span>F1 Efectivo</span><span>F2 Tarjeta</span><span>F3 Cliente</span><span>F4 Buscar</span>
              <span>F5 Estacionar</span><span>F6 Recuperar</span><span>F8 Desc 10%</span><span>F12 Limpiar</span>
            </div>
          </div>
        </div>
      </div>

      )}

      {/* Customer Select Modal */}
      {showCustomerSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCustomerSelect(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Seleccionar cliente</h3>
              <button onClick={() => setShowCustomerSelect(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <input className="input-field mb-4" placeholder="Buscar por nombre, RUC o CI..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-2">
              <button onClick={() => { setSelectedCustomer(null); setShowCustomerSelect(false) }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <p className="text-sm font-bold text-gray-500">Cliente genérico</p>
              </button>
              {filteredCustomers.map(c => (
                <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerSelect(false) }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{c.razon_social}</p>
                  <p className="text-xs text-gray-500">{c.ruc || c.ci || "Sin documento"}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPayment(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirmar pago</h3>
              <button onClick={() => setShowPayment(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total a cobrar</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatPYG(total)}</p>
              <p className="text-sm text-primary mt-2 capitalize">Método: {paymentMethod}</p>
              {!isOnline && <p className="text-xs text-amber-500 mt-1 font-bold">Sin conexión — se guardará localmente</p>}
            </div>
            <div className="flex gap-3 mt-4">
              <button className="btn-outline flex-1" onClick={() => setShowPayment(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handleConfirmPayment} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagopar Link Modal */}
      {showPagoparLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPagoparLink(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-orange-500" />
                Link de pago generado
              </h3>
              <button onClick={() => setShowPagoparLink(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatPYG(total)}</p>
              <p className="text-xs text-gray-400 mt-1">Orden: {pagoparOrderId}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">URL de pago</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate flex-1">{pagoparUrl}</p>
                <button onClick={handleCopyLink} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <a href={pagoparUrl} target="_blank" rel="noopener noreferrer" className="btn-outline flex-1 flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Abrir link
              </a>
              <button className="btn-primary flex-1" onClick={() => { setShowPagoparLink(false); setCart([]) }}>
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kuapay QR Modal */}
      {showKuapayLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowKuapayLink(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-teal-500" />
                QR de pago generado
              </h3>
              <button onClick={() => setShowKuapayLink(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatPYG(total)}</p>
              <p className="text-xs text-gray-400 mt-1">Orden: {kuapayOrderId}</p>
            </div>
            {kuapayQrUrl && (
              <div className="flex justify-center mb-4">
                <img src={kuapayQrUrl} alt="QR Code" className="w-48 h-48 border rounded-lg" />
              </div>
            )}
            {kuapayCheckoutUrl && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">URL de pago</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate flex-1">{kuapayCheckoutUrl}</p>
                  <button onClick={() => { navigator.clipboard.writeText(kuapayCheckoutUrl); toast.success("Copiado", "Enlace copiado") }} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              {kuapayCheckoutUrl && (
                <a href={kuapayCheckoutUrl} target="_blank" rel="noopener noreferrer" className="btn-outline flex-1 flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Abrir link
                </a>
              )}
              <button className="btn-primary flex-1" onClick={() => { setShowKuapayLink(false); setCart([]) }}>
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bancard Modal */}
      {showBancardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBancardModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-red-500" />Pago con Bancard</h3>
              <button onClick={() => setShowBancardModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatPYG(total)}</p>
            </div>
            {bancardUrl && <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4"><input className="w-full bg-transparent text-xs font-mono" value={bancardUrl} readOnly /></div>}
            <div className="flex gap-3">
              {bancardUrl && <a href={bancardUrl} target="_blank" rel="noopener noreferrer" className="btn-outline flex-1"><ExternalLink className="w-4 h-4" />Pagar</a>}
              <button className="btn-primary flex-1" onClick={() => { setShowBancardModal(false); setCart([]) }}>Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {/* Dinelco Modal */}
      {showDinelcoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDinelcoModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-rose-500" />Pago con Dinelco</h3>
              <button onClick={() => setShowDinelcoModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatPYG(total)}</p>
            </div>
            {dinelcoUrl && <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4"><input className="w-full bg-transparent text-xs font-mono" value={dinelcoUrl} readOnly /></div>}
            <div className="flex gap-3">
              {dinelcoUrl && <a href={dinelcoUrl} target="_blank" rel="noopener noreferrer" className="btn-outline flex-1"><ExternalLink className="w-4 h-4" />Pagar</a>}
              <button className="btn-primary flex-1" onClick={() => { setShowDinelcoModal(false); setCart([]) }}>Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {/* SPI QR BCP Modal */}
      {showSpiQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSpiQr(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><QrCode className="w-5 h-5 text-cyan-500" />QR Interoperable BCP</h3>
              <button onClick={() => setShowSpiQr(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatPYG(total)}</p>
              <p className="text-xs text-gray-400 mt-1">Orden: {spiOrderId}</p>
            </div>
            {spiQrImage && (
              <div className="flex justify-center mb-4">
                <img src={spiQrImage} alt="QR BCP" className="w-48 h-48 border rounded-lg" />
              </div>
            )}
            <p className="text-xs text-gray-500 text-center mb-1">Escanee con cualquier app bancaria o billetera</p>
            <div className="text-center mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                spiStatus === "approved" ? "bg-green-100 text-green-700" :
                spiStatus === "rejected" ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {spiStatus === "approved" ? "Pagado" : spiStatus === "rejected" ? "Rechazado" : "Pendiente"}
              </span>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={handleVerifySpi} disabled={spiVerifying}>
                {spiVerifying ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Verificar pago
              </button>
              <button className="btn-primary flex-1" onClick={() => { setShowSpiQr(false); setCart([]) }}>Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {/* Split Payment Modal */}
      {showSplitPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSplitPayment(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Divide className="w-5 h-5 text-gray-500" />Pago dividido</h3>
              <button onClick={() => setShowSplitPayment(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-2"><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPYG(totalAfterDiscount)}</p></div>
            <div className="space-y-3 mt-4">
              <div>
                <label className="input-label">Método 1</label>
                <div className="flex gap-2">
                  <select className="input-field w-28" value={splitMethod1} onChange={(e) => setSplitMethod1(e.target.value)}>
                    <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transfer.</option>
                  </select>
                  <input className="input-field flex-1" type="number" placeholder="Monto" value={splitAmount1 || ""} onChange={(e) => setSplitAmount1(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div>
                <label className="input-label">Método 2 — {formatPYG(Math.max(totalAfterDiscount - splitAmount1, 0))}</label>
                <select className="input-field" value={splitMethod2} onChange={(e) => setSplitMethod2(e.target.value)}>
                  <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transfer.</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowSplitPayment(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleSplitPayment} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cobrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Report Modal */}
      {showShiftReport && shiftReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShiftReport(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reporte {shiftReport.tipo}</h3>
              <button onClick={() => setShowShiftReport(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">{formatShiftReport(shiftReport)}</pre>
            <div className="flex gap-3 mt-4">
              <button className="btn-outline flex-1" onClick={() => window.print()}>Imprimir</button>
              <button className="btn-primary flex-1" onClick={() => setShowShiftReport(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Modal */}
      {showLoyaltyModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowLoyaltyModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Puntos de Fidelidad</h3>
              <button onClick={() => setShowLoyaltyModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">{selectedCustomer.razon_social}</p>
              <p className="text-4xl font-bold text-purple-500 mt-2">{loyaltyPoints}</p>
              <p className="text-xs text-gray-400">puntos acumulados</p>
              <p className="text-sm text-gray-500 mt-4">Equivalen a {formatPYG(pointsToDiscount(loyaltyPoints))}</p>
            </div>
            <button className="btn-primary w-full" onClick={() => {
              if (loyaltyPoints > 0) {
                const discount = pointsToDiscount(loyaltyPoints)
                const used = Math.min(discount, totalAfterDiscount)
                setRedeemAmount(used)
                setDiscountPct(Math.round(used / Math.max(totalAfterDiscount, 1) * 100))
                toast.success("Canjeado", `Descuento de ${formatPYG(used)} aplicado`)
              }
              setShowLoyaltyModal(false)
            }}>Canjear puntos</button>
          </div>
        </div>
      )}

      {/* Pharma Equivalents Modal */}
      {showEquivalents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowEquivalents(null); setEquivalentMeds([]) }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Equivalentes</h3>
              <button onClick={() => { setShowEquivalents(null); setEquivalentMeds([]) }} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            {equivalentMeds.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Sin equivalentes disponibles</p>
            ) : (
              <div className="space-y-2">
                {equivalentMeds.map(eq => (
                  <div key={eq.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{eq.marca_comercial || "—"}</p>
                      <p className="text-xs text-gray-500">{eq.concentracion} — {eq.forma_farmaceutica} {eq.es_generico ? "(Gen)" : ""}</p>
                      {eq.laboratorio && <p className="text-xs text-gray-400">{eq.laboratorio}</p>}
                    </div>
                    <span className="text-xs font-bold text-primary">{eq.registro_sanitario || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scale Weighing Modal */}
      {showScaleModal && scaleProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowScaleModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Pesar producto
              </h3>
              <button onClick={() => setShowScaleModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="mb-4">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{scaleProduct.nombre}</p>
              <p className="text-xs text-gray-400 font-mono">{scaleProduct.sku}</p>
            </div>
            {/* Scale selector */}
            <div className="mb-4">
              <label className="input-label">Báscula</label>
              {scaleLoadingScales ? (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" />Cargando básculas...</div>
              ) : scales.length === 0 ? (
                <p className="text-xs text-amber-500">No hay básculas activas configuradas</p>
              ) : (
                <select className="input-field" value={selectedScaleId} onChange={(e) => setSelectedScaleId(e.target.value)}>
                  {scales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              )}
            </div>
            {/* Price per kg */}
            <div className="mb-4">
              <label className="input-label">Precio por kg</label>
              <input className="input-field" type="number" step="any"
                value={scalePrecioUnitario || ""}
                onChange={(e) => { const v = parseFloat(e.target.value) || 0; setScalePrecioUnitario(v); setScaleSubtotal(scaleWeight * v) }}
              />
            </div>
            {/* Read weight */}
            <button className="btn-primary w-full mb-4" onClick={async () => {
              if (!selectedScaleId) { toast.error("Error", "Seleccioná una báscula"); return }
              if (!scalePrecioUnitario) { toast.error("Error", "Ingresá un precio por kg"); return }
              setScaleReading(true)
              try {
                const result = await api.scales.weighProduct(selectedScaleId, {
                  producto_id: scaleProduct.id,
                  precio_unitario: scalePrecioUnitario,
                })
                setScaleWeight(result.peso_kg)
                setScaleEstable(result.estable)
                setScaleSubtotal(result.subtotal)
                if (!result.estable) toast.warning("Peso inestable", "La lectura puede no ser precisa")
                else toast.success("Peso leído", `${result.peso_kg} kg leídos correctamente`)
              } catch (e: any) {
                toast.error("Error de báscula", e.message || "No se pudo leer el peso")
              } finally {
                setScaleReading(false)
              }
            }} disabled={scaleReading || scales.length === 0}>
              {scaleReading ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
              Leer peso
            </button>
            {/* Weight result */}
            {scaleWeight > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Peso</span>
                  <span className="font-bold font-mono">{scaleWeight.toFixed(3)} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Precio unitario</span>
                  <span className="font-bold font-mono">{formatPYG(scalePrecioUnitario)} / kg</span>
                </div>
                <div className="flex justify-between text-base font-bold text-primary border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatPYG(scaleSubtotal)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button className="btn-outline flex-1" onClick={() => setShowScaleModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" disabled={scaleWeight <= 0}
                onClick={() => {
                  setCart(prev => {
                    const medInfo = pharmaEnabled ? getMedicationInfo(scaleProduct.id) : null
                    return [...prev, {
                      id: scaleProduct.id, nombre: scaleProduct.nombre,
                      precio: scalePrecioUnitario,
                      categoria: scaleProduct.categoria?.nombre || "", sku: scaleProduct.sku,
                      quantity: scaleWeight, iva_tasa: scaleProduct.iva_tasa || 10,
                      ...(medInfo ? {
                        medication_id: medInfo.medication_id, es_controlado: medInfo.es_controlado,
                        requiere_cadena_frio: medInfo.requiere_cadena_frio, es_generico: medInfo.es_generico,
                        concentracion: medInfo.concentracion, forma_farmaceutica: medInfo.forma_farmaceutica,
                        laboratorio: medInfo.laboratorio, registro_sanitario: medInfo.registro_sanitario,
                      } : {}),
                    }]
                  })
                  setShowScaleModal(false)
                  setScaleWeight(0)
                  playSuccess()
                  toast.success(scaleProduct.nombre, `Agregado — ${scaleWeight.toFixed(3)} kg`)
                }}>
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kitchen Display Panel */}
      {showKitchen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowKitchen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pedidos Cocina ({kitchenOrders.length})</h3>
              <button onClick={() => setShowKitchen(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            {kitchenOrders.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Sin pedidos</p>
            ) : (
              <div className="space-y-3">
                {kitchenOrders.map(o => (
                  <div key={o.id} className={`p-4 rounded-lg border ${o.estado === "pendiente" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200" : "bg-green-50 dark:bg-green-900/20 border-green-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-gray-400">#{o.id.slice(0, 8)}</span>
                      <select className="text-xs input-field w-24" value={o.estado} onChange={(e) => {
                        setKitchenOrders(prev => prev.map(k => k.id === o.id ? { ...k, estado: e.target.value } : k))
                      }}>
                        <option value="pendiente">Pendiente</option>
                        <option value="preparando">Preparando</option>
                        <option value="listo">Listo</option>
                        <option value="entregado">Entregado</option>
                      </select>
                    </div>
                    {o.items.map((i, idx) => (
                      <div key={idx} className="text-sm flex justify-between">
                        <span className="font-bold">{i.nombre}</span>
                        <span>x{i.quantity}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
