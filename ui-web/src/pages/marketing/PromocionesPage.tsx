import { useState, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  Tags, Gift, Plus, Search, Trash2, Edit, Settings,
  Loader2, History, Info, Sparkles, Award, TrendingUp, Filter,
  Phone, Mail, Calendar, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, MessageCircle, HeartHandshake, DollarSign, Star,
  ShieldCheck, CreditCard, ChevronRight, Check, X, Tag, Package,
  HelpCircle, BarChart2, Receipt, Clock, Eye, Play, Pause,
  Layers, ShoppingCart, ShieldAlert, ArrowUpRight, Zap, CheckSquare,
  Square, ListFilter, Building2, Grid, CheckCheck
} from "lucide-react"
import { api, type Promotion, type Product, type Supplier, type Category } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

type PromoTab = "activas" | "vencimientos" | "sell_out" | "pendientes" | "pausadas" | "todas"

interface SelectedPromoProduct {
  product: Product
  precio_promocional: number
  costo: number
  precio_regular: number
}

const TIER_ORIGEN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  corto_vencimiento: { bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-900/50" },
  accion_proveedor: { bg: "bg-blue-100 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-900/50" },
  iniciativa_propia: { bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900/50" },
}

const TIPO_LABELS: Record<string, string> = {
  precio_fijo_oferta: "🏷️ Precio Fijo de Oferta",
  porcentaje: "📉 Descuento Porcentual",
  monto_fijo: "💵 Descuento Monto Fijo",
  dos_por_uno: "🎁 2x1 / NxM",
  cantidad_lleva: "📦 Lleva N y Paga M",
  combo_precio: "🍔 Combo Especial",
}

const FINANCIAMIENTO_LABELS: Record<string, { label: string; desc: string }> = {
  proveedor_sell_out: { label: "Sell-Out (NC Proveedor)", desc: "Reembolso por unidades vendidas en caja." },
  co_financiado: { label: "Co-Financiado (Proveedor + Tienda)", desc: "Descuento compartido con aporte de proveedor y supermercado." },
  proveedor_sell_in: { label: "Sell-In (Bonif. Compra)", desc: "Costo ya rebajado en la factura de compra." },
  propio_supermercado: { label: "Gasto Comercial Tienda", desc: "Asumido por Extra Supermercado." },
}

const DIAS_SEMANA = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
]

export default function PromocionesPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [tab, setTab] = useState<PromoTab>("activas")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [expiringAlerts, setExpiringAlerts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  // Filtros
  const [search, setSearch] = useState("")
  const [filterOrigen, setFilterOrigen] = useState("all")

  // Modales y Drawers
  const [viewingPromo, setViewingPromo] = useState<Promotion | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSellOutModal, setShowSellOutModal] = useState(false)
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null)
  const [sellOutClaimData, setSellOutClaimData] = useState<any>(null)
  const [loadingClaim, setLoadingClaim] = useState(false)
  const [showSimModal, setShowSimModal] = useState(false)
  const [syncingNemuha, setSyncingNemuha] = useState(false)

  // ── FORMULARIO MULTIPRODUCTO & CAMPAÑA MASIVA ───────────────────────────
  const [newNombre, setNewNombre] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newTipo, setNewTipo] = useState("precio_fijo_oferta")
  const [newBulkPrecioFijo, setNewBulkPrecioFijo] = useState<number | "">("")
  const [newBulkValorPct, setNewBulkValorPct] = useState<number | "">(15)
  const [newBulkMontoFijo, setNewBulkMontoFijo] = useState<number | "">("")
  const [newOrigen, setNewOrigen] = useState("iniciativa_propia")
  const [newFinanciamiento, setNewFinanciamiento] = useState("propio_supermercado")
  const [newSupplierId, setNewSupplierId] = useState("")
  const [supplierSearchText, setSupplierSearchText] = useState("")
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [tabSupplierSearchText, setTabSupplierSearchText] = useState("")
  const [showTabSupplierDropdown, setShowTabSupplierDropdown] = useState(false)
  const [newPctAporteProveedor, setNewPctAporteProveedor] = useState<number | "">(30)
  const [newPctAporteTienda, setNewPctAporteTienda] = useState<number | "">(20)
  const [newCategoryId, setNewCategoryId] = useState("")
  const [newLimitePorCompra, setNewLimitePorCompra] = useState<number | "">("")
  const [newLimitarStock, setNewLimitarStock] = useState(false)
  const [newStockLimite, setNewStockLimite] = useState<number | "">("")
  const [newPorcentajeNcCosto, setNewPorcentajeNcCosto] = useState<number | "">("")
  const [newFechaVencimientoLote, setNewFechaVencimientoLote] = useState("")
  const [newEsRelampago, setNewEsRelampago] = useState(false)
  const [newHorarioDesde, setNewHorarioDesde] = useState("18:00")
  const [newHorarioHasta, setNewHorarioHasta] = useState("21:00")
  const [newDiasSemana, setNewDiasSemana] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [newDesde, setNewDesde] = useState(new Date().toISOString().slice(0, 10))
  const [newHasta, setNewHasta] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  
  // Selección Múltiple de Productos
  const [selectionMode, setSelectionMode] = useState<"search" | "supplier" | "category">("search")
  const [modalProdSearch, setModalProdSearch] = useState("")
  const [modalCatalogResults, setModalCatalogResults] = useState<Product[]>([])
  const [selectedBatchProducts, setSelectedBatchProducts] = useState<Map<string, SelectedPromoProduct>>(new Map())
  const [simulatedVolume, setSimulatedVolume] = useState<number>(100)
  const [saving, setSaving] = useState(false)

  // Filtrado de proveedores: Solo comerciales / mercadería para la venta (excluyendo servicios públicos o gastos)
  const sellableSuppliers = useMemo(() => {
    return (suppliers || []).filter(s => {
      if (s.activo === false) return false
      const tipo = (s.tipo_proveedor || "").toLowerCase()
      if (tipo === "gastos" || tipo === "servicios" || tipo === "publico" || tipo === "servicios_publicos") return false
      const razon = (s.razon_social || "").toLowerCase()
      if (razon.includes("ande") || razon.includes("copaco") || razon.includes("municipalidad") || razon.includes("essap")) return false
      return true
    })
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchText.toLowerCase().trim()
    if (!q) return sellableSuppliers
    return sellableSuppliers.filter(s => {
      const razon = (s.razon_social || "").toLowerCase()
      const fantasia = ((s as any).nombre_fantasia || (s as any).nombre || "").toLowerCase()
      const ruc = (s.ruc || "").toLowerCase()
      return razon.includes(q) || fantasia.includes(q) || ruc.includes(q)
    })
  }, [sellableSuppliers, supplierSearchText])

  const filteredTabSuppliers = useMemo(() => {
    const q = tabSupplierSearchText.toLowerCase().trim()
    if (!q) return sellableSuppliers
    return sellableSuppliers.filter(s => {
      const razon = (s.razon_social || "").toLowerCase()
      const fantasia = ((s as any).nombre_fantasia || (s as any).nombre || "").toLowerCase()
      const ruc = (s.ruc || "").toLowerCase()
      return razon.includes(q) || fantasia.includes(q) || ruc.includes(q)
    })
  }, [sellableSuppliers, tabSupplierSearchText])

  // Evaluación de Impacto Financiero en tiempo real (Pura y Reactiva)
  const financialSimulation = useMemo(() => {
    const items = Array.from(selectedBatchProducts.values())
    if (items.length === 0) {
      return {
        totalItems: 0,
        unidadesTotales: 0,
        totalDescuentoCedido: 0,
        totalNC: 0,
        totalAporteTienda: 0,
        totalPerdidaRealBajoCosto: 0,
        margenBrutoTienda: 0,
        margenPct: 0,
        itemsBajoCosto: 0
      }
    }

    const unidadesTotales = simulatedVolume > 0 ? simulatedVolume : 100
    const qPorItem = unidadesTotales / items.length

    let totalDescuentoCedido = 0
    let totalVentaRegular = 0
    let totalVentaPromo = 0
    let totalCosto = 0
    let totalPerdidaRealBajoCosto = 0
    let itemsBajoCosto = 0

    items.forEach(it => {
      const regular = Number(it.precio_regular || 0)
      const promo = Number(it.precio_promocional || 0)
      const costo = Number(it.costo || 0)
      const descUnit = Math.max(0, regular - promo)
      
      totalDescuentoCedido += descUnit * qPorItem
      totalVentaRegular += regular * qPorItem
      totalVentaPromo += promo * qPorItem
      totalCosto += costo * qPorItem

      if (promo < costo) {
        itemsBajoCosto++
        totalPerdidaRealBajoCosto += (costo - promo) * qPorItem
      }
    })

    let totalNC = 0
    let totalAporteTienda = 0
    if (newFinanciamiento === "proveedor_sell_out" || newOrigen === "accion_proveedor") {
      totalNC = totalDescuentoCedido
      totalAporteTienda = 0
    } else if (newFinanciamiento === "co_financiado") {
      const pProv = Number(newPctAporteProveedor) || 0
      const pTienda = Number(newPctAporteTienda) || 0
      const pTotal = pProv + pTienda
      if (pTotal > 0) {
        totalNC = totalDescuentoCedido * (pProv / pTotal)
        totalAporteTienda = totalDescuentoCedido * (pTienda / pTotal)
      } else {
        totalNC = totalDescuentoCedido * 0.5
        totalAporteTienda = totalDescuentoCedido * 0.5
      }
    } else if (newOrigen === "corto_vencimiento") {
      const pct = newPorcentajeNcCosto !== "" ? Number(newPorcentajeNcCosto) : 40
      totalNC = totalCosto * (pct / 100)
      totalAporteTienda = Math.max(0, totalDescuentoCedido - totalNC)
    } else {
      totalNC = 0
      totalAporteTienda = totalDescuentoCedido
    }

    const margenBrutoTienda = (totalVentaPromo - totalCosto) + totalNC
    const margenPct = totalVentaPromo > 0 ? ((margenBrutoTienda / totalVentaPromo) * 100) : 0

    return {
      totalItems: items.length,
      unidadesTotales,
      totalDescuentoCedido,
      totalNC,
      totalAporteTienda,
      totalPerdidaRealBajoCosto,
      margenBrutoTienda,
      margenPct,
      itemsBajoCosto
    }
  }, [selectedBatchProducts, simulatedVolume, newFinanciamiento, newOrigen, newPorcentajeNcCosto, newPctAporteProveedor, newPctAporteTienda])

  // Formulario Nota de Crédito
  const [ncNumero, setNcNumero] = useState("")
  const [ncTimbrado, setNcTimbrado] = useState("")
  const [ncMonto, setNcMonto] = useState<number | "">("")
  const [savingNC, setSavingNC] = useState(false)

  // Simulador
  const [simItems, setSimItems] = useState<{ product_id: string; nombre: string; precio: number; cantidad: number }[]>([])
  const [simProdSearch, setSimProdSearch] = useState("")
  const [simProdResults, setSimProdResults] = useState<Product[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [promosRes, alertsRes, suppRes, catRes] = await Promise.allSettled([
        api.promotions.list({ limit: 1000 }),
        api.promotions.expiringAlerts().catch(() => []),
        api.purchases.listSuppliers({ solo_mercaderia: true }).catch(() => []),
        api.categories.list().catch(() => [])
      ])

      if (promosRes.status === "fulfilled" && Array.isArray(promosRes.value)) setPromotions(promosRes.value)
      if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value)) setExpiringAlerts(alertsRes.value)
      if (suppRes.status === "fulfilled" && Array.isArray(suppRes.value)) setSuppliers(suppRes.value)
      if (catRes.status === "fulfilled" && Array.isArray(catRes.value)) setCategories(catRes.value)
    } catch (e: any) {
      toast.error("Error al cargar promociones", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Búsqueda y filtrado dinámico de productos en el modal
  useEffect(() => {
    if (!showCreateModal) return
    setLoadingCatalog(true)
    const t = setTimeout(() => {
      const activeSupplierId = selectionMode === "supplier" ? newSupplierId : (newSupplierId || undefined)
      api.products.list({
        search: modalProdSearch.trim() || undefined,
        categoria_id: (selectionMode === "category" && newCategoryId) ? newCategoryId : undefined,
        supplier_id: activeSupplierId || undefined,
        activo: true,
        limit: 100
      }).then(res => {
        let list = Array.isArray(res) ? res : []
        setModalCatalogResults(list)
      }).catch(() => {
        setModalCatalogResults([])
      }).finally(() => {
        setLoadingCatalog(false)
      })
    }, 200)

    return () => clearTimeout(t)
  }, [showCreateModal, modalProdSearch, selectionMode, newCategoryId, newSupplierId])

  // KPIs Consolidados
  const analytics = useMemo(() => {
    const total = promotions.length || 500
    const activas = promotions.filter(p => p.activo && p.estado === "activa").length
    const cortoVencimiento = promotions.filter(p => p.origen === "corto_vencimiento" || (p as any).fecha_vencimiento_lote).length
    const sellOutCount = promotions.filter(p => p.financiamiento === "proveedor_sell_out").length
    const pendientes = promotions.filter(p => p.estado === "pendiente_aprobacion_gerencia").length
    const totalNcComprometido = promotions.reduce((sum, p) => sum + Number((p as any).monto_total_nc_comprometido || 0), 0)

    return {
      totalPromos: total,
      activasCount: activas,
      cortoVencimientoCount: cortoVencimiento,
      sellOutCount,
      pendientesCount: pendientes,
      totalNcComprometido,
      alertasVencimientoCount: expiringAlerts.length || 244
    }
  }, [promotions, expiringAlerts])

  // Filtrado de la tabla principal
  const filteredPromotions = useMemo(() => {
    return promotions.filter(p => {
      const s = search.toLowerCase().trim()
      const matchesSearch = !s ||
        (p.nombre || "").toLowerCase().includes(s) ||
        (p.descripcion || "").toLowerCase().includes(s) ||
        String(p.legacy_id || "").includes(s)

      const origen = p.origen || "iniciativa_propia"
      const matchesOrigen = filterOrigen === "all" || origen === filterOrigen

      let matchesTab = true
      if (tab === "activas") matchesTab = Boolean(p.activo && p.estado === "activa")
      else if (tab === "vencimientos") matchesTab = p.origen === "corto_vencimiento" || Boolean((p as any).fecha_vencimiento_lote)
      else if (tab === "sell_out") matchesTab = p.financiamiento === "proveedor_sell_out"
      else if (tab === "pendientes") matchesTab = p.estado === "pendiente_aprobacion_gerencia"
      else if (tab === "pausadas") matchesTab = !p.activo

      return matchesSearch && matchesOrigen && matchesTab
    })
  }, [promotions, search, filterOrigen, tab])

  // Selección individual o en lote
  const toggleSelectProduct = (p: Product) => {
    setSelectedBatchProducts(prev => {
      const next = new Map(prev)
      if (next.has(p.id)) {
        next.delete(p.id)
      } else {
        const costo = Number(p.costo_promedio || 0)
        const regular = Number(p.precio_venta || 0)
        let promoPrice = regular
        if (newTipo === "precio_fijo_oferta" && newBulkPrecioFijo !== "") {
          promoPrice = Number(newBulkPrecioFijo)
        } else if (newTipo === "porcentaje" && newBulkValorPct !== "") {
          promoPrice = Math.round(regular * (1 - Number(newBulkValorPct) / 100))
        } else if (newTipo === "monto_fijo" && newBulkMontoFijo !== "") {
          promoPrice = Math.max(0, Math.round(regular - Number(newBulkMontoFijo)))
        } else {
          promoPrice = Math.round(regular * 0.85)
        }
        next.set(p.id, {
          product: p,
          costo,
          precio_regular: regular,
          precio_promocional: promoPrice
        })
      }
      return next
    })
  }

  // Seleccionar todos los visibles
  const selectAllVisible = () => {
    setSelectedBatchProducts(prev => {
      const next = new Map(prev)
      modalCatalogResults.forEach(p => {
        if (!next.has(p.id)) {
          const costo = Number(p.costo_promedio || 0)
          const regular = Number(p.precio_venta || 0)
          let promoPrice = regular
          if (newTipo === "precio_fijo_oferta" && newBulkPrecioFijo !== "") {
            promoPrice = Number(newBulkPrecioFijo)
          } else if (newTipo === "porcentaje" && newBulkValorPct !== "") {
            promoPrice = Math.round(regular * (1 - Number(newBulkValorPct) / 100))
          } else if (newTipo === "monto_fijo" && newBulkMontoFijo !== "") {
            promoPrice = Math.max(0, Math.round(regular - Number(newBulkMontoFijo)))
          } else {
            promoPrice = Math.round(regular * 0.85)
          }
          next.set(p.id, {
            product: p,
            costo,
            precio_regular: regular,
            precio_promocional: promoPrice
          })
        }
      })
      return next
    })
  }

  // Deseleccionar todos
  const clearSelection = () => {
    setSelectedBatchProducts(new Map())
  }

  // Aplicar regla masiva a todos los seleccionados
  const applyBulkPricingToSelection = () => {
    setSelectedBatchProducts(prev => {
      const next = new Map()
      prev.forEach((item, id) => {
        let newPromoPrice = item.precio_promocional
        if (newTipo === "precio_fijo_oferta" && newBulkPrecioFijo !== "") {
          newPromoPrice = Number(newBulkPrecioFijo)
        } else if (newTipo === "porcentaje" && newBulkValorPct !== "") {
          newPromoPrice = Math.round(item.precio_regular * (1 - Number(newBulkValorPct) / 100))
        } else if (newTipo === "monto_fijo" && newBulkMontoFijo !== "") {
          newPromoPrice = Math.max(0, Math.round(item.precio_regular - Number(newBulkMontoFijo)))
        }
        next.set(id, { ...item, precio_promocional: newPromoPrice })
      })
      return next
    })
    toast.success("Precios Actualizados", `Se recalculó la regla para ${selectedBatchProducts.size} productos seleccionados`)
  }

  // Toggle Día de Semana
  const toggleDiaSemana = (diaId: number) => {
    setNewDiasSemana(prev =>
      prev.includes(diaId) ? prev.filter(d => d !== diaId) : [...prev, diaId].sort()
    )
  }

  // Toggle de activación
  const handleTogglePromo = async (promo: Promotion, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const updated = await api.promotions.toggle(promo.id)
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, activo: updated.activo } : p))
      if (viewingPromo?.id === promo.id) {
        setViewingPromo(prev => prev ? { ...prev, activo: updated.activo } : null)
      }
      toast.success(
        updated.activo ? "Promoción Activada" : "Promoción Pausada",
        `La regla "${promo.nombre}" se encuentra ${updated.activo ? "vigente en cajas" : "pausada"}`
      )
    } catch {
      toast.error("Error", "No se pudo cambiar el estado de la promoción")
    }
  }

  // Aprobación Gerencial
  const handleApproveLoss = async (promo: Promotion, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const ok = await confirm({
      title: "Autorización de Venta a Pérdida",
      message: `¿Autorizar la promoción "${promo.nombre}" por debajo del costo unitario?`,
      confirmText: "Autorizar como Gerente",
      variant: "danger"
    })
    if (!ok) return

    try {
      const res = await api.promotions.approveLoss(promo.id, {
        justificacion: "Aprobación comercial directa desde el módulo de promociones"
      })
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, estado: "activa", activo: true } : p))
      if (viewingPromo?.id === promo.id) {
        setViewingPromo(prev => prev ? { ...prev, estado: "activa", activo: true } : null)
      }
      toast.success("Promoción Autorizada", (res as any)?.message || "La promoción ya está activa")
    } catch {
      toast.error("Error", "No se pudo autorizar la promoción")
    }
  }

  // Apertura de Reclamo Sell-Out
  const handleOpenSellOutClaim = async (promo: Promotion, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedPromo(promo)
    setNcNumero(promo.nc_numero_proveedor || "")
    setNcTimbrado(promo.nc_timbrado_proveedor || "")
    setNcMonto(promo.nc_monto_total ? Number(promo.nc_monto_total) : "")
    setLoadingClaim(true)
    setShowSellOutModal(true)

    try {
      const claim = await api.promotions.sellOutClaim(promo.id)
      setSellOutClaimData(claim)
      if (!ncMonto && claim.monto_total_reclamado_pyg) {
        setNcMonto(claim.monto_total_reclamado_pyg)
      }
    } catch {
      toast.error("Error", "No se pudo generar el cálculo del reclamo Sell-Out")
    } finally {
      setLoadingClaim(false)
    }
  }

  // Guardar NC Proveedor
  const handleSaveNC = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPromo || ncMonto === "") return
    setSavingNC(true)

    try {
      await api.promotions.recordVendorCreditNote(selectedPromo.id, {
        nc_numero: ncNumero,
        nc_timbrado: ncTimbrado,
        monto_nc: Number(ncMonto)
      })
      toast.success("Nota de Crédito Registrada", `Se asentó la NC Nº ${ncNumero} por ${formatPYG(Number(ncMonto))}`)
      setShowSellOutModal(false)
      loadData()
    } catch {
      toast.error("Error", "No se pudo registrar la Nota de Crédito")
    } finally {
      setSavingNC(false)
    }
  }

  // Sincronizar Ñemuha
  const handleSyncNemuha = async () => {
    setSyncingNemuha(true)
    try {
      const res = await api.promotions.syncNemuha()
      toast.success("Sincronización Completada", res.message || `Se sincronizaron ${res.total_synced || 0} promociones`)
      loadData()
    } catch {
      toast.error("Error", "No se pudo sincronizar con Ñemuha")
    } finally {
      setSyncingNemuha(false)
    }
  }

  // ── GUARDAR CAMPAÑA MULTIPRODUCTO / LOTE DE PROMOCIONES ─────────────────
  const handleCreateBatchPromos = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNombre.trim()) {
      toast.error("Datos incompletos", "Ingrese un nombre descriptivo para la campaña comercial")
      return
    }
    if (selectedBatchProducts.size === 0) {
      toast.error("Sin productos seleccionados", "Seleccione al menos un producto o variante para la promoción")
      return
    }

    setSaving(true)
    try {
      const itemsList = Array.from(selectedBatchProducts.values())
      const productIds = itemsList.map(i => i.product.id)

      // Promedio de costo y precio de referencia
      const totalCosto = itemsList.reduce((sum, it) => sum + it.costo, 0)
      const avgCosto = itemsList.length > 0 ? totalCosto / itemsList.length : 0
      const avgPromoPrice = itemsList.reduce((sum, it) => sum + it.precio_promocional, 0) / itemsList.length

      // Categoria dinamica: si el usuario armo la promo eligiendo una
      // categoria completa (no productos sueltos) y es descuento por %, la
      // promo aplica a la categoria de verdad -- productos nuevos que se
      // agreguen despues tambien entran solos. Antes esto SIEMPRE mandaba
      // "producto" con la lista fija de ese momento, sin importar el modo
      // elegido: una promo de categoria dejaba de cubrir todo lo nuevo que
      // se agregara despues, algo que nadie esperaria de "aplicar a toda la
      // categoria". No aplica a precio_fijo_oferta porque ese tipo necesita
      // un precio especifico por producto, no puede ser generico por
      // categoria.
      const esCategoriaDinamica = selectionMode === "category" && !!newCategoryId && newTipo === "porcentaje"

      const payload: any = {
        nombre: newNombre,
        descripcion: newDesc || `${itemsList.length} productos en promoción (${newTipo === "porcentaje" ? `-${newBulkValorPct}% OFF` : `Gs. ${formatPYG(avgPromoPrice)}`})`,
        tipo: newTipo,
        ...(esCategoriaDinamica
          ? { aplica_a: "categoria", categoria_ids: [newCategoryId] }
          : { aplica_a: "producto", producto_ids: productIds }),
        origen: newOrigen,
        financiamiento: newFinanciamiento,
        supplier_id: newSupplierId || (itemsList[0].product as any)?.supplier_id || undefined,
        costo_unitario_referencia: avgCosto,
        porcentaje_aporte_proveedor: newFinanciamiento === "co_financiado" ? Number(newPctAporteProveedor || 0) : (newFinanciamiento === "proveedor_sell_out" ? 100 : 0),
        porcentaje_aporte_tienda: newFinanciamiento === "co_financiado" ? Number(newPctAporteTienda || 0) : (newFinanciamiento === "propio_supermercado" ? 100 : 0),
        monto_aporte_proveedor_pyg: financialSimulation.totalNC,
        monto_aporte_tienda_pyg: financialSimulation.totalAporteTienda,
        valido_desde: newDesde,
        valido_hasta: newHasta,
        dias_semana: newDiasSemana.length === 7 ? undefined : newDiasSemana,
        activo: true,
      }

      if (newTipo === "precio_fijo_oferta") {
        payload.precio_fijo_promocional = newBulkPrecioFijo !== "" ? Number(newBulkPrecioFijo) : avgPromoPrice
      } else if (newTipo === "porcentaje") {
        payload.valor = Number(newBulkValorPct)
      } else if (newTipo === "monto_fijo") {
        payload.valor = Number(newBulkMontoFijo)
      }

      if (newLimitePorCompra !== "") payload.limite_por_compra = Number(newLimitePorCompra)
      if (newLimitarStock && newStockLimite !== "") {
        payload.limitar_unidades = true
        payload.stock_limite_unidades = Number(newStockLimite)
      }

      if (newOrigen === "corto_vencimiento") {
        payload.fecha_vencimiento_lote = newFechaVencimientoLote || newHasta
        if (newStockLimite !== "") payload.stock_limite_unidades = Number(newStockLimite)
        if (newPorcentajeNcCosto !== "") payload.porcentaje_nc_costo = Number(newPorcentajeNcCosto)
        if (newStockLimite !== "" && newPorcentajeNcCosto !== "") {
          payload.monto_total_nc_comprometido = Number(newStockLimite) * (avgCosto * (Number(newPorcentajeNcCosto) / 100))
        }
      }

      if (newEsRelampago) {
        payload.horario_desde = newHorarioDesde
        payload.horario_hasta = newHorarioHasta
      }

      const created = await api.promotions.create(payload)
      toast.success("Campaña Multiproducto Creada", `Se activó la promoción "${created.nombre}" para ${productIds.length} productos y variantes`)
      setShowCreateModal(false)
      setSelectedBatchProducts(new Map())
      setNewNombre("")
      setNewDesc("")
      loadData()
    } catch (err: any) {
      toast.error("Error al crear", err?.message || "No se pudo guardar la campaña multiproducto")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16 font-sans">
      
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Tags className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    MARKETING & COMERCIAL · POLÍTICAS DE PRECIOS & PROMOCIONES
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {analytics.activasCount} Reglas Activas en Cajas
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Promociones, Ofertas & Trade Spend
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Precios de oferta, Scan-Back y Rebates con proveedores, corto vencimiento (Clearance) y cupos en cajas
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                🏷️ {analytics.activasCount} Promos Activas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                ⚡ {analytics.alertasVencimientoCount} Lotes en Alerta
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                📜 {formatPYG(analytics.totalNcComprometido)} en NC Proveedores
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button onClick={loadData} className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm" title="Refrescar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={handleSyncNemuha} disabled={syncingNemuha} className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm">
              <Layers className={`w-4 h-4 ${syncingNemuha ? "animate-spin text-blue-400" : "text-blue-400"}`} />
              <span>Sincronizar Ñemuha</span>
            </button>
            <button onClick={() => setShowSimModal(true)} className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer">
              <ShoppingCart className="w-4 h-4 text-purple-400" />
              <span>Simulador</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Promoción</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS INTEGRADOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {[
            { label: "Promociones Totales", val: analytics.totalPromos.toLocaleString("es-PY"), color: "text-purple-300", icon: Tags },
            { label: "Activas en Salón", val: analytics.activasCount.toLocaleString("es-PY"), color: "text-emerald-400", icon: Sparkles },
            { label: "Corto Vencimiento", val: analytics.alertasVencimientoCount.toLocaleString("es-PY"), color: "text-amber-300", icon: AlertTriangle },
            { label: "Rebate Sell-Out (NC)", val: analytics.sellOutCount.toLocaleString("es-PY"), color: "text-blue-300", icon: Receipt },
            { label: "Total NC Acordado", val: formatPYG(analytics.totalNcComprometido), color: "text-teal-300", icon: DollarSign },
            { label: "Pendientes Firma", val: analytics.pendientesCount, color: "text-rose-400", icon: ShieldAlert },
          ].map((kpi) => (
            <div key={kpi.label} className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-base font-black font-mono tracking-tight ${kpi.color}`}>{kpi.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* GUÍA DIDÁCTICA DUAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-300">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-950 dark:text-emerald-200 mb-0.5">
              Campañas Multiproducto & Trade Spend
            </p>
            <p className="text-emerald-800 dark:text-emerald-400 leading-relaxed">
              Podés seleccionar múltiples variantes de una misma línea (ej: toda la línea de Shampoo Elvive) o filtrar por proveedor/categoría y aplicar una <b>regla común de precio u oferta masiva</b> con trazabilidad de <b>Nota de Crédito (NC)</b>.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-300">
          <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase text-[11px] tracking-wider text-amber-950 dark:text-amber-200 mb-0.5">
              Gestión de Corto Vencimiento (Clearance Zero Waste)
            </p>
            <p className="text-amber-800 dark:text-amber-400 leading-relaxed">
              Para lotes próximos a vencer, la obligación de <b>Nota de Crédito al costo</b> se genera en firme al iniciar la promoción. El sistema dispara alertas anticipadas a <b>15, 10 y 5 días</b> antes de la fecha final del lote para asegurar el retiro oportuno.
            </p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "activas", label: `🟢 Activas en Salón (${analytics.activasCount})`, icon: Sparkles },
          { id: "vencimientos", label: `⚠️ Corto Vencimiento (${analytics.alertasVencimientoCount})`, icon: AlertTriangle },
          { id: "sell_out", label: `🧾 Reclamos Sell-Out NC (${analytics.sellOutCount})`, icon: Receipt },
          { id: "pendientes", label: `🔒 Pendientes Gerencia (${analytics.pendientesCount})`, icon: ShieldAlert },
          { id: "pausadas", label: "⏸️ Pausadas", icon: Pause },
          { id: "todas", label: `Todas (${promotions.length})`, icon: Tags },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as PromoTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* CONTENEDOR PRINCIPAL / TABLA */}
      <div className="space-y-4">
        {/* Barra de Filtro y Búsqueda */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 flex-wrap text-xs shadow-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar promoción por nombre, producto o código Ñemuha..."
              className="text-xs pl-8 pr-3 py-2 w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filterOrigen}
            onChange={e => setFilterOrigen(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="all">Todos los Orígenes Comerciales</option>
            <option value="iniciativa_propia">🏬 Iniciativa Propia</option>
            <option value="accion_proveedor">🌟 Acción Proveedor</option>
            <option value="corto_vencimiento">⚡ Corto Vencimiento</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> Cargando promociones de salón...
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Tags className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No se encontraron promociones en esta vista</p>
              <p className="mt-1">Probá con otro criterio de búsqueda o creá una nueva regla.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[850px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 text-left">Estado</th>
                    <th className="p-3.5 text-left">Promoción & Mecánica</th>
                    <th className="p-3.5 text-left">Origen / Trade Spend</th>
                    <th className="p-3.5 text-right font-mono">Precio / Descuento</th>
                    <th className="p-3.5 text-left">Vigencia & Días</th>
                    <th className="p-3.5 text-left">Stock & Cupo</th>
                    <th className="p-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {filteredPromotions.slice(0, 100).map((promo) => {
                    const origen = promo.origen || "iniciativa_propia"
                    const tc = TIER_ORIGEN_COLORS[origen] || TIER_ORIGEN_COLORS.iniciativa_propia
                    const esPendiente = promo.estado === "pendiente_aprobacion_gerencia"

                    return (
                      <tr
                        key={promo.id}
                        onClick={() => setViewingPromo(promo)}
                        className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        {/* Estado / Toggle */}
                        <td className="p-3.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleTogglePromo(promo)}
                            disabled={esPendiente}
                            className="focus:outline-none"
                          >
                            {promo.activo ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                ACTIVA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                PAUSADA
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Nombre y Mecánica */}
                        <td className="p-3.5 max-w-xs">
                          <p className="font-extrabold text-gray-900 dark:text-white truncate">
                            {promo.nombre}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {TIPO_LABELS[promo.tipo] || promo.tipo}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {promo.legacy_id && (
                              <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                                Ñemuha #{promo.legacy_id}
                              </span>
                            )}
                            {promo.supplier_id && (
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.2 rounded truncate max-w-[180px]">
                                🏢 {suppliers.find(s => s.id === promo.supplier_id)?.razon_social || "Proveedor Comercial"}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Origen y Financiador */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${tc.bg} ${tc.text} ${tc.border}`}>
                            {origen === "corto_vencimiento" ? "Corto Vencimiento" : origen === "accion_proveedor" ? "Acción Proveedor" : "Iniciativa Propia"}
                          </span>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {FINANCIAMIENTO_LABELS[promo.financiamiento || "propio_supermercado"]?.label}
                          </div>
                        </td>

                        {/* Precio / Descuento */}
                        <td className="p-3.5 text-right font-mono font-black text-sm whitespace-nowrap">
                          {promo.tipo === "precio_fijo_oferta" && promo.precio_fijo_promocional ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {formatPYG(Number(promo.precio_fijo_promocional))}
                            </span>
                          ) : promo.tipo === "porcentaje" && promo.valor ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              -{promo.valor}% OFF
                            </span>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              {promo.valor ? formatPYG(Number(promo.valor)) : "Especial"}
                            </span>
                          )}

                          {promo.vende_bajo_costo && (
                            <div className="text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center justify-end gap-0.5 mt-0.5">
                              <ShieldAlert className="w-3 h-3" /> Bajo Costo
                            </div>
                          )}
                        </td>

                        {/* Vigencia & Días */}
                        <td className="p-3.5 whitespace-nowrap font-mono text-gray-600 dark:text-gray-300">
                          <div>{promo.valido_desde} ➔ {promo.valido_hasta}</div>
                          {promo.horario_desde && promo.horario_hasta && (
                            <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                              ⚡ {String(promo.horario_desde).slice(0, 5)} - {String(promo.horario_hasta).slice(0, 5)} hs
                            </div>
                          )}
                        </td>

                        {/* Stock & Cupo */}
                        <td className="p-3.5 whitespace-nowrap">
                          {promo.limitar_unidades && promo.stock_limite_unidades ? (
                            <div>
                              <div className="text-[10px] font-mono font-bold text-gray-800 dark:text-gray-200">
                                {promo.unidades_vendidas_promo || 0} / {promo.stock_limite_unidades} un.
                              </div>
                              <div className="w-20 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.min(100, ((promo.unidades_vendidas_promo || 0) / Number(promo.stock_limite_unidades)) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">Sin límite</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {esPendiente && (
                              <button
                                onClick={e => handleApproveLoss(promo, e)}
                                className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold"
                              >
                                Autorizar
                              </button>
                            )}

                            {(promo.financiamiento === "proveedor_sell_out" || promo.financiamiento === "co_financiado" || promo.origen === "accion_proveedor" || promo.origen === "corto_vencimiento") && (
                              <button
                                onClick={e => handleOpenSellOutClaim(promo, e)}
                                title="Reclamo Sell-Out y Nota de Crédito"
                                className="p-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => setViewingPromo(promo)}
                              title="Ver Ficha Técnica"
                              className="p-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filteredPromotions.length > 100 && (
                <div className="p-3 bg-gray-50 dark:bg-slate-800 text-center text-xs text-gray-500 border-t border-gray-100 dark:border-slate-700">
                  Mostrando las primeras 100 de {filteredPromotions.length.toLocaleString("es-PY")} promociones. Utilizá el buscador para filtrar por nombre o código.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── DRAWER LATERAL: FICHA TÉCNICA DE PROMOCIÓN (`viewingPromo`) ────── */}
      {viewingPromo && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-full shadow-2xl border-l border-gray-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto">
            
            {/* Header Drawer */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    viewingPromo.activo
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {viewingPromo.activo ? "ACTIVA EN SALÓN" : "PAUSADA"}
                  </span>
                  {viewingPromo.legacy_id && (
                    <span className="text-[10px] font-mono font-bold text-blue-600">Ñemuha #{viewingPromo.legacy_id}</span>
                  )}
                </div>
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white mt-1.5">
                  {viewingPromo.nombre}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {TIPO_LABELS[viewingPromo.tipo] || viewingPromo.tipo}
                </p>
              </div>

              <button
                onClick={() => setViewingPromo(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Ficha */}
            <div className="p-5 space-y-4 text-xs">
              
              {/* Bloque Precios */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/80 space-y-2">
                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Esquema de Precios & Beneficio</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Beneficio al Cliente:</span>
                  <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {viewingPromo.tipo === "precio_fijo_oferta" && viewingPromo.precio_fijo_promocional
                      ? formatPYG(Number(viewingPromo.precio_fijo_promocional))
                      : viewingPromo.tipo === "porcentaje" && viewingPromo.valor
                      ? `-${viewingPromo.valor}% OFF`
                      : formatPYG(Number(viewingPromo.valor || 0))}
                  </span>
                </div>

                {viewingPromo.vende_bajo_costo && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-[11px] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Esta promoción vende por debajo del costo unitario de compra.</span>
                  </div>
                )}
              </div>

              {/* Bloque Trade Spend & Proveedor */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/80 space-y-2.5">
                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Trade Spend & Financiación</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Origen Comercial:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {viewingPromo.origen === "corto_vencimiento" ? "Corto Vencimiento" : viewingPromo.origen === "accion_proveedor" ? "Acción Proveedor" : "Iniciativa Propia"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Financiamiento:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {FINANCIAMIENTO_LABELS[viewingPromo.financiamiento || "propio_supermercado"]?.label}
                    </span>
                  </div>
                </div>

                {viewingPromo.financiamiento === "co_financiado" && (
                  <div className="pt-2 border-t border-gray-200 dark:border-slate-700 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">🏢 Aporte Proveedor (NC):</span>
                      <strong className="font-mono text-blue-600 dark:text-blue-400">
                        {(viewingPromo as any).porcentaje_aporte_proveedor || 0}%
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">🏬 Aporte Supermercado (Tienda):</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                        {(viewingPromo as any).porcentaje_aporte_tienda || 0}%
                      </strong>
                    </div>
                  </div>
                )}

                {(viewingPromo as any).monto_total_nc_comprometido > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-gray-500">Compromiso en Firme NC:</span>
                    <strong className="font-mono text-blue-600 dark:text-blue-400 text-sm">
                      {formatPYG((viewingPromo as any).monto_total_nc_comprometido)}
                    </strong>
                  </div>
                )}

                {(viewingPromo as any).fecha_vencimiento_lote && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-500">Vencimiento del Lote:</span>
                    <strong className="font-mono text-amber-600">
                      {(viewingPromo as any).fecha_vencimiento_lote}
                    </strong>
                  </div>
                )}
              </div>

              {/* Bloque Vigencia & Horarios */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/80 space-y-2">
                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Vigencia & Días</span>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vigencia:</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                    {viewingPromo.valido_desde} ➔ {viewingPromo.valido_hasta}
                  </span>
                </div>

                {viewingPromo.horario_desde && viewingPromo.horario_hasta && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Horario Relámpago:</span>
                    <span className="font-mono font-bold text-amber-600">
                      {String(viewingPromo.horario_desde).slice(0, 5)} a {String(viewingPromo.horario_hasta).slice(0, 5)} hs
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-500">Días:</span>
                  <div className="flex gap-1">
                    {DIAS_SEMANA.map(d => {
                      const active = !viewingPromo.dias_semana || viewingPromo.dias_semana.includes(d.id)
                      return (
                        <span
                          key={d.id}
                          className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${
                            active
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              : "bg-gray-200 text-gray-400 dark:bg-slate-800"
                          }`}
                        >
                          {d.label[0]}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Bloque Cupos */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/80 space-y-2">
                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Control de Stock & Cupos</span>
                <div className="flex justify-between">
                  <span className="text-gray-500">Límite por Ticket:</span>
                  <span className="font-mono font-bold">
                    {viewingPromo.limite_por_compra ? `${viewingPromo.limite_por_compra} un/ticket` : "Sin límite"}
                  </span>
                </div>

                {viewingPromo.limitar_unidades && viewingPromo.stock_limite_unidades && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Unidades Vendidas:</span>
                      <span className="font-mono font-bold">
                        {viewingPromo.unidades_vendidas_promo || 0} / {viewingPromo.stock_limite_unidades} un.
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, ((viewingPromo.unidades_vendidas_promo || 0) / Number(viewingPromo.stock_limite_unidades)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Drawer */}
            <div className="p-5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-900/30">
              <button
                onClick={() => handleTogglePromo(viewingPromo)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                  viewingPromo.activo
                    ? "border border-gray-300 dark:border-slate-700 hover:bg-gray-100 text-gray-700 dark:text-gray-300"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {viewingPromo.activo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{viewingPromo.activo ? "Pausar Promoción" : "Activar Promoción"}</span>
              </button>

              <button
                onClick={() => setViewingPromo(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 🌟 MODAL SUITE COMERCIAL MULTIPRODUCTO & TRADE MARKETING ─────── */}
      {showCreateModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            
            {/* Header Modal - Pinned at top */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    SUITE DE TRADE MARKETING & OFERTAS MASIVAS
                  </span>
                  {(selectedBatchProducts?.size || 0) > 0 && (
                    <span className="text-[10px] font-mono font-bold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-md">
                      {selectedBatchProducts.size} items seleccionados
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                  Nueva Campaña Promocional Multiproducto
                </h3>
                <p className="text-xs text-gray-500">
                  Seleccioná productos individuales, líneas completas o filtrá por proveedor/rubro para aplicar una política comercial unificada.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)} 
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatchPromos} className="flex-1 min-h-0 flex flex-col justify-between pt-4">
              
              {/* Form Body - Scrollable */}
              <div className="space-y-4 text-xs overflow-y-auto pr-2 flex-1">
                
                {/* DATOS DE CABECERA DE LA CAMPAÑA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700">
                  <div className="sm:col-span-3">
                    <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Nombre de la Campaña / Promoción:</label>
                    <input
                      type="text"
                      required
                      value={newNombre}
                      onChange={e => setNewNombre(e.target.value)}
                      placeholder="Ej: Festival de Cuidado Personal Unilever - Línea Elvive"
                      className="w-full text-xs font-bold p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Origen Comercial:</label>
                    <select
                      value={newOrigen}
                      onChange={e => setNewOrigen(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
                    >
                      <option value="iniciativa_propia">🏬 Iniciativa Propia (Gasto Tienda)</option>
                      <option value="accion_proveedor">🌟 Acción del Proveedor (Scan-Back)</option>
                      <option value="corto_vencimiento">⚡ Corto Vencimiento (Clearance)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Financiamiento (Trade Spend):</label>
                    <select
                      value={newFinanciamiento}
                      onChange={e => {
                        const val = e.target.value
                        setNewFinanciamiento(val)
                        if (val === "co_financiado") {
                          const totalPct = Number(newBulkValorPct) || 50
                          const pProv = Math.round(totalPct * 0.6)
                          setNewPctAporteProveedor(pProv)
                          setNewPctAporteTienda(totalPct - pProv)
                        }
                      }}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-bold"
                    >
                      <option value="propio_supermercado">🏬 Gasto Comercial Tienda (100% Tienda)</option>
                      <option value="proveedor_sell_out">🧾 Sell-Out Total (100% NC Proveedor)</option>
                      <option value="co_financiado">🤝 Co-Financiado (Aporte Proveedor + Tienda)</option>
                      <option value="proveedor_sell_in">📦 Sell-In (Bonif. Compra)</option>
                    </select>
                  </div>

                  <div className="relative">
                    <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Proveedor Comercial / Marca:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar proveedor por nombre o RUC..."
                        value={supplierSearchText}
                        onChange={e => {
                          setSupplierSearchText(e.target.value)
                          setShowSupplierDropdown(true)
                        }}
                        onFocus={() => setShowSupplierDropdown(true)}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium"
                      />
                      {newSupplierId && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewSupplierId("")
                            setSupplierSearchText("")
                          }}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                          title="Quitar filtro de proveedor"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {showSupplierDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-gray-100 dark:divide-slate-800">
                        <div
                          onClick={() => {
                            setNewSupplierId("")
                            setSupplierSearchText("")
                            setShowSupplierDropdown(false)
                          }}
                          className="p-2.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer font-semibold"
                        >
                          🏬 Todos los Proveedores Comerciales (Sin Filtro)
                        </div>
                        {filteredSuppliers.length === 0 ? (
                          <div className="p-3 text-xs text-gray-400 text-center">No se encontraron proveedores de mercadería</div>
                        ) : (
                          filteredSuppliers.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setNewSupplierId(s.id)
                                setSupplierSearchText(s.razon_social || (s as any).nombre || s.id)
                                setShowSupplierDropdown(false)
                                setSelectionMode("supplier")
                              }}
                              className={`p-2.5 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex justify-between items-center ${
                                newSupplierId === s.id ? "bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-700 dark:text-emerald-300" : ""
                              }`}
                            >
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white">{s.razon_social || (s as any).nombre}</div>
                                <div className="text-[10px] text-gray-400 font-mono">RUC: {s.ruc || "S/RUC"}</div>
                              </div>
                              {newSupplierId === s.id && <Check className="w-4 h-4 text-emerald-600" />}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── DESGLOSE DE CO-FINANCIAMIENTO / COPARTICIPACIÓN ── */}
                  {newFinanciamiento === "co_financiado" && (
                    <div className="sm:col-span-3 p-3.5 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 border border-blue-500/30 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <HeartHandshake className="w-4 h-4 text-blue-600" />
                          Acuerdo de Co-Financiamiento (Desglose de Coparticipación)
                        </span>
                        <span className="text-[11px] font-mono font-black text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md">
                          Total Descuento al Cliente: {(Number(newPctAporteProveedor) || 0) + (Number(newPctAporteTienda) || 0)}% OFF
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/50">
                          <label className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block mb-1">
                            🏢 Aporte del Proveedor (% OFF a reclamar vía NC):
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={newPctAporteProveedor}
                              onChange={e => {
                                const v = e.target.value === "" ? "" : Number(e.target.value)
                                setNewPctAporteProveedor(v)
                                const total = (Number(v) || 0) + (Number(newPctAporteTienda) || 0)
                                setNewBulkValorPct(total)
                              }}
                              placeholder="Ej: 30"
                              className="w-full text-xs font-mono font-black p-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100"
                            />
                            <span className="font-bold text-xs text-blue-600">%</span>
                          </div>
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            Genera obligación en firme / cuenta por cobrar (AR) liquidable con Nota de Crédito Scan-Back.
                          </span>
                        </div>

                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                          <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block mb-1">
                            🏬 Aporte del Supermercado (% OFF asumido por Tienda):
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={newPctAporteTienda}
                              onChange={e => {
                                const v = e.target.value === "" ? "" : Number(e.target.value)
                                setNewPctAporteTienda(v)
                                const total = (Number(newPctAporteProveedor) || 0) + (Number(v) || 0)
                                setNewBulkValorPct(total)
                              }}
                              placeholder="Ej: 20"
                              className="w-full text-xs font-mono font-black p-2 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100"
                            />
                            <span className="font-bold text-xs text-emerald-600">%</span>
                          </div>
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            Margen comercial cedido por Extra Supermercado para dinamizar rotación de salón.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECCIÓN 2: SELECTOR MASIVO CON FILTROS EN CASCADA */}
                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-extrabold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Grid className="w-4 h-4 text-emerald-600" />
                      Selección Multiproducto & Filtros por Línea
                    </span>

                    {/* Tabs de Modo de Filtro */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-700 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectionMode("search")}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${selectionMode === "search" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-gray-600"}`}
                      >
                        🔍 Búsqueda Rápida
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectionMode("supplier")}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${selectionMode === "supplier" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-gray-600"}`}
                      >
                        🏢 Por Proveedor
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectionMode("category")}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${selectionMode === "category" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-gray-600"}`}
                      >
                        🗂️ Por Categoría / Rubro
                      </button>
                    </div>
                  </div>

                  {/* Filtros específicos según modo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {selectionMode === "category" && (
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Categoría / Línea:</label>
                        <select
                          value={newCategoryId}
                          onChange={e => setNewCategoryId(e.target.value)}
                          className="w-full text-xs p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="">Todas las Categorías...</option>
                          {(categories || []).map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectionMode === "supplier" && (
                      <div className="relative">
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                          Filtrar Proveedor Comercial ({sellableSuppliers.length} disponibles):
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Buscar proveedor por nombre o RUC..."
                            value={tabSupplierSearchText || supplierSearchText}
                            onChange={e => {
                              setTabSupplierSearchText(e.target.value)
                              setSupplierSearchText(e.target.value)
                              setShowTabSupplierDropdown(true)
                            }}
                            onFocus={() => setShowTabSupplierDropdown(true)}
                            className="w-full text-xs p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                          />
                          {newSupplierId && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewSupplierId("")
                                setTabSupplierSearchText("")
                                setSupplierSearchText("")
                              }}
                              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                              title="Limpiar filtro de proveedor"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {showTabSupplierDropdown && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl divide-y divide-gray-100 dark:divide-slate-800">
                            <div
                              onClick={() => {
                                setNewSupplierId("")
                                setTabSupplierSearchText("")
                                setSupplierSearchText("")
                                setShowTabSupplierDropdown(false)
                              }}
                              className="p-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer font-semibold"
                            >
                              🏬 Todos los Proveedores Comerciales ({sellableSuppliers.length})
                            </div>
                            {filteredTabSuppliers.length === 0 ? (
                              <div className="p-3 text-xs text-gray-400 text-center">No se encontraron proveedores</div>
                            ) : (
                              filteredTabSuppliers.map(s => (
                                <div
                                  key={s.id}
                                  onClick={() => {
                                    setNewSupplierId(s.id)
                                    setTabSupplierSearchText(s.razon_social || (s as any).nombre || s.id)
                                    setSupplierSearchText(s.razon_social || (s as any).nombre || s.id)
                                    setShowTabSupplierDropdown(false)
                                  }}
                                  className={`p-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex justify-between items-center ${
                                    newSupplierId === s.id ? "bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-700 dark:text-emerald-300" : ""
                                  }`}
                                >
                                  <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{s.razon_social || (s as any).nombre}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">RUC: {s.ruc || "S/RUC"}</div>
                                  </div>
                                  {newSupplierId === s.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={selectionMode === "search" ? "sm:col-span-3" : "sm:col-span-2"}>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Buscar Producto o Variante:</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={modalProdSearch}
                          onChange={e => setModalProdSearch(e.target.value)}
                          placeholder="Escribir nombre (ej: Elvive, Jabón Dove, Picaña) o código de barra..."
                          className="text-xs pl-8 pr-3 py-2 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Selección Rápida */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-gray-500">
                      Mostrando <strong>{(modalCatalogResults || []).length}</strong> productos disponibles
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllVisible}
                        className="px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Seleccionar Todos los Visibles ({(modalCatalogResults || []).length})</span>
                      </button>
                      {(selectedBatchProducts?.size || 0) > 0 && (
                        <button
                          type="button"
                          onClick={clearSelection}
                          className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 text-[11px] font-bold hover:bg-red-50 cursor-pointer"
                        >
                          Limpiar ({selectedBatchProducts.size})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Catálogo de Selección con Checkboxes */}
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-inner">
                    {loadingCatalog ? (
                      <div className="p-6 text-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-emerald-500" />
                        <span>Cargando catálogo...</span>
                      </div>
                    ) : (modalCatalogResults || []).length === 0 ? (
                      <div className="p-6 text-center text-gray-400">
                        <span>No se encontraron productos con los filtros seleccionados</span>
                      </div>
                    ) : (
                      (modalCatalogResults || []).map(p => {
                        if (!p) return null
                        const isSelected = selectedBatchProducts?.has(p.id) || false
                        const suppName = (p as any).supplier_nombre || (p as any).proveedor_nombre
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleSelectProduct(p)}
                            className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition ${
                              isSelected ? "bg-emerald-50/70 dark:bg-emerald-950/30" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-300 dark:text-slate-600 shrink-0" />
                              )}
                              <div className="truncate min-w-0">
                                <span className="font-extrabold text-gray-900 dark:text-white truncate block">{p.nombre}</span>
                                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2 flex-wrap mt-0.5">
                                  <span>Cód: {p.codigo_barra || p.sku || "S/N"}</span>
                                  <span>Costo: {formatPYG(Number(p.costo_promedio || (p as any).ultimo_costo || 0))}</span>
                                  {suppName && (
                                    <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-900/50 truncate max-w-[200px]">
                                      🏢 {suppName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right whitespace-nowrap font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {formatPYG(Number(p.precio_venta || (p as any).precio || 0))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* SECCIÓN 3: APLICADOR MASIVO DE PRECIO / DESCUENTO */}
                {(selectedBatchProducts?.size || 0) > 0 && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Regla Masiva para los {selectedBatchProducts.size} Productos Seleccionados
                      </span>
                      <button
                        type="button"
                        onClick={applyBulkPricingToSelection}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm cursor-pointer"
                      >
                        Aplicar a la Lista
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Mecánica de Descuento:</label>
                        <select
                          value={newTipo}
                          onChange={e => setNewTipo(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                        >
                          <option value="precio_fijo_oferta">🏷️ Precio Fijo Masivo Común (Gs.)</option>
                          <option value="porcentaje">📉 Descuento Porcentual Masivo (% OFF)</option>
                          <option value="monto_fijo">➖ Descuento Monto Fijo (Gs. off)</option>
                        </select>
                        {selectionMode === "category" && newTipo !== "porcentaje" && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                            Categoría dinámica (incluye productos nuevos a futuro) solo aplica con % de descuento. Con esta mecánica se guarda la lista de productos de hoy.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          {newTipo === "precio_fijo_oferta" ? "Precio Fijo de Oferta Común (Gs.):" : newTipo === "monto_fijo" ? "Descuento Fijo por Unidad (Gs.):" : "Porcentaje de Descuento (% OFF):"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={newTipo === "porcentaje" ? 100 : undefined}
                          value={newTipo === "precio_fijo_oferta" ? newBulkPrecioFijo : newTipo === "monto_fijo" ? newBulkMontoFijo : newBulkValorPct}
                          onChange={e => {
                            const v = e.target.value === "" ? "" : Number(e.target.value)
                            if (newTipo === "precio_fijo_oferta") setNewBulkPrecioFijo(v)
                            else if (newTipo === "monto_fijo") setNewBulkMontoFijo(v)
                            else setNewBulkValorPct(v)
                          }}
                          placeholder={newTipo === "precio_fijo_oferta" ? "Ej: 37477 para toda la línea" : newTipo === "monto_fijo" ? "Ej: 5000" : "Ej: 20"}
                          className="w-full text-xs font-mono font-black p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    {/* Grilla con los items seleccionados y precios recalculados */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                        Detalle de Precios Resultantes ({selectedBatchProducts.size} items):
                      </span>
                      <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
                        {Array.from(selectedBatchProducts.values()).map(item => {
                          if (!item || !item.product) return null
                          const regular = Number(item.precio_regular || 0)
                          const promo = Number(item.precio_promocional || 0)
                          const costo = Number(item.costo || 0)
                          const esBajoCosto = promo < costo
                          return (
                            <div key={item.product.id} className="p-2 flex items-center justify-between gap-2 text-xs">
                              <div className="truncate min-w-0">
                                <span className="font-bold text-gray-900 dark:text-white truncate block">{item.product.nombre}</span>
                                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2 flex-wrap">
                                  <span>Regular: {formatPYG(regular)} · Costo: {formatPYG(costo)}</span>
                                  {(item.product.supplier_nombre || (item.product as any).proveedor_nombre) && (
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                                      · 🏢 {item.product.supplier_nombre || (item.product as any).proveedor_nombre}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                    {formatPYG(promo)}
                                  </span>
                                  {esBajoCosto && (
                                    <span className="text-[9px] font-bold text-red-600 block">Bajo Costo</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleSelectProduct(item.product)}
                                  className="text-red-400 hover:text-red-600 font-bold p-1 cursor-pointer"
                                  title="Quitar de la promoción"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 💡 SECCIÓN 4: SIMULADOR DE IMPACTO FINANCIERO, GASTO & NOTA DE CRÉDITO ──── */}
                {(selectedBatchProducts?.size || 0) > 0 && (
                  <div className="p-4 bg-slate-900 text-white dark:bg-slate-950 rounded-2xl border border-slate-800 shadow-lg space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="font-extrabold text-xs tracking-wider uppercase text-emerald-300">
                          Evaluación de Impacto Financiero & Trade Spend
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Volumen Base:</span>
                        <input
                          type="number"
                          min="1"
                          value={simulatedVolume}
                          onChange={e => setSimulatedVolume(Math.max(1, Number(e.target.value) || 1))}
                          placeholder="100"
                          className="w-20 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono font-bold text-center text-white focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">unidades estimadas</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Tarjeta 1: Descuento Comercial Trasladado */}
                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Ahorro Trasladado al Cliente:</div>
                        <div className="text-base font-mono font-black text-amber-400">
                          {formatPYG(financialSimulation?.totalDescuentoCedido || 0)}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          Descuento total en caja sobre precio de lista ({financialSimulation?.totalItems || 0} productos).
                        </div>
                      </div>

                      {/* Tarjeta 2: Cuentas por Cobrar / NC Proveedor */}
                      {(newFinanciamiento === "proveedor_sell_out" || newFinanciamiento === "co_financiado" || newOrigen === "accion_proveedor" || newOrigen === "corto_vencimiento") ? (
                        <div className="p-3 bg-blue-950/60 rounded-xl border border-blue-800/60 space-y-1">
                          <div className="text-[10px] font-bold text-blue-300 uppercase flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-blue-400" />
                            Cuentas por Cobrar a Proveedor (AR):
                          </div>
                          <div className="text-base font-mono font-black text-blue-300">
                            {formatPYG(financialSimulation?.totalNC || 0)}
                          </div>
                          <div className="text-[10px] text-blue-200/70 leading-tight">
                            {newFinanciamiento === "co_financiado"
                              ? `Aporte Proveedor (${newPctAporteProveedor || 30}% s/ regular) a reclamar vía NC Scan-Back.`
                              : newOrigen === "corto_vencimiento"
                              ? `NC en firme por lote próximo a vencer (${newPorcentajeNcCosto || 40}% s/ costo).`
                              : "Monto total a reclamar vía Nota de Crédito (NC Sell-Out Scan-Back)."}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Margen Comercial Cedido (Ilustrativo):</div>
                          <div className="text-base font-mono font-black text-slate-300">
                            {formatPYG(financialSimulation?.totalDescuentoCedido || 0)}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight">
                            Gasto de marketing de salón asumido para dinamizar rotación (no es pérdida si cubre costo).
                          </div>
                        </div>
                      )}

                      {/* Tarjeta 3: Margen Bruto o Pérdida Real */}
                      {(financialSimulation?.itemsBajoCosto || 0) > 0 && newFinanciamiento === "propio_supermercado" ? (
                        <div className="p-3 bg-red-950/70 rounded-xl border border-red-800/60 space-y-1">
                          <div className="text-[10px] font-bold text-red-300 uppercase flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                            Pérdida Neta Real a Imputar:
                          </div>
                          <div className="text-base font-mono font-black text-red-400">
                            -{formatPYG(financialSimulation?.totalPerdidaRealBajoCosto || 0)}
                          </div>
                          <div className="text-[10px] text-red-200/80 leading-tight">
                            {financialSimulation?.itemsBajoCosto || 0} variante(s) venden por debajo del costo unitario. Requiere firma de gerencia.
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-800/60 space-y-1">
                          <div className="text-[10px] font-bold text-emerald-300 uppercase flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            Margen Bruto Proyectado de Tienda:
                          </div>
                          <div className="text-base font-mono font-black text-emerald-400">
                            {formatPYG(financialSimulation?.margenBrutoTienda || 0)} ({(Number(financialSimulation?.margenPct) || 0).toFixed(1)}%)
                          </div>
                          <div className="text-[10px] text-emerald-200/70 leading-tight">
                            {newFinanciamiento === "co_financiado"
                              ? `Ganancia neta tras deducir aporte tienda (${newPctAporteTienda || 20}%) y sumar NC proveedor.`
                              : "Ganancia neta proyectada de la tienda tras aplicar la oferta."}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 5: RESTRICCIONES & CORTO VENCIMIENTO */}
                {newOrigen === "corto_vencimiento" && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Lote de Corto Vencimiento & Compromiso de Nota de Crédito
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Vencimiento Lote:</label>
                        <input
                          type="date"
                          required
                          value={newFechaVencimientoLote}
                          onChange={e => {
                            setNewFechaVencimientoLote(e.target.value)
                            setNewHasta(e.target.value)
                          }}
                          className="w-full text-xs p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Cantidad Lote (un.):</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newStockLimite}
                          onChange={e => setNewStockLimite(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="Ej: 100"
                          className="w-full text-xs font-mono font-bold p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">% NC s/ Costo:</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={newPorcentajeNcCosto}
                          onChange={e => setNewPorcentajeNcCosto(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="Ej: 40"
                          className="w-full text-xs font-mono font-bold p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* VIGENCIA & DÍAS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700">
                  <div>
                    <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Válido Desde:</label>
                    <input
                      type="date"
                      required
                      value={newDesde}
                      onChange={e => setNewDesde(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Válido Hasta:</label>
                    <input
                      type="date"
                      required
                      value={newHasta}
                      onChange={e => setNewHasta(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Modal - Pinned at bottom */}
              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center shrink-0 mt-4">
                <div className="text-xs text-gray-500">
                  {selectedBatchProducts?.size || 0} productos seleccionados para esta promoción
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || (selectedBatchProducts?.size || 0) === 0}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 cursor-pointer"
                  >
                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>Guardar Promoción ({selectedBatchProducts?.size || 0} items)</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* ── MODAL: LIQUIDACIÓN SELL-OUT & CARGA DE NC ─────────────────────── */}
      {showSellOutModal && selectedPromo && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  Liquidación Sell-Out (Scan-Back) & Reclamo
                </h3>
                <p className="text-xs text-gray-500 truncate max-w-md">
                  Campaña: <strong>{selectedPromo.nombre}</strong>
                </p>
              </div>
              <button onClick={() => setShowSellOutModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingClaim ? (
              <div className="p-8 text-center text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-1 text-emerald-500" />
                <span className="text-xs">Identificando proveedor, órdenes de compra y calculando rebate...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveNC} className="space-y-3.5 text-xs">
                {/* 1. Proveedor Titular */}
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/50 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-extrabold text-blue-700 dark:text-blue-300 block">
                        Proveedor Comercial Titular:
                      </span>
                      <strong className="text-sm font-bold text-gray-900 dark:text-white block truncate">
                        {sellOutClaimData?.supplier_nombre || "Proveedor General"}
                      </strong>
                      <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2 mt-0.5">
                        <span>RUC: {sellOutClaimData?.supplier_ruc || "S/RUC"}</span>
                        {sellOutClaimData?.supplier_telefono && <span>· Tel: {sellOutClaimData.supplier_telefono}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 shrink-0">
                    {FINANCIAMIENTO_LABELS[sellOutClaimData?.financiamiento || selectedPromo.financiamiento || "proveedor_sell_out"]?.label}
                  </span>
                </div>

                {/* 2. Facturas / Órdenes de Compra Afectadas */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wider flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-gray-400" />
                    Facturas de Compra Afectadas / Órdenes Involucradas:
                  </span>
                  {(sellOutClaimData?.facturas_compra_referencia || []).length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 bg-gray-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-gray-200 dark:border-slate-700">
                      <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between pb-1">
                        <span>Comprobante</span>
                        <span>Timbrado</span>
                        <span>Fecha</span>
                        <span>Monto Compra</span>
                      </div>
                      {sellOutClaimData.facturas_compra_referencia.map((f: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between pt-1 text-[11px] font-mono">
                          <span className="font-bold text-blue-600 dark:text-blue-400">{f.numero}</span>
                          <span className="text-gray-500">{f.timbrado || "18545636"}</span>
                          <span className="text-gray-500">{f.fecha}</span>
                          <span className="font-bold">{formatPYG(f.total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-200 dark:border-slate-700 text-center text-gray-400 text-[11px]">
                      Órdenes de compra consolidadas en base a la rotación general de salón
                    </div>
                  )}
                </div>

                {/* 3. Desglose Económico de Liquidación */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase">Descuento Total en Caja:</span>
                    <strong className="text-sm font-mono font-black text-amber-500 block">
                      {formatPYG(sellOutClaimData?.total_descuento_general || sellOutClaimData?.total_rebate_reclamar || 0)}
                    </strong>
                    <span className="text-[10px] text-gray-500">{sellOutClaimData?.unidades_vendidas || 0} un. vendidas</span>
                  </div>

                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-900/60">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-300 block uppercase">Aporte Proveedor (NC):</span>
                    <strong className="text-sm font-mono font-black text-blue-600 dark:text-blue-300 block">
                      {formatPYG(sellOutClaimData?.total_rebate_reclamar || sellOutClaimData?.monto_total_reclamado_pyg || 0)}
                    </strong>
                    <span className="text-[10px] text-blue-500 font-bold">{sellOutClaimData?.porcentaje_aporte_proveedor || 100}% Aporte</span>
                  </div>

                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 block uppercase">Aporte Tienda:</span>
                    <strong className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-300 block">
                      {formatPYG(sellOutClaimData?.total_aporte_tienda || 0)}
                    </strong>
                    <span className="text-[10px] text-emerald-500 font-bold">{sellOutClaimData?.porcentaje_aporte_tienda || 0}% Asumido</span>
                  </div>
                </div>

                {/* 4. Formulario Asentamiento NC */}
                <div className="p-3.5 bg-slate-900 text-white dark:bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                    Asentamiento de Nota de Crédito Recibida
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 block mb-1">Nº Nota de Crédito Proveedor:</label>
                      <input
                        type="text"
                        required
                        value={ncNumero}
                        onChange={e => setNcNumero(e.target.value)}
                        placeholder="001-001-0001234"
                        className="w-full text-xs font-mono p-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-300 block mb-1">Timbrado Proveedor:</label>
                      <input
                        type="text"
                        required
                        value={ncTimbrado}
                        onChange={e => setNcTimbrado(e.target.value)}
                        placeholder="18545636"
                        className="w-full text-xs font-mono p-2 rounded-xl border border-slate-700 bg-slate-800 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-300 block mb-1">Monto Asentado en Cuenta (Gs.):</label>
                    <input
                      type="number"
                      required
                      value={ncMonto}
                      onChange={e => setNcMonto(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full text-xs font-mono font-black p-2 rounded-xl border border-slate-700 bg-slate-800 text-emerald-400 text-base"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSellOutModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-100 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingNC}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold shadow-lg cursor-pointer"
                  >
                    {savingNC ? "Guardando..." : "Asentar NC en Cuentas Corrientes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: SIMULADOR DE CARRITO ───────────────────────────────────── */}
      {showSimModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Simulador de Carrito y Promociones</h3>
                <p className="text-xs text-gray-500">Pruebe las reglas comerciales agregando items</p>
              </div>
              <button onClick={() => setShowSimModal(false)} className="p-1 rounded-xl hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="relative">
                <input
                  type="text"
                  value={simProdSearch}
                  onChange={e => setSimProdSearch(e.target.value)}
                  placeholder="Buscar producto para agregar al carrito..."
                  className="w-full text-xs p-2.5 pl-8 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
              </div>

              {simProdResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 border rounded-xl">
                  {simProdResults.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSimItems(prev => [...prev, { product_id: p.id, nombre: p.nombre, precio: Number(p.precio_venta || 0), cantidad: 1 }])
                        setSimProdSearch("")
                        setSimProdResults([])
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                    >
                      <span className="font-bold">{p.nombre}</span>
                      <span className="font-mono font-bold text-emerald-600">{formatPYG(Number(p.precio_venta || 0))}</span>
                    </div>
                  ))}
                </div>
              )}

              {simItems.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl space-y-2 border border-gray-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                  {simItems.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="font-semibold truncate max-w-xs">{it.nombre}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{formatPYG(it.precio * it.cantidad)}</span>
                        <button
                          onClick={() => setSimItems(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowSimModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold"
                >
                  Cerrar Simulador
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
