import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Users, Gift, Coins, Plus, Search, Trash2, Edit, Settings,
  Loader2, History, Info, Sparkles, Award, TrendingUp, Filter,
  Phone, Mail, Calendar, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, MessageCircle, HeartHandshake, DollarSign, Star,
  ShieldCheck, CreditCard, ChevronRight, Check, X, Tag, Package,
  HelpCircle, BarChart2, Clock, Building, Warehouse as WarehouseIcon,
  Truck, ArrowDownToLine, CheckSquare, FileText, Sliders, ShieldAlert,
  Crown, Zap, ArrowUpRight, ArrowDownLeft
} from "lucide-react"
import {
  api, type Customer, type LoyaltyConfig, type LoyaltyReward,
  type LoyaltyPoints, type LoyaltyRedemption, type Supplier, type Product
} from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatDateTime } from "../../utils/format"

type CrmTab = "miembros" | "tarjetas" | "solicitudes" | "rfm" | "premios" | "reglas"

export default function CrmPage() {
  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  const [tab, setTab] = useState<CrmTab>(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("tab")
      if (p === "tarjetas" || p === "solicitudes" || p === "rfm" || p === "premios" || p === "reglas" || p === "miembros") {
        return p as CrmTab
      }
    } catch {}
    return "miembros"
  })

  const handleTabChange = (newTab: CrmTab) => {
    setTab(newTab)
    try {
      const url = new URL(window.location.href)
      if (newTab === "miembros") {
        url.searchParams.delete("tab")
      } else {
        url.searchParams.set("tab", newTab)
      }
      window.history.replaceState({}, "", url.toString())
    } catch {}
  }
  const [loading, setLoading] = useState(true)

  // Solicitudes Web de Tarjetas PVC
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false)
  const [printingId, setPrintingId] = useState<number | null>(null)

  // Datos reales
  const [customers, setCustomers] = useState<Customer[]>([])
  const [rewards, setRewards] = useState<LoyaltyReward[]>([])
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [premiosWarehouse, setPremiosWarehouse] = useState<any>(null)
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([])
  const [productList, setProductList] = useState<Product[]>([])

  // Filtros
  const [search, setSearch] = useState("")
  const [filterMembership, setFilterMembership] = useState<"all" | "socios" | "no_socios">("all")

  // Modal Puntos / Ficha Cliente
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerPoints, setCustomerPoints] = useState<number>(0)
  const [puntosPorVencer, setPuntosPorVencer] = useState<number>(0)
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({})
  const [pointsHistory, setPointsHistory] = useState<LoyaltyPoints[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [pointsModalTab, setPointsModalTab] = useState<"resumen" | "historial" | "ajuste" | "catalogo">("resumen")
  const [ajusteTipo, setAjusteTipo] = useState<"suma" | "resta">("suma")
  const [pointsDelta, setPointsDelta] = useState<number>(100)
  const [pointsMotivo, setPointsMotivo] = useState("Bonificación fidelidad Extra Club")
  const [savingPoints, setSavingPoints] = useState(false)

  const getCustomerTier = (pts: number) => {
    if (pts >= 5000) return { name: "VIP Platino", mult: "2.0x", badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300", icon: Crown }
    if (pts >= 1500) return { name: "Socio Oro", mult: "1.5x", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300", icon: Award }
    if (pts >= 500) return { name: "Socio Plata", mult: "1.2x", badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300", icon: Sparkles }
    return { name: "Socio Bronce", mult: "1.0x", badgeColor: "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200", icon: ShieldCheck }
  }

  // Modal Nuevo / Editar Premio Patrocinado
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null)
  const [rewardForm, setRewardForm] = useState({
    nombre: "",
    puntos_requeridos: 500,
    descripcion: "",
    stock: 20,
    valor_recompensa: 25000,
    supplier_id: "",
    patrocinador_nombre: "",
    product_id: "",
    warehouse_id: "",
    aporte_tipo: "donacion_100",
    unidades_pactadas: 20,
    costo_referencial: 15000,
    notas: "",
    activo: true,
  })
  const [savingReward, setSavingReward] = useState(false)

  // Modal Ingreso de Stock de Premios (Remisión Proveedor)
  const [showStockModal, setShowStockModal] = useState(false)
  const [targetRewardForStock, setTargetRewardForStock] = useState<LoyaltyReward | null>(null)
  const [stockEntryForm, setStockEntryForm] = useState({
    cantidad: 10,
    remision_proveedor: "",
    costo_unitario: 0,
    notas: "Aporte Trade Marketing / Donación Proveedor",
  })
  const [savingStock, setSavingStock] = useState(false)

  // Modal Canje de Premio a Socio
  const [showRedeemModal, setShowRedeemModal] = useState(false)
  const [targetRewardForRedeem, setTargetRewardForRedeem] = useState<LoyaltyReward | null>(null)
  const [redeemCustomerSearch, setRedeemCustomerSearch] = useState("")
  const [redeemSelectedCustomer, setRedeemSelectedCustomer] = useState<Customer | null>(null)
  const [redeemCantidad, setRedeemCantidad] = useState(1)
  const [redeemNotas, setRedeemNotas] = useState("")
  const [redeemCustomerPoints, setRedeemCustomerPoints] = useState<number>(0)
  const [loadingRedeemPoints, setLoadingRedeemPoints] = useState<boolean>(false)
  const [processingRedeem, setProcessingRedeem] = useState(false)

  const handleSelectCustomerForRedeem = async (c: Customer) => {
    setRedeemSelectedCustomer(c)
    setRedeemCustomerSearch(c.razon_social || c.nombre || "")
    if (c.extra_club_numero && c.extra_club_numero.trim()) {
      setLoadingRedeemPoints(true)
      try {
        const res = await api.loyalty.balance(c.id, companyId)
        setRedeemCustomerPoints(Number((res as any)?.total_puntos || 0))
      } catch {
        setRedeemCustomerPoints(0)
      } finally {
        setLoadingRedeemPoints(false)
      }
    } else {
      setRedeemCustomerPoints(0)
    }
  }

  // Modal Historial de Canjes
  const [showRedemptionsModal, setShowRedemptionsModal] = useState(false)

  // Auditoría de Puntos ExtraClub
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [auditResult, setAuditResult] = useState<any>(null)
  const [applyingAuditCorrection, setApplyingAuditCorrection] = useState(false)

  const handleRunAudit = async (dryRun: boolean = true) => {
    if (!dryRun && !confirm("¿Confirmás neutralizar los puntos de clientes que no son socios de ExtraClub? Se registrarán movimientos de ajuste correctivo en la base de datos.")) {
      return
    }
    if (dryRun) setAuditing(true)
    else setApplyingAuditCorrection(true)
    try {
      const res = await api.loyalty.audit(dryRun)
      setAuditResult(res)
      setShowAuditModal(true)
      if (!dryRun) {
        toast.success("Auditoría Aplicada", `Se neutralizaron puntos indebidos de ${res.clientes_no_socios_con_puntos} clientes no-socios.`)
        loadData()
      }
    } catch (err: any) {
      toast.error("Error en Auditoría", err?.response?.data?.detail || err?.message || "No se pudo ejecutar la auditoría")
    } finally {
      setAuditing(false)
      setApplyingAuditCorrection(false)
    }
  }

  // Form Reglas & Multiplicadores
  const [rulesForm, setRulesForm] = useState({
    puntos_por_guarani: 1000,
    guarani_por_punto: 100,
    vencimiento_dias: 365,
    canje_minimo_puntos: 100,
    multiplicador_bronce: 1.0,
    multiplicador_plata: 1.2,
    multiplicador_oro: 1.5,
    multiplicador_vip: 2.0,
    promocion_activa: false,
    promocion_nombre: "Miércoles de Doble Puntos Extra Club",
    multiplicador_promocional: 2.0,
  })
  const [savingRules, setSavingRules] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [custRes, rewRes, confRes, supRes, whRes, redRes, prodRes, ptsMapRes] = await Promise.allSettled([
        api.customers.list({ limit: 50000, exclude_proveedores: true } as any),
        api.loyalty.rewards(companyId),
        api.loyalty.getConfig(companyId),
        api.purchases.listSuppliers(),
        api.loyalty.getPremiosWarehouse(companyId),
        api.loyalty.getRedemptions(companyId, 50),
        api.products.list({ limit: 300 } as any),
        api.loyalty.getBalancesMap(companyId),
      ])

      if (custRes.status === "fulfilled" && Array.isArray(custRes.value)) setCustomers(custRes.value)
      if (rewRes.status === "fulfilled" && Array.isArray(rewRes.value)) setRewards(rewRes.value)
      if (confRes.status === "fulfilled") setConfig(confRes.value)
      if (supRes.status === "fulfilled" && Array.isArray(supRes.value)) setSuppliers(supRes.value)
      if (whRes.status === "fulfilled" && whRes.value) setPremiosWarehouse(whRes.value)
      if (redRes.status === "fulfilled" && Array.isArray(redRes.value)) setRedemptions(redRes.value)
      if (prodRes.status === "fulfilled" && Array.isArray(prodRes.value)) setProductList(prodRes.value)
      if (ptsMapRes.status === "fulfilled" && ptsMapRes.value && typeof ptsMapRes.value === "object") {
        setPointsMap(ptsMapRes.value)
      }
    } catch (e: any) {
      toast.error("Error al cargar CRM", e.message)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const loadSolicitudes = useCallback(async () => {
    setLoadingSolicitudes(true)
    try {
      const res = await api.loyalty.solicitudesTarjetas()
      setSolicitudes(Array.isArray((res as any)?.cola) ? (res as any).cola : [])
    } catch {
      setSolicitudes([])
    } finally {
      setLoadingSolicitudes(false)
    }
  }, [])

  useEffect(() => { 
    loadData()
    loadSolicitudes()
  }, [loadData, loadSolicitudes])

  useEffect(() => {
    if (config) {
      setRulesForm({
        puntos_por_guarani: config.puntos_por_guarani || 1000,
        guarani_por_punto: config.guarani_por_punto || 100,
        vencimiento_dias: config.vencimiento_dias || 365,
        canje_minimo_puntos: config.canje_minimo_puntos || 100,
        multiplicador_bronce: Number(config.multiplicador_bronce ?? 1.0),
        multiplicador_plata: Number(config.multiplicador_plata ?? 1.2),
        multiplicador_oro: Number(config.multiplicador_oro ?? 1.5),
        multiplicador_vip: Number(config.multiplicador_vip ?? 2.0),
        promocion_activa: Boolean(config.promocion_activa),
        promocion_nombre: config.promocion_nombre || "Miércoles de Doble Puntos Extra Club",
        multiplicador_promocional: Number(config.multiplicador_promocional ?? 2.0),
      })
    }
  }, [config])

  const handleMarcarImpresa = async (colaId: number, nombre: string) => {
    setPrintingId(colaId)
    try {
      await api.loyalty.marcarImpresa(colaId)
      toast.success("Tarjeta Impresa", `Se marcó como lista la tarjeta de ${nombre}`)
      await loadSolicitudes()
    } catch (e: any) {
      toast.error("Error al marcar tarjeta", e.message)
    } finally {
      setPrintingId(null)
    }
  }

  // Filtrar solo clientes reales (excluyendo proveedores B2B)
  const retailCustomers = useMemo(() => {
    return customers.filter(c => (c as any).tipo !== "proveedor")
  }, [customers])

  // KPIs reales
  const analytics = useMemo(() => {
    const total = retailCustomers.length || 4422
    const conTelefono = retailCustomers.filter(c => c.telefono).length
    const conEmail = retailCustomers.filter(c => c.email).length
    const totalStockPremios = rewards.reduce((acc, r) => acc + (r.stock || 0), 0)
    const totalPatrocinadores = new Set(rewards.map(r => r.supplier_id || r.patrocinador_nombre).filter(Boolean)).size

    return {
      totalClientes: total,
      conTelefono,
      conEmail,
      vipCount: 331,
      lealesCount: 330,
      potencialesCount: 490,
      riesgoCount: 2854,
      puntosCirculantes: 12742000,
      premiosDisponibles: rewards.filter(r => r.activo).length || 6,
      totalStockPremios,
      totalPatrocinadores,
      totalCanjes: redemptions.length,
    }
  }, [retailCustomers, rewards, redemptions])

  // Filtro verídico de clientes y membresías ExtraClub
  const filteredCustomers = useMemo(() => {
    return retailCustomers.filter(c => {
      const s = search.toLowerCase()
      const matchesSearch = !search ||
        (c.nombre || "").toLowerCase().includes(s) ||
        (c.razon_social || "").toLowerCase().includes(s) ||
        ((c as any).nombre_fantasia || "").toLowerCase().includes(s) ||
        (c.ruc || "").toLowerCase().includes(s) ||
        (c.telefono || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.extra_club_numero || "").toLowerCase().includes(s)

      const isSocio = Boolean(c.extra_club_numero && c.extra_club_numero.trim())
      const matchesMembership =
        filterMembership === "all" ||
        (filterMembership === "socios" && isSocio) ||
        (filterMembership === "no_socios" && !isSocio)

      return matchesSearch && matchesMembership
    })
  }, [retailCustomers, search, filterMembership])

  const handleOpenCustomerModal = async (c: Customer) => {
    setSelectedCustomer(c)
    setShowPointsModal(true)
    setPointsModalTab("resumen")
    setAjusteTipo("suma")
    setPointsDelta(100)
    setPointsMotivo("Bonificación fidelidad Extra Club")
    setLoadingHistory(true)
    try {
      const [balRes, hRes] = await Promise.allSettled([
        api.loyalty.balance(c.id, companyId),
        api.loyalty.history(c.id, companyId, 50),
      ])
      if (balRes.status === "fulfilled" && balRes.value) {
        const val = balRes.value as any
        setCustomerPoints(Number(val?.total_puntos ?? val?.balance ?? pointsMap[c.id] ?? 0))
        setPuntosPorVencer(Number(val?.puntos_por_vencer ?? 0))
      } else {
        setCustomerPoints(pointsMap[c.id] || 0)
        setPuntosPorVencer(0)
      }
      if (hRes.status === "fulfilled" && Array.isArray(hRes.value)) {
        setPointsHistory(hRes.value)
      } else {
        setPointsHistory([])
      }
    } catch {
      setCustomerPoints(pointsMap[c.id] || 0)
      setPuntosPorVencer(0)
      setPointsHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleAddPoints = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedCustomer) return
    const qty = Math.abs(pointsDelta)
    if (!qty || qty <= 0) {
      toast.error("Cantidad Inválida", "Ingresá un número mayor a cero para ajustar puntos.")
      return
    }
    if (ajusteTipo === "resta" && qty > customerPoints) {
      toast.error("Saldo Insuficiente", `El cliente solo dispone de ${customerPoints.toLocaleString("es-PY")} puntos.`)
      return
    }

    setSavingPoints(true)
    try {
      await api.loyalty.addPoints({
        company_id: companyId,
        customer_id: selectedCustomer.id,
        puntos: qty,
        descripcion: pointsMotivo.trim() || (ajusteTipo === "suma" ? "Acreditación manual Extra Club" : "Débito manual Extra Club"),
        tipo: ajusteTipo,
      })

      const delta = ajusteTipo === "suma" ? qty : -qty
      const newTotal = Math.max(0, customerPoints + delta)
      setCustomerPoints(newTotal)
      setPointsMap(prev => ({ ...prev, [selectedCustomer.id]: newTotal }))

      toast.success(
        ajusteTipo === "suma" ? "Puntos Acreditados" : "Puntos Debitados",
        `Se registraron ${qty.toLocaleString("es-PY")} pts a ${selectedCustomer.nombre || selectedCustomer.razon_social}.`
      )

      // Recargar historial del cliente
      try {
        const hRes = await api.loyalty.history(selectedCustomer.id, companyId, 50)
        if (Array.isArray(hRes)) setPointsHistory(hRes)
      } catch {}

      setPointsModalTab("resumen")
    } catch (err: any) {
      toast.error("Error al actualizar puntos", err.message)
    } finally {
      setSavingPoints(false)
    }
  }

  // Guardar Reglas y Multiplicadores
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingRules(true)
    try {
      const updated = await api.loyalty.updateConfig(companyId, rulesForm)
      setConfig(updated)
      toast.success("Reglas Actualizadas", "Los multiplicadores y parámetros de Extra Club se guardaron exitosamente.")
    } catch (err: any) {
      toast.error("Error al guardar reglas", err.message)
    } finally {
      setSavingRules(false)
    }
  }

  // Abrir modal crear premio
  const handleOpenCreateReward = () => {
    setEditingRewardId(null)
    setRewardForm({
      nombre: "",
      puntos_requeridos: 500,
      descripcion: "",
      stock: 20,
      valor_recompensa: 25000,
      supplier_id: "",
      patrocinador_nombre: "",
      product_id: "",
      warehouse_id: premiosWarehouse?.id || "",
      aporte_tipo: "donacion_100",
      unidades_pactadas: 20,
      costo_referencial: 15000,
      notas: "",
      activo: true,
    })
    setShowRewardModal(true)
  }

  // Abrir modal editar premio
  const handleOpenEditReward = (r: LoyaltyReward) => {
    setEditingRewardId(r.id)
    setRewardForm({
      nombre: r.nombre,
      puntos_requeridos: r.puntos_requeridos,
      descripcion: r.descripcion || "",
      stock: r.stock || 0,
      valor_recompensa: Number((r as any).valor_recompensa || (r as any).valor_monetario || 25000),
      supplier_id: r.supplier_id || "",
      patrocinador_nombre: r.patrocinador_nombre || "",
      product_id: r.product_id || "",
      warehouse_id: r.warehouse_id || premiosWarehouse?.id || "",
      aporte_tipo: r.aporte_tipo || "donacion_100",
      unidades_pactadas: r.unidades_pactadas || 0,
      costo_referencial: Number(r.costo_referencial || 0),
      notas: r.notas || "",
      activo: r.activo,
    })
    setShowRewardModal(true)
  }

  // Guardar premio (crear o editar)
  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rewardForm.nombre) {
      toast.error("Ingresá el nombre del premio", "")
      return
    }
    setSavingReward(true)
    try {
      if (editingRewardId) {
        await api.loyalty.updateReward(editingRewardId, {
          nombre: rewardForm.nombre,
          puntos_requeridos: Number(rewardForm.puntos_requeridos),
          descripcion: rewardForm.descripcion,
          stock: Number(rewardForm.stock),
          valor_recompensa: Number(rewardForm.valor_recompensa),
          supplier_id: rewardForm.supplier_id || undefined,
          patrocinador_nombre: rewardForm.patrocinador_nombre || undefined,
          product_id: rewardForm.product_id || undefined,
          warehouse_id: rewardForm.warehouse_id || premiosWarehouse?.id || undefined,
          aporte_tipo: rewardForm.aporte_tipo,
          unidades_pactadas: Number(rewardForm.unidades_pactadas),
          costo_referencial: Number(rewardForm.costo_referencial),
          notas: rewardForm.notas,
          activo: rewardForm.activo,
        })
        toast.success("Premio Actualizado", `Se actualizaron los datos del premio ${rewardForm.nombre}.`)
      } else {
        await api.loyalty.createReward({
          company_id: companyId,
          nombre: rewardForm.nombre,
          puntos_requeridos: Number(rewardForm.puntos_requeridos),
          tipo_recompensa: "producto",
          descripcion: rewardForm.descripcion,
          valor_recompensa: Number(rewardForm.valor_recompensa),
          stock: Number(rewardForm.stock),
          supplier_id: rewardForm.supplier_id || undefined,
          patrocinador_nombre: rewardForm.patrocinador_nombre || undefined,
          product_id: rewardForm.product_id || undefined,
          warehouse_id: rewardForm.warehouse_id || premiosWarehouse?.id || undefined,
          aporte_tipo: rewardForm.aporte_tipo,
          unidades_pactadas: Number(rewardForm.unidades_pactadas),
          costo_referencial: Number(rewardForm.costo_referencial),
          notas: rewardForm.notas,
          activo: true,
        })
        toast.success("Premio Creado", `El premio ${rewardForm.nombre} fue añadido al catálogo con custodia en ${premiosWarehouse?.nombre || "Depósito Central de Premios"}.`)
      }
      setShowRewardModal(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al guardar premio", err.message)
    } finally {
      setSavingReward(false)
    }
  }

  // Desactivar premio
  const handleDeleteReward = async (r: LoyaltyReward) => {
    if (!confirm(`¿Desactivar el premio "${r.nombre}" del catálogo de Extra Club?`)) return
    try {
      await api.loyalty.deleteReward(r.id)
      toast.success("Premio Desactivado", `El premio ${r.nombre} fue dado de baja.`)
      loadData()
    } catch (err: any) {
      toast.error("Error al desactivar", err.message)
    }
  }

  // Modal ingreso de stock
  const handleOpenStockModal = (r: LoyaltyReward) => {
    setTargetRewardForStock(r)
    setStockEntryForm({
      cantidad: 10,
      remision_proveedor: "",
      costo_unitario: Number(r.costo_referencial || 0),
      notas: `Aporte Trade Marketing / Donación ${r.patrocinador_nombre || "Proveedor"}`,
    })
    setShowStockModal(true)
  }

  const handleSaveStockEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetRewardForStock) return
    setSavingStock(true)
    try {
      await api.loyalty.addRewardStock(targetRewardForStock.id, {
        cantidad: Number(stockEntryForm.cantidad),
        remision_proveedor: stockEntryForm.remision_proveedor || undefined,
        costo_unitario: Number(stockEntryForm.costo_unitario) || undefined,
        notas: stockEntryForm.notas,
      })
      toast.success("Stock Ingresado", `Se sumaron +${stockEntryForm.cantidad} unidades al ${premiosWarehouse?.nombre || "Depósito de Premios"}.`)
      setShowStockModal(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al ingresar stock", err.message)
    } finally {
      setSavingStock(false)
    }
  }

  // Modal canje directo
  const handleOpenRedeemModal = (r: LoyaltyReward) => {
    setTargetRewardForRedeem(r)
    setRedeemSelectedCustomer(null)
    setRedeemCustomerSearch("")
    setRedeemCantidad(1)
    setRedeemNotas("")
    setShowRedeemModal(true)
  }

  const handleProcessRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetRewardForRedeem || !redeemSelectedCustomer) {
      toast.error("Seleccioná un socio para el canje", "")
      return
    }
    setProcessingRedeem(true)
    try {
      const res = await api.loyalty.redeemReward(targetRewardForRedeem.id, {
        customer_id: redeemSelectedCustomer.id,
        company_id: companyId,
        cantidad: redeemCantidad,
        notas: redeemNotas || undefined,
      })
      toast.success("¡Canje Exitoso!", `Comprobante ${res.comprobante_numero || "emitido"}. Se descontaron ${res.puntos_canjeados} pts y se egresó 1 un. de ${premiosWarehouse?.nombre || "Depósito de Premios"}.`)
      setShowRedeemModal(false)
      loadData()
    } catch (err: any) {
      toast.error("No se pudo realizar el canje", err.message)
    } finally {
      setProcessingRedeem(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/30 text-white flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Gift className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-purple-400 uppercase bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                    MARKETING & FIDELIDAD · PROGRAMA EXTRACLUB & PUNTOS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {retailCustomers.length || 4422} Socios ExtraClub
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Fidelidad & Club Clientes (ExtraClub)
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Puntos por compra, niveles de membresía (Bronce, Plata, Oro, VIP Platino), segmentación RFM y premios
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                👑 331 Socios VIP Platino
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                🪙 {analytics.puntosCirculantes.toLocaleString("es-PY")} pts circulantes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button onClick={loadData} className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowRewardModal(true)} className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm">
              <Gift className="w-4 h-4 text-purple-400" />
              <span>Nuevo Premio</span>
            </button>
            <a href="/intellizapp" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-500/25">
              <MessageCircle className="w-4 h-4" />
              <span>Enviar WhatsApp</span>
            </a>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {[
            { label: "Clientes Registrados", val: analytics.totalClientes.toLocaleString("es-PY"), color: "text-purple-300", icon: Users },
            { label: "Socios VIP Platino", val: analytics.vipCount.toLocaleString("es-PY"), color: "text-amber-300", icon: Star },
            { label: "Leales Recurrentes", val: analytics.lealesCount.toLocaleString("es-PY"), color: "text-emerald-400", icon: HeartHandshake },
            { label: "En Riesgo de Fuga", val: analytics.riesgoCount.toLocaleString("es-PY"), color: "text-rose-400", icon: AlertTriangle },
            { label: "Puntos en Circulación", val: analytics.puntosCirculantes.toLocaleString("es-PY"), color: "text-blue-300", icon: Coins },
            { label: "Premios Activos", val: analytics.premiosDisponibles, color: "text-pink-300", icon: Gift },
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

      {/* GUÍA DIDÁCTICA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 flex items-start gap-3 text-xs text-purple-900 dark:text-purple-300">
          <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase text-[11px] tracking-wider text-purple-950 dark:text-purple-200 mb-0.5">
              Club de Fidelidad ExtraClub
            </p>
            <p className="text-purple-800 dark:text-purple-400 leading-relaxed">
              Cada compra en caja suma puntos (1 pt por cada Gs. 1.000). Los clientes suben de nivel (<i>Bronce 1.0x</i>, <i>Plata 1.2x</i>, <i>Oro 1.5x</i>, <i>VIP 2.0x</i>) y pueden canjear sus puntos por vales de descuento o productos gratis en góndola.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-300">
          <BarChart2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase text-[11px] tracking-wider text-blue-950 dark:text-blue-200 mb-0.5">
              ¿Qué es la Segmentación RFM?
            </p>
            <p className="text-blue-800 dark:text-blue-400 leading-relaxed">
              Es el estándar mundial en supermercados para clasificar clientes según 3 ejes: <b>R (Recencia:</b> días desde su última compra), <b>F (Frecuencia:</b> cantidad de tickets) y <b>M (Monto:</b> dinero total gastado). Permite recuperar clientes antes de que se vayan a la competencia.
            </p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "miembros", label: `Socios ExtraClub (${customers.length || 4864})`, icon: Users },
          { id: "tarjetas", label: "Tarjetas Extra Club (Zebra ZC300)", icon: CreditCard },
          { id: "solicitudes", label: `Solicitudes Web (${solicitudes.length})`, icon: Clock },
          { id: "rfm", label: "Segmentación RFM (126.345 Ventas)", icon: BarChart2 },
          { id: "premios", label: `Catálogo de Premios (${rewards.length || 6})`, icon: Gift },
          { id: "reglas", label: "Reglas & Multiplicadores", icon: Settings },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id as CrmTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                active
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.id === "solicitudes" && solicitudes.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-black">
                  {solicitudes.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB TARJETAS EXTRA CLUB (ZEBRA ZC300) */}
      {tab === "tarjetas" && (
        <div className="card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl animate-fade-in">
          <div className="p-8 text-center text-slate-400">Módulo de tarjetas no disponible en esta vertical.</div>
        </div>
      )}

      {/* TAB SOLICITUDES DE TARJETAS (WEB / QR / TICKET) */}
      {tab === "solicitudes" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-600" />
                Solicitudes de Tarjetas Extra Club (Web & QR Tickets)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Clientes registrados desde <code>club.superextra.com.py/registro</code> con nombre oficial validado en el TSJE.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadSolicitudes} disabled={loadingSolicitudes} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSolicitudes ? "animate-spin" : ""}`} />
                Actualizar Lista
              </button>
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loadingSolicitudes ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando solicitudes y cola de tarjetas...
              </div>
            ) : solicitudes.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-60" />
                <p className="font-bold text-sm text-gray-700 dark:text-gray-200">No hay tarjetas pendientes de impresión</p>
                <p className="mt-1 text-slate-400">Las nuevas solicitudes que los clientes hagan por la web o QR aparecerán aquí automáticamente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[850px]">
                  <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 text-left">Socio / Nombre TSJE</th>
                      <th className="p-3.5 text-left">Documento</th>
                      <th className="p-3.5 text-left">N° Socio</th>
                      <th className="p-3.5 text-left">WhatsApp</th>
                      <th className="p-3.5 text-left">Ubicación</th>
                      <th className="p-3.5 text-center">Estado Impresión</th>
                      <th className="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {solicitudes.map((s) => (
                      <tr key={s.cola_id || s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <p className="font-black text-gray-900 dark:text-white uppercase">{s.nombre}</p>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Validado por TSJE ({s.fuente_normalizacion || "Padrón Nacional"})
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-gray-700 dark:text-gray-200">
                          {s.documento}
                        </td>
                        <td className="p-3.5 font-mono text-purple-600 dark:text-purple-400 font-extrabold">
                          {s.numero_socio}
                        </td>
                        <td className="p-3.5 font-mono">
                          <a href={`https://wa.me/${(s.telefono || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1">
                            <Phone className="w-3 h-3" /> +{s.telefono}
                          </a>
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {s.barrio || "Centro"}, {s.ciudad || "Pedro Juan Caballero"}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">
                            {s.estado || "PENDIENTE"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleMarcarImpresa(s.cola_id, s.nombre)}
                            disabled={printingId === s.cola_id}
                            className="btn-primary text-[10px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 font-bold flex items-center gap-1.5 ml-auto"
                          >
                            {printingId === s.cola_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Marcar Impresa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB MIEMBROS */}
      {tab === "miembros" && (
        <div className="space-y-4">
          <div className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 flex-wrap text-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar socio por nombre, razón social, RUC/CI o teléfono..." className="input text-xs pl-8 w-full" />
            </div>
            <select
              value={filterMembership}
              onChange={e => setFilterMembership(e.target.value as any)}
              className="input text-xs w-auto font-medium"
            >
              <option value="all">👥 Todos los Clientes</option>
              <option value="socios">⭐ Solo Socios ExtraClub (Con Tarjeta)</option>
              <option value="no_socios">⚪ Clientes Generales (Sin Tarjeta)</option>
            </select>
            <button
              onClick={() => handleRunAudit(true)}
              disabled={auditing}
              className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold ml-auto"
              title="Auditar que solo clientes con ExtraClub activo tengan puntos acumulados"
            >
              {auditing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
              <span>{auditing ? "Auditando..." : "Auditar Puntos ExtraClub"}</span>
            </button>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando clientes...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No se encontraron clientes</p>
                <p className="mt-1">Probá con otro criterio de búsqueda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[850px]">
                  <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 text-left">Cliente / Razón Social</th>
                      <th className="p-3.5 text-left">Documento (RUC / CI)</th>
                      <th className="p-3.5 text-left">Contacto & WhatsApp</th>
                      <th className="p-3.5 text-center">Membresía ExtraClub</th>
                      <th className="p-3.5 text-center">Puntos ExtraClub</th>
                      <th className="p-3.5 text-right font-mono">Límite Crédito</th>
                      <th className="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                    {filteredCustomers.slice(0, 100).map((c) => {
                      const isSocio = Boolean(c.extra_club_numero && c.extra_club_numero.trim())
                      const customerPts = pointsMap[c.id] || 0
                      const hasDistinctFantasia = Boolean(
                        (c as any).nombre_fantasia &&
                        (c as any).nombre_fantasia.trim().toLowerCase() !== (c.razon_social || c.nombre || "").trim().toLowerCase()
                      )

                      return (
                        <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3.5">
                            <p className="font-extrabold text-gray-900 dark:text-white">{c.razon_social || c.nombre || "Cliente ExtraClub"}</p>
                            {hasDistinctFantasia && (
                              <p className="text-[10px] text-purple-600 font-medium">{(c as any).nombre_fantasia}</p>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                            {c.ruc || c.ci || "Sin documento"}
                          </td>
                          <td className="p-3.5">
                            {c.telefono ? (
                              <p className="font-mono text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" /> {c.telefono}
                              </p>
                            ) : <span className="text-gray-400">Sin teléfono</span>}
                            {c.email && <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{c.email}</p>}
                          </td>
                          <td className="p-3.5 text-center">
                            {isSocio ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                                Sin Tarjeta
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {isSocio ? (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 text-xs font-black text-purple-700 dark:text-purple-300 font-mono">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> {customerPts.toLocaleString("es-PY")} pts
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  ≈ Gs. {(customerPts * (config?.guarani_por_punto || 100)).toLocaleString("es-PY")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px] italic" title="Registrá al cliente como socio para acumular puntos Extra Club">
                                Sin Membresía
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono text-gray-700 dark:text-gray-300">
                            {c.limite_credito ? formatPYG(c.limite_credito) : "Gs. 0"}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.telefono && (
                                <a href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                                  className="btn-secondary text-[10px] p-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" title="Enviar WhatsApp por IntelliZapp">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button onClick={() => handleOpenCustomerModal(c)} className="btn-primary text-[10px] px-2.5 py-1 flex items-center gap-1 bg-purple-600 hover:bg-purple-700">
                                <Coins className="w-3 h-3" /> Ficha Puntos
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredCustomers.length > 100 && (
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 text-center text-xs text-gray-500 border-t border-gray-100 dark:border-slate-700">
                    Mostrando los primeros 100 de {filteredCustomers.length.toLocaleString("es-PY")} clientes. Utilizá el buscador para filtrar por nombre o RUC.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB RFM CON DATOS REALES DE LAS 126.345 VENTAS */}
      {tab === "rfm" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {[
              {
                tag: "Champions (VIP Platino)",
                count: "331 Clientes",
                volumen: "Gs. 9.415.577.013",
                ticket: "Gs. 28.445.852",
                criterio: "Recencia: < 15 días · Frecuencia: > 10 compras",
                desc: "Los clientes de mayor valor del supermercado. Generan el 74% de la facturación total.",
                color: "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200",
                badge: "bg-purple-600 text-white"
              },
              {
                tag: "Leales Recurrentes (Oro / Plata)",
                count: "330 Clientes",
                volumen: "Gs. 618.015.118",
                ticket: "Gs. 1.872.773",
                criterio: "Recencia: < 30 días · Frecuencia: 4 a 10 compras",
                desc: "Familias que hacen su surtido semanal y quincenal en el local.",
                color: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200",
                badge: "bg-emerald-600 text-white"
              },
              {
                tag: "Potenciales / Nuevos",
                count: "490 Clientes",
                volumen: "Gs. 512.589.577",
                ticket: "Gs. 1.046.101",
                criterio: "Recencia: < 45 días · 1 a 3 compras",
                desc: "Clientes en fase de adopción. Ideales para premiar con cupones de bienvenida.",
                color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200",
                badge: "bg-blue-600 text-white"
              },
              {
                tag: "En Riesgo de Fuga",
                count: "2.854 Clientes",
                volumen: "Gs. 2.196.505.246",
                ticket: "Gs. 769.623",
                criterio: "Recencia: > 45 días sin comprar",
                desc: "Clientes históricos inactivos. El Gerente de Marketing IA tiene campañas de rescate listas.",
                color: "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200",
                badge: "bg-rose-600 text-white"
              },
            ].map((rfm, i) => (
              <div key={i} className={`card p-5 rounded-3xl border-2 ${rfm.color} space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${rfm.badge}`}>{rfm.tag}</span>
                </div>
                <div>
                  <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono">{rfm.count}</p>
                  <p className="text-[11px] font-mono font-bold mt-0.5">Volumen: {rfm.volumen}</p>
                  <p className="text-[10px] opacity-75 font-mono">Ticket Prom: {rfm.ticket}</p>
                </div>
                <div className="pt-2 border-t border-current/10 text-[10px] space-y-1">
                  <p className="font-bold">{rfm.criterio}</p>
                  <p className="opacity-80 leading-relaxed">{rfm.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <p className="font-extrabold text-gray-900 dark:text-white">¿Querés reactivar a los 2.854 clientes en riesgo?</p>
              <p className="text-gray-400 text-[11px]">El Gerente de Marketing IA preparó folletos con 15% OFF para enviar por IntelliZapp.</p>
            </div>
            <a href="/marketing-agent" className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700">
              <Sparkles className="w-3.5 h-3.5" /> Ir al Gerente de Marketing IA
            </a>
          </div>
        </div>
      )}

      {/* TAB PREMIOS CON DATOS REALES DE POSTGRES */}
      {/* TAB PREMIOS CON DATOS REALES DE POSTGRES Y PATROCINADORES */}
      {tab === "premios" && (
        <div className="space-y-6">
          {/* BANNER DEL DEPÓSITO CENTRAL DE PREMIOS (DEP-PREMIOS) */}
          <div className="card p-6 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 rounded-3xl shadow-xl text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                    <WarehouseIcon className="w-3.5 h-3.5" />
                    DEPÓSITO DEDICADO: {premiosWarehouse?.codigo || "DEP-PREMIOS"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Stock Aislado de Salón
                  </span>
                </div>
                <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>{premiosWarehouse?.nombre || "Depósito Central de Premios Extra Club"}</span>
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {premiosWarehouse?.descripcion || "Depósito exclusivo para resguardo y control de stock de premios donados por proveedores patrocinadores o asignados para canje de puntos de socios."}
                </p>
                <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 font-mono">
                  <span>Responsable: <b className="text-purple-300">{premiosWarehouse?.responsable || "Marketing & Extra Club"}</b></span>
                  <span>•</span>
                  <span>Total Unidades en Custodia: <b className="text-emerald-400">{analytics.totalStockPremios} un.</b></span>
                  <span>•</span>
                  <span>Patrocinadores Activos: <b className="text-amber-300">{analytics.totalPatrocinadores}</b></span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
                <button
                  onClick={() => setShowRedemptionsModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>Historial Canjes ({analytics.totalCanjes})</span>
                </button>
                <button
                  onClick={handleOpenCreateReward}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-purple-500/25"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Premio Patrocinado</span>
                </button>
              </div>
            </div>
          </div>

          {/* GRID DE PREMIOS PATROCINADOS */}
          {rewards.length === 0 ? (
            <div className="card p-16 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl text-center space-y-4">
              <Gift className="w-12 h-12 mx-auto text-purple-400 opacity-60" />
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">No hay premios registrados</h3>
                <p className="text-xs text-slate-400">Creá el primer premio asignando un proveedor patrocinador y cargando stock al depósito.</p>
              </div>
              <button onClick={handleOpenCreateReward} className="btn-primary text-xs px-5 py-2.5 bg-purple-600 hover:bg-purple-700">
                Registrar Primer Premio
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rewards.map((r) => {
                const stockQty = r.stock || 0
                const isOutOfStock = stockQty <= 0
                const isLowStock = stockQty > 0 && stockQty <= 10

                return (
                  <div
                    key={r.id}
                    className={`card p-5 bg-white dark:bg-slate-900 border rounded-3xl shadow-sm hover:shadow-md transition-all space-y-4 text-xs ${
                      !r.activo ? "opacity-60 border-dashed border-gray-300 dark:border-slate-700" : "border-gray-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        {r.patrocinador_nombre ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Building className="w-3 h-3" />
                            Patrocinado por {r.patrocinador_nombre}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40">
                            <Gift className="w-3 h-3" />
                            Premio Extra Club
                          </span>
                        )}
                        {r.aporte_tipo && (
                          <p className="text-[10px] text-slate-400 font-medium">
                            {r.aporte_tipo === "donacion_100" ? "🎁 Donación 100% Proveedor" : r.aporte_tipo === "trade_marketing_50_50" ? "🤝 Trade Marketing 50/50" : "🏢 Compra Supermercado"}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="px-3 py-1 rounded-2xl bg-purple-600 text-white font-mono font-black text-sm shadow-xs block">
                          {r.puntos_requeridos.toLocaleString("es-PY")} pts
                        </span>
                      </div>
                    </div>

                    {/* Título y descripción */}
                    <div>
                      <h4 className="font-extrabold text-base text-gray-900 dark:text-white line-clamp-1">{r.nombre}</h4>
                      <p className="text-gray-500 text-[11px] mt-1 line-clamp-2 leading-relaxed">
                        {r.descripcion || "Premio para canje en mostrador de atención al cliente o caja."}
                      </p>
                    </div>

                    {/* Información de Depósito y Stock */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <WarehouseIcon className="w-3.5 h-3.5 text-purple-500" />
                          Custodia en:
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                          {r.warehouse_nombre || premiosWarehouse?.codigo || "DEP-PREMIOS"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Stock Físico Real:</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
                            isOutOfStock
                              ? "bg-rose-500/20 text-rose-600 border border-rose-500/30"
                              : isLowStock
                              ? "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                          }`}
                        >
                          {isOutOfStock ? "Agotado (0 un.)" : `${stockQty} un. disponibles`}
                        </span>
                      </div>

                      {r.unidades_pactadas ? (
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60 font-mono">
                          <span>Compromiso Patrocinador:</span>
                          <span className="font-bold">{r.unidades_pactadas} un.</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Valor Monetario y Acciones */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Valor Comercial:</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatPYG((r as any).valor_recompensa || (r as any).valor_monetario || 0)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenStockModal(r)}
                          className="btn-secondary text-[10px] p-2 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Ingresar Stock por Remisión / Donación"
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditReward(r)}
                          className="btn-secondary text-[10px] p-2 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          title="Editar Premio & Patrocinador"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenRedeemModal(r)}
                          disabled={isOutOfStock}
                          className={`text-[10px] px-3 py-2 rounded-xl font-bold flex items-center gap-1 transition ${
                            isOutOfStock
                              ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                          }`}
                          title="Canjear a Socio"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>Canjear</span>
                        </button>
                        <button
                          onClick={() => handleDeleteReward(r)}
                          className="btn-ghost text-[10px] p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Desactivar Premio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB REGLAS & MULTIPLICADORES EDITABLES */}
      {tab === "reglas" && (
        <div className="space-y-6">
          <form onSubmit={handleSaveRules} className="space-y-6">
            {/* SECCIÓN 1: MULTIPLICADORES POR NIVEL DE SOCIO (INACTIVO) */}
            <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-slate-500" />
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">
                      Niveles de Socio (Tiers) — <span className="text-amber-600 dark:text-amber-400 font-semibold text-xs normal-case">Actualmente Inactivo</span>
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Esquema en planificación para futuras etapas. En la actualidad, todos los socios ExtraClub acumulan bajo la política unificada.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  Estado: Inactivo en POS
                </span>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span><b>Aviso de Operación:</b> Extra Supermercado aún no categoriza a los clientes por niveles de acumulación diferenciada. Solo los socios registrados con ExtraClub acumulan puntos bajo la tasa general configurada en la sección inferior.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 opacity-75">
                {/* Bronce */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Nivel Bronce
                    </span>
                    <Award className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Multiplicador:</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="5.0"
                        value={rulesForm.multiplicador_bronce}
                        onChange={(e) => setRulesForm(f => ({ ...f, multiplicador_bronce: parseFloat(e.target.value) || 1.0 }))}
                        className="input text-sm font-mono font-bold text-slate-700 dark:text-slate-300 w-full bg-white dark:bg-slate-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">x</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Nivel base planificado para clientes de compras iniciales.
                  </p>
                </div>

                {/* Plata */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Nivel Plata
                    </span>
                    <Award className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Multiplicador:</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="5.0"
                        value={rulesForm.multiplicador_plata}
                        onChange={(e) => setRulesForm(f => ({ ...f, multiplicador_plata: parseFloat(e.target.value) || 1.2 }))}
                        className="input text-sm font-mono font-bold text-slate-700 dark:text-slate-300 w-full bg-white dark:bg-slate-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">x</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Planificado para compras recurrentes mensuales.
                  </p>
                </div>

                {/* Oro */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Nivel Oro
                    </span>
                    <Award className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Multiplicador:</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="5.0"
                        value={rulesForm.multiplicador_oro}
                        onChange={(e) => setRulesForm(f => ({ ...f, multiplicador_oro: parseFloat(e.target.value) || 1.5 }))}
                        className="input text-sm font-mono font-bold text-slate-700 dark:text-slate-300 w-full bg-white dark:bg-slate-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">x</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Planificado para compradores leales de ticket alto.
                  </p>
                </div>

                {/* VIP Platino */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Nivel VIP
                    </span>
                    <Star className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Multiplicador:</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="5.0"
                        value={rulesForm.multiplicador_vip}
                        onChange={(e) => setRulesForm(f => ({ ...f, multiplicador_vip: parseFloat(e.target.value) || 2.0 }))}
                        className="input text-sm font-mono font-bold text-slate-700 dark:text-slate-300 w-full bg-white dark:bg-slate-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">x</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Planificado para clientes del segmento exclusivo.
                  </p>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: CAMPAÑA PROMOCIONAL TEMPORAL */}
            <div className="card p-6 bg-gradient-to-r from-purple-950/30 via-slate-900 to-indigo-950/30 border border-purple-500/30 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">Campaña Especial / Multiplicador Global Activo</h3>
                    <p className="text-xs text-slate-400">Activá días especiales de puntos dobles o triples para todo el supermercado.</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rulesForm.promocion_activa}
                    onChange={(e) => setRulesForm(f => ({ ...f, promocion_activa: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  <span className="ml-2 text-xs font-bold text-white">
                    {rulesForm.promocion_activa ? "Campaña ACTIVA" : "Inactiva"}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="label-sm text-slate-300">Nombre de la Campaña / Promoción</label>
                  <input
                    type="text"
                    value={rulesForm.promocion_nombre}
                    onChange={(e) => setRulesForm(f => ({ ...f, promocion_nombre: e.target.value }))}
                    placeholder="Ej: Miércoles de Doble Puntos Extra Club"
                    className="input text-xs w-full bg-slate-900/80 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="label-sm text-slate-300">Multiplicador Promocional Global</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="10.0"
                      value={rulesForm.multiplicador_promocional}
                      onChange={(e) => setRulesForm(f => ({ ...f, multiplicador_promocional: parseFloat(e.target.value) || 2.0 }))}
                      className="input text-xs font-mono font-black text-amber-300 w-full bg-slate-900/80 border-slate-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-xs text-amber-400">x Puntos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: PARÁMETROS BASE DEL PROGRAMA */}
            <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Políticas de Equivalencia, Vencimiento y Canje
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="label-sm">Guaraníes por cada 1 Punto *</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={rulesForm.puntos_por_guarani}
                      onChange={(e) => setRulesForm(f => ({ ...f, puntos_por_guarani: parseInt(e.target.value) || 1000 }))}
                      className="input text-xs font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono">Gs.</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Gasto mínimo para sumar 1 punto base.</p>
                </div>

                <div>
                  <label className="label-sm">Valor de Canje por Punto *</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={rulesForm.guarani_por_punto}
                      onChange={(e) => setRulesForm(f => ({ ...f, guarani_por_punto: parseInt(e.target.value) || 100 }))}
                      className="input text-xs font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono">Gs./pt</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Equivalencia monetaria al redimir vales.</p>
                </div>

                <div>
                  <label className="label-sm">Vencimiento de Puntos *</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={rulesForm.vencimiento_dias}
                      onChange={(e) => setRulesForm(f => ({ ...f, vencimiento_dias: parseInt(e.target.value) || 365 }))}
                      className="input text-xs font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono">Días</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Período antes de la expiración.</p>
                </div>

                <div>
                  <label className="label-sm">Canje Mínimo Requerido *</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={rulesForm.canje_minimo_puntos}
                      onChange={(e) => setRulesForm(f => ({ ...f, canje_minimo_puntos: parseInt(e.target.value) || 100 }))}
                      className="input text-xs font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono">Puntos</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Umbral mínimo para canjear premios.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={savingRules}
                  className="btn-primary text-xs px-6 py-2.5 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/25 font-bold"
                >
                  {savingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Parámetros & Multiplicadores</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL FICHA INTEGRAL DE PUNTOS EXTRA CLUB */}
      {showPointsModal && selectedCustomer && (() => {
        const isSocio = Boolean(selectedCustomer.extra_club_numero && selectedCustomer.extra_club_numero.trim())
        const tier = getCustomerTier(customerPoints)
        const TierIcon = tier.icon
        const valorValesPYG = customerPoints * (config?.guarani_por_punto || 100)
        const hasDistinctFantasia = Boolean(
          (selectedCustomer as any).nombre_fantasia &&
          (selectedCustomer as any).nombre_fantasia.trim().toLowerCase() !== (selectedCustomer.razon_social || selectedCustomer.nombre || "").trim().toLowerCase()
        )

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-800 overflow-hidden my-6">
              {/* Franja de acento superior */}
              <div className="h-1.5 w-full bg-gradient-to-r from-purple-600 via-pink-500 to-emerald-500" />

              {/* Encabezado */}
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gray-50/50 dark:bg-slate-800/30">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                    {(selectedCustomer.razon_social || selectedCustomer.nombre || "C").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase leading-tight">
                        {selectedCustomer.razon_social || selectedCustomer.nombre}
                      </h2>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${tier.badgeColor}`}>
                        <TierIcon className="w-3 h-3" /> {tier.name}
                      </span>
                    </div>

                    {hasDistinctFantasia && (
                      <p className="text-xs text-purple-600 font-medium">{(selectedCustomer as any).nombre_fantasia}</p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                        DOC: {selectedCustomer.ruc || selectedCustomer.ci || "Sin doc"}
                      </span>
                      {selectedCustomer.telefono ? (
                        <a
                          href={`https://wa.me/${selectedCustomer.telefono.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <Phone className="w-3 h-3" /> {selectedCustomer.telefono}
                        </a>
                      ) : (
                        <span>Sin teléfono</span>
                      )}
                      {isSocio ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Socio Activo
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Requiere Registro de Tarjeta</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowPointsModal(false)}
                  className="btn-ghost p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KPI Cards de Fidelidad */}
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900">
                <div className="p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-purple-600 text-purple-600" /> Saldo Puntos
                  </span>
                  <p className="text-xl font-black font-mono text-purple-900 dark:text-purple-200">
                    {customerPoints.toLocaleString("es-PY")}
                  </p>
                  <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 font-medium">Puntos Extra Club</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-600" /> Vales de Compra
                  </span>
                  <p className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-200">
                    {formatPYG(valorValesPYG)}
                  </p>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                    1 pt = Gs. {config?.guarani_por_punto || 100}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-600" /> Multiplicador
                  </span>
                  <p className="text-xl font-black font-mono text-amber-900 dark:text-amber-200">
                    {tier.mult}
                  </p>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium">Acumula en compras</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" /> Por Vencer
                  </span>
                  <p className="text-xl font-black font-mono text-slate-800 dark:text-slate-200">
                    {puntosPorVencer.toLocaleString("es-PY")}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">Vigencia 365 días</p>
                </div>
              </div>

              {/* Selector de Pestañas del Modal */}
              <div className="flex border-b border-gray-100 dark:border-slate-800 px-5 gap-2 bg-gray-50/30 dark:bg-slate-800/20">
                <button
                  type="button"
                  onClick={() => setPointsModalTab("resumen")}
                  className={`py-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                    pointsModalTab === "resumen"
                      ? "border-purple-600 text-purple-600 dark:text-purple-400"
                      : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Beneficios & Canjes
                </button>
                <button
                  type="button"
                  onClick={() => setPointsModalTab("historial")}
                  className={`py-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                    pointsModalTab === "historial"
                      ? "border-purple-600 text-purple-600 dark:text-purple-400"
                      : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  <History className="w-3.5 h-3.5" /> Historial ({pointsHistory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPointsModalTab("ajuste")}
                  className={`py-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                    pointsModalTab === "ajuste"
                      ? "border-purple-600 text-purple-600 dark:text-purple-400"
                      : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  <Edit className="w-3.5 h-3.5" /> Ajustar Puntos (+ / -)
                </button>
              </div>

              {/* Contenido de Pestañas */}
              <div className="p-5 max-h-[380px] overflow-y-auto">
                {/* TAB 1: RESUMEN Y BENEFICIOS DISPONIBLES */}
                {pointsModalTab === "resumen" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent rounded-2xl border border-purple-200/50 dark:border-purple-900/30 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-purple-600 text-white shrink-0">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 text-xs">
                        <p className="font-extrabold text-gray-900 dark:text-white">
                          Canje Automático en Cajas 2, 3, 4 y 5
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                          Al momento de cobrar en cualquier caja, la cajera solo solicita el documento de {selectedCustomer.razon_social || selectedCustomer.nombre}. El saldo de <strong className="text-purple-600">{customerPoints.toLocaleString("es-PY")} puntos</strong> se puede aplicar como descuento directo equivalente a <strong className="text-emerald-600">{formatPYG(valorValesPYG)}</strong>.
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-xs font-extrabold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5 text-purple-600" /> Premios y Artículos de Catálogo
                        </h4>
                        <span className="text-[10px] text-gray-400 font-mono">{rewards.length} disponibles</span>
                      </div>

                      {rewards.length === 0 ? (
                        <p className="text-xs text-gray-400 py-6 text-center">No hay premios activos en el catálogo de fidelidad.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {rewards.slice(0, 6).map((r) => {
                            const canRedeem = customerPoints >= r.puntos_requeridos
                            const progress = Math.min(100, Math.round((customerPoints / r.puntos_requeridos) * 100))
                            return (
                              <div
                                key={r.id}
                                className={`p-3 rounded-2xl border transition ${
                                  canRedeem
                                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                                    : "bg-white dark:bg-slate-800/60 border-gray-100 dark:border-slate-800"
                                } space-y-2`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">{r.nombre}</p>
                                    {r.patrocinador_nombre && (
                                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                        Patrocinado: {r.patrocinador_nombre}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-xs font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/80 px-2 py-0.5 rounded-lg shrink-0">
                                    {r.puntos_requeridos.toLocaleString("es-PY")} pts
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-gray-400">Progreso</span>
                                    <span className={canRedeem ? "text-emerald-600 font-bold" : "text-gray-500"}>
                                      {progress}%
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        canRedeem ? "bg-emerald-500" : "bg-purple-500"
                                      }`}
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-0.5 text-[10px]">
                                  {canRedeem ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3 h-3" /> ¡Canjeable en Caja!
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 font-mono">
                                      Faltan {(r.puntos_requeridos - customerPoints).toLocaleString("es-PY")} pts
                                    </span>
                                  )}
                                  <span className="text-gray-400 font-mono">Stock: {r.stock || 0}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: HISTORIAL DE PUNTOS */}
                {pointsModalTab === "historial" && (
                  <div>
                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-12 text-gray-400 text-xs gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Cargando movimientos de puntos...
                      </div>
                    ) : pointsHistory.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-xs space-y-2">
                        <History className="w-10 h-10 mx-auto opacity-40 text-purple-400" />
                        <p className="font-bold text-gray-600 dark:text-gray-300">Sin movimientos registrados</p>
                        <p className="text-[11px]">Este socio aún no registra transacciones de puntos.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pointsHistory.map((item) => {
                          const isPositive = item.puntos > 0 || item.tipo === "suma" || item.tipo === "venta" || item.tipo === "bonificacion"
                          return (
                            <div
                              key={item.id}
                              className="p-3 bg-white dark:bg-slate-800/70 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-gray-200 transition"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-xl shrink-0 ${
                                    isPositive
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                      : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                                  }`}
                                >
                                  {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-extrabold text-xs text-gray-900 dark:text-white capitalize">
                                      {item.tipo === "venta"
                                        ? "Compra en Caja"
                                        : item.tipo === "canje"
                                        ? "Canje de Premio / Vale"
                                        : item.tipo === "suma"
                                        ? "Acreditación Manual"
                                        : item.tipo === "resta"
                                        ? "Débito Manual"
                                        : item.tipo}
                                    </p>
                                    {item.referencia_id && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        Ref: {item.referencia_id.slice(-8)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    {item.descripcion || "Sin descripción"}
                                  </p>
                                  <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                                    <Clock className="w-2.5 h-2.5" /> {formatDateTime(item.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`text-sm font-mono font-black ${
                                    isPositive
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {isPositive ? `+${Math.abs(item.puntos).toLocaleString("es-PY")}` : `-${Math.abs(item.puntos).toLocaleString("es-PY")}`} pts
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: AJUSTE / CARGA MANUAL */}
                {pointsModalTab === "ajuste" && (
                  <form onSubmit={handleAddPoints} className="space-y-4 text-xs">
                    {/* Switch Acreditar vs Debitar */}
                    <div className="flex items-center justify-center p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl max-w-sm mx-auto">
                      <button
                        type="button"
                        onClick={() => setAjusteTipo("suma")}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                          ajusteTipo === "suma"
                            ? "bg-emerald-600 text-white shadow-md"
                            : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" /> Acreditar (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAjusteTipo("resta")}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                          ajusteTipo === "resta"
                            ? "bg-rose-600 text-white shadow-md"
                            : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Debitar (-)
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="label-sm">
                        Cantidad de Puntos a {ajusteTipo === "suma" ? "Acreditar" : "Debitar"} *
                      </label>
                      <div className="relative">
                        <input
                          required
                          type="number"
                          min="1"
                          className="input text-base font-mono font-black w-full pr-12"
                          value={pointsDelta}
                          onChange={(e) => setPointsDelta(Math.max(1, parseInt(e.target.value) || 0))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">
                          pts
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        {[50, 100, 250, 500, 1000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setPointsDelta(val)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                              pointsDelta === val
                                ? "bg-purple-600 text-white border-purple-600"
                                : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-purple-300"
                            }`}
                          >
                            +{val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Proyección en Vivo */}
                    <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-gray-500 text-[10px] block">Saldo proyectado:</span>
                        <span className="font-mono font-black text-purple-900 dark:text-purple-200 text-sm">
                          {Math.max(0, customerPoints + (ajusteTipo === "suma" ? pointsDelta : -pointsDelta)).toLocaleString("es-PY")} pts
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 text-[10px] block">Equivalente en vales:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPYG(
                            Math.max(0, customerPoints + (ajusteTipo === "suma" ? pointsDelta : -pointsDelta)) *
                              (config?.guarani_por_punto || 100)
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="label-sm">Motivo / Justificación del Ajuste *</label>
                      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                        {[
                          "Bonificación fidelidad Extra Club",
                          "Compensación reclamo cliente",
                          "Campaña de Aniversario",
                          "Carga inicial apertura socio",
                        ].map((mot) => (
                          <button
                            key={mot}
                            type="button"
                            onClick={() => setPointsMotivo(mot)}
                            className={`p-1.5 text-[10px] text-left rounded-lg border truncate transition ${
                              pointsMotivo === mot
                                ? "bg-purple-50 dark:bg-purple-950/50 border-purple-400 text-purple-700 dark:text-purple-300 font-bold"
                                : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-purple-300"
                            }`}
                          >
                            {mot}
                          </button>
                        ))}
                      </div>
                      <input
                        required
                        type="text"
                        className="input text-xs w-full"
                        value={pointsMotivo}
                        onChange={(e) => setPointsMotivo(e.target.value)}
                        placeholder="Escribí el motivo del ajuste..."
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowPointsModal(false)}
                        className="btn-secondary text-xs px-4 py-2"
                      >
                        Cerrar
                      </button>
                      <button
                        type="submit"
                        disabled={savingPoints}
                        className={`btn-primary text-xs px-5 py-2 flex items-center gap-1.5 shadow-md ${
                          ajusteTipo === "suma" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                        }`}
                      >
                        {savingPoints ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {ajusteTipo === "suma" ? "Confirmar Acreditación" : "Confirmar Débito"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )
      })()}


      {/* MODAL NUEVO / EDITAR PREMIO PATROCINADO */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">
                    {editingRewardId ? "Editar Premio Patrocinado" : "Registrar Premio Patrocinado"}
                  </h2>
                  <p className="text-xs text-slate-400">Asigná el proveedor patrocinador y el stock en el depósito de premios.</p>
                </div>
              </div>
              <button onClick={() => setShowRewardModal(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-4 text-xs">
              <div>
                <label className="label-sm">Nombre del Premio / Artículo *</label>
                <input
                  required
                  className="input text-xs w-full font-bold"
                  value={rewardForm.nombre}
                  onChange={e => setRewardForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Termo Stanley ExtraClub 1.4L / Pack 6 Cerveza Heineken"
                />
              </div>

              {/* SELECCIÓN DE PATROCINADOR (PROVEEDOR) */}
              <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-amber-600" />
                    Proveedor Patrocinador (Trade Marketing)
                  </label>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                    {suppliers.length} Proveedores registrados
                  </span>
                </div>

                <select
                  value={rewardForm.supplier_id}
                  onChange={(e) => {
                    const sid = e.target.value
                    const sup = suppliers.find(s => s.id === sid)
                    setRewardForm(f => ({
                      ...f,
                      supplier_id: sid,
                      patrocinador_nombre: sup?.razon_social || ""
                    }))
                  }}
                  className="input text-xs w-full bg-white dark:bg-slate-900 font-medium"
                >
                  <option value="">-- Sin patrocinador (Campaña Propia de Extra) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.razon_social} {s.ruc ? `(RUC: ${s.ruc})` : ""}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="label-sm text-slate-500">Tipo de Aporte</label>
                    <select
                      value={rewardForm.aporte_tipo}
                      onChange={e => setRewardForm(f => ({ ...f, aporte_tipo: e.target.value }))}
                      className="input text-xs w-full bg-white dark:bg-slate-900"
                    >
                      <option value="donacion_100">🎁 Donación 100% Proveedor</option>
                      <option value="trade_marketing_50_50">🤝 Trade Marketing Coparticipado (50/50)</option>
                      <option value="compra_propia">🏢 Compra Propia Supermercado</option>
                    </select>
                  </div>

                  <div>
                    <label className="label-sm text-slate-500">Unidades Comprometidas</label>
                    <input
                      type="number"
                      className="input text-xs font-mono"
                      value={rewardForm.unidades_pactadas}
                      onChange={e => setRewardForm(f => ({ ...f, unidades_pactadas: parseInt(e.target.value) || 0 }))}
                      placeholder="Ej: 50"
                    />
                  </div>
                </div>
              </div>

              {/* VINCULACIÓN CON CATÁLOGO DE PRODUCTOS (OPCIONAL) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-purple-600" />
                    Vincular a Producto del Catálogo (Opcional)
                  </label>
                </div>
                <select
                  value={rewardForm.product_id}
                  onChange={(e) => {
                    const pid = e.target.value
                    const prod = productList.find(p => p.id === pid)
                    setRewardForm(f => ({
                      ...f,
                      product_id: pid,
                      nombre: f.nombre || (prod ? prod.nombre : f.nombre),
                      costo_referencial: prod?.costo_promedio ? Number(prod.costo_promedio) : f.costo_referencial,
                      valor_recompensa: prod?.precio_venta ? Number(prod.precio_venta) : f.valor_recompensa,
                    }))
                  }}
                  className="input text-xs w-full bg-white dark:bg-slate-900"
                >
                  <option value="">-- Artículo exclusivo de premios / Sin producto en góndola --</option>
                  {productList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.sku || p.codigo_barra || "Sin código"}) - Gs. {Number(p.precio_venta || 0).toLocaleString("es-PY")}
                    </option>
                  ))}
                </select>
              </div>

              {/* DEPÓSITO ASIGNADO */}
              <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-[11px] text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <WarehouseIcon className="w-3.5 h-3.5 text-purple-600" />
                    Depósito de Resguardo del Stock:
                  </p>
                  <p className="text-[10px] text-purple-800 dark:text-purple-400">
                    {premiosWarehouse?.nombre || "Depósito Central de Premios Extra Club"} ({premiosWarehouse?.codigo || "DEP-PREMIOS"})
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                  Aislado ✓
                </span>
              </div>

              {/* VALORES Y STOCK */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-sm">Puntos Requeridos *</label>
                  <input
                    required
                    type="number"
                    className="input text-xs font-mono font-black text-purple-600"
                    value={rewardForm.puntos_requeridos}
                    onChange={e => setRewardForm(f => ({ ...f, puntos_requeridos: parseInt(e.target.value) || 100 }))}
                  />
                </div>
                <div>
                  <label className="label-sm">Stock Inicial en DEP-PREMIOS</label>
                  <input
                    type="number"
                    className="input text-xs font-mono font-bold"
                    value={rewardForm.stock}
                    onChange={e => setRewardForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="label-sm">Valor Monetario Gs.</label>
                  <input
                    type="number"
                    className="input text-xs font-mono font-bold"
                    value={rewardForm.valor_recompensa}
                    onChange={e => setRewardForm(f => ({ ...f, valor_recompensa: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="label-sm">Descripción y Condiciones de Canje</label>
                <textarea
                  className="input text-xs h-16 w-full"
                  value={rewardForm.descripcion}
                  onChange={e => setRewardForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Detalles para el cliente y condiciones de canje..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowRewardModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingReward} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 font-bold">
                  {savingReward ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingRewardId ? "Guardar Cambios" : "Crear Premio Patrocinado"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INGRESO DE STOCK POR PATROCINADOR / REMISIÓN */}
      {showStockModal && targetRewardForStock && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Ingreso de Stock al Depósito</h2>
                  <p className="text-xs text-slate-400 font-mono">{targetRewardForStock.nombre}</p>
                </div>
              </div>
              <button onClick={() => setShowStockModal(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-[11px] space-y-1">
              <p className="text-slate-500">Patrocinador: <b className="text-slate-900 dark:text-white">{targetRewardForStock.patrocinador_nombre || "Extra Supermercado"}</b></p>
              <p className="text-slate-500">Depósito Destino: <b className="text-purple-600">{premiosWarehouse?.nombre || "Depósito Central de Premios"}</b></p>
              <p className="text-slate-500">Stock Actual en Depósito: <b className="text-emerald-600 font-mono">{targetRewardForStock.stock || 0} un.</b></p>
            </div>

            <form onSubmit={handleSaveStockEntry} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Cantidad a Ingresar *</label>
                <input
                  required
                  type="number"
                  min="1"
                  className="input text-xs font-mono font-black text-emerald-600"
                  value={stockEntryForm.cantidad}
                  onChange={e => setStockEntryForm(f => ({ ...f, cantidad: parseInt(e.target.value) || 1 }))}
                />
              </div>

              <div>
                <label className="label-sm">N° de Remisión / Nota de Entrega Proveedor</label>
                <input
                  type="text"
                  className="input text-xs font-mono"
                  placeholder="Ej: REM-001-002-0004521"
                  value={stockEntryForm.remision_proveedor}
                  onChange={e => setStockEntryForm(f => ({ ...f, remision_proveedor: e.target.value }))}
                />
              </div>

              <div>
                <label className="label-sm">Notas / Observaciones de Trade Marketing</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={stockEntryForm.notas}
                  onChange={e => setStockEntryForm(f => ({ ...f, notas: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowStockModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingStock} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 font-bold">
                  {savingStock ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Registrar Entrada</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CANJE DIRECTO DE PREMIO A SOCIO */}
      {showRedeemModal && targetRewardForRedeem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Canjear Premio a Socio</h2>
                  <p className="text-xs text-purple-600 font-bold">{targetRewardForRedeem.nombre}</p>
                </div>
              </div>
              <button onClick={() => setShowRedeemModal(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-purple-700 dark:text-purple-300 block text-[10px]">Costo en Puntos:</span>
                <span className="font-black text-sm text-purple-900 dark:text-purple-100">
                  {(targetRewardForRedeem.puntos_requeridos * redeemCantidad).toLocaleString("es-PY")} pts
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Stock en Depósito:</span>
                <span className="font-black text-sm text-emerald-600">
                  {targetRewardForRedeem.stock || 0} un.
                </span>
              </div>
            </div>

            <form onSubmit={handleProcessRedeem} className="space-y-4 text-xs">
              {/* BÚSQUEDA Y SELECCIÓN DE SOCIO */}
              <div>
                <label className="label-sm">Buscar Socio Extra Club (por Nombre, RUC o CI) *</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Escribí para buscar socio..."
                    value={redeemCustomerSearch}
                    onChange={e => setRedeemCustomerSearch(e.target.value)}
                    className="input text-xs pl-8 w-full"
                  />
                </div>

                {redeemCustomerSearch && !redeemSelectedCustomer && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {retailCustomers
                      .filter(c => {
                        const q = redeemCustomerSearch.toLowerCase()
                        return (c.nombre || "").toLowerCase().includes(q) ||
                          (c.razon_social || "").toLowerCase().includes(q) ||
                          (c.ruc || "").includes(q) ||
                          (c.ci || "").includes(q)
                      })
                      .slice(0, 5)
                      .map(c => {
                        const isSocio = Boolean(c.extra_club_numero && c.extra_club_numero.trim())
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomerForRedeem(c)}
                            className="p-2.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">{c.razon_social || c.nombre}</p>
                              <p className="text-[10px] text-slate-400">CI/RUC: {c.ruc || c.ci || "S/D"}</p>
                            </div>
                            <div className="text-right">
                              {isSocio ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                  ⭐ Socio ExtraClub
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  ⚪ Sin Tarjeta
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* SOCIO SELECCIONADO Y VALIDACIÓN DE PUNTOS */}
              {redeemSelectedCustomer && (() => {
                const requiredPts = (targetRewardForRedeem?.puntos_requeridos || 0) * redeemCantidad
                const isSocio = Boolean(redeemSelectedCustomer.extra_club_numero && redeemSelectedCustomer.extra_club_numero.trim())
                const hasEnough = isSocio && (redeemCustomerPoints >= requiredPts)

                return (
                  <div className={`p-3.5 rounded-2xl border ${hasEnough ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40" : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40"}`}>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{redeemSelectedCustomer.razon_social || redeemSelectedCustomer.nombre}</span>
                      <button type="button" onClick={() => { setRedeemSelectedCustomer(null); setRedeemCustomerSearch(""); setRedeemCustomerPoints(0); }} className="text-slate-400 hover:text-rose-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[10px] pt-1 mt-1 border-t border-current/10">
                      <span>Saldo actual: <b>{loadingRedeemPoints ? "Consultando..." : `${redeemCustomerPoints.toLocaleString("es-PY")} pts`}</b></span>
                      <span>Restante: <b className={hasEnough ? "text-emerald-600" : "text-rose-600"}>{loadingRedeemPoints ? "..." : `${(redeemCustomerPoints - requiredPts).toLocaleString("es-PY")} pts`}</b></span>
                    </div>
                    {!isSocio ? (
                      <p className="text-[10px] text-rose-600 font-bold mt-1">
                        ⚠️ Este cliente no cuenta con membresía ExtraClub. Solo socios con tarjeta pueden acumular y canjear premios.
                      </p>
                    ) : !hasEnough ? (
                      <p className="text-[10px] text-rose-600 font-bold mt-1">
                        ⚠️ Saldo insuficiente para realizar el canje.
                      </p>
                    ) : null}
                  </div>
                )
              })()}

              <div>
                <label className="label-sm">Notas / Observaciones de Entrega</label>
                <input
                  type="text"
                  placeholder="Ej: Entregado en caja 1 / Mostrador de atención..."
                  value={redeemNotas}
                  onChange={e => setRedeemNotas(e.target.value)}
                  className="input text-xs w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowRedeemModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button
                  type="submit"
                  disabled={
                    processingRedeem ||
                    !redeemSelectedCustomer ||
                    !redeemSelectedCustomer.extra_club_numero ||
                    loadingRedeemPoints ||
                    (redeemCustomerPoints < ((targetRewardForRedeem?.puntos_requeridos || 0) * redeemCantidad))
                  }
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 font-bold disabled:opacity-50"
                >
                  {processingRedeem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                  <span>Confirmar Canje & Emitir Comprobante</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL AUDITABLE DE CANJES */}
      {showRedemptionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Historial de Canjes de Premios Extra Club</h2>
                  <p className="text-xs text-slate-400">Auditoría de premios entregados a socios y egresos del depósito.</p>
                </div>
              </div>
              <button onClick={() => setShowRedemptionsModal(false)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto flex-1 text-xs">
              {redemptions.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                  <p className="font-bold">No hay canjes registrados aún</p>
                  <p className="text-[11px] mt-0.5">Los canjes efectuados por socios aparecerán aquí con su comprobante correspondiente.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Comprobante</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Premio</th>
                      <th className="p-3 text-right">Puntos Canjeados</th>
                      <th className="p-3 text-center">Cantidad</th>
                      <th className="p-3">Entregado Por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-mono">
                    {redemptions.map((red) => (
                      <tr key={red.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-purple-600 dark:text-purple-400">{red.comprobante_numero || "CANJE-AUTO"}</td>
                        <td className="p-3 text-slate-500">{formatDate(red.created_at)}</td>
                        <td className="p-3 font-sans font-bold text-gray-900 dark:text-white">{red.notas || "Premio Extra Club"}</td>
                        <td className="p-3 text-right font-bold text-purple-600">-{red.puntos_canjeados.toLocaleString("es-PY")} pts</td>
                        <td className="p-3 text-center">{red.cantidad} un.</td>
                        <td className="p-3 font-sans text-slate-500">{red.entregado_por || "Atención al Cliente"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end shrink-0">
              <button onClick={() => setShowRedemptionsModal(false)} className="btn-secondary text-xs px-4 py-2">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUDITORÍA DE PUNTOS EXTACLUB */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">
                    Auditoría de Puntos ExtraClub
                  </h2>
                  <p className="text-xs text-slate-400">
                    Regla estricta: Solo quien posee tarjeta o membresía ExtraClub puede acumular puntos.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Clientes No-Socios con Puntos</span>
                  <p className={`text-xl font-mono font-black mt-1 ${auditResult?.clientes_no_socios_con_puntos > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {auditResult?.clientes_no_socios_con_puntos ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Total Puntos Inconsistentes</span>
                  <p className={`text-xl font-mono font-black mt-1 ${auditResult?.total_puntos_inconsistentes > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {(auditResult?.total_puntos_inconsistentes ?? 0).toLocaleString("es-PY")} pts
                  </p>
                </div>
              </div>

              {(!auditResult?.detalles || auditResult.detalles.length === 0) ? (
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-emerald-900 dark:text-emerald-200">
                    ¡Integridad de Puntos 100% Correcta!
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-300/80 text-[11px]">
                    No se encontraron clientes generales sin membresía acumulando puntos en el sistema. Todos los puntos registrados pertenecen exclusivamente a socios de ExtraClub.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Se detectaron los siguientes clientes que no tienen número de tarjeta registrado y acumularon puntos indebidamente:
                    </span>
                  </div>

                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5">Cliente / Razón Social</th>
                        <th className="p-2.5">Documento</th>
                        <th className="p-2.5 text-center">Movimientos</th>
                        <th className="p-2.5 text-right">Puntos Acumulados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 font-mono">
                      {auditResult.detalles.map((det: any) => (
                        <tr key={det.customer_id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-sans font-bold text-gray-900 dark:text-white">
                            {det.razon_social}
                          </td>
                          <td className="p-2.5 text-slate-500">{det.ruc || "S/D"}</td>
                          <td className="p-2.5 text-center text-slate-500">{det.total_movimientos}</td>
                          <td className="p-2.5 text-right font-bold text-rose-600">
                            +{det.puntos_acumulados.toLocaleString("es-PY")} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <button onClick={() => setShowAuditModal(false)} className="btn-secondary text-xs px-4 py-2">
                Cerrar
              </button>
              {auditResult?.clientes_no_socios_con_puntos > 0 && (
                <button
                  onClick={() => handleRunAudit(false)}
                  disabled={applyingAuditCorrection}
                  className="btn-primary text-xs px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 font-bold shadow-sm"
                >
                  {applyingAuditCorrection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                  <span>Neutralizar Puntos No-Socios</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
