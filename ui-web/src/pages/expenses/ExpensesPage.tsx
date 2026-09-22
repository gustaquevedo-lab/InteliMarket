import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  Search, Plus, Loader2, DollarSign, CheckCircle2, XCircle, Wallet, TrendingUp,
  TrendingDown, BarChart3, Ban, Receipt as ReceiptIcon, Building2, Sparkles,
  AlertTriangle, ThumbsUp, ThumbsDown, Layers, PiggyBank, UserCircle2, Landmark,
  Paperclip, ClipboardCheck, Scale, Filter, Eye, RefreshCw, ShieldAlert, ArrowRight,
  SlidersHorizontal, Check, AlertCircle, FileText, Download, Calendar, Tag,
  FileSpreadsheet, Printer, PieChart, BookOpen, FileCheck, ScrollText, CheckCheck,
  Pencil, Package
} from "lucide-react"
import {
  api, API_ORIGIN, type Expense, type ExpenseCategory, type CostCenter,
  type ExpenseDashboard, type FinanceRecommendation, type PettyCashFund,
  type BankAccount, type PettyCashFundCount, type PettyCashRendicion
} from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, getTodayAsuncion } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"
import { useAuth } from "../../context/AuthContext"

import { RendicionCreateModal } from "./RendicionCreateModal"
import { RendicionAuditModal } from "./RendicionAuditModal"
import { ExpensePaymentModal } from "./ExpensePaymentModal"

type Tab = "dashboard" | "fondos" | "rendiciones" | "list" | "arqueos" | "sectores" | "categories" | "reportes"
type ReportSubTab = "sector" | "fondos" | "fiscal" | "rendicion"

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [dashboard, setDashboard] = useState<ExpenseDashboard | null>(null)
  const [recommendations, setRecommendations] = useState<FinanceRecommendation[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  
  // Filtros
  const [search, setSearch] = useState("")
  const [filterMonto, setFilterMonto] = useState("")
  const [filterRendicion, setFilterRendicion] = useState("")
  const [filterEstado, setFilterEstado] = useState("")
  const [filterFund, setFilterFund] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [filterSector, setFilterSector] = useState("")

  // Modales
  const [showForm, setShowForm] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showSectorForm, setShowSectorForm] = useState(false)
  const [showFundForm, setShowFundForm] = useState(false)
  const [funds, setFunds] = useState<PettyCashFund[]>([])
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([])
  
  // Formularios
  const [form, setForm] = useState<any>({
    monto: "",
    descripcion: "",
    fund_id: "",
    category_id: "",
    cost_center_id: "",
    proveedor: "",
    ruc: "",
    timbrado: "",
    numero_factura: "",
    tipo_comprobante: "factura_contado",
    iva_10: "",
    iva_5: "",
    exentas: "",
    tipo_pago: "efectivo",
    fecha_gasto: getTodayAsuncion(),
    es_inversion: false,
    asset_nombre: "",
    asset_codigo_interno: "",
    asset_categoria: "muebles_equipos",
    asset_vida_util_meses: 60,
    es_pago_proveedor: false,
    supplier_id: "",
    supplier_invoice_id: "",
    moneda: "PYG",
    monto_brl: "",
    tipo_cambio: "1350",
  })
  const [catForm, setCatForm] = useState({ nombre: "", descripcion: "", presupuesto_mensual: "" })
  const [sectorForm, setSectorForm] = useState({ nombre: "", tipo: "sector", peso_prorateo: "1" })
  const [fundForm, setFundForm] = useState({
    nombre: "",
    monto_autorizado: "",
    custodio_id: "",
    cost_center_id: "",
    monto_maximo_por_gasto: "",
    dotacion_inicial: false,
    medio_dotacion: "EFECTIVO_BOVEDA",
    caja_boveda_id: "",
    bank_account_id: "",
  })

  // Rendiciones de Cuentas & Reposición
  const [rendiciones, setRendiciones] = useState<PettyCashRendicion[]>([])
  const [loadingRendiciones, setLoadingRendiciones] = useState(false)
  const [showCreateRendicionModal, setShowCreateRendicionModal] = useState(false)
  const [rendicionCreateInitialFundId, setRendicionCreateInitialFundId] = useState("")
  const [selectedRendicionForAuditId, setSelectedRendicionForAuditId] = useState<string | null>(null)
  const [filterRendicionFund, setFilterRendicionFund] = useState("")
  const [filterRendicionEstado, setFilterRendicionEstado] = useState("")
  const [cashRegisters, setCashRegisters] = useState<any[]>([])

  // Umbral de aprobación
  const [showThresholdForm, setShowThresholdForm] = useState(false)
  const [approvalThreshold, setApprovalThreshold] = useState<number | null>(null)
  const [approvalThresholdForm, setApprovalThresholdForm] = useState("")
  const [toleranciaArqueoForm, setToleranciaArqueoForm] = useState("")

  // Reposición de fondos
  const [showReplenishForm, setShowReplenishForm] = useState(false)
  const [replenishFund, setReplenishFund] = useState<PettyCashFund | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [replenishForm, setReplenishForm] = useState({ monto: "", bank_account_id: "", referencia: "", observaciones: "" })
  const [submittingReplenish, setSubmittingReplenish] = useState(false)

  // Comprobante
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [uploadingComprobante, setUploadingComprobante] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Arqueos
  const [pendingCounts, setPendingCounts] = useState<PettyCashFundCount[]>([])
  const [showCountForm, setShowCountForm] = useState(false)
  const [countingFund, setCountingFund] = useState<PettyCashFund | null>(null)
  const [countForm, setCountForm] = useState({ monto_contado: "", observaciones: "" })
  const [submittingCount, setSubmittingCount] = useState(false)
  const [countResult, setCountResult] = useState<PettyCashFundCount | null>(null)

  // Detalle de movimientos de fondo
  const [selectedFundMovements, setSelectedFundMovements] = useState<{ fund: PettyCashFund; movements: any[] } | null>(null)
  const [loadingMovements, setLoadingMovements] = useState(false)

  // 📊 Centro de Reportes
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>("sector")
  const getStartOfMonthAsuncion = () => {
    const today = getTodayAsuncion()
    return `${today.slice(0, 7)}-01`
  }
  const [repFechaDesde, setRepFechaDesde] = useState(getStartOfMonthAsuncion())
  const [repFechaHasta, setRepFechaHasta] = useState(getTodayAsuncion())
  const [repFundId, setRepFundId] = useState("")
  const [reportSectorData, setReportSectorData] = useState<any>(null)
  const [reportFundsData, setReportFundsData] = useState<any[] | null>(null)
  const [reportFiscalData, setReportFiscalData] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [rendicionFundId, setRendicionFundId] = useState("")
  const [paymentModalExpense, setPaymentModalExpense] = useState<Expense | null>(null)
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null)
  const [downloadingConsolidatedPdf, setDownloadingConsolidatedPdf] = useState(false)

  // Autocomplete proveedores en modal de gasto
  const [suppliersList, setSuppliersList] = useState<any[]>([])
  const [supplierSearch, setSupplierSearch] = useState("")
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const toast = useToast()
  const { user } = useAuth()

  const catName = (id?: string) => categories.find(c => c.id === id)?.nombre || "Sin categoría"
  const sectorName = (id?: string) => costCenters.find(c => c.id === id)?.nombre || "Sin sector"
  const fundName = (id?: string) => funds.find(f => f.id === id)?.nombre || "General"

  const rendicionMap = useMemo(() => {
    const map = new Map<string, PettyCashRendicion>()
    rendiciones.forEach(r => map.set(r.id, r))
    return map
  }, [rendiciones])

  const getExpenseRendicion = (e: Expense): PettyCashRendicion | null => {
    if (e.rendicion_id && rendicionMap.has(e.rendicion_id)) {
      return rendicionMap.get(e.rendicion_id)!
    }
    return null
  }

  const fetchRendiciones = async () => {
    setLoadingRendiciones(true)
    try {
      const data = await api.expenses.rendiciones.list({
        fund_id: filterRendicionFund || undefined,
        estado: filterRendicionEstado || undefined,
      })
      const sortedRends = Array.isArray(data) ? [...data].sort((a: any, b: any) => new Date(b.fecha_presentacion || b.created_at || 0).getTime() - new Date(a.fecha_presentacion || a.created_at || 0).getTime()) : []
      setRendiciones(sortedRends)
    } catch (err: any) {
      toast.error("Error al cargar rendiciones", err.message)
    } finally {
      setLoadingRendiciones(false)
    }
  }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [c, cc, f, ac, pc, bAccs, cRegs, rends, invs] = await Promise.all([
        api.expenses.categories.list().catch(() => []),
        api.expenses.costCenters.list().catch(() => []),
        api.expenses.funds.list().catch(() => []),
        api.expenses.approvalConfig.get().catch(() => null),
        api.expenses.funds.counts.pendingAll().catch(() => []),
        api.financial.banks.list().catch(() => []),
        api.caja.registers.list().catch(() => []),
        api.expenses.rendiciones.list().catch(() => []),
        api.financial.invoices.list({ limit: 1000 }).catch(() => []),
      ])
      setCategories(c)
      setCostCenters(cc)
      setFunds(f)
      setPendingCounts(Array.isArray(pc) ? [...pc].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()) : [])
      setBankAccounts(bAccs.filter((b: any) => b.activo))
      setCashRegisters(cRegs)
      setRendiciones(Array.isArray(rends) ? [...rends].sort((a: any, b: any) => new Date(b.fecha_presentacion || b.created_at || 0).getTime() - new Date(a.fecha_presentacion || a.created_at || 0).getTime()) : [])
      setPendingInvoices(Array.isArray(invs) ? invs.filter((i: any) => i.estado === "pendiente" || i.estado === "parcial") : [])
      if (ac) {
        setApprovalThreshold(ac.umbral_aprobacion)
        setApprovalThresholdForm(String(ac.umbral_aprobacion))
        setToleranciaArqueoForm(String(ac.tolerancia_arqueo))
      }

      if (tab === "dashboard") {
        const [d, recs] = await Promise.all([
          api.expenses.dashboard().catch(() => null),
          api.financeAgent.recommendations().catch(() => []),
        ])
        setDashboard(d)
        setRecommendations(recs.filter(r => r.tipo === "reduccion_gasto"))
      }

      if (tab === "list" || tab === "dashboard") {
        const [e, r] = await Promise.all([
          api.expenses.list({
            estado: filterEstado || undefined,
            category_id: filterCategory || undefined,
            limit: 500,
          }).catch(() => []),
          api.expenses.rendiciones.list().catch(() => []),
        ])
        setExpenses(e)
        if (Array.isArray(r) && r.length > 0) {
          setRendiciones(r)
        }
      }

      if (tab === "rendiciones") {
        const r = await api.expenses.rendiciones.list({
          fund_id: filterRendicionFund || undefined,
          estado: filterRendicionEstado || undefined,
        }).catch(() => [])
        setRendiciones(r)
      }
    } catch (e: any) {
      toast.error("Error al cargar datos de gastos", e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [tab, filterEstado, filterCategory, filterRendicionFund, filterRendicionEstado])

  const fetchReportData = async () => {
    setLoadingReport(true)
    try {
      if (reportSubTab === "sector") {
        const data = await api.expenses.reports.bySector({ fecha_desde: repFechaDesde, fecha_hasta: repFechaHasta })
        setReportSectorData(data)
      } else if (reportSubTab === "fondos") {
        const data = await api.expenses.reports.fundsStatus()
        setReportFundsData(data)
      } else if (reportSubTab === "fiscal") {
        const data = await api.expenses.reports.fiscalPurchases({
          fecha_desde: repFechaDesde,
          fecha_hasta: repFechaHasta,
          fund_id: repFundId || undefined
        })
        setReportFiscalData(data)
      }
    } catch (e: any) {
      toast.error("Error al cargar reporte", e.message)
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    if (tab === "reportes") {
      fetchReportData()
    }
  }, [tab, reportSubTab, repFechaDesde, repFechaHasta, repFundId])

  const handleDownloadSectorPdf = async () => {
    setDownloadingPdf(true)
    try {
      await api.expenses.reports.downloadBySectorPdf({ fecha_desde: repFechaDesde, fecha_hasta: repFechaHasta })
      toast.success("PDF Generado", "El reporte de gastos por sector se descargó correctamente.")
    } catch (e: any) {
      toast.error("Error al descargar PDF", e.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadFundsPdf = async () => {
    setDownloadingPdf(true)
    try {
      await api.expenses.reports.downloadFundsStatusPdf()
      toast.success("PDF Generado", "El estado consolidado de fondos fijos se descargó correctamente.")
    } catch (e: any) {
      toast.error("Error al descargar PDF", e.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadFiscalPdf = async () => {
    setDownloadingPdf(true)
    try {
      await api.expenses.reports.downloadFiscalPurchasesPdf({
        fecha_desde: repFechaDesde,
        fecha_hasta: repFechaHasta,
        fund_id: repFundId || undefined
      })
      toast.success("PDF Generado", "El libro fiscal de compras menores se descargó correctamente.")
    } catch (e: any) {
      toast.error("Error al descargar PDF", e.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadRendicionPdf = async (targetFundId?: string) => {
    const fid = targetFundId || rendicionFundId || funds[0]?.id
    if (!fid) {
      toast.warning("Seleccioná un fondo", "Indicá de qué fondo fijo querés generar el acta de rendición.")
      return
    }
    setDownloadingPdf(true)
    try {
      await api.expenses.reports.downloadRendicionPdf(fid)
      toast.success("Acta Generada", "El acta de rendición con firmas institucionales se descargó correctamente.")
    } catch (e: any) {
      toast.error("Error al generar acta de rendición", e.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingExpenseId(null)
    setForm({
      monto: "",
      descripcion: "",
      fund_id: "",
      category_id: "",
      cost_center_id: "",
      proveedor: "",
      ruc: "",
      timbrado: "",
      numero_factura: "",
      tipo_comprobante: "factura_contado",
      iva_10: "",
      iva_5: "",
      exentas: "",
      tipo_pago: "efectivo",
      fecha_gasto: getTodayAsuncion(),
      es_inversion: false,
      asset_nombre: "",
      asset_codigo_interno: "",
      asset_categoria: "muebles_equipos",
      asset_vida_util_meses: 60,
      es_pago_proveedor: false,
      supplier_id: "",
      supplier_invoice_id: "",
    })
    setComprobanteFile(null)
    setShowForm(true)
  }

  const handleOpenEdit = (e: Expense) => {
    setEditingExpenseId(e.id)
    setForm({
      monto: String(e.monto || ""),
      descripcion: e.descripcion || "",
      fund_id: (e.fund_id as string) || "",
      category_id: (e.category_id as string) || "",
      cost_center_id: (e.cost_center_id as string) || "",
      proveedor: e.proveedor || "",
      ruc: e.ruc || "",
      timbrado: e.timbrado || "",
      numero_factura: e.numero_factura || "",
      tipo_comprobante: (e.tipo_comprobante as string) || "factura_contado",
      iva_10: e.iva_10 ? String(e.iva_10) : "",
      iva_5: e.iva_5 ? String(e.iva_5) : "",
      exentas: e.exentas ? String(e.exentas) : "",
      tipo_pago: (e.tipo_pago as string) || "efectivo",
      fecha_gasto: e.fecha_gasto ? String(e.fecha_gasto).slice(0, 10) : getTodayAsuncion(),
      es_inversion: e.es_inversion || false,
      asset_nombre: "",
      asset_codigo_interno: "",
      asset_categoria: e.categoria_activo || "muebles_equipos",
      asset_vida_util_meses: e.vida_util_meses || 60,
      es_pago_proveedor: Boolean((e as any).es_pago_proveedor),
      supplier_id: (e as any).supplier_id || "",
      supplier_invoice_id: (e as any).supplier_invoice_id || "",
    })
    setComprobanteFile(null)
    setShowForm(true)
  }

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto || Number(form.monto) <= 0) {
      toast.warning("Monto requerido", "Ingresá un monto válido para el gasto.")
      return
    }
    if (!form.descripcion) {
      toast.warning("Descripción requerida", "Ingresá el concepto del gasto.")
      return
    }

    try {
      let comprobante_url: string | undefined
      if (comprobanteFile) {
        setUploadingComprobante(true)
        try {
          const res = await api.expenses.uploadComprobante(comprobanteFile)
          comprobante_url = res.url
        } catch (err: any) {
          toast.error("Error al subir comprobante", err.message)
          setUploadingComprobante(false)
          return
        }
        setUploadingComprobante(false)
      }

      if (editingExpenseId) {
        await api.expenses.update(editingExpenseId, {
          fund_id: form.fund_id || undefined,
          category_id: form.category_id || undefined,
          cost_center_id: form.cost_center_id || undefined,
          monto: Number(form.monto),
          descripcion: form.descripcion,
          proveedor: form.proveedor || undefined,
          ruc: form.ruc || undefined,
          timbrado: form.timbrado || undefined,
          numero_factura: form.numero_factura || undefined,
          tipo_comprobante: form.tipo_comprobante,
          iva_10: form.iva_10 ? Number(form.iva_10) : 0,
          iva_5: form.iva_5 ? Number(form.iva_5) : 0,
          exentas: form.exentas ? Number(form.exentas) : 0,
          tipo_pago: form.tipo_pago,
          fecha_gasto: form.fecha_gasto || undefined,
          es_inversion: form.es_inversion || false,
          categoria_activo: form.es_inversion ? form.asset_categoria : undefined,
          vida_util_meses: form.es_inversion && form.asset_vida_util_meses ? Number(form.asset_vida_util_meses) : undefined,
          es_pago_proveedor: form.es_pago_proveedor || false,
          supplier_id: form.supplier_id || undefined,
          supplier_invoice_id: form.supplier_invoice_id || undefined,
          monto_brl: form.moneda === "BRL" && form.monto_brl ? Number(form.monto_brl) : undefined,
          ...(comprobante_url ? { comprobante_url } : {})
        })
        toast.success("Comprobante Actualizado", "Los cambios en el gasto fueron guardados exitosamente.")
      } else {
        await api.expenses.create({
          ...form,
          fund_id: form.fund_id || undefined,
          category_id: form.category_id || undefined,
          cost_center_id: form.cost_center_id || undefined,
          monto: Number(form.monto),
          monto_brl: form.moneda === "BRL" && form.monto_brl ? Number(form.monto_brl) : undefined,
          iva_10: form.iva_10 ? Number(form.iva_10) : undefined,
          iva_5: form.iva_5 ? Number(form.iva_5) : undefined,
          exentas: form.exentas ? Number(form.exentas) : undefined,
          es_inversion: form.es_inversion || false,
          asset_nombre: form.es_inversion ? form.asset_nombre : undefined,
          asset_codigo_interno: form.es_inversion ? form.asset_codigo_interno : undefined,
          asset_categoria: form.es_inversion ? form.asset_categoria : undefined,
          asset_vida_util_meses: form.es_inversion && form.asset_vida_util_meses ? Number(form.asset_vida_util_meses) : undefined,
          es_pago_proveedor: form.es_pago_proveedor || false,
          supplier_id: form.supplier_id || undefined,
          supplier_invoice_id: form.supplier_invoice_id || undefined,
          comprobante_url
        })
        toast.success("Comprobante Registrado", "El gasto quedó en estado Pendiente de Aprobación. Aprobalo para luego asignar la forma de pago.")
      }

      setShowForm(false)
      setEditingExpenseId(null)
      setForm({
        monto: "",
        descripcion: "",
        fund_id: "",
        category_id: "",
        cost_center_id: "",
        proveedor: "",
        ruc: "",
        timbrado: "",
        numero_factura: "",
        tipo_comprobante: "factura_contado",
        iva_10: "",
        iva_5: "",
        exentas: "",
        tipo_pago: "efectivo",
        fecha_gasto: getTodayAsuncion(),
        es_inversion: false,
        asset_nombre: "",
        asset_codigo_interno: "",
        asset_categoria: "muebles_equipos",
        asset_vida_util_meses: 60,
        es_pago_proveedor: false,
        supplier_id: "",
        supplier_invoice_id: "",
        moneda: "PYG",
        monto_brl: "",
        tipo_cambio: "1350",
      })
      setComprobanteFile(null)
      fetchAll()
    } catch (e: any) {
      toast.error(editingExpenseId ? "Error al actualizar gasto" : "Error al registrar gasto", e.message)
    }
  }

  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fundForm.nombre || !fundForm.monto_autorizado) {
      toast.warning("Datos incompletos", "Completá nombre y monto autorizado del fondo.")
      return
    }
    try {
      await api.expenses.funds.create({
        nombre: fundForm.nombre,
        monto_autorizado: Number(fundForm.monto_autorizado),
        custodio_id: fundForm.custodio_id || undefined,
        cost_center_id: fundForm.cost_center_id || undefined,
        monto_maximo_por_gasto: fundForm.monto_maximo_por_gasto ? Number(fundForm.monto_maximo_por_gasto) : undefined,
        dotacion_inicial: fundForm.dotacion_inicial,
        medio_dotacion: fundForm.dotacion_inicial ? fundForm.medio_dotacion : undefined,
        caja_boveda_id: fundForm.dotacion_inicial && fundForm.medio_dotacion === "EFECTIVO_BOVEDA" ? fundForm.caja_boveda_id : undefined,
        bank_account_id: fundForm.dotacion_inicial && fundForm.medio_dotacion === "DEBITO_BANCARIO" ? fundForm.bank_account_id : undefined,
      })
      toast.success("Fondo Fijo Creado", "Ya podés registrar gastos y rendiciones contra este fondo.")
      setShowFundForm(false)
      setFundForm({
        nombre: "",
        monto_autorizado: "",
        custodio_id: "",
        cost_center_id: "",
        monto_maximo_por_gasto: "",
        dotacion_inicial: false,
        medio_dotacion: "EFECTIVO_BOVEDA",
        caja_boveda_id: "",
        bank_account_id: "",
      })
      fetchAll()
    } catch (e: any) {
      toast.error("Error al crear fondo", e.message)
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!catForm.nombre) return
    try {
      await api.expenses.categories.create({
        ...catForm,
        presupuesto_mensual: catForm.presupuesto_mensual ? Number(catForm.presupuesto_mensual) : undefined
      })
      toast.success("Categoría Creada")
      setShowCategoryForm(false)
      setCatForm({ nombre: "", descripcion: "", presupuesto_mensual: "" })
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleCreateSector = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectorForm.nombre) return
    try {
      await api.expenses.costCenters.create({
        ...sectorForm,
        peso_prorateo: Number(sectorForm.peso_prorateo)
      })
      toast.success("Centro de Costo Creado")
      setShowSectorForm(false)
      setSectorForm({ nombre: "", tipo: "sector", peso_prorateo: "1" })
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await api.expenses.approve(id)
      toast.success("Gasto Aprobado", "Se autorizó formalmente el comprobante.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al aprobar", e.message)
    }
  }

  const handleReject = async (id: string) => {
    const motivo = window.prompt("Motivo del rechazo de gasto:")
    if (!motivo) return
    try {
      await api.expenses.reject(id, motivo)
      toast.success("Gasto Rechazado", "El comprobante fue devuelto al solicitante.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al rechazar", e.message)
    }
  }

  const handleVoid = async (id: string) => {
    const motivo = window.prompt("Motivo de anulación del gasto:")
    if (!motivo) return
    try {
      await api.expenses.void(id, motivo)
      toast.success("Gasto Anulado", "Se revirtió el impacto en saldo y presupuesto.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al anular", e.message)
    }
  }

  const handleDownloadReceiptPdf = async (expenseId: string) => {
    setDownloadingReceiptId(expenseId)
    try {
      await api.expenses.downloadPdf(expenseId)
      toast.success("Recibo Descargado", "Se generó el comprobante oficial en PDF.")
    } catch (e: any) {
      toast.error("Error al descargar recibo", e.message)
    } finally {
      setDownloadingReceiptId(null)
    }
  }

  const handleDownloadConsolidatedPdf = async () => {
    setDownloadingConsolidatedPdf(true)
    try {
      await api.expenses.downloadReportPdf({
        desde: repFechaDesde || undefined,
        hasta: repFechaHasta || undefined,
        estado: filterEstado || undefined,
        fund_id: filterFund || undefined,
        category_id: filterCategory || undefined,
      })
      toast.success("Reporte Descargado", "Se descargó el consolidado analítico de gastos en PDF.")
    } catch (e: any) {
      toast.error("Error al exportar reporte", e.message)
    } finally {
      setDownloadingConsolidatedPdf(false)
    }
  }

  const handleOpenReplenish = async (fund: PettyCashFund) => {
    setReplenishFund(fund)
    const sugerido = Math.max(0, fund.monto_autorizado - fund.saldo_actual)
    setReplenishForm({
      monto: sugerido > 0 ? String(sugerido) : "",
      bank_account_id: "",
      referencia: `REP-${fund.nombre.slice(0, 4).toUpperCase()}-${new Date().getMonth() + 1}`,
      observaciones: ""
    })
    setShowReplenishForm(true)
    try {
      const banks = await api.financial.banks.list()
      setBankAccounts(banks.filter(b => b.activo))
    } catch {
      setBankAccounts([])
    }
  }

  const handleReplenish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replenishFund || !replenishForm.monto || Number(replenishForm.monto) <= 0) return
    setSubmittingReplenish(true)
    try {
      await api.expenses.funds.replenish(replenishFund.id, {
        monto: Number(replenishForm.monto),
        bank_account_id: replenishForm.bank_account_id || undefined,
        referencia: replenishForm.referencia || undefined,
        observaciones: replenishForm.observaciones || undefined
      })
      toast.success("Fondo Repuesto", `Se inyectaron ${formatPYG(Number(replenishForm.monto))} al fondo ${replenishFund.nombre}.`)
      setShowReplenishForm(false)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al reponer fondo", e.message)
    } finally {
      setSubmittingReplenish(false)
    }
  }

  const handleOpenCount = (fund: PettyCashFund) => {
    setCountingFund(fund)
    setCountForm({ monto_contado: "", observaciones: "" })
    setCountResult(null)
    setShowCountForm(true)
  }

  const handleSubmitCount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!countingFund || !countForm.monto_contado) return
    setSubmittingCount(true)
    try {
      const result = await api.expenses.funds.counts.create(countingFund.id, {
        monto_contado: Number(countForm.monto_contado),
        observaciones: countForm.observaciones || undefined,
      })
      setCountResult(result)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al registrar arqueo", e.message)
    } finally {
      setSubmittingCount(false)
    }
  }

  const handleConfirmCount = async (count: PettyCashFundCount, ajustar: boolean) => {
    const label = ajustar ? "ajustar el saldo del fondo al monto contado" : "confirmar sin modificar el saldo en sistema"
    if (!confirm(`¿Deseas ${label}?`)) return
    try {
      await api.expenses.funds.counts.confirm(count.id, { ajustar })
      toast.success("Arqueo Confirmado", ajustar ? "Saldo del fondo ajustado con éxito." : "Arqueo archivado sin modificación de saldo.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error al confirmar arqueo", e.message)
    }
  }

  const handleViewFundMovements = async (fund: PettyCashFund) => {
    setLoadingMovements(true)
    setSelectedFundMovements({ fund, movements: [] })
    try {
      const movs = await api.expenses.funds.movements(fund.id, 50)
      setSelectedFundMovements({ fund, movements: movs })
    } catch (e: any) {
      toast.error("Error al cargar movimientos", e.message)
    } finally {
      setLoadingMovements(false)
    }
  }

  const handleSaveApprovalThreshold = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.expenses.approvalConfig.update({
        umbral_aprobacion: Number(approvalThresholdForm),
        tolerancia_arqueo: Number(toleranciaArqueoForm)
      })
      toast.success("Parámetros Guardados", "Se actualizaron las políticas de aprobación y auditoría.")
      setShowThresholdForm(false)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      await api.financeAgent.run()
      toast.success("Diagnóstico IA Completado", "El Gerente Financiero analizó las desviaciones y patrones de gasto.")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDecideRecommendation = async (id: string, approve: boolean) => {
    try {
      const fn = approve ? api.financeAgent.approve : api.financeAgent.reject
      await fn(id, user?.id || "", undefined)
      toast.success(approve ? "Recomendación Aprobada" : "Recomendación Descartada")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  // Cálculos KPIs Cockpit
  const totalFondosAutorizado = funds.reduce((acc, f) => acc + (f.monto_autorizado || 0), 0)
  const totalFondosSaldoActual = funds.reduce((acc, f) => acc + (f.saldo_actual || 0), 0)
  const gastosPendientes = expenses.filter(e => e.estado === "pendiente")
  const totalPendienteMonto = gastosPendientes.reduce((acc, e) => acc + (e.monto || 0), 0)

  // Filtrado de gastos en tabla
  const filteredExpenses = expenses.filter(e => {
    // 1. Filtro por Rendición
    if (filterRendicion === "sin_rendicion" && e.rendicion_id) return false
    if (filterRendicion === "con_rendicion" && !e.rendicion_id) return false
    if (filterRendicion && filterRendicion !== "sin_rendicion" && filterRendicion !== "con_rendicion") {
      if (e.rendicion_id !== filterRendicion) return false
    }

    // 2. Filtro por Fondo y Sector
    const matchFund = !filterFund || e.fund_id === filterFund
    const matchSector = !filterSector || e.cost_center_id === filterSector
    if (!matchFund || !matchSector) return false

    // 3. Filtro específico por Monto (input dedicado)
    if (filterMonto && filterMonto.trim()) {
      const cleanMontoInput = filterMonto.replace(/[^\d]/g, "")
      const montoDigits = String(Math.round(e.monto || 0))
      if (cleanMontoInput && !montoDigits.includes(cleanMontoInput)) {
        return false
      }
    }

    // 4. Búsqueda general (concepto, proveedor, factura, timbrado, RUC, rendición, monto)
    if (search && search.trim()) {
      const sRaw = search.trim().toLowerCase()
      const sDigits = search.replace(/[^\d]/g, "")

      const rend = getExpenseRendicion(e)
      const rendNum = (e.rendicion_numero || rend?.numero_rendicion || "").toLowerCase()
      const rendCustodio = (rend?.custodio_nombre || "").toLowerCase()
      const desc = (e.descripcion || "").toLowerCase()
      const prov = (e.proveedor || "").toLowerCase()
      const numFact = (e.numero_factura || "").toLowerCase()
      const timb = (e.timbrado || "").toLowerCase()
      const ruc = (e.ruc || "").toLowerCase()
      const fName = (e.fund_nombre || fundName(e.fund_id) || "").toLowerCase()
      const secName = (e.cost_center_nombre || sectorName(e.cost_center_id) || "").toLowerCase()

      const textMatch =
        desc.includes(sRaw) ||
        prov.includes(sRaw) ||
        numFact.includes(sRaw) ||
        timb.includes(sRaw) ||
        ruc.includes(sRaw) ||
        rendNum.includes(sRaw) ||
        rendCustodio.includes(sRaw) ||
        fName.includes(sRaw) ||
        secName.includes(sRaw)

      const montoVal = Math.round(Number(e.monto || 0))
      const montoDigits = String(montoVal)
      const montoFormatted = formatPYG(e.monto || 0).toLowerCase()

      const montoMatch =
        (sDigits.length >= 2 && montoDigits.includes(sDigits)) ||
        montoDigits === sDigits ||
        montoFormatted.includes(sRaw)

      if (!textMatch && !montoMatch) return false
    }

    return true
  }).sort((a, b) => new Date(b.fecha_gasto || b.created_at || 0).getTime() - new Date(a.fecha_gasto || a.created_at || 0).getTime())

  const maxTendencia = dashboard ? Math.max(...dashboard.tendencia_mensual.map(t => t.total), 1) : 1
  const maxSector = dashboard ? Math.max(...dashboard.por_sector.map(s => s.total), 1) : 1

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/90 text-white p-7 border border-rose-500/20 shadow-2xl shadow-rose-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-600 border border-rose-400/30 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                  <ReceiptIcon className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-2.5 py-0.5 rounded-md border border-rose-500/20">
                    FINANZAS & TESORERÍA · GASTOS OPERATIVOS (OPEX) & FONDOS FIJOS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    {expenses.length} Comprobantes Registrados
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gastos Operativos & Fondos Fijos
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Rendición de comprobantes por departamento (Carnicería, Panadería, Limpieza), autorización de desembolsos y arqueos de caja chica
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-300">
                💸 {dashboard ? formatPYG(dashboard.total_periodo) : "—"} ejecutado
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🐷 {formatPYG(totalFondosSaldoActual)} disponible en cajas chicas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-rose-500/25"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Gasto</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gasto Total (30d)</span>
              <DollarSign className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {dashboard ? formatPYG(dashboard.total_periodo) : "—"}
            </p>
            <div className="flex items-center gap-2 text-xs">
              {dashboard?.variacion_pct !== null && dashboard?.variacion_pct !== undefined ? (
                <span className={`flex items-center font-bold font-mono ${dashboard.variacion_pct > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {dashboard.variacion_pct > 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                  {Math.abs(dashboard.variacion_pct).toFixed(1)}%
                </span>
              ) : null}
              <span className="text-slate-400 text-[11px]">vs período anterior</span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cajas Chicas (Saldo)</span>
              <PiggyBank className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(totalFondosSaldoActual)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              de {formatPYG(totalFondosAutorizado)} autorizados ({totalFondosAutorizado > 0 ? ((totalFondosSaldoActual / totalFondosAutorizado) * 100).toFixed(0) : 0}% disp.)
            </p>
          </div>

          <button
            onClick={() => { setTab("list"); setFilterEstado("pendiente") }}
            className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-amber-500/40 hover:border-amber-400 hover:bg-amber-950/20 transition-all text-left w-full cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Por Autorizar</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(totalPendienteMonto)}
            </p>
            <p className="text-[11px] text-amber-400 font-bold font-mono">
              {gastosPendientes.length} comprobante(s) en espera
            </p>
            <p className="text-[10px] text-amber-500/70 mt-1">▶ Click para ver y aprobar</p>
          </button>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Arqueos Pendientes</span>
              <Scale className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {pendingCounts.length}
            </p>
            <p className="text-[11px] text-slate-400">
              {pendingCounts.some(c => c.requiere_revision) ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Hay arqueos con desvío
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fondos balanceados
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { k: "dashboard" as Tab, l: "Torre de Control", i: BarChart3 },
          { k: "fondos" as Tab, l: "Fondos Fijos (Caja Chica)", i: PiggyBank, count: funds.length },
          { k: "rendiciones" as Tab, l: "Rendiciones & Reposición", i: FileCheck, count: rendiciones.filter(r => r.estado === "presentada").length },
          { k: "list" as Tab, l: "Comprobantes de Gasto", i: ReceiptIcon, count: expenses.length },
          { k: "arqueos" as Tab, l: "Auditoría de Arqueos", i: Scale, count: pendingCounts.length },
          { k: "sectores" as Tab, l: "Centros de Costo", i: Layers, count: costCenters.length },
          { k: "categories" as Tab, l: "Categorías", i: Wallet, count: categories.length },
          { k: "reportes" as Tab, l: "Centro de Reportes", i: FileSpreadsheet },
        ].map((t) => {
          const Icon = t.i
          const active = tab === t.k
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.l}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* CONTENIDO DE TABS */}
      {loading && !dashboard ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {/* TAB 1: DASHBOARD & PRESUPUESTOS */}
          {tab === "dashboard" && dashboard && (
            <div className="space-y-6">
              {/* Alertas Inteligentes & Sugerencias */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Reglas automáticas */}
                <div className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" /> Alertas Automáticas de Gasto
                    </h3>
                    <span className="text-[10px] text-gray-400 font-medium">Reglas de Control Interno</span>
                  </div>
                  <div className="space-y-2.5">
                    {dashboard.sugerencias.map((s, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{s.titulo}</p>
                          <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">{s.detalle}</p>
                        </div>
                      </div>
                    ))}
                    {dashboard.sugerencias.length === 0 && (
                      <div className="p-6 text-center text-xs text-gray-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-70" />
                        Sin desvíos detectados. Los gastos se encuentran dentro de las tolerancias.
                      </div>
                    )}
                  </div>
                </div>

                {/* Recomendaciones Gerente Financiero IA */}
                <div className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" /> Diagnóstico del Finance Agent IA
                    </h3>
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
                    >
                      {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {analyzing ? "Analizando..." : "Ejecutar Diagnóstico"}
                    </button>
                  </div>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {recommendations.map(r => (
                      <div key={r.id} className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{r.titulo}</p>
                          {r.monto_relacionado && (
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                              {r.monto_relacionado}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-gray-300">{r.descripcion}</p>
                        {r.status === "pending" ? (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleDecideRecommendation(r.id, true)}
                              className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <ThumbsUp className="w-3 h-3" /> Aplicar
                            </button>
                            <button
                              onClick={() => handleDecideRecommendation(r.id, false)}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Descartar
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {r.status === "approved" ? "Aprobada por Gerencia" : "Descartada"}
                          </span>
                        )}
                      </div>
                    ))}
                    {recommendations.length === 0 && (
                      <div className="p-6 text-center text-xs text-gray-400">
                        Presioná "Ejecutar Diagnóstico" para que la IA evalúe oportunidades de reducción de costos y desvíos de caja chica.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Consumo Presupuestario por Sector y Categoría */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Por Sector / Centro de Costo */}
                <div className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" /> Distribución por Sector Operativo
                    </h3>
                    <span className="text-[10px] text-gray-400 font-medium">Directo + Prorrateo Global</span>
                  </div>
                  <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                    {dashboard.por_sector.map((s, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-800 dark:text-gray-200">{s.nombre}</span>
                          <span className="text-gray-900 dark:text-white font-mono">{formatPYG(s.total)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-indigo-600 rounded-l-full"
                            style={{ width: `${(s.directo / maxSector) * 100}%` }}
                            title={`Directo: ${formatPYG(s.directo)}`}
                          />
                          <div
                            className="h-full bg-indigo-300 dark:bg-indigo-400/50 rounded-r-full"
                            style={{ width: `${(s.prorrateado / maxSector) * 100}%` }}
                            title={`Prorrateado: ${formatPYG(s.prorrateado)}`}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>Directo: {formatPYG(s.directo)}</span>
                          <span>Prorrateado: {formatPYG(s.prorrateado)}</span>
                        </div>
                      </div>
                    ))}
                    {dashboard.por_sector.length === 0 && (
                      <p className="text-center py-6 text-xs text-gray-400">Sin centros de costo asignados</p>
                    )}
                  </div>
                </div>

                {/* Por Categoría vs Presupuesto */}
                <div className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-600" /> Control Presupuestario por Categoría
                    </h3>
                    <span className="text-[10px] text-gray-400 font-medium">Límite Mensual</span>
                  </div>
                  <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                    {dashboard.por_categoria.map((c, i) => {
                      const pct = c.pct_usado || 0
                      const isOver = c.sobre_presupuesto || pct > 100
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className={isOver ? "text-red-600 font-bold" : "text-gray-800 dark:text-gray-200"}>
                              {c.nombre}
                            </span>
                            <span className="text-gray-900 dark:text-white font-mono">{formatPYG(c.total)}</span>
                          </div>
                          {c.presupuesto_prorateado !== null && (
                            <>
                              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isOver ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className={isOver ? "text-red-500 font-bold" : "text-gray-400"}>
                                  {pct.toFixed(0)}% ejecutado
                                </span>
                                <span className="text-gray-400">
                                  Límite: {formatPYG(c.presupuesto_prorateado)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                    {dashboard.por_categoria.length === 0 && (
                      <p className="text-center py-6 text-xs text-gray-400">Sin gastos categorizados en el período</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tendencia Mensual */}
              <div className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" /> Evolución Mensual de Egresos Operativos
                  </h3>
                  <span className="text-[10px] text-gray-400 font-medium">Histórico últimos 6 meses</span>
                </div>
                <div className="flex items-end gap-4 h-36 pt-4">
                  {dashboard.tendencia_mensual.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatPYG(t.total)}
                      </div>
                      <div
                        className="w-full bg-indigo-500/20 group-hover:bg-indigo-600 rounded-t-lg transition-all duration-300 relative"
                        style={{ height: `${(t.total / maxTendencia) * 85}%`, minHeight: "6px" }}
                      />
                      <span className="text-[11px] font-bold text-gray-500 uppercase">{t.mes.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FONDOS FIJOS (CAJAS CHICAS) */}
          {tab === "fondos" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Cajas Chicas y Fondos Fijos Descentralizados</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Cada fondo opera como una caja autónoma con custodio responsable, límite autorizado y reposición respaldada por comprobantes.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFundForm({
                      nombre: "",
                      monto_autorizado: "",
                      custodio_id: user?.id || "",
                      cost_center_id: "",
                      monto_maximo_por_gasto: "",
                      dotacion_inicial: false,
                      medio_dotacion: "EFECTIVO_BOVEDA",
                      caja_boveda_id: "",
                      bank_account_id: "",
                    })
                    setShowFundForm(true)
                  }}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Crear Nuevo Fondo
                </button>
              </div>

              {/* Grid de Fondos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {funds.map(f => {
                  const pctUsado = f.monto_autorizado > 0 ? ((f.monto_autorizado - f.saldo_actual) / f.monto_autorizado) * 100 : 0
                  const isCritico = f.monto_autorizado > 0 && f.saldo_actual / f.monto_autorizado < 0.2
                  return (
                    <div
                      key={f.id}
                      className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 flex flex-col justify-between hover:shadow-md transition-shadow"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300">
                              <PiggyBank className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-gray-900 dark:text-white">{f.nombre}</h4>
                              <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <UserCircle2 className="w-3.5 h-3.5" />
                                {f.custodio_nombre || "Custodio no asignado"}
                              </p>
                            </div>
                          </div>
                          {!f.activo && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              Inactivo
                            </span>
                          )}
                        </div>

                        {/* Etiquetas de Sector y Límite */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {f.cost_center_nombre && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              <Layers className="w-3 h-3" /> {f.cost_center_nombre}
                            </span>
                          )}
                          {f.monto_maximo_por_gasto && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              Máx/gasto: {formatPYG(f.monto_maximo_por_gasto)}
                            </span>
                          )}
                        </div>

                        {/* Saldos */}
                        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[11px] font-semibold text-gray-500">Saldo Disponible:</span>
                            <span className={`text-lg font-black font-mono ${isCritico ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {formatPYG(f.saldo_actual)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-400">
                            <span>Límite Autorizado:</span>
                            <span className="font-mono font-semibold">{formatPYG(f.monto_autorizado)}</span>
                          </div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isCritico ? "bg-red-500" : "bg-indigo-600"}`}
                              style={{ width: `${Math.min(100 - pctUsado, 100)}%` }}
                            />
                          </div>
                          {isCritico && (
                            <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 pt-0.5">
                              <AlertTriangle className="w-3 h-3" /> Saldo crítico ({((f.saldo_actual / f.monto_autorizado) * 100).toFixed(0)}% restante)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          onClick={() => {
                            setRendicionCreateInitialFundId(f.id)
                            setShowCreateRendicionModal(true)
                          }}
                          className="btn-primary py-1.5 px-2 text-xs flex items-center justify-center gap-1 col-span-2 sm:col-span-1"
                          title="Rendir comprobantes y solicitar reposición"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Rendir
                        </button>
                        <button
                          onClick={() => handleOpenReplenish(f)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex items-center justify-center gap-1 transition-colors"
                          title="Reponer fondos desde banco o tesorería"
                        >
                          <Landmark className="w-3.5 h-3.5" /> Reponer
                        </button>
                        <button
                          onClick={() => handleOpenCount(f)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1 transition-colors"
                          title="Registrar arqueo de caja"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" /> Arqueo
                        </button>
                        <button
                          onClick={() => handleViewFundMovements(f)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1 transition-colors"
                          title="Ver historial de comprobantes"
                        >
                          <FileText className="w-3.5 h-3.5" /> Detalle
                        </button>
                      </div>
                    </div>
                  )
                })}
                {funds.length === 0 && (
                  <div className="col-span-full card p-12 text-center text-gray-400 bg-white dark:bg-slate-800/80">
                    <PiggyBank className="w-10 h-10 mx-auto mb-2 opacity-50 text-indigo-500" />
                    <p className="font-bold text-sm text-gray-700 dark:text-gray-200">No hay fondos fijos configurados</p>
                    <p className="text-xs mt-1">Creá una caja chica para comenzar a registrar comprobantes y rendiciones por sector.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RENDICIONES DE CUENTAS & REPOSICIÓN */}
          {tab === "rendiciones" && (
            <div className="space-y-6">
              {/* Encabezado y Acción */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-indigo-600" />
                    Rendiciones de Cuentas & Reposición de Fondos Fijos
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Proceso formal: El custodio agrupa comprobantes y declara efectivo remanente. Tesorería audita ítem por ítem con validación antifraude y repone desde Bóveda o Banco.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRendicionCreateInitialFundId(funds[0]?.id || "")
                      setShowCreateRendicionModal(true)
                    }}
                    className="btn-primary text-xs flex items-center gap-2 shrink-0 px-4 py-2.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Nueva Rendición
                  </button>
                </div>
              </div>

              {/* Filtros de Rendiciones */}
              <div className="card p-4 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Filtrar por Fondo Fijo</label>
                    <select
                      className="input-field w-full text-xs"
                      value={filterRendicionFund}
                      onChange={e => setFilterRendicionFund(e.target.value)}
                    >
                      <option value="">Todos los Fondos Fijos ({funds.length})</option>
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>{f.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Estado de Auditoría</label>
                    <select
                      className="input-field w-full text-xs"
                      value={filterRendicionEstado}
                      onChange={e => setFilterRendicionEstado(e.target.value)}
                    >
                      <option value="">Todos los Estados</option>
                      <option value="presentada">⏳ Presentadas (Pendientes de Auditoría)</option>
                      <option value="en_auditoria">🔍 En Auditoría</option>
                      <option value="aprobada">✓ Aprobadas (Listas p/ Reponer)</option>
                      <option value="repuesta">💎 Repuestas / Cerradas</option>
                      <option value="rechazada">✕ Rechazadas</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={fetchRendiciones}
                      disabled={loadingRendiciones}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1.5 transition-colors w-full h-[38px]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingRendiciones ? "animate-spin" : ""}`} />
                      Actualizar Listado
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de Rendiciones */}
              {loadingRendiciones ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : rendiciones.length === 0 ? (
                <div className="card p-12 text-center text-gray-400 bg-white dark:bg-slate-800/80">
                  <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-40 text-indigo-500" />
                  <p className="font-bold text-sm text-gray-700 dark:text-gray-200">No hay rendiciones de cuentas registradas</p>
                  <p className="text-xs mt-1 text-gray-500">
                    Los encargados de fondos fijos pueden generar una rendición agrupando los comprobantes cargados en el sistema.
                  </p>
                </div>
              ) : (
                <div className="card overflow-hidden bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-700/60 uppercase tracking-wider text-[10px] font-bold">
                        <tr>
                          <th className="py-3 px-4">N° Expediente</th>
                          <th className="py-3 px-4">Fondo / Custodio</th>
                          <th className="py-3 px-4">Fecha Presentación</th>
                          <th className="py-3 px-4 text-center">Comprobantes</th>
                          <th className="py-3 px-4 text-right">Monto Rendido</th>
                          <th className="py-3 px-4 text-right">Arqueo Remanente</th>
                          <th className="py-3 px-4 text-center">Estado</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {rendiciones.map(r => {
                          const f = funds.find(x => x.id === r.fund_id)
                          const dif = r.diferencia_arqueo || 0
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                                    {r.numero_rendicion}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-gray-900 dark:text-white">{r.fund_nombre || f?.nombre || "Fondo Fijo"}</div>
                                <div className="text-[11px] text-gray-400 flex items-center gap-1">
                                  <UserCircle2 className="w-3 h-3" />
                                  {r.presentado_por_nombre || f?.custodio_nombre || "Custodio"}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-300">
                                {r.created_at ? new Date(r.created_at).toLocaleDateString("es-PY") : "—"}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {r.cantidad_comprobantes ?? r.total_comprobantes_presentados ?? 0} comp.
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                                {formatPYG(r.total_presentado ?? r.total_comprobantes_presentados ?? 0)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                  {formatPYG(r.efectivo_remanente_contado)}
                                </div>
                                <div className="text-[10px] mt-0.5">
                                  {dif === 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Cuadrado (0 Gs)</span>
                                  ) : dif < 0 ? (
                                    <span className="text-red-500 font-bold">Faltante {formatPYG(dif)}</span>
                                  ) : (
                                    <span className="text-amber-500 font-bold">Sobrante +{formatPYG(dif)}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {r.estado === "presentada" && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    Pendiente Auditoría
                                  </span>
                                )}
                                {(r.estado === "en_auditoria" || r.estado === "en_revision") && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    En Auditoría
                                  </span>
                                )}
                                {r.estado === "aprobada" && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    Aprobada p/ Reponer
                                  </span>
                                )}
                                {(r.estado === "repuesta" || r.estado === "pagada") && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Repuesta / Cerrada
                                  </span>
                                )}
                                {r.estado === "rechazada" && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                    Rechazada
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedRendicionForAuditId(r.id)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 transition-colors shadow-sm"
                                    title="Auditar ítem por ítem o reponer fondos"
                                  >
                                    <FileCheck className="w-3.5 h-3.5" />
                                    {r.estado === "repuesta" || r.estado === "pagada" ? "Ver Expediente" : "Auditar"}
                                  </button>
                                  <button
                                    onClick={() => api.expenses.rendiciones.downloadPdf(r.id, r.numero_rendicion)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    title="Descargar Acta Oficial en PDF con firmas institucionales"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PLANILLA DE COMPROBANTES DE GASTO */}
          {tab === "list" && (
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="card p-4 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-center">
                  {/* Buscador General */}
                  <div className="relative sm:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input-field pl-9 pr-7 text-xs w-full"
                      placeholder="Buscar por concepto, proveedor, factura o monto..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Limpiar búsqueda"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Búsqueda Directa por Monto */}
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    <input
                      type="text"
                      className="input-field pl-9 pr-7 text-xs w-full font-mono font-medium"
                      placeholder="Monto Gs. (ej: 50.000)"
                      value={filterMonto}
                      onChange={e => setFilterMonto(e.target.value)}
                    />
                    {filterMonto && (
                      <button
                        type="button"
                        onClick={() => setFilterMonto("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Limpiar filtro de monto"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filtro por Rendición */}
                  <div>
                    <select
                      className="input-field text-xs w-full"
                      value={filterRendicion}
                      onChange={e => setFilterRendicion(e.target.value)}
                    >
                      <option value="">Todas las Rendiciones</option>
                      <option value="sin_rendicion">⚠️ Sin Rendición (Pendientes)</option>
                      <option value="con_rendicion">📄 Asignados a una Rendición</option>
                      {rendiciones.length > 0 && (
                        <optgroup label="Rendiciones Específicas">
                          {rendiciones.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.numero_rendicion} ({r.estado})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Filtro por Estado */}
                  <div>
                    <select
                      className="input-field text-xs w-full"
                      value={filterEstado}
                      onChange={e => setFilterEstado(e.target.value)}
                    >
                      <option value="">Todos los Estados</option>
                      <option value="pendiente">Pendientes de Aprobación</option>
                      <option value="aprobado">Aprobados (Listos para Pagar)</option>
                      <option value="pagado">Pagados / Liquidados</option>
                      <option value="rechazado">Rechazados</option>
                    </select>
                  </div>

                  {/* Filtro Caja Chica */}
                  <div>
                    <select
                      className="input-field text-xs w-full"
                      value={filterFund}
                      onChange={e => setFilterFund(e.target.value)}
                    >
                      <option value="">Todas las Cajas Chicas</option>
                      {funds.map(f => (
                        <option key={f.id} value={f.id}>{f.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub-barra de acciones y filtros activos */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] flex-wrap">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Mostrando {filteredExpenses.length} de {expenses.length} comprobante(s)
                    </span>
                    {(search || filterMonto || filterRendicion || filterEstado || filterFund || filterSector) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("")
                          setFilterMonto("")
                          setFilterRendicion("")
                          setFilterEstado("")
                          setFilterFund("")
                          setFilterSector("")
                        }}
                        className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline font-bold"
                      >
                        <XCircle className="w-3 h-3" /> Limpiar filtros
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="input-field text-xs py-1"
                      value={filterSector}
                      onChange={e => setFilterSector(e.target.value)}
                    >
                      <option value="">Todos los Sectores</option>
                      {costCenters.map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleDownloadConsolidatedPdf}
                      disabled={downloadingConsolidatedPdf}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap"
                      title="Descargar Reporte Consolidado Analítico de Gastos en PDF"
                    >
                      {downloadingConsolidatedPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>Reporte PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla Enterprise de Gastos */}
              <div className="card p-0 overflow-hidden bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/90 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                        <th className="p-3.5">Fecha</th>
                        <th className="p-3.5">Descripción & Comprobante</th>
                        <th className="p-3.5">Proveedor</th>
                        <th className="p-3.5">Caja Chica</th>
                        <th className="p-3.5">Rendición / Ubicación</th>
                        <th className="p-3.5">Sector</th>
                        <th className="p-3.5">Categoría</th>
                        <th className="p-3.5">Monto Total</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                      {filteredExpenses.map(e => {
                        const rend = getExpenseRendicion(e)
                        const rendNumero = e.rendicion_numero || rend?.numero_rendicion
                        const rendEstado = e.rendicion_estado || rend?.estado
                        const rendId = e.rendicion_id || rend?.id
                        const rendFecha = e.rendicion_fecha || rend?.fecha_presentacion || rend?.created_at
                        const rendCustodio = rend?.custodio_nombre

                        return (
                          <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-mono text-gray-500 whitespace-nowrap">
                              {e.fecha_gasto ? new Date(e.fecha_gasto).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 font-bold text-gray-900 dark:text-white max-w-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{e.descripcion}</span>
                                {e.es_pago_proveedor && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                    <Package className="w-2.5 h-2.5" /> Mercaderías (Cuentas por Pagar)
                                  </span>
                                )}
                              </div>

                              {/* Datos fiscales para ubicar el comprobante físico */}
                              {(e.numero_factura || e.timbrado || e.ruc) && (
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-1 flex-wrap">
                                  {e.tipo_comprobante && (
                                    <span className="uppercase text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                                      {e.tipo_comprobante.replace("_", " ")}
                                    </span>
                                  )}
                                  {e.numero_factura && (
                                    <span className="text-gray-800 dark:text-gray-200 font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                      N° {e.numero_factura}
                                    </span>
                                  )}
                                  {e.timbrado && (
                                    <span className="text-gray-500" title={`Timbrado oficial: ${e.timbrado}`}>
                                      Timb: {e.timbrado}
                                    </span>
                                  )}
                                  {e.ruc && (
                                    <span className="text-gray-500">
                                      RUC: {e.ruc}
                                    </span>
                                  )}
                                </div>
                              )}

                              {e.comprobante_url && (
                                <a
                                  href={e.comprobante_url.startsWith("http") ? e.comprobante_url : `${API_ORIGIN}${e.comprobante_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline mt-1 font-semibold"
                                >
                                  <Paperclip className="w-3 h-3" /> Ver Comprobante Adjunto
                                </a>
                              )}
                            </td>
                            <td className="p-3.5 text-gray-600 dark:text-gray-300">
                              {e.proveedor || "—"}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                {fundName(e.fund_id)}
                              </span>
                            </td>

                            {/* COLUMNA: Rendición / Ubicación */}
                            <td className="p-3.5">
                              {rendNumero && rendId ? (
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRendicionForAuditId(rendId)}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition shadow-sm group"
                                    title="Ver expediente y auditoría de esta rendición"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
                                    <span>{rendNumero}</span>
                                  </button>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                      rendEstado === "aprobada" || rendEstado === "pagada"
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                        : rendEstado === "presentada" || rendEstado === "en_revision"
                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                                        : rendEstado === "rechazada"
                                        ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    }`}>
                                      {rendEstado === "pagada" ? "Pagada / Repuesta" : rendEstado || "En Rendición"}
                                    </span>
                                    {rendCustodio && (
                                      <span className="text-[10px] text-gray-500 truncate max-w-[110px]" title={`Custodio: ${rendCustodio}`}>
                                        👤 {rendCustodio}
                                      </span>
                                    )}
                                  </div>
                                  {rendFecha && (
                                    <p className="text-[9px] text-gray-400 font-mono">
                                      {new Date(rendFecha).toLocaleDateString("es-PY")}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                    <AlertCircle className="w-3 h-3 text-amber-500" />
                                    Sin Rendición
                                  </span>
                                  <p className="text-[10px] text-gray-400">
                                    En custodia ({fundName(e.fund_id)})
                                  </p>
                                </div>
                              )}
                            </td>

                            <td className="p-3.5 text-gray-500">
                              {sectorName(e.cost_center_id)}
                            </td>
                            <td className="p-3.5 text-gray-500">
                              {catName(e.category_id)}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                              {formatPYG(e.monto)}
                            </td>
                            <td className="p-3.5">
                              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                e.estado === "pagado"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200"
                                  : e.estado === "aprobado"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200"
                                  : e.estado === "rechazado"
                                  ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200"
                              }`}>
                                {e.estado === "pagado" ? "Pagado" : e.estado === "aprobado" ? "Aprobado" : e.estado === "rechazado" ? "Rechazado" : "Pendiente"}
                              </span>
                              {e.forma_pago_resumen && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 truncate max-w-[130px]" title={e.forma_pago_resumen}>
                                  {e.forma_pago_resumen}
                                </p>
                              )}
                              {e.estado === "rechazado" && e.rechazado_motivo && (
                                <p className="text-[10px] text-red-500 mt-1 max-w-[140px] italic">
                                  {e.rechazado_motivo}
                                </p>
                              )}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* 0. Botón Editar Comprobante */}
                                {!e.anulado && e.estado !== "anulado" && (
                                  <button
                                    onClick={() => handleOpenEdit(e)}
                                    title="Editar comprobante de gasto"
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                )}

                                {/* 1. Si está pendiente: Botones de Aprobar y Rechazar */}
                                {e.estado === "pendiente" && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(e.id)}
                                      title="Aprobar comprobante de gasto"
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleReject(e.id)}
                                      title="Rechazar gasto"
                                      className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {/* 2. Si está aprobado: Botón destacado Pagar / Liquidar */}
                                {e.estado === "aprobado" && (
                                  <button
                                    onClick={() => setPaymentModalExpense(e)}
                                    title="Liquidar gasto y asignar medios de pago"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    Pagar
                                  </button>
                                )}

                                {/* 3. Si está pagado o aprobado: Botón de Recibo PDF */}
                                {(e.estado === "pagado" || e.estado === "aprobado") && (
                                  <button
                                    onClick={() => handleDownloadReceiptPdf(e.id)}
                                    disabled={downloadingReceiptId === e.id}
                                    title="Descargar Recibo Oficial / Orden de Pago PDF"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  >
                                    {downloadingReceiptId === e.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    ) : (
                                      <Printer className="w-4 h-4" />
                                    )}
                                  </button>
                                )}

                                {/* 4. Anular gasto */}
                                <button
                                  onClick={() => handleVoid(e.id)}
                                  title="Anular gasto"
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredExpenses.length === 0 && (
                        <tr>
                          <td colSpan={10} className="text-center py-12 text-gray-400">
                            No se encontraron comprobantes registrados con los filtros aplicados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDITORÍA DE ARQUEOS */}
          {tab === "arqueos" && (
            <div className="space-y-6">
              <div className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Scale className="w-5 h-5 text-indigo-600" /> Arqueos de Caja Chica Pendientes de Confirmación
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Comparativa entre el saldo teórico del sistema y el conteo físico de billetes y monedas.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {pendingCounts.map(c => {
                    const hasDiff = c.diferencia !== 0
                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          hasDiff
                            ? "bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30"
                            : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                              {fundName(c.fund_id)}
                            </span>
                            <span className="text-xs text-gray-400">· Contado por {c.contado_por_nombre || "Auditor"}</span>
                            {c.requiere_revision && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                Desvío Mayor a Tolerancia
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300 pt-1">
                            <span>Saldo en Sistema: <strong className="font-mono">{formatPYG(c.saldo_esperado)}</strong></span>
                            <span>Monto Contado: <strong className="font-mono">{formatPYG(c.monto_contado)}</strong></span>
                            <span>
                              Diferencia:{" "}
                              <strong className={`font-mono ${c.diferencia === 0 ? "text-emerald-600" : c.diferencia > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {c.diferencia > 0 ? "+" : ""}{formatPYG(c.diferencia)}
                              </strong>
                            </span>
                          </div>
                          {c.observaciones && (
                            <p className="text-[11px] text-gray-500 italic mt-1">"{c.observaciones}"</p>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleConfirmCount(c, true)}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            Confirmar y Ajustar Saldo
                          </button>
                          <button
                            onClick={() => handleConfirmCount(c, false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            Confirmar sin Ajustar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {pendingCounts.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                      <p className="font-bold text-sm text-gray-700 dark:text-gray-300">Todos los arqueos están al día</p>
                      <p className="text-xs mt-1">No hay diferencias de caja pendientes de revisión por gerencia.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CENTROS DE COSTOS & SECTORES */}
          {tab === "sectores" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Centros de Costo & Prorrateo de Supermercado</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Definí sectores operativos (Carnicería, Panadería, Frutería) y centros de gasto global que se prorratean automáticamente según su peso.
                  </p>
                </div>
                <button
                  onClick={() => setShowSectorForm(true)}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Nuevo Centro de Costo
                </button>
              </div>

              <div className="card p-0 overflow-hidden bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/90 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                      <th className="p-3.5">Nombre del Centro</th>
                      <th className="p-3.5">Tipo de Imputación</th>
                      <th className="p-3.5">Peso de Prorrateo</th>
                      <th className="p-3.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {costCenters.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white">{c.nombre}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            c.tipo === "global"
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          }`}>
                            {c.tipo === "global" ? "Global (Prorratea)" : "Sector Directo"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-gray-500">
                          {c.tipo === "sector" ? `${c.peso_prorateo}x` : "—"}
                        </td>
                        <td className="p-3.5">
                          {c.activo ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <Check className="w-4 h-4" /> Activo
                            </span>
                          ) : (
                            <span className="text-gray-400">Inactivo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {costCenters.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-400">
                          Sin centros de costo configurados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: CATEGORÍAS & LÍMITES PRESUPUESTARIOS */}
          {tab === "categories" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Categorías de Gasto & Presupuesto Máximo</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Establecé topes de gasto mensual para insumos, mantenimiento, logística, limpieza y servicios.
                  </p>
                </div>
                <button
                  onClick={() => setShowCategoryForm(true)}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Nueva Categoría
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(c => (
                  <div key={c.id} className="card p-5 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-600" /> {c.nombre}
                      </h4>
                      {c.presupuesto_mensual && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Presupuestada
                        </span>
                      )}
                    </div>
                    {c.descripcion && (
                      <p className="text-xs text-gray-500">{c.descripcion}</p>
                    )}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                      <span className="text-xs text-gray-500 font-medium">Tope Mensual:</span>
                      <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">
                        {c.presupuesto_mensual ? formatPYG(c.presupuesto_mensual) : "Sin Límite"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 📊 CENTRO DE REPORTES Y LIQUIDACIÓN DE FONDOS FIJOS */}
          {tab === "reportes" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header & Subtítulo Institucional */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Régimen de Fondos Fijos & Contabilidad
                    </span>
                    <h2 className="text-2xl font-black tracking-tight mt-2 flex items-center gap-2.5 text-white">
                      <FileSpreadsheet className="w-7 h-7 text-indigo-400" /> Centro de Reportes y Liquidación de Fondos
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Auditoría por sector, libro de compras fiscales (DNIT/SET), control de custodias y actas oficiales de rendición.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => fetchReportData()}
                      disabled={loadingReport}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/10"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin" : ""}`} /> Actualizar Datos
                    </button>
                  </div>
                </div>
              </div>

              {/* Barra de Filtros y Subpestañas */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  {/* Selector de Subreporte */}
                  <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {[
                      { id: "sector" as ReportSubTab, label: "Gastos por Sector", icon: Layers },
                      { id: "fondos" as ReportSubTab, label: "Libro de Fondos Fijos", icon: PiggyBank },
                      { id: "fiscal" as ReportSubTab, label: "Libro Fiscal IVA", icon: BookOpen },
                      { id: "rendicion" as ReportSubTab, label: "Rendición y Reposición", icon: FileCheck },
                    ].map(st => {
                      const Icon = st.icon
                      const active = reportSubTab === st.id
                      return (
                        <button
                          key={st.id}
                          onClick={() => setReportSubTab(st.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            active
                              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-extrabold"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{st.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Selector de Rango de Fechas (Horario Asunción) */}
                  {reportSubTab !== "fondos" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[11px] font-bold text-slate-500">Desde:</span>
                        <input
                          type="date"
                          value={repFechaDesde}
                          onChange={e => setRepFechaDesde(e.target.value)}
                          className="bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                        />
                        <span className="text-[11px] font-bold text-slate-500 ml-1">Hasta:</span>
                        <input
                          type="date"
                          value={repFechaHasta}
                          onChange={e => setRepFechaHasta(e.target.value)}
                          className="bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      {/* Botones rápidos de período */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const hoy = getTodayAsuncion()
                            setRepFechaDesde(hoy)
                            setRepFechaHasta(hoy)
                          }}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Hoy
                        </button>
                        <button
                          onClick={() => {
                            setRepFechaDesde(getStartOfMonthAsuncion())
                            setRepFechaHasta(getTodayAsuncion())
                          }}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Este Mes
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* SUBTAB 1: GASTOS POR SECTOR Y CENTRO DE COSTO */}
                {reportSubTab === "sector" && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                      <div>
                        <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                          Informe Consolidado de Gastos por Sector
                        </h4>
                        <p className="text-xs text-indigo-700/80 dark:text-indigo-400">
                          Imputación directa a sectores operativos con prorrateo de gastos globales según peso configurado.
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadSectorPdf}
                        disabled={downloadingPdf}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                      >
                        {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        Descargar Acta PDF Firmada
                      </button>
                    </div>

                    {loadingReport ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      </div>
                    ) : reportSectorData ? (
                      <div className="space-y-5">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Período</span>
                            <p className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                              {formatPYG(reportSectorData.total_periodo)}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {reportSectorData.total_gastos_count} comprobantes
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase">Gasto Directo</span>
                            <p className="text-lg font-black font-mono text-blue-900 dark:text-blue-100 mt-1">
                              {formatPYG(reportSectorData.por_sector?.reduce((acc: number, s: any) => acc + (s.directo || 0), 0) || 0)}
                            </p>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              Imputación por sector
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Prorrateo Global</span>
                            <p className="text-lg font-black font-mono text-emerald-900 dark:text-emerald-100 mt-1">
                              {formatPYG(reportSectorData.por_sector?.reduce((acc: number, s: any) => acc + (s.prorrateado || 0), 0) || 0)}
                            </p>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Distribución transversal
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Sin Asignar</span>
                            <p className={`text-lg font-black font-mono mt-1 ${reportSectorData.sin_asignar > 0 ? "text-rose-600" : "text-slate-600"}`}>
                              {formatPYG(reportSectorData.sin_asignar)}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {reportSectorData.sin_asignar > 0 ? "Requiere imputación" : "100% asignado"}
                            </span>
                          </div>
                        </div>

                        {/* Tabla Resumen por Sector */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                <th className="p-3">Sector / Centro de Costo</th>
                                <th className="p-3 text-right">Gasto Directo</th>
                                <th className="p-3 text-right">Prorrateo Global</th>
                                <th className="p-3 text-right">Total Consolidado</th>
                                <th className="p-3 text-center">Participación %</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {reportSectorData.por_sector?.map((s: any) => {
                                const pct = reportSectorData.total_periodo > 0 ? (s.total / reportSectorData.total_periodo * 100) : 0
                                return (
                                  <tr key={s.cost_center_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                                      {s.nombre}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                      {formatPYG(s.directo)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-500">
                                      {formatPYG(s.prorrateado)}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                      {formatPYG(s.total)}
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className="bg-indigo-600 h-1.5 rounded-full"
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                          />
                                        </div>
                                        <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                          {pct.toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Detalle de Comprobantes Recientes */}
                        {reportSectorData.detalle_gastos?.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              Comprobantes Registrados ({reportSectorData.detalle_gastos.length})
                            </h5>
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-96">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                                  <tr>
                                    <th className="p-2.5">Fecha</th>
                                    <th className="p-2.5">Sector</th>
                                    <th className="p-2.5">Concepto</th>
                                    <th className="p-2.5">Proveedor</th>
                                    <th className="p-2.5">Fondo Fijo</th>
                                    <th className="p-2.5 text-right">Monto</th>
                                    <th className="p-2.5 text-center">Comprobante</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {reportSectorData.detalle_gastos.map((g: any) => (
                                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                      <td className="p-2.5 font-mono text-[11px] text-slate-500">{g.fecha_gasto}</td>
                                      <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{g.sector_nombre || "—"}</td>
                                      <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">{g.descripcion}</td>
                                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{g.proveedor || "—"}</td>
                                      <td className="p-2.5 text-slate-500">{g.fund_nombre || "Caja Chica"}</td>
                                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">{formatPYG(g.monto)}</td>
                                      <td className="p-2.5 text-center">
                                        {g.comprobante_url ? (
                                          <a
                                            href={`${API_ORIGIN}${g.comprobante_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                                          >
                                            <Paperclip className="w-3 h-3" /> Ver
                                          </a>
                                        ) : (
                                          <span className="text-[10px] text-slate-400">Sin archivo</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* SUBTAB 2: LIBRO DE FONDOS FIJOS (CAJAS CHICAS) */}
                {reportSubTab === "fondos" && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                      <div>
                        <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                          Libro Consolidado y Monitoreo de Fondos Fijos
                        </h4>
                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
                          Control de saldos en gaveta, nivel de liquidez por sector, alertas de reposición y custodios.
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadFundsPdf}
                        disabled={downloadingPdf}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                      >
                        {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        Descargar Libro de Fondos PDF (A4 Landscape)
                      </button>
                    </div>

                    {loadingReport ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      </div>
                    ) : reportFundsData ? (
                      <div className="space-y-5">
                        {/* KPI Cards Fondos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Monto Total Autorizado</span>
                            <p className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                              {formatPYG(reportFundsData.reduce((acc, f) => acc + (f.monto_autorizado || 0), 0))}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">{reportFundsData.length} fondos registrados</span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Disponible en Gavetas</span>
                            <p className="text-lg font-black font-mono text-emerald-900 dark:text-emerald-100 mt-1">
                              {formatPYG(reportFundsData.reduce((acc, f) => acc + (f.saldo_actual || 0), 0))}
                            </p>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Efectivo para cambio/gastos</span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase">Gastado / A Reponer</span>
                            <p className="text-lg font-black font-mono text-blue-900 dark:text-blue-100 mt-1">
                              {formatPYG(reportFundsData.reduce((acc, f) => acc + (f.gastado || 0), 0))}
                            </p>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Comprobantes acumulados</span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Alertas Reposición</span>
                            <p className="text-lg font-black font-mono mt-1 text-rose-600">
                              {reportFundsData.filter(f => f.alerta_reposicion).length} Fondos
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">Saldo menor al 20%</span>
                          </div>
                        </div>

                        {/* Tabla de Fondos */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                <th className="p-3">Fondo / Sector</th>
                                <th className="p-3">Custodio Responsable</th>
                                <th className="p-3 text-right">Monto Autorizado</th>
                                <th className="p-3 text-right">Saldo en Gaveta</th>
                                <th className="p-3 text-right">Gastado / Por Rendir</th>
                                <th className="p-3 text-center">Nivel de Liquidez</th>
                                <th className="p-3 text-center">Estado</th>
                                <th className="p-3 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {reportFundsData.map((f: any) => (
                                <tr key={f.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <PiggyBank className="w-4 h-4 text-emerald-500" />
                                    {f.nombre}
                                  </td>
                                  <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                                    {f.custodio_nombre || "Sin custodio asignado"}
                                  </td>
                                  <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                    {formatPYG(f.monto_autorizado)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatPYG(f.saldo_actual)}
                                  </td>
                                  <td className="p-3 text-right font-mono text-slate-500">
                                    {formatPYG(f.gastado)}
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className={`h-1.5 rounded-full ${
                                            f.liquidez_pct < 20 ? "bg-rose-500" : f.liquidez_pct < 40 ? "bg-amber-500" : "bg-emerald-500"
                                          }`}
                                          style={{ width: `${Math.min(f.liquidez_pct, 100)}%` }}
                                        />
                                      </div>
                                      <span className="font-mono text-[11px] font-bold">
                                        {f.liquidez_pct}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      f.alerta_reposicion
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200"
                                        : f.liquidez_pct < 40
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                    }`}>
                                      {f.estado_desc}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      onClick={() => handleDownloadRendicionPdf(f.id)}
                                      disabled={downloadingPdf}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[11px] font-bold transition-all inline-flex items-center gap-1"
                                      title="Descargar Acta de Rendición"
                                    >
                                      <Printer className="w-3 h-3" /> Rendición
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* SUBTAB 3: LIBRO FISCAL DE COMPRAS MENORES (IVA DNIT) */}
                {reportSubTab === "fiscal" && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/60 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-100 dark:border-amber-900/50">
                      <div>
                        <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                          Libro Fiscal de Compras Menores y Crédito Fiscal IVA
                        </h4>
                        <p className="text-xs text-amber-700/80 dark:text-amber-400">
                          Discriminación de Facturas por Caja Chica: Bases 10%, 5%, Exentas y Liquidación de Impuesto DNIT / SET.
                        </p>
                      </div>
                      <button
                        onClick={handleDownloadFiscalPdf}
                        disabled={downloadingPdf}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-amber-500/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                      >
                        {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        Descargar Libro Compras Fiscal PDF (A4 Landscape)
                      </button>
                    </div>

                    {loadingReport ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      </div>
                    ) : reportFiscalData ? (
                      <div className="space-y-5">
                        {/* KPI Cards Fiscales */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Compras</span>
                            <p className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                              {formatPYG(reportFiscalData.total_general)}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {reportFiscalData.items?.length || 0} comprobantes
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Crédito IVA 10%</span>
                            <p className="text-lg font-black font-mono text-emerald-900 dark:text-emerald-100 mt-1">
                              {formatPYG(reportFiscalData.total_iva_10)}
                            </p>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Gravada: {formatPYG(reportFiscalData.total_gravada_10)}
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase">Crédito IVA 5%</span>
                            <p className="text-lg font-black font-mono text-blue-900 dark:text-blue-100 mt-1">
                              {formatPYG(reportFiscalData.total_iva_5)}
                            </p>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Canasta básica</span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Exentas / No Gravadas</span>
                            <p className="text-lg font-black font-mono text-slate-700 dark:text-slate-300 mt-1">
                              {formatPYG(reportFiscalData.total_exentas)}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">Combustibles / tasas</span>
                          </div>
                        </div>

                        {/* Tabla Fiscal */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                <th className="p-2.5">Fecha</th>
                                <th className="p-2.5">RUC</th>
                                <th className="p-2.5">Proveedor</th>
                                <th className="p-2.5">N° Factura</th>
                                <th className="p-2.5">Timbrado</th>
                                <th className="p-2.5">Sector</th>
                                <th className="p-2.5 text-right">Gravada 10%</th>
                                <th className="p-2.5 text-right">IVA 10%</th>
                                <th className="p-2.5 text-right">Exentas</th>
                                <th className="p-2.5 text-right">Total (Gs.)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {reportFiscalData.items?.map((it: any) => (
                                <tr key={it.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="p-2.5 font-mono text-[11px] text-slate-500">{it.fecha}</td>
                                  <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">{it.ruc}</td>
                                  <td className="p-2.5 font-semibold text-slate-900 dark:text-white max-w-[150px] truncate">{it.proveedor}</td>
                                  <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">{it.numero_factura}</td>
                                  <td className="p-2.5 font-mono text-[11px] text-slate-500">{it.timbrado}</td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-300">{it.sector}</td>
                                  <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{formatPYG(it.gravada_10)}</td>
                                  <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatPYG(it.iva_10)}</td>
                                  <td className="p-2.5 text-right font-mono text-slate-500">{formatPYG(it.exentas)}</td>
                                  <td className="p-2.5 text-right font-mono font-black text-slate-900 dark:text-white">{formatPYG(it.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* SUBTAB 4: GENERADOR DE RENDICIÓN Y REPOSICIÓN OFICIAL */}
                {reportSubTab === "rendicion" && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileCheck className="w-5 h-5 text-indigo-600" /> Solicitud de Reposición y Rendición de Fondo Fijo
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Generá el acta impresa con la relación de comprobantes para que el custodio entregue a Tesorería y se libre el cheque o desembolso.
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadRendicionPdf()}
                          disabled={downloadingPdf || funds.length === 0}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                        >
                          {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                          Descargar Acta de Rendición PDF
                        </button>
                      </div>

                      {/* Selector de Fondo Fijo */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Seleccionar Caja Chica / Fondo Fijo del Sector:
                          </label>
                          <select
                            value={rendicionFundId || (funds[0]?.id || "")}
                            onChange={e => setRendicionFundId(e.target.value)}
                            className="input-field w-full text-xs font-semibold"
                          >
                            {funds.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.nombre} — Saldo Disp: {formatPYG(f.saldo_actual)} / Aut: {formatPYG(f.monto_autorizado)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Resumen del Fondo Seleccionado */}
                    {(() => {
                      const curFund = funds.find(f => f.id === (rendicionFundId || funds[0]?.id))
                      if (!curFund) return null
                      const aut = curFund.monto_autorizado || 0
                      const sal = curFund.saldo_actual || 0
                      const gast = aut - sal
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-500 uppercase">Fondo Autorizado</span>
                            <p className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                              {formatPYG(aut)}
                            </p>
                            <span className="text-[11px] text-slate-400">Límite asignado a {curFund.nombre}</span>
                          </div>

                          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">Saldo Actual en Gaveta</span>
                            <p className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-100 mt-1">
                              {formatPYG(sal)}
                            </p>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Disponible para gastos</span>
                          </div>

                          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase">Total a Reponer por Tesorería</span>
                            <p className="text-xl font-black font-mono text-rose-900 dark:text-rose-100 mt-1">
                              {formatPYG(gast)}
                            </p>
                            <span className="text-[11px] text-rose-600 dark:text-rose-400">Monto total de los comprobantes</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: REGISTRAR GASTO */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 animate-in fade-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ReceiptIcon className="w-5 h-5 text-indigo-600" /> {editingExpenseId ? "Editar Comprobante de Gasto" : "Registrar Comprobante de Gasto / Inversión"}
                </h3>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                  {editingExpenseId ? "✏️ Modificación de Comprobante Existente" : "📋 Paso 1 de 3 — Carga de Comprobante (quedará en estado Pendiente)"}
                </span>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Banner flujo 3 pasos */}
            <div className="flex items-center gap-1.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
              <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">1</span>
              <span>Registrar comprobante</span>
              <span className="text-indigo-400 mx-1">→</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold">2</span>
              <span className="text-slate-400">Aprobar</span>
              <span className="text-indigo-400 mx-1">→</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold">3</span>
              <span className="text-slate-400">Liquidar y asignar forma de pago</span>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              {/* Selector de Naturaleza / Destino */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-gray-700 dark:text-gray-300 block text-[11px] uppercase tracking-wider">
                  Destino del Comprobante:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev: any) => ({ ...prev, es_pago_proveedor: false, supplier_invoice_id: "" }))}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition ${
                      !form.es_pago_proveedor
                        ? "bg-rose-50 border-rose-400 text-rose-800 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200 font-bold shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-slate-50"
                    }`}
                  >
                    <ReceiptIcon className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <div className="text-xs">Gasto Operativo (OPEX)</div>
                      <div className="text-[10px] text-gray-500 font-normal">Limpieza, papelería, servicios, fletes</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((prev: any) => ({ ...prev, es_pago_proveedor: true }))}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition ${
                      form.es_pago_proveedor
                        ? "bg-purple-50 border-purple-400 text-purple-800 dark:bg-purple-950/40 dark:border-purple-700 dark:text-purple-200 font-bold shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-slate-50"
                    }`}
                  >
                    <Package className="w-4 h-4 text-purple-500 shrink-0" />
                    <div>
                      <div className="text-xs">Pago a Proveedor Mercadería</div>
                      <div className="text-[10px] text-gray-500 font-normal">Cuentas por Pagar (Compras reventa)</div>
                    </div>
                  </button>
                </div>

                {form.es_pago_proveedor && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5 animate-in fade-in">
                    <label className="font-bold text-purple-900 dark:text-purple-200 block text-[11px]">
                      Factura Comercial de Compra a Cancelar / Amortizar *
                    </label>
                    <select
                      className="input-field w-full text-xs font-medium bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-700"
                      value={form.supplier_invoice_id || ""}
                      onChange={e => {
                        const invId = e.target.value
                        const inv = pendingInvoices.find((i: any) => i.id === invId)
                        if (inv) {
                          setForm((prev: any) => ({
                            ...prev,
                            supplier_invoice_id: inv.id,
                            supplier_id: inv.supplier_id,
                            proveedor: inv.supplier_nombre || prev.proveedor,
                            numero_factura: inv.numero_factura || prev.numero_factura,
                            ruc: inv.ruc || prev.ruc,
                            timbrado: inv.timbrado || prev.timbrado,
                            monto: prev.monto && Number(prev.monto) > 0 ? prev.monto : String(inv.saldo_pendiente || inv.total),
                            descripcion: prev.descripcion || `Pago proveedor ${inv.supplier_nombre || ''} - Factura ${inv.numero_factura}`,
                          }))
                        } else {
                          setForm((prev: any) => ({ ...prev, supplier_invoice_id: "", supplier_id: "" }))
                        }
                      }}
                    >
                      <option value="">-- Seleccionar factura de compra pendiente (o cargar datos manualmente) --</option>
                      {pendingInvoices.map((inv: any) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.supplier_nombre || "Proveedor"} — Factura #{inv.numero_factura} (Saldo: {formatPYG(inv.saldo_pendiente || inv.total)})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400">
                      ℹ️ Al guardar, se amortizará la deuda comercial en Cuentas por Pagar y no afectará el total de Gasto Operativo (OPEX).
                    </p>
                  </div>
                )}
              </div>

              {/* Moneda y Montos */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Moneda de Facturación / Compra
                  </label>
                  <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setForm((prev: any) => ({ ...prev, moneda: "PYG", monto_brl: "" }))}
                      className={`px-3 py-1 rounded transition ${
                        form.moneda === "PYG" ? "bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white" : "text-slate-500"
                      }`}
                    >
                      🇵🇾 En Guaraníes (₲)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tc = Number(form.tipo_cambio) || 1350
                        const brlVal = form.monto ? (Number(form.monto) / tc).toFixed(2) : ""
                        setForm((prev: any) => ({ ...prev, moneda: "BRL", monto_brl: brlVal, tipo_cambio: String(tc) }))
                      }}
                      className={`px-3 py-1 rounded transition ${
                        form.moneda === "BRL" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500"
                      }`}
                    >
                      🇧🇷 En Reales (R$)
                    </button>
                  </div>
                </div>

                {form.moneda === "BRL" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                        Monto Final Reales (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Ej: 250.00"
                        className="input-field w-full text-xs font-mono font-bold text-right border-emerald-400 dark:border-emerald-600 text-emerald-600"
                        value={form.monto_brl || ""}
                        onChange={(e) => {
                          const brl = e.target.value
                          const tc = Number(form.tipo_cambio) || 1350
                          const pyg = Math.round(Number(brl) * tc)
                          setForm((prev: any) => ({ ...prev, monto_brl: brl, monto: String(pyg) }))
                        }}
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Cotización R$ (₲ / R$) *
                      </label>
                      <CurrencyInput
                        currency="PYG"
                        required
                        value={form.tipo_cambio || "1350"}
                        onChangeValue={(tc) => {
                          const validTc = tc || 1
                          const pyg = Math.round(Number(form.monto_brl || 0) * validTc)
                          setForm((prev: any) => ({ ...prev, tipo_cambio: String(validTc), monto: String(pyg) }))
                        }}
                        className="input-field w-full text-xs font-mono font-bold text-right"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Eq. Fiscal Guaraníes (₲)
                      </label>
                      <div className="input-field w-full text-xs font-mono font-black text-right bg-slate-100 dark:bg-slate-800 flex items-center justify-end px-3">
                        {formatPYG(Number(form.monto) || 0)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Monto Total (PYG) *</label>
                    <CurrencyInput
                      required
                      currency="PYG"
                      placeholder="ej: 150.000"
                      className="input-field w-full text-xs font-mono font-bold text-right"
                      value={form.monto}
                      onChangeValue={(num) => setForm({ ...form, monto: String(num) })}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Fecha de Emisión</label>
                <input
                  type="date"
                  className="input-field w-full text-xs font-mono"
                  value={form.fecha_gasto}
                  onChange={e => setForm({ ...form, fecha_gasto: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Descripción / Justificación del Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Compra de bolsas biodegradables para panadería"
                  className="input-field w-full text-xs"
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Categoría de Gasto</label>
                  <select
                    className="input-field w-full text-xs"
                    value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}
                  >
                    <option value="">Seleccionar Categoría...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Centro de Costo / Sector Imputado</label>
                  <select
                    className="input-field w-full text-xs"
                    value={form.cost_center_id}
                    onChange={e => setForm({ ...form, cost_center_id: e.target.value })}
                  >
                    <option value="">Seleccionar Sector...</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DATOS FISCALES DEL COMPROBANTE */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Datos Fiscales del Comprobante (SET / DNIT)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const m = Number(form.monto) || 0
                        setForm({ ...form, iva_10: m > 0 ? String(Math.round(m / 11)) : "", iva_5: "", exentas: "" })
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold"
                    >
                      Calcular IVA 10%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const m = Number(form.monto) || 0
                        setForm({ ...form, iva_5: m > 0 ? String(Math.round(m / 21)) : "", iva_10: "", exentas: "" })
                      }}
                      className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold"
                    >
                      Calcular IVA 5%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const m = Number(form.monto) || 0
                        setForm({ ...form, exentas: m > 0 ? String(m) : "", iva_10: "", iva_5: "" })
                      }}
                      className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold"
                    >
                      Exenta
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">Tipo de Comprobante</label>
                    <select
                      className="input-field w-full text-xs"
                      value={form.tipo_comprobante}
                      onChange={e => setForm({ ...form, tipo_comprobante: e.target.value })}
                    >
                      <option value="factura_contado">Factura Contado</option>
                      <option value="factura_credito">Factura Crédito</option>
                      <option value="autofactura">Autofactura</option>
                      <option value="boleta_resguardo">Boleta de Resguardo</option>
                      <option value="recibo_dinero">Recibo de Dinero</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">Proveedor / Beneficiario</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar proveedor por nombre o RUC..."
                        className="input-field w-full text-xs"
                        value={supplierSearch || form.proveedor}
                        onFocus={async () => {
                          if (suppliersList.length === 0) {
                            setLoadingSuppliers(true)
                            try {
                              const list = await api.purchases.listSuppliers()
                              setSuppliersList(list)
                            } catch {}
                            setLoadingSuppliers(false)
                          }
                          setSupplierDropdownOpen(true)
                        }}
                        onChange={async e => {
                          const q = e.target.value
                          setSupplierSearch(q)
                          setForm({ ...form, proveedor: q, ruc: "" })
                          setSupplierDropdownOpen(true)
                          if (q.length >= 2) {
                            setLoadingSuppliers(true)
                            try {
                              const list = await api.purchases.listSuppliers({ search: q })
                              setSuppliersList(list)
                            } catch {}
                            setLoadingSuppliers(false)
                          }
                        }}
                        onBlur={() => setTimeout(() => setSupplierDropdownOpen(false), 200)}
                      />
                      {supplierDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                          {loadingSuppliers && (
                            <div className="p-3 text-xs text-slate-400 flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                            </div>
                          )}
                          {!loadingSuppliers && suppliersList.length === 0 && (
                            <div className="p-3 text-xs text-slate-400">Sin resultados</div>
                          )}
                          {suppliersList
                            .filter(s => {
                              const q = (supplierSearch || "").toLowerCase()
                              if (!q) return true
                              return (
                                (s.razon_social || "").toLowerCase().includes(q) ||
                                (s.nombre_fantasia || "").toLowerCase().includes(q) ||
                                (s.ruc || "").includes(q)
                              )
                            })
                            .slice(0, 20)
                            .map(s => (
                              <button
                                key={s.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-xs border-b border-slate-100 dark:border-slate-800 last:border-0"
                                onMouseDown={() => {
                                  const nombre = s.razon_social || s.nombre_fantasia || ""
                                  setForm({ ...form, proveedor: nombre, ruc: s.ruc || "" })
                                  setSupplierSearch("")
                                  setSupplierDropdownOpen(false)
                                }}
                              >
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{s.razon_social || s.nombre_fantasia}</span>
                                {s.nombre_fantasia && s.razon_social && (
                                  <span className="ml-1 text-slate-400">({s.nombre_fantasia})</span>
                                )}
                                {s.ruc && <span className="ml-2 font-mono text-indigo-500 text-[10px]">RUC: {s.ruc}</span>}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">RUC (se completa al seleccionar)</label>
                    <input
                      type="text"
                      placeholder="ej: 80012345-6"
                      className="input-field w-full text-xs font-mono"
                      value={form.ruc}
                      onChange={e => setForm({ ...form, ruc: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">Timbrado Fiscal</label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="ej: 12345678"
                      className="input-field w-full text-xs font-mono"
                      value={form.timbrado}
                      onChange={e => setForm({ ...form, timbrado: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">N° Factura / Comprobante</label>
                    <input
                      type="text"
                      placeholder="ej: 001-001-0012345"
                      className="input-field w-full text-xs font-mono"
                      value={form.numero_factura}
                      onChange={e => setForm({ ...form, numero_factura: e.target.value })}
                    />
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">IVA 10% (PYG)</label>
                    <CurrencyInput
                      currency="PYG"
                      placeholder="ej: 13.636"
                      className="input-field w-full text-xs font-mono text-emerald-600 font-bold text-right"
                      value={form.iva_10}
                      onChangeValue={(num, formatted) => setForm({ ...form, iva_10: String(num) })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">IVA 5% (PYG)</label>
                    <CurrencyInput
                      currency="PYG"
                      placeholder="ej: 0"
                      className="input-field w-full text-xs font-mono text-teal-600 font-bold text-right"
                      value={form.iva_5}
                      onChangeValue={(num, formatted) => setForm({ ...form, iva_5: String(num) })}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">Exentas (PYG)</label>
                    <CurrencyInput
                      currency="PYG"
                      placeholder="ej: 0"
                      className="input-field w-full text-xs font-mono text-right"
                      value={form.exentas}
                      onChangeValue={(num, formatted) => setForm({ ...form, exentas: String(num) })}
                    />
                  </div>
                </div>
              </div>

              {/* CLASIFICACIÓN CONTABLE: GASTO VS INVERSIÓN (ACTIVO FIJO) */}
              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <div>
                      <span className="font-bold text-purple-900 dark:text-purple-300 text-xs block">
                        Clasificación Contable: ¿Es Inversión / Activo Fijo?
                      </span>
                      <span className="text-[10px] text-purple-700 dark:text-purple-400">
                        Marcar si se adquiere un bien de uso que se amortizará en varios meses (ej: maquinarias, computadoras, estanterías).
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="es_inversion_chk"
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    checked={form.es_inversion}
                    onChange={e => setForm({ ...form, es_inversion: e.target.checked })}
                  />
                </div>

                {form.es_inversion && (
                  <div className="space-y-2.5 pt-2 border-t border-purple-200/60 dark:border-purple-800/60 animate-in fade-in">
                    <p className="text-[10px] text-purple-800 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-900/40 p-2 rounded-lg font-medium">
                      ✓ Al aprobarse y reponerse esta rendición, el sistema dará de alta automáticamente este ítem en el módulo contable de <strong>Activos Fijos (Cta 1.2.01 Bienes de Uso)</strong> para su amortización acumulada.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 block mb-1">Nombre del Activo Fijo *</label>
                        <input
                          type="text"
                          required={form.es_inversion}
                          placeholder="ej: Cortadora de Fiambre Marani 300mm"
                          className="input-field w-full text-xs"
                          value={form.asset_nombre}
                          onChange={e => setForm({ ...form, asset_nombre: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 block mb-1">Código Interno / Placa (Opcional)</label>
                        <input
                          type="text"
                          placeholder="ej: AF-PAN-004"
                          className="input-field w-full text-xs font-mono"
                          value={form.asset_codigo_interno}
                          onChange={e => setForm({ ...form, asset_codigo_interno: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 block mb-1">Categoría del Bien</label>
                        <select
                          className="input-field w-full text-xs"
                          value={form.asset_categoria}
                          onChange={e => {
                            const cat = e.target.value
                            let vida = 60
                            if (cat === "maquinarias_equipos" || cat === "muebles_equipos" || cat === "instalaciones") vida = 120
                            if (cat === "equipos_informatica") vida = 48
                            if (cat === "vehiculos") vida = 60
                            setForm({ ...form, asset_categoria: cat, asset_vida_util_meses: vida })
                          }}
                        >
                          <option value="maquinarias_equipos">Maquinarias y Equipos (10 años / 120m)</option>
                          <option value="muebles_equipos">Muebles y Útiles (10 años / 120m)</option>
                          <option value="equipos_informatica">Equipos de Informática (4 años / 48m)</option>
                          <option value="vehiculos">Vehículos y Rodados (5 años / 60m)</option>
                          <option value="instalaciones">Instalaciones y Mejoras (10 años / 120m)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 dark:text-purple-300 block mb-1">Vida Útil Estimada (Meses)</label>
                        <input
                          type="number"
                          placeholder="ej: 60"
                          className="input-field w-full text-xs font-mono font-bold"
                          value={form.asset_vida_util_meses}
                          onChange={e => setForm({ ...form, asset_vida_util_meses: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Adjuntar Comprobante Físico */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="font-bold text-gray-700 dark:text-gray-300 block">
                  Comprobante Físico / Factura Digital (Foto o PDF)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={e => setComprobanteFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingComprobante}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2"
                >
                  {uploadingComprobante ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {uploadingComprobante ? "Subiendo Comprobante..." : editingExpenseId ? "Guardar Cambios" : "Guardar Comprobante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO FONDO FIJO */}
      {showFundForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-indigo-600" /> Crear Fondo Fijo / Caja Chica Descentralizada
              </h3>
              <button onClick={() => setShowFundForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFund} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Nombre de la Caja / Fondo *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Caja Chica Panadería / Salón Central"
                  className="input-field w-full text-xs"
                  value={fundForm.nombre}
                  onChange={e => setFundForm({ ...fundForm, nombre: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Monto Autorizado (PYG) *</label>
                  <CurrencyInput
                    required
                    currency="PYG"
                    placeholder="ej: 1.000.000"
                    className="input-field w-full text-xs font-mono font-bold text-right"
                    value={fundForm.monto_autorizado}
                    onChangeValue={(num, formatted) => setFundForm({ ...fundForm, monto_autorizado: String(num) })}
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Límite Máximo por Gasto (PYG)</label>
                  <CurrencyInput
                    currency="PYG"
                    placeholder="ej: 200.000"
                    className="input-field w-full text-xs font-mono text-right"
                    value={fundForm.monto_maximo_por_gasto}
                    onChangeValue={(num, formatted) => setFundForm({ ...fundForm, monto_maximo_por_gasto: String(num) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Centro de Costo / Sector Asignado</label>
                  <select
                    className="input-field w-full text-xs"
                    value={fundForm.cost_center_id}
                    onChange={e => setFundForm({ ...fundForm, cost_center_id: e.target.value })}
                  >
                    <option value="">Sin sector específico (Global)</option>
                    {costCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Custodio Responsable (Encargado)</label>
                  <input
                    type="text"
                    placeholder={user?.nombre || "Encargado de sector"}
                    className="input-field w-full text-xs"
                    value={fundForm.custodio_id}
                    onChange={e => setFundForm({ ...fundForm, custodio_id: e.target.value })}
                  />
                </div>
              </div>

              {/* OPCIÓN: DOTACIÓN INICIAL DESDE TESORERÍA */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                      Dotación Inicial de Efectivo
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Desembolsar de inmediato el efectivo a la apertura desde Bóveda Central o Banco.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="dotacion_chk"
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={fundForm.dotacion_inicial}
                    onChange={e => setFundForm({ ...fundForm, dotacion_inicial: e.target.checked })}
                  />
                </div>

                {fundForm.dotacion_inicial && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Medio de Desembolso</label>
                      <select
                        className="input-field w-full text-xs font-semibold"
                        value={fundForm.medio_dotacion}
                        onChange={e => setFundForm({ ...fundForm, medio_dotacion: e.target.value })}
                      >
                        <option value="EFECTIVO_BOVEDA">Efectivo Físico desde Bóveda Central (Gaveta)</option>
                        <option value="DEBITO_BANCARIO">Transferencia / Débito Bancario</option>
                      </select>
                    </div>

                    {fundForm.medio_dotacion === "EFECTIVO_BOVEDA" ? (
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Caja Bóveda de Origen</label>
                        <select
                          className="input-field w-full text-xs"
                          value={fundForm.caja_boveda_id}
                          onChange={e => setFundForm({ ...fundForm, caja_boveda_id: e.target.value })}
                        >
                          <option value="">Bóveda Central por defecto</option>
                          {cashRegisters.map(cr => (
                            <option key={cr.id} value={cr.id}>
                              {cr.nombre || `Caja ${cr.numero_caja}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Cuenta Bancaria de Origen</label>
                        <select
                          className="input-field w-full text-xs"
                          value={fundForm.bank_account_id}
                          onChange={e => setFundForm({ ...fundForm, bank_account_id: e.target.value })}
                        >
                          <option value="">Seleccionar cuenta bancaria...</option>
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.alias ? `[${b.alias}] ` : ""}{b.banco || "Banco"} — {b.numero_cuenta} ({formatPYG(b.saldo_actual || 0)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowFundForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-2">
                  Crear Fondo Fijo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REPOSICIÓN DE FONDO */}
      {showReplenishForm && replenishFund && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600" /> Reponer Fondo: {replenishFund.nombre}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Saldo actual: {formatPYG(replenishFund.saldo_actual)} de {formatPYG(replenishFund.monto_autorizado)}
                </p>
              </div>
              <button onClick={() => setShowReplenishForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReplenish} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Monto de Reposición (PYG) *</label>
                <CurrencyInput
                  required
                  currency="PYG"
                  placeholder="ej: 1.000.000"
                  className="input-field w-full text-xs font-mono font-bold text-right"
                  value={replenishForm.monto}
                  onChangeValue={(num, formatted) => setReplenishForm({ ...replenishForm, monto: String(num) })}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Cuenta Bancaria de Origen (Débito)</label>
                <select
                  className="input-field w-full text-xs"
                  value={replenishForm.bank_account_id}
                  onChange={e => setReplenishForm({ ...replenishForm, bank_account_id: e.target.value })}
                >
                  <option value="">Sin Débito Bancario Automático (Efectivo)</option>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.alias ? `[${b.alias}] ` : ""}{b.banco || "Banco"} — {b.numero_cuenta} ({formatPYG(b.saldo_actual || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">N° de Referencia / SIPAP</label>
                <input
                  type="text"
                  placeholder="ej: SIPAP-948293"
                  className="input-field w-full text-xs font-mono"
                  value={replenishForm.referencia}
                  onChange={e => setReplenishForm({ ...replenishForm, referencia: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowReplenishForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReplenish}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  {submittingReplenish && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar Reposición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ARQUEO DE CAJA */}
      {showCountForm && countingFund && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-indigo-600" /> Arqueo Físico: {countingFund.nombre}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Saldo en sistema: {formatPYG(countingFund.saldo_actual)}
                </p>
              </div>
              <button onClick={() => setShowCountForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {countResult ? (
              <div className="space-y-4 text-xs">
                <div className={`p-4 rounded-xl border ${
                  countResult.diferencia === 0
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200"
                    : "bg-amber-50 dark:bg-amber-900/20 border-amber-200"
                }`}>
                  <h4 className="font-bold text-sm mb-2">Resultado del Arqueo</h4>
                  <div className="space-y-1">
                    <p>Saldo Esperado: <strong className="font-mono">{formatPYG(countResult.saldo_esperado)}</strong></p>
                    <p>Monto Contado: <strong className="font-mono">{formatPYG(countResult.monto_contado)}</strong></p>
                    <p className={`font-bold ${countResult.diferencia === 0 ? "text-emerald-600" : "text-red-600"}`}>
                      Diferencia: {countResult.diferencia > 0 ? "+" : ""}{formatPYG(countResult.diferencia)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCountForm(false)}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitCount} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Monto Real Contado en Billetes/Monedas (PYG) *
                  </label>
                  <CurrencyInput
                    required
                    currency="PYG"
                    placeholder="ej: 850.000"
                    className="input-field w-full text-xs font-mono font-bold text-right"
                    value={countForm.monto_contado}
                    onChangeValue={(num, formatted) => setCountForm({ ...countForm, monto_contado: String(num) })}
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Observaciones de Auditoría</label>
                  <textarea
                    rows={2}
                    placeholder="ej: Faltante de 10.000 por comprobante pendiente de rendición"
                    className="input-field w-full text-xs"
                    value={countForm.observaciones}
                    onChange={e => setCountForm({ ...countForm, observaciones: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowCountForm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCount}
                    className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
                  >
                    {submittingCount && <Loader2 className="w-4 h-4 animate-spin" />}
                    Registrar Arqueo
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MOVIMIENTOS HISTÓRICOS DE FONDO */}
      {selectedFundMovements && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-indigo-600" /> Movimientos: {selectedFundMovements.fund.nombre}
                </h3>
                <p className="text-xs text-gray-400">Últimos comprobantes y reposiciones imputadas a este fondo</p>
              </div>
              <button onClick={() => setSelectedFundMovements(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {loadingMovements ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {selectedFundMovements.movements.map((m: any) => (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{m.descripcion || m.tipo}</p>
                      <p className="text-[11px] text-gray-400">
                        {m.created_at ? new Date(m.created_at).toLocaleString("es-PY") : "—"} · {m.tipo}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className={`font-bold text-sm ${m.monto < 0 ? "text-red-500" : "text-emerald-600"}`}>
                        {formatPYG(m.monto)}
                      </span>
                      <p className="text-[10px] text-gray-400">Saldo: {formatPYG(m.saldo_posterior)}</p>
                    </div>
                  </div>
                ))}
                {selectedFundMovements.movements.length === 0 && (
                  <p className="text-center py-8 text-xs text-gray-400">Sin movimientos registrados en este fondo.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: POLÍTICAS DE APROBACIÓN */}
      {showThresholdForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-600" /> Políticas de Aprobación & Auditoría
              </h3>
              <button onClick={() => setShowThresholdForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveApprovalThreshold} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Umbral de Aprobación Automática (PYG)
                </label>
                <p className="text-[11px] text-gray-400 mb-2">
                  Gastos con monto menor o igual se aprueban automáticamente sin requerir intervención de supervisión.
                </p>
                <CurrencyInput
                  required
                  currency="PYG"
                  placeholder="ej: 100.000"
                  className="input-field w-full text-xs font-mono font-bold text-right"
                  value={approvalThresholdForm}
                  onChangeValue={(num, formatted) => setApprovalThresholdForm(String(num))}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Tolerancia de Arqueo (PYG)
                </label>
                <p className="text-[11px] text-gray-400 mb-2">
                  Diferencias menores a este valor no disparan alerta roja de desvío en los arqueos.
                </p>
                <CurrencyInput
                  required
                  currency="PYG"
                  placeholder="ej: 5.000"
                  className="input-field w-full text-xs font-mono font-bold text-right"
                  value={toleranciaArqueoForm}
                  onChangeValue={(num, formatted) => setToleranciaArqueoForm(String(num))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowThresholdForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-2">
                  Guardar Políticas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA CATEGORÍA */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-600" /> Nueva Categoría de Gasto
              </h3>
              <button onClick={() => setShowCategoryForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Mantenimiento de Heladeras"
                  className="input-field w-full text-xs"
                  value={catForm.nombre}
                  onChange={e => setCatForm({ ...catForm, nombre: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="ej: Servicios técnicos y repuestos de frío"
                  className="input-field w-full text-xs"
                  value={catForm.descripcion}
                  onChange={e => setCatForm({ ...catForm, descripcion: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Presupuesto Mensual Máximo (PYG)</label>
                <CurrencyInput
                  currency="PYG"
                  placeholder="ej: 3.000.000"
                  className="input-field w-full text-xs font-mono font-bold text-right"
                  value={catForm.presupuesto_mensual}
                  onChangeValue={(num, formatted) => setCatForm({ ...catForm, presupuesto_mensual: String(num) })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCategoryForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-2">
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO CENTRO DE COSTO */}
      {showSectorForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" /> Nuevo Centro de Costo
              </h3>
              <button onClick={() => setShowSectorForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSector} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Nombre del Sector *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Carnicería / Fiambrería"
                  className="input-field w-full text-xs"
                  value={sectorForm.nombre}
                  onChange={e => setSectorForm({ ...sectorForm, nombre: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Tipo de Imputación</label>
                <select
                  className="input-field w-full text-xs"
                  value={sectorForm.tipo}
                  onChange={e => setSectorForm({ ...sectorForm, tipo: e.target.value })}
                >
                  <option value="sector">Sector Operativo (Gasto Directo)</option>
                  <option value="global">Gasto Global (Se prorratea entre todos los sectores)</option>
                </select>
              </div>

              {sectorForm.tipo === "sector" && (
                <div>
                  <label className="font-bold text-gray-700 dark:text-gray-300 block mb-1">Peso de Prorrateo</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="1"
                    className="input-field w-full text-xs font-mono font-bold"
                    value={sectorForm.peso_prorateo}
                    onChange={e => setSectorForm({ ...sectorForm, peso_prorateo: e.target.value })}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowSectorForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-2">
                  Guardar Centro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRESENTACIÓN DE RENDICIÓN DE CUENTAS (CUSTODIO) */}
      <RendicionCreateModal
        isOpen={showCreateRendicionModal}
        onClose={() => setShowCreateRendicionModal(false)}
        onSuccess={() => {
          setShowCreateRendicionModal(false)
          fetchRendiciones()
          fetchAll()
        }}
        funds={funds}
        initialFundId={rendicionCreateInitialFundId}
      />

      {/* MODAL: AUDITORÍA ITEM POR ITEM Y REPOSICIÓN (TESORERÍA) */}
      <RendicionAuditModal
        rendicionId={selectedRendicionForAuditId}
        isOpen={!!selectedRendicionForAuditId}
        onClose={() => setSelectedRendicionForAuditId(null)}
        onSuccess={() => {
          setSelectedRendicionForAuditId(null)
          fetchRendiciones()
          fetchAll()
        }}
        bankAccounts={bankAccounts}
        cashRegisters={cashRegisters}
      />

      {/* MODAL: LIQUIDACIÓN Y PAGO MULTIMEDIO DE GASTO OPERATIVO */}
      {paymentModalExpense && (
        <ExpensePaymentModal
          isOpen={!!paymentModalExpense}
          expense={paymentModalExpense}
          onClose={() => setPaymentModalExpense(null)}
          onSuccess={() => {
            setPaymentModalExpense(null)
            fetchAll()
          }}
        />
      )}
    </div>
  )
}
