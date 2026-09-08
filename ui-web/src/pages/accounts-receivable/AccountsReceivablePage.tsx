import { useState, useEffect } from "react"
import {
  Search, ReceiptText, Clock, AlertTriangle, DollarSign, FileText, Loader2,
  Calendar, Eye, X, Package, Wallet, Sparkles, PhoneCall, CreditCard, Plus,
  TrendingUp, FileSpreadsheet, FileDown, CheckCircle2, ChevronDown, ChevronRight,
  User, Check, Phone, ArrowUpRight, ShieldCheck, RefreshCw, BarChart2,
  Printer, QrCode, ExternalLink, CheckSquare, Square, Building2, Building,
  Users, Send, Landmark, ArrowRight, DownloadCloud, FileCheck, Layers, Filter
} from "lucide-react"
import { api, type AccountsReceivable, type Sale, type SaleItem, type CreditAccount } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatPercentage } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

type TabType = "documentos" | "aging" | "scoring" | "recibos" | "empresas_vinculadas" | "reportes"


interface CustomerScore {
  id: string
  customer_id: string
  customer_nombre: string | null
  score: number
  pago_puntual: number
  dias_mora_promedio: number
  antiguedad_dias: number
  total_compras: number
  total_pagos: number
  veces_mora: number
  ultima_actualizacion: string | null
}

interface AgingData {
  total_pendiente: number
  cantidad_documentos: number
  buckets: { rango: string; monto: number; cantidad: number; porcentaje: number }[]
  por_clientes: {
    customer_id: string
    customer_name: string
    customer_ruc?: string
    customer_telefono?: string
    saldo_total: number
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_91_plus: number
    total_documentos: number
  }[]
}

interface SummaryData {
  total: number
  total_pendiente: number
  pagados: number
  pendientes: number
  vencidos: number
  monto_vencido: number
  dso?: number | null
}

interface PendingDoc {
  id: string
  numero_documento: string
  fecha_emision: string
  fecha_vencimiento: string | null
  moneda: string
  monto_original: number
  saldo_pendiente: number
  dias_mora: number
}

interface CollectionAction {
  id: string
  tipo: string
  resultado?: string | null
  notas?: string | null
  fecha: string
  contacto?: string | null
  proximo_contacto?: string | null
  compromiso_pago?: string | null
  monto_comprometido?: number | null
}

export default function AccountsReceivablePage() {
  const [tab, setTab] = useState<TabType>("documentos")
  const [docs, setDocs] = useState<AccountsReceivable[]>([])
  const [aging, setAging] = useState<AgingData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [scores, setScores] = useState<CustomerScore[]>([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<AccountsReceivable | null>(null)
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<SaleItem[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [docPayments, setDocPayments] = useState<{ id: string; fecha: string; forma_pago: string | null; referencia: string | null; monto: number }[]>([])
  const [customerDocs, setCustomerDocs] = useState<AccountsReceivable[]>([])

  // Recibos e Historial de Cobros
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  // Reportes exportables (Aging / Cobranzas / Deuda Detallada)
  const [reportFechaDesde, setReportFechaDesde] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [reportFechaHasta, setReportFechaHasta] = useState(() => new Date().toISOString().split("T")[0])
  const [reportCustomerId, setReportCustomerId] = useState<string>("")
  const [reportCustomerName, setReportCustomerName] = useState<string>("")
  const [reportEmpresaVinculada, setReportEmpresaVinculada] = useState<string>("")
  const [showReportModal, setShowReportModal] = useState(false)

  // Typeahead del modal de reporte
  const [customerSearchInput, setCustomerSearchInput] = useState("")
  const [customerSearchResults, setCustomerSearchResults] = useState<{ id: string; razon_social: string; ruc?: string }[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [empresaSearchInput, setEmpresaSearchInput] = useState("")
  const [empresaSearchResults, setEmpresaSearchResults] = useState<string[]>([])
  const [empresaSearchOpen, setEmpresaSearchOpen] = useState(false)
  const [empresaSearchLoading, setEmpresaSearchLoading] = useState(false)

  // Registrar pago & Cobro Global FIFO
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null)
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [payMontoGlobal, setPayMontoGlobal] = useState<string>("")
  const [selectedBatchDocs, setSelectedBatchDocs] = useState<Record<string, boolean>>({})
  const [completedReceipt, setCompletedReceipt] = useState<{ id: string; numero_recibo: string; monto_total: number; documentos_afectados: number } | null>(null)
  const [payFormaPago, setPayFormaPago] = useState("efectivo")
  const [payReferencia, setPayReferencia] = useState("")
  const [payFecha, setPayFecha] = useState(() => new Date().toISOString().split("T")[0])
  const [payObservaciones, setPayObservaciones] = useState("")
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // 🏛️ Tesorería, Bóveda y Bancos
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [payDestinoFondos, setPayDestinoFondos] = useState<"boveda" | "caja">("boveda")
  const [payBankAccountId, setPayBankAccountId] = useState("")
  const [payChequeNumero, setPayChequeNumero] = useState("")
  const [payChequeBanco, setPayChequeBanco] = useState("")
  const [payChequeLibrador, setPayChequeLibrador] = useState("")
  const [payChequeRuc, setPayChequeRuc] = useState("")
  const [payChequeFechaEmision, setPayChequeFechaEmision] = useState(() => new Date().toISOString().split("T")[0])
  const [payChequeFechaCobro, setPayChequeFechaCobro] = useState(() => new Date().toISOString().split("T")[0])

  // ⚡ Modal de Inicio Rápido de Cobro (Cabecera)
  const [showQuickCobroModal, setShowQuickCobroModal] = useState(false)
  const [quickCustomerSearch, setQuickCustomerSearch] = useState("")
  const [quickCustomerResults, setQuickCustomerResults] = useState<any[]>([])
  const [quickCustomerLoading, setQuickCustomerLoading] = useState(false)
  const [paymentCustomerInfo, setPaymentCustomerInfo] = useState<{ razon_social: string; ruc?: string; empresa_vinculada?: string } | null>(null)

  // 🏢 Convenios Corporativos y Nóminas (Empresas Vinculadas)
  const [agreements, setAgreements] = useState<any[]>([])
  const [agreementsLoading, setAgreementsLoading] = useState(false)
  const [selectedEmpresa, setSelectedEmpresa] = useState<string | null>(null)
  const [empresaPending, setEmpresaPending] = useState<any | null>(null)
  const [empresaPendingLoading, setEmpresaPendingLoading] = useState(false)
  const [remissions, setRemissions] = useState<any[]>([])
  const [remissionsLoading, setRemissionsLoading] = useState(false)
  const [showRemitModal, setShowRemitModal] = useState(false)
  const [remitPeriodo, setRemitPeriodo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [remitNotas, setRemitNotas] = useState("")
  const [remitting, setRemitting] = useState(false)
  const [showPayRemissionModal, setShowPayRemissionModal] = useState<any | null>(null)
  const [payRemForm, setPayRemForm] = useState({
    monto: "",
    forma_pago: "transferencia",
    bank_account_id: "",
    referencia: "",
    fecha_pago: new Date().toISOString().split("T")[0],
    notas: "",
  })
  const [payingRemission, setPayingRemission] = useState(false)

  // 📊 Filtros en línea del Centro de Reportes
  const [repAgingDesde, setRepAgingDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]
  })
  const [repAgingHasta, setRepAgingHasta] = useState(() => new Date().toISOString().split("T")[0])
  const [repCobranzasDesde, setRepCobranzasDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]
  })
  const [repCobranzasHasta, setRepCobranzasHasta] = useState(() => new Date().toISOString().split("T")[0])
  const [repEmpresaExtracto, setRepEmpresaExtracto] = useState("")
  const [repPeriodoExtracto, setRepPeriodoExtracto] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [repSelectedRemissionId, setRepSelectedRemissionId] = useState("")
  const [repCustomerEstadoCuenta, setRepCustomerEstadoCuenta] = useState<{ id: string; razon_social: string; ruc?: string } | null>(null)
  const [repCustSearchInput, setRepCustSearchInput] = useState("")
  const [repCustSearchResults, setRepCustSearchResults] = useState<any[]>([])
  const [repCustSearchOpen, setRepCustSearchOpen] = useState(false)
  const [repCustSearchLoading, setRepCustSearchLoading] = useState(false)
  const [repLoadingCard, setRepLoadingCard] = useState<string | null>(null)

  // Cobranzas + linea de credito
  const [collectionActions, setCollectionActions] = useState<CollectionAction[]>([])
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null)
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [collectionForm, setCollectionForm] = useState({ tipo: "llamada", resultado: "", notas: "", contacto: "", proximo_contacto: "", compromiso_pago: "", monto_comprometido: "" })


  const toast = useToast()

  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const [docsTotal, setDocsTotal] = useState(0)

  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Buscador de cliente (typeahead) del modal de reporte
  useEffect(() => {
    if (!customerSearchInput.trim()) { setCustomerSearchResults([]); return }
    setCustomerSearchLoading(true)
    const t = setTimeout(() => {
      api.customers.list({ search: customerSearchInput.trim(), limit: 20 })
        .then(rows => setCustomerSearchResults(rows.map(r => ({ id: r.id, razon_social: r.razon_social || "Cliente sin nombre", ruc: r.ruc }))))
        .catch(() => setCustomerSearchResults([]))
        .finally(() => setCustomerSearchLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearchInput])

  // Buscador de empresa vinculada (typeahead) del modal de reporte
  useEffect(() => {
    if (!empresaSearchInput.trim()) { setEmpresaSearchResults([]); return }
    setEmpresaSearchLoading(true)
    const t = setTimeout(() => {
      api.accountsReceivable.searchEmpresasVinculadas(empresaSearchInput.trim())
        .then(rows => setEmpresaSearchResults(rows))
        .catch(() => setEmpresaSearchResults([]))
        .finally(() => setEmpresaSearchLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [empresaSearchInput])

  // Cargar cuentas bancarias activas para cobro en tesorería
  useEffect(() => {
    api.accountsReceivable.listBanks()
      .then(rows => {
        setBankAccounts(rows || [])
        if (rows && rows.length > 0) setPayBankAccountId(rows[0].id)
      })
      .catch(() => setBankAccounts([]))
  }, [])

  // Buscador rápido de clientes para el modal de cabecera "Registrar Cobro"
  useEffect(() => {
    if (!quickCustomerSearch.trim()) { setQuickCustomerResults([]); return }
    setQuickCustomerLoading(true)
    const t = setTimeout(() => {
      api.customers.list({ search: quickCustomerSearch.trim(), limit: 15 })
        .then(rows => setQuickCustomerResults(rows))
        .catch(() => setQuickCustomerResults([]))
        .finally(() => setQuickCustomerLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [quickCustomerSearch])

  // Buscador de cliente para Reporte "Estado de Cuenta"
  useEffect(() => {
    if (!repCustSearchInput.trim()) { setRepCustSearchResults([]); return }
    setRepCustSearchLoading(true)
    const t = setTimeout(() => {
      api.customers.list({ search: repCustSearchInput.trim(), limit: 15 })
        .then(rows => setRepCustSearchResults(rows))
        .catch(() => setRepCustSearchResults([]))
        .finally(() => setRepCustSearchLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [repCustSearchInput])

  // Carga de Convenios y Remisiones al entrar a la pestaña
  const fetchAgreements = async () => {
    setAgreementsLoading(true)
    try {
      const data = await api.accountsReceivable.corporateAgreementsSummary()
      setAgreements(data || [])
    } catch {
      toast.error("Error", "No se pudieron cargar los convenios de empresas vinculadas")
    } finally {
      setAgreementsLoading(false)
    }
  }

  const fetchRemissions = async () => {
    setRemissionsLoading(true)
    try {
      const data = await api.accountsReceivable.listCorporateRemissions()
      setRemissions(data || [])
    } catch {
      toast.error("Error", "No se pudieron cargar las remisiones corporativas")
    } finally {
      setRemissionsLoading(false)
    }
  }

  const handleSelectEmpresa = async (empresaNombre: string) => {
    setSelectedEmpresa(empresaNombre)
    setEmpresaPendingLoading(true)
    try {
      const data = await api.accountsReceivable.corporateAgreementPendingDocs(empresaNombre)
      setEmpresaPending(data)
    } catch {
      toast.error("Error", "No se pudieron cargar los documentos pendientes de la empresa")
    } finally {
      setEmpresaPendingLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "empresas_vinculadas") {
      fetchAgreements()
      fetchRemissions()
    }
  }, [tab])

  const handleExecuteRemit = async () => {
    if (!selectedEmpresa) return
    setRemitting(true)
    try {
      const res = await api.accountsReceivable.createCorporateRemission({
        empresa_vinculada_nombre: selectedEmpresa,
        periodo_mes: remitPeriodo,
        notas: remitNotas || undefined,
      })
      toast.success(
        "Corte y Remisión ejecutada con éxito",
        `Lote ${res.numero_remision} emitido. Se liberó la línea de crédito de ${res.cantidad_funcionarios} funcionarios socios Extra Club.`
      )
      setShowRemitModal(false)
      setRemitNotas("")
      fetchAgreements()
      fetchRemissions()
      handleSelectEmpresa(selectedEmpresa)
      fetchData()
    } catch (e: any) {
      toast.error("Error al ejecutar corte", e.message || "Ocurrió un error al procesar la remisión")
    } finally {
      setRemitting(false)
    }
  }

  const handlePayRemission = async () => {
    if (!showPayRemissionModal) return
    const monto = parseFloat(payRemForm.monto)
    if (!monto || monto <= 0) {
      toast.error("Monto requerido", "Ingresá un monto válido pagado por la empresa")
      return
    }
    setPayingRemission(true)
    try {
      const res = await api.accountsReceivable.payCorporateRemission(showPayRemissionModal.id, {
        monto,
        forma_pago: payRemForm.forma_pago,
        bank_account_id: payRemForm.bank_account_id || undefined,
        referencia: payRemForm.referencia || undefined,
        fecha_pago: payRemForm.fecha_pago || undefined,
        notas: payRemForm.notas || undefined,
      })
      toast.success("Pago de empresa registrado", `Se canceló ${formatPYG(monto)} del saldo adeudado por la empresa (${res.estado})`)
      setShowPayRemissionModal(null)
      fetchRemissions()
      fetchAgreements()
      fetchData()
    } catch (e: any) {
      toast.error("Error al registrar pago", e.message || "No se pudo registrar el pago de la remisión")
    } finally {
      setPayingRemission(false)
    }
  }


  const fetchData = async () => {
    setLoading(true)
    try {
      const estadoParam = filterStatus !== "todos" ? filterStatus : undefined
      const [docsData, countData, agingData, summaryData] = await Promise.all([
        api.accountsReceivable.list({ estado: estadoParam, search: debouncedSearch.trim() || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        api.accountsReceivable.count({ estado: estadoParam }),
        api.accountsReceivable.aging(),
        api.accountsReceivable.summary(),
      ])
      setDocs(docsData)
      setDocsTotal(countData.total)
      setAging(agingData)
      setSummary(summaryData)
    } catch {
      setDocs([])
      setDocsTotal(0)
      setAging(null)
      setSummary(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { setPage(0) }, [filterStatus, debouncedSearch])
  useEffect(() => { fetchData() }, [filterStatus, page, debouncedSearch])

  const fetchScoring = async () => {
    setScoresLoading(true)
    try {
      const data = await api.integratedFinance.listCustomerScores(COMPANY_ID)
      setScores(data)
    } catch {
      toast.error("Error", "No se pudieron cargar los scores de crédito")
    } finally {
      setScoresLoading(false)
    }
  }

  useEffect(() => {
    if (tab === "scoring" && scores.length === 0) fetchScoring()
  }, [tab])

  const openInvoice = async (doc: AccountsReceivable) => {
    setSelectedDoc(doc)
    setInvoiceSale(null)
    setInvoiceItems([])
    setDocPayments([])
    api.accountsReceivable.documentPayments(doc.id).then(setDocPayments).catch(() => setDocPayments([]))
    if (!doc.sale_id) return
    setInvoiceLoading(true)
    try {
      const [sale, items] = await Promise.all([
        api.sales.get(doc.sale_id),
        api.sales.items(doc.sale_id),
      ])
      setInvoiceSale(sale)
      setInvoiceItems(items)
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la factura")
    } finally {
      setInvoiceLoading(false)
    }
  }

  const openCustomer = async (customerId: string) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null)
      return
    }
    setExpandedCustomer(customerId)
    setCollectionActions([])
    setCreditAccount(null)
    setCustomerDocs([])
    api.integratedFinance.listCollectionActions(COMPANY_ID, customerId).then(setCollectionActions).catch(() => setCollectionActions([]))
    api.creditAccounts.getByCustomer(customerId).then(setCreditAccount).catch(() => setCreditAccount(null))
    api.accountsReceivable.list({ customer_id: customerId, limit: 500 }).then(setCustomerDocs).catch(() => setCustomerDocs([]))
  }

  const openPaymentModal = async (customerId: string, custInfo?: { razon_social: string; ruc?: string; empresa_vinculada?: string }) => {
    setShowPaymentModal(customerId)
    if (custInfo) {
      setPaymentCustomerInfo(custInfo)
    } else {
      // Intentar obtener datos del cliente si no vinieron
      const foundDoc = docs.find(d => (d.customer_id === customerId || (d as any).customer?.id === customerId))
      if (foundDoc) {
        setPaymentCustomerInfo({
          razon_social: foundDoc.customer_name || (foundDoc as any).customer?.razon_social || "Cliente",
          ruc: foundDoc.customer_ruc || (foundDoc as any).customer?.ruc,
          empresa_vinculada: (foundDoc as any).customer?.empresa_vinculada_nombre,
        })
      } else {
        setPaymentCustomerInfo(null)
      }
    }
    setAllocations({})
    setPayMontoGlobal("")
    setSelectedBatchDocs({})
    setPayReferencia("")
    setPayObservaciones("")
    setPayDestinoFondos("boveda")
    if (bankAccounts.length > 0 && !payBankAccountId) {
      setPayBankAccountId(bankAccounts[0].id)
    }
    setPayChequeNumero("")
    setPayChequeBanco("")
    setPayChequeLibrador(custInfo?.razon_social || "")
    setPayChequeRuc(custInfo?.ruc || "")
    setPayChequeFechaEmision(new Date().toISOString().split("T")[0])
    setPayChequeFechaCobro(new Date().toISOString().split("T")[0])

    setPendingLoading(true)
    try {
      const docs = await api.accountsReceivable.pendingForCustomer(customerId)
      setPendingDocs(docs)
      const initBatch: Record<string, boolean> = {}
      docs.forEach(d => { initBatch[d.id] = true })
      setSelectedBatchDocs(initBatch)
    } catch {
      toast.error("Error", "No se pudieron cargar los documentos pendientes")
      setPendingDocs([])
    } finally {
      setPendingLoading(false)
    }
  }

  const montoTotalPago = Object.values(allocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)

  const handleDistribuirFifo = (montoInput?: number) => {
    const total = montoInput !== undefined ? montoInput : parseFloat(payMontoGlobal) || 0
    if (total <= 0) {
      toast.error("Monto requerido", "Ingresá el monto que abonó el cliente para distribuirlo en cascada.")
      return
    }
    let restante = total
    const nuevas: Record<string, string> = {}
    const docsFiltrados = pendingDocs.filter(d => selectedBatchDocs[d.id] !== false)

    for (const d of docsFiltrados) {
      if (restante <= 0) break
      const saldo = d.saldo_pendiente || 0
      const aplicar = Math.min(restante, saldo)
      if (aplicar > 0) {
        nuevas[d.id] = String(aplicar)
        restante -= aplicar
      }
    }
    setAllocations(nuevas)
    setPayMontoGlobal(String(total))
  }

  const handleToggleDocBatch = (id: string) => {
    const nextState = { ...selectedBatchDocs, [id]: !selectedBatchDocs[id] }
    setSelectedBatchDocs(nextState)
    const total = parseFloat(payMontoGlobal) || 0
    if (total > 0) {
      let restante = total
      const nuevas: Record<string, string> = {}
      const docsFiltrados = pendingDocs.filter(d => nextState[d.id] !== false)
      for (const d of docsFiltrados) {
        if (restante <= 0) break
        const aplicar = Math.min(restante, d.saldo_pendiente || 0)
        if (aplicar > 0) {
          nuevas[d.id] = String(aplicar)
          restante -= aplicar
        }
      }
      setAllocations(nuevas)
    }
  }

  const handleSubmitPayment = async () => {
    if (!showPaymentModal) return
    const allocs = Object.entries(allocations).filter(([, v]) => parseFloat(v) > 0).map(([id, v]) => ({ accounts_receivable_id: id, monto: parseFloat(v) }))
    if (allocs.length === 0) { toast.error("Error", "Asigná o distribuí un monto a al menos una factura"); return }
    setSubmittingPayment(true)
    try {
      const selectedDocIds = Object.keys(allocations).filter(id => (parseFloat(allocations[id]) || 0) > 0)
      const res = await api.accountsReceivable.applyGlobalPayment({
        customer_id: showPaymentModal,
        monto_total: montoTotalPago,
        forma_pago: payFormaPago,
        referencia: payReferencia || undefined,
        fecha: payFecha,
        observaciones: payObservaciones || undefined,
        accounts_receivable_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        bank_account_id: (payFormaPago === "transferencia" || payFormaPago === "pix" || payFormaPago === "qr") ? (payBankAccountId || undefined) : undefined,
        destino_fondos: payFormaPago === "efectivo" ? payDestinoFondos : undefined,
        cheque_numero: payFormaPago === "cheque" ? (payChequeNumero || undefined) : undefined,
        cheque_banco: payFormaPago === "cheque" ? (payChequeBanco || undefined) : undefined,
        cheque_librador: payFormaPago === "cheque" ? (payChequeLibrador || undefined) : undefined,
        cheque_ruc: payFormaPago === "cheque" ? (payChequeRuc || undefined) : undefined,
        cheque_fecha_emision: payFormaPago === "cheque" ? payChequeFechaEmision : undefined,
        cheque_fecha_cobro: payFormaPago === "cheque" ? payChequeFechaCobro : undefined,
      })

      toast.success("Pago registrado con éxito", `${formatPYG(montoTotalPago)} imputado en cascada FIFO`)
      setShowPaymentModal(null)
      fetchData()
      if (expandedCustomer) openCustomer(expandedCustomer)

      setCompletedReceipt({
        id: res.payment_id || res.id,
        numero_recibo: res.numero_recibo || `REC-${(res.payment_id || res.id).slice(0, 8).toUpperCase()}`,
        monto_total: montoTotalPago,
        documentos_afectados: res.documentos_afectados || allocs.length,
      })
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo registrar el pago")
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleCreateCollectionAction = async () => {
    if (!expandedCustomer) return
    try {
      await api.integratedFinance.createCollectionAction({
        company_id: COMPANY_ID, customer_id: expandedCustomer,
        receivable_id: selectedDoc?.id,
        tipo: collectionForm.tipo, resultado: collectionForm.resultado || undefined,
        notas: collectionForm.notas || undefined, contacto: collectionForm.contacto || undefined,
        proximo_contacto: collectionForm.proximo_contacto || undefined,
        compromiso_pago: collectionForm.compromiso_pago || undefined,
        monto_comprometido: collectionForm.monto_comprometido ? Number(collectionForm.monto_comprometido) : undefined,
      })
      toast.success("Gestión registrada")
      setShowCollectionForm(false)
      setCollectionForm({ tipo: "llamada", resultado: "", notas: "", contacto: "", proximo_contacto: "", compromiso_pago: "", monto_comprometido: "" })
      openCustomer(expandedCustomer)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo registrar la gestión")
    }
  }

  const handleRecalculateScoring = async () => {
    try {
      await api.integratedFinance.recalculateAllScores(COMPANY_ID)
      toast.success("Scoring actualizado", "Los puntajes de todos los clientes han sido recalculados")
      fetchScoring()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo recalcular el scoring")
    }
  }

  const reportParams = { fecha_desde: reportFechaDesde, fecha_hasta: reportFechaHasta }
  const agingReportParams = {
    ...reportParams,
    ...(reportCustomerId ? { customer_id: reportCustomerId } : {}),
    ...(reportEmpresaVinculada.trim() ? { empresa_vinculada: reportEmpresaVinculada.trim() } : {}),
  }
  const handleDownloadAgingExcel = () => api.accountsReceivable.downloadAgingExcel(agingReportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadAgingPdf = () => api.accountsReceivable.downloadAgingPdf(agingReportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadDeudaDetalladaPdf = () =>
    api.accountsReceivable.downloadDeudaDetalladaPdf({
      customer_id: reportCustomerId || undefined,
      empresa_vinculada: reportEmpresaVinculada.trim() || undefined,
      solo_con_saldo: true,
    }).catch((e: any) => toast.error("Error", e.message))

  const resetReportFilters = () => {
    setReportCustomerId("")
    setReportCustomerName("")
    setReportEmpresaVinculada("")
    setCustomerSearchInput("")
    setCustomerSearchResults([])
    setEmpresaSearchInput("")
    setEmpresaSearchResults([])
  }
  const handleDownloadCobranzasExcel = () => api.accountsReceivable.downloadCobranzasExcel(reportParams).catch((e: any) => toast.error("Error", e.message))
  const handleDownloadCobranzasPdf = () => api.accountsReceivable.downloadCobranzasPdf(reportParams).catch((e: any) => toast.error("Error", e.message))

  const filteredDocs = docs.filter(d => {
    if (!search) return true
    const q = search.toLowerCase().trim()
    const qClean = q.replace(/\D/g, "")
    const rucClean = (d.customer_ruc || "").replace(/\D/g, "")
    return (
      d.numero_documento?.toLowerCase().includes(q) ||
      d.customer_name?.toLowerCase().includes(q) ||
      d.customer_ruc?.toLowerCase().includes(q) ||
      (qClean.length > 0 && rucClean.includes(qClean))
    )
  })

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: "Excelente", class: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200" }
    if (score >= 60) return { label: "Bueno", class: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200" }
    if (score >= 40) return { label: "Regular", class: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200" }
    return { label: "Riesgoso", class: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200" }
  }

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <ReceiptText className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    FINANZAS & TESORERÍA · CUENTAS POR COBRAR (AR) & AGING
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    {summary?.pendientes || 0} Facturas por Cobrar
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Cuentas por Cobrar & Matriz Aging
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Líneas de crédito a clientes, scoring crediticio por morosidad, seguimiento de vencimientos y planillas de cobranza
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                💰 {formatPYG(summary?.total_pendiente || 0)} saldo pendiente
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                ⏱️ DSO: {summary?.dso != null ? `${summary.dso.toFixed(0)} días` : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => {
                setQuickCustomerSearch("")
                setQuickCustomerResults([])
                setShowQuickCobroModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-950/40 border border-emerald-400/30 ring-2 ring-emerald-500/20 active:scale-95"
              title="Registrar cobro directo de cliente con imputación bimonetaria / tesorería"
            >
              <Wallet className="w-4 h-4 text-emerald-100" />
              <span>Registrar Cobro</span>
            </button>
            <button
              onClick={() => { setRefreshing(true); fetchData(); if (tab === "scoring") fetchScoring(); }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button
              onClick={() => setTab("reportes")}
              className="px-3.5 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
              title="Acceder al Centro de Reportes Ejecutivos"
            >
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Centro de Reportes</span>
            </button>
            <button
              onClick={handleDownloadDeudaDetalladaPdf}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
              title="Descargar PDF con estética Arqueo y desglose detallado de facturas"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Deuda Detallada (PDF)</span>
            </button>
          </div>
        </div>


        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Pendiente</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(summary?.total_pendiente || 0)}
            </p>
            <p className="text-[11px] text-slate-400">{summary?.pendientes || 0} facturas por cobrar</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DSO Promedio</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {summary?.dso != null ? `${summary.dso.toFixed(0)}d` : "—"}
            </p>
            <p className="text-[11px] text-slate-400">Días venta pendientes</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Doc. Vencidos</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {summary?.vencidos || 0}
            </p>
            <p className="text-[11px] text-rose-400 font-bold">En mora activa</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monto Vencido</span>
              <Clock className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-rose-400">
              {formatPYG(summary?.monto_vencido || 0)}
            </p>
            <p className="text-[11px] text-slate-400">Cartera en riesgo</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Doc. Totales</span>
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {docsTotal.toLocaleString("es-PY")}
            </p>
            <p className="text-[11px] text-slate-400">{summary?.pagados || 0} cancelados</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "documentos", label: "Documentos por Cobrar", icon: ReceiptText, count: docsTotal },
          { key: "aging", label: "Matriz de Aging (Antigüedad)", icon: BarChart2, count: aging?.por_clientes?.length },
          { key: "scoring", label: "Scoring Crediticio & Riesgo", icon: ShieldCheck, count: scores.length },
          { key: "empresas_vinculadas", label: "Convenios & Nóminas", icon: Building2, count: agreements?.length },
          { key: "reportes", label: "Centro de Reportes", icon: Layers },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* TAB 1: DOCUMENTOS POR COBRAR */}
          {tab === "documentos" && (
            <div className="space-y-5">
              {/* Barra de Filtros */}
              <div className="card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-48">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Estado</label>
                    <select className="input-field w-full text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="todos">Todos los estados</option>
                      <option value="pendiente">Solo Pendientes</option>
                      <option value="pagado">Solo Pagados</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[240px]">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="N° factura, cliente, RUC..."
                        className="input-field pl-9 w-full text-xs"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Documentos */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                        <th className="p-3.5">Documento</th>
                        <th className="p-3.5">Cliente</th>
                        <th className="p-3.5">Emisión</th>
                        <th className="p-3.5">Vencimiento</th>
                        <th className="p-3.5">Monto Original</th>
                        <th className="p-3.5">Saldo Pendiente</th>
                        <th className="p-3.5">Mora</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                      {filteredDocs.map(d => {
                        const isMora = (d.dias_mora || 0) > 0 && d.estado === "pendiente"
                        return (
                          <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                              {d.numero_documento || "—"}
                            </td>
                            <td className="p-3.5 font-medium text-gray-900 dark:text-white max-w-xs truncate" title={d.customer_name}>
                              <div>{d.customer_name || "Cliente general"}</div>
                              {d.customer_ruc && (
                                <div className="text-[11px] font-mono text-gray-400 font-normal">CI/RUC: {d.customer_ruc}</div>
                              )}
                            </td>
                            <td className="p-3.5 text-xs text-gray-500 font-mono">
                              {d.fecha_emision ? new Date(d.fecha_emision).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 text-xs font-mono">
                              {d.fecha_vencimiento ? new Date(d.fecha_vencimiento).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                              {formatPYG(d.monto_original)}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                              {formatPYG(d.saldo_pendiente)}
                            </td>
                            <td className="p-3.5 text-xs font-mono font-semibold">
                              {isMora ? (
                                <span className="text-red-600">{d.dias_mora} días</span>
                              ) : d.estado === "pendiente" ? (
                                <span className="text-emerald-600">Al día</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                d.estado === "pagado"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200"
                                  : isMora
                                  ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200"
                              }`}>
                                {d.estado === "pagado" ? "Pagado" : isMora ? "Vencido" : "Pendiente"}
                              </span>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openInvoice(d)}
                                  className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Detalle
                                </button>
                                {d.estado === "pendiente" && d.customer_id && (
                                  <button
                                    onClick={() => openPaymentModal(d.customer_id!)}
                                    className="btn-primary py-1 px-2.5 text-xs"
                                  >
                                    Cobrar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
                  <span>Mostrando página {page + 1} de {Math.ceil(docsTotal / PAGE_SIZE) || 1}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="btn-outline py-1 px-3 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= docsTotal}
                      className="btn-outline py-1 px-3 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIZ DE AGING */}
          {tab === "aging" && (
            <div className="space-y-6">
              {/* Tarjetas de Buckets de Antigüedad */}
              {aging && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {aging.buckets.map((b, i) => {
                    const isMoraAlta = b.rango.includes("61-90") || b.rango.includes("+90")
                    return (
                      <div key={b.rango} className={`card p-5 ${isMoraAlta ? "border-red-200 dark:border-red-900/30 bg-red-50/10" : ""}`}>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{b.rango}</div>
                        <div className={`text-xl font-extrabold mt-1 font-mono ${isMoraAlta ? "text-red-600" : "text-gray-900 dark:text-white"}`}>
                          {formatPYG(b.monto)}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                          <span>{b.cantidad} facturas</span>
                          <span className="font-semibold">{b.porcentaje}% del total</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Tabla de Clientes con Deuda */}
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Desglose de Deuda por Cliente ({aging?.por_clientes?.length || 0})
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Hacé clic en un cliente para ver sus documentos y registrar gestiones</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                        <th className="p-3.5">Cliente</th>
                        <th className="p-3.5">Al Día</th>
                        <th className="p-3.5">1-30d</th>
                        <th className="p-3.5">31-60d</th>
                        <th className="p-3.5">61-90d</th>
                        <th className="p-3.5">+90d</th>
                        <th className="p-3.5">Saldo Total</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                      {aging?.por_clientes.map(c => {
                        const isExpanded = expandedCustomer === c.customer_id
                        return (
                          <>
                            <tr
                              key={c.customer_id}
                              onClick={() => openCustomer(c.customer_id)}
                              className={`cursor-pointer transition-colors ${isExpanded ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}
                            >
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                  <div>
                                    <div>{c.customer_name}</div>
                                    <div className="text-xs text-gray-400 font-mono font-normal">
                                      {c.customer_ruc ? `RUC: ${c.customer_ruc}` : ""} {c.customer_telefono ? `· Tel: ${c.customer_telefono}` : ""}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5 font-mono text-xs text-emerald-600 font-semibold">{c.current > 0 ? formatPYG(c.current) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-amber-600">{c.days_1_30 > 0 ? formatPYG(c.days_1_30) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-orange-600">{c.days_31_60 > 0 ? formatPYG(c.days_31_60) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-red-500 font-bold">{c.days_61_90 > 0 ? formatPYG(c.days_61_90) : "—"}</td>
                              <td className="p-3.5 font-mono text-xs text-red-700 font-black">{c.days_91_plus > 0 ? formatPYG(c.days_91_plus) : "—"}</td>
                              <td className="p-3.5 font-mono font-extrabold text-gray-900 dark:text-white">{formatPYG(c.saldo_total)}</td>
                              <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => api.accountsReceivable.downloadStatementPdf(c.customer_id)}
                                    className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1"
                                    title="Descargar Estado de Cuenta en PDF"
                                  >
                                    <FileDown className="w-3.5 h-3.5 text-red-500" /> Estado de Cuenta
                                  </button>
                                  <button
                                    onClick={() => openPaymentModal(c.customer_id)}
                                    className="btn-primary py-1 px-2.5 text-xs"
                                  >
                                    Cobrar
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Detalle Desplegable del Cliente */}
                            {isExpanded && (
                              <tr className="bg-gray-50/70 dark:bg-slate-800/40">
                                <td colSpan={8} className="p-5">
                                  <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
                                      <div className="flex items-center gap-4 text-xs">
                                        <span className="font-bold text-gray-700 dark:text-gray-300">Documentos del Cliente ({customerDocs.length})</span>
                                        {creditAccount && (
                                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold">
                                            Límite: {formatPYG(creditAccount.limite_credito)} (Disponible: {formatPYG(creditAccount.saldo_disponible)})
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => setShowCollectionForm(true)}
                                        className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1"
                                      >
                                        <PhoneCall className="w-3.5 h-3.5 text-primary" /> Registrar Gestión de Cobro
                                      </button>
                                    </div>

                                    {/* Lista de facturas de este cliente */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {customerDocs.map(d => (
                                        <div key={d.id} className="p-3 rounded-lg border bg-white dark:bg-slate-800 flex items-center justify-between text-xs">
                                          <div>
                                            <span className="font-mono font-bold text-gray-900 dark:text-white">{d.numero_documento}</span>
                                            <div className="text-gray-400 text-[11px] mt-0.5">
                                              Emisión: {d.fecha_emision} · Vence: {d.fecha_vencimiento}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-mono font-bold text-gray-900 dark:text-white">{formatPYG(d.saldo_pendiente)}</div>
                                            <span className={`text-[10px] font-semibold ${d.estado === "pagado" ? "text-emerald-600" : "text-amber-600"}`}>
                                              {d.estado === "pagado" ? "Pagado" : `${d.dias_mora || 0}d mora`}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Gestiones de Cobranza Registradas */}
                                    {collectionActions.length > 0 && (
                                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Historial de Gestiones de Cobro</h5>
                                        <div className="space-y-1.5">
                                          {collectionActions.map(act => (
                                            <div key={act.id} className="p-2.5 rounded bg-white dark:bg-slate-800 text-xs flex items-center justify-between">
                                              <div>
                                                <span className="font-semibold capitalize text-primary">{act.tipo}</span>: {act.resultado || act.notas || "Sin detalle"}
                                              </div>
                                              <span className="text-[11px] text-gray-400 font-mono">{act.fecha}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCORING & RIESGO */}
          {tab === "scoring" && (
            <div className="space-y-5">
              <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50/40 dark:from-slate-800/90 dark:to-slate-900 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-wider block">Evaluación Automatizada de Riesgo</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Scoring Crediticio de Clientes</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                    El puntaje se calcula analizando el porcentaje de pagos puntuales, promedio de días de atraso, volumen total comprado y frecuencia de pago.
                  </p>
                </div>
                <button
                  onClick={handleRecalculateScoring}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" /> Recalcular Scores
                </button>
              </div>

              <div className="card p-0 overflow-hidden">
                {scoresLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : scores.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No hay scores calculados aún. Hacé clic en "Recalcular Scores".</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">Cliente</th>
                          <th className="p-3.5">Score (1-100)</th>
                          <th className="p-3.5">Calificación</th>
                          <th className="p-3.5">Pago Puntual</th>
                          <th className="p-3.5">Mora Promedio</th>
                          <th className="p-3.5">Total Compras</th>
                          <th className="p-3.5">Total Pagos</th>
                          <th className="p-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {scores.map(s => {
                          const badge = getScoreBadge(s.score)
                          return (
                            <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                                {s.customer_nombre || "Cliente"}
                              </td>
                              <td className="p-3.5 font-mono font-extrabold text-base text-gray-900 dark:text-white">
                                {s.score}
                              </td>
                              <td className="p-3.5">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.class}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-xs">
                                <span className="font-bold text-emerald-600">{(s.pago_puntual * 100).toFixed(0)}%</span>
                              </td>
                              <td className="p-3.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                                {s.dias_mora_promedio > 0 ? `${s.dias_mora_promedio} días` : "0 días"}
                              </td>
                              <td className="p-3.5 font-mono font-semibold text-gray-900 dark:text-white">
                                {formatPYG(s.total_compras)}
                              </td>
                              <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                                {formatPYG(s.total_pagos)}
                              </td>
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={() => openPaymentModal(s.customer_id)}
                                  className="btn-outline py-1 px-2.5 text-xs"
                                >
                                  Cobrar
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EMPRESAS VINCULADAS & NÓMINAS */}
          {tab === "empresas_vinculadas" && (
            <div className="space-y-6">
              {/* Banner Explicativo de Convenio Corporativo */}
              <div className="card p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-indigo-500/20 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black tracking-widest uppercase">
                        CONVENIOS EXTRA CLUB · RETENCIÓN POR NÓMINA
                      </span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-indigo-400" />
                      Gestión Integral de Convenios con Empresas Vinculadas
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Los funcionarios socios de Extra Club compran a crédito personal vinculado a su empleador. Al finalizar el período, el supermercado genera los extractos masivos con talón de autorización de descuento y ejecuta el <strong>Corte y Remisión</strong>. En ese acto formal, la deuda se traspasa a la empresa vinculada y se <strong>libera inmediatamente la línea de crédito</strong> del funcionario.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch gap-2.5 self-start md:self-auto">
                    <button
                      onClick={() => { fetchAgreements(); fetchRemissions(); }}
                      disabled={agreementsLoading}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${agreementsLoading ? "animate-spin" : ""}`} />
                      <span>Actualizar Convenios</span>
                    </button>
                  </div>
                </div>

                {/* Métricas de Convenios */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Empresas con Convenio Activo</span>
                    <p className="text-xl font-black font-mono text-white mt-0.5">{agreements.length}</p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Funcionarios con Saldo</span>
                    <p className="text-xl font-black font-mono text-indigo-400 mt-0.5">
                      {agreements.reduce((sum, a) => sum + (a.cantidad_funcionarios || 0), 0)}
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total a Facturar / Remitir</span>
                    <p className="text-xl font-black font-mono text-amber-400 mt-0.5">
                      {formatPYG(agreements.reduce((sum, a) => sum + (a.total_saldo_pendiente || 0), 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabla de Empresas Vinculadas */}
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Building className="w-4 h-4 text-indigo-500" />
                      Planilla de Empresas Vinculadas con Consumos Pendientes
                    </h3>
                    <p className="text-xs text-gray-500">Seleccioná una empresa para auditar los vales individuales de sus empleados o generar el corte mensual.</p>
                  </div>
                </div>

                {agreementsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : agreements.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-xs">No hay empresas vinculadas con consumos pendientes de corte en este momento.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">Empresa Vinculada</th>
                          <th className="p-3.5">Funcionarios Activos</th>
                          <th className="p-3.5">Facturas / Vales</th>
                          <th className="p-3.5">Deuda Total Acumulada</th>
                          <th className="p-3.5 text-right">Acciones de Corte</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {agreements.map((a, idx) => {
                          const isSelected = selectedEmpresa === a.empresa_vinculada_nombre
                          return (
                            <tr
                              key={idx}
                              className={`transition-colors ${isSelected ? "bg-indigo-50/70 dark:bg-indigo-950/30" : "hover:bg-gray-50 dark:hover:bg-slate-800/50"}`}
                            >
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-indigo-500" />
                                  <span>{a.empresa_vinculada_nombre}</span>
                                </div>
                              </td>
                              <td className="p-3.5 font-mono font-semibold">
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200">
                                  {a.cantidad_funcionarios} funcionarios
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300">
                                {a.cantidad_documentos} vales
                              </td>
                              <td className="p-3.5 font-mono font-black text-sm text-gray-900 dark:text-white">
                                {formatPYG(a.total_saldo_pendiente)}
                              </td>
                              <td className="p-3.5 text-right space-x-2">
                                <button
                                  onClick={() => handleSelectEmpresa(a.empresa_vinculada_nombre)}
                                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                                    isSelected
                                      ? "bg-indigo-600 text-white"
                                      : "btn-outline text-indigo-600 dark:text-indigo-400"
                                  }`}
                                >
                                  {isSelected ? "Viendo Nómina" : "Ver Nómina"}
                                </button>
                                <button
                                  onClick={() => api.accountsReceivable.downloadExtractosEmpresaPdf(a.empresa_vinculada_nombre, remitPeriodo)}
                                  className="py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition inline-flex items-center gap-1"
                                  title="Descargar Extractos Masivos de Funcionarios con Talón de Conformidad"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                  <span>Extractos (PDF)</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedEmpresa(a.empresa_vinculada_nombre)
                                    setShowRemitModal(true)
                                  }}
                                  className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition inline-flex items-center gap-1 shadow-sm"
                                  title="Cerrar período, transferir deuda a la empresa y liberar línea del funcionario"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Remitir a Empresa</span>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Panel Drilldown: Nómina y Vales de la Empresa Seleccionada */}
              {selectedEmpresa && (
                <div className="card p-5 border-2 border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          PERÍODO EN CURSO
                        </span>
                        <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                          Nómina de Descuento: {selectedEmpresa}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Vales y compras a crédito que serán descontados por Recursos Humanos en el corte {remitPeriodo}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => api.accountsReceivable.downloadExtractosEmpresaPdf(selectedEmpresa, remitPeriodo)}
                        className="btn-outline text-xs flex items-center gap-1.5 font-bold"
                      >
                        <FileDown className="w-4 h-4 text-indigo-500" />
                        <span>Extractos Masivos (PDF)</span>
                      </button>
                      <button
                        onClick={() => setShowRemitModal(true)}
                        className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                        <span>Generar Corte y Remitir</span>
                      </button>
                    </div>
                  </div>

                  {empresaPendingLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : !empresaPending || !empresaPending.funcionarios || empresaPending.funcionarios.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs">No hay documentos pendientes de remisión para esta empresa.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Total Funcionarios</span>
                          <p className="text-lg font-black font-mono text-gray-900 dark:text-white">{empresaPending.cantidad_funcionarios}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Vales / Facturas</span>
                          <p className="text-lg font-black font-mono text-gray-900 dark:text-white">{empresaPending.cantidad_documentos}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Total a Retener</span>
                          <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(empresaPending.total_deuda)}</p>
                        </div>
                      </div>

                      <div className="divide-y divide-gray-100 dark:divide-gray-800 border rounded-xl overflow-hidden">
                        {empresaPending.funcionarios.map((f: any, i: number) => (
                          <div key={i} className="p-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-gray-900 dark:text-white">{f.customer_nombre || "Funcionario"}</span>
                                {f.customer_ruc && (
                                  <span className="font-mono text-gray-400 text-[11px]">CI/RUC: {f.customer_ruc}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {f.documentos?.map((d: any, di: number) => (
                                  <span key={di} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-mono text-[10px] text-gray-700 dark:text-gray-300">
                                    {d.numero_documento}: {formatPYG(d.saldo_pendiente)}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                              <span className="text-gray-400 text-[11px]">{f.documentos?.length || 0} compras</span>
                              <span className="font-mono font-black text-sm text-gray-900 dark:text-white">{formatPYG(f.total_saldo)}</span>
                              <button
                                onClick={() => openPaymentModal(f.customer_id, {
                                  razon_social: f.customer_nombre,
                                  ruc: f.customer_ruc,
                                  empresa_vinculada: selectedEmpresa,
                                })}
                                className="btn-outline py-1 px-2.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300"
                                title="Registrar cobro individual anticipado"
                              >
                                Cobro Anticipado
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Historial de Remisiones y Lotes Emitidos a Empresas */}
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-500" />
                      Historial de Remisiones & Deuda Corporativa de Empresas
                    </h3>
                    <p className="text-xs text-gray-500">Lotes formalmente remitidos a las empresas vinculadas. Al cobrar el lote, ingresa a tesorería y cancela la deuda corporativa.</p>
                  </div>
                </div>

                {remissionsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : remissions.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs">No hay remisiones registradas en el historial.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">N° Remisión</th>
                          <th className="p-3.5">Empresa Vinculada</th>
                          <th className="p-3.5">Período</th>
                          <th className="p-3.5">Fecha Emisión</th>
                          <th className="p-3.5">Funcionarios</th>
                          <th className="p-3.5">Total Remitido</th>
                          <th className="p-3.5">Saldo Pendiente</th>
                          <th className="p-3.5">Estado</th>
                          <th className="p-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {remissions.map((r) => {
                          const isPagado = r.estado === "PAGADO"
                          return (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-3.5 font-mono font-black text-indigo-600 dark:text-indigo-400">
                                {r.numero_remision}
                              </td>
                              <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                                {r.empresa_vinculada_nombre}
                              </td>
                              <td className="p-3.5 font-mono font-semibold">
                                {r.periodo_mes}
                              </td>
                              <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                                {r.created_at ? new Date(r.created_at).toLocaleDateString("es-PY") : "—"}
                              </td>
                              <td className="p-3.5 font-mono">
                                {r.cantidad_funcionarios} socios
                              </td>
                              <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                                {formatPYG(r.monto_total)}
                              </td>
                              <td className="p-3.5 font-mono font-black text-amber-600 dark:text-amber-400">
                                {formatPYG(r.saldo_pendiente)}
                              </td>
                              <td className="p-3.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isPagado
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200"
                                }`}>
                                  {isPagado ? "Cancelado" : "Pendiente Pago"}
                                </span>
                              </td>
                              <td className="p-3.5 text-right space-x-2">
                                <button
                                  onClick={() => api.accountsReceivable.downloadRemisionPdf(r.id, r.numero_remision)}
                                  className="btn-outline py-1 px-2.5 text-xs inline-flex items-center gap-1"
                                  title="Descargar Acta de Remisión Consolidada con firma de recepción conforme"
                                >
                                  <Printer className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Acta (PDF)</span>
                                </button>
                                {!isPagado && (
                                  <button
                                    onClick={() => {
                                      setShowPayRemissionModal(r)
                                      setPayRemForm({
                                        monto: String(r.saldo_pendiente),
                                        forma_pago: "transferencia",
                                        bank_account_id: bankAccounts.length > 0 ? bankAccounts[0].id : "",
                                        referencia: "",
                                        fecha_pago: new Date().toISOString().split("T")[0],
                                        notas: "",
                                      })
                                    }}
                                    className="btn-primary py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs inline-flex items-center gap-1 shadow-sm font-bold"
                                    title="Registrar pago de la empresa en tesorería"
                                  >
                                    <DollarSign className="w-3.5 h-3.5" />
                                    <span>Cobrar Lote</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: CENTRO DE REPORTES EJECUTIVOS */}
          {tab === "reportes" && (
            <div className="space-y-6">
              {/* Header de la Pestaña */}
              <div className="card p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/20 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black tracking-widest uppercase">
                      CATÁLOGO EJECUTIVO DE REPORTES & EXPORTACIONES
                    </span>
                    <h2 className="text-xl font-black tracking-tight text-white mt-1 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-400" />
                      Centro de Reportes de Cuentas por Cobrar & Convenios
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Generación directa en PDF institucional de Extra Supermercado y planillas Excel. Aplicá filtros específicos por cada necesidad de auditoría o cobranza.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid de las 6 Tarjetas Ejecutivas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* TARJETA 1: Deuda Detallada */}
                <div className="card p-5 flex flex-col justify-between border-t-4 border-t-emerald-500 shadow-md hover:shadow-lg transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        AUDITORÍA & COBRANZAS
                      </span>
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Deuda Detallada por Factura (PDF)
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Reporte pormenorizado factura por factura con desglose de ítems, fechas de vencimiento, días de mora calculados y estética oficial idéntica al Arqueo de Caja.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700/60 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Cliente (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Todos los clientes..."
                          className="input-field text-xs py-1.5"
                          value={reportCustomerName || customerSearchInput}
                          onChange={e => {
                            setCustomerSearchInput(e.target.value)
                            setReportCustomerName("")
                            setReportCustomerId("")
                          }}
                        />
                        {customerSearchResults.length > 0 && !reportCustomerId && (
                          <div className="max-h-28 overflow-y-auto bg-white dark:bg-slate-800 border rounded-lg mt-1 shadow-sm">
                            {customerSearchResults.map(c => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setReportCustomerId(c.id)
                                  setReportCustomerName(c.razon_social)
                                  setCustomerSearchResults([])
                                }}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-[11px] truncate font-medium"
                              >
                                {c.razon_social} {c.ruc ? `(${c.ruc})` : ""}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Empresa Vinculada (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Filtrar por empresa..."
                          className="input-field text-xs py-1.5"
                          value={reportEmpresaVinculada}
                          onChange={e => setReportEmpresaVinculada(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                    <button
                      onClick={handleDownloadDeudaDetalladaPdf}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Descargar Deuda Detallada (PDF)</span>
                    </button>
                  </div>
                </div>

                {/* TARJETA 2: Matriz Aging */}
                <div className="card p-5 flex flex-col justify-between border-t-4 border-t-indigo-500 shadow-md hover:shadow-lg transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        ANÁLISIS DE RIESGO
                      </span>
                      <BarChart2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Matriz de Antigüedad / Aging
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Clasificación de la cartera por baldes temporales (Al día, 1-30d, 31-60d, 61-90d, +90d) y cálculo automático del Days Sales Outstanding (DSO).
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700/60 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Desde</label>
                          <input type="date" className="input-field text-xs py-1" value={repAgingDesde} onChange={e => setRepAgingDesde(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Hasta</label>
                          <input type="date" className="input-field text-xs py-1" value={repAgingHasta} onChange={e => setRepAgingHasta(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => api.accountsReceivable.downloadAgingExcel({ fecha_desde: repAgingDesde, fecha_hasta: repAgingHasta })}
                      className="py-2.5 px-3 btn-outline text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={() => api.accountsReceivable.downloadAgingPdf({ fecha_desde: repAgingDesde, fecha_hasta: repAgingHasta })}
                      className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>Aging PDF</span>
                    </button>
                  </div>
                </div>

                {/* TARJETA 3: Extractos Masivos de Convenio */}
                <div className="card p-5 flex flex-col justify-between border-t-4 border-t-purple-500 shadow-md hover:shadow-lg transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                        NÓMINAS & RRHH
                      </span>
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Extractos Masivos para Nómina (PDF)
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Legajo consolidado: genera 1 página A4 por funcionario con desglose de vales y el Talón de Conformidad de Descuento de Haberes para firma del empleado.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700/60 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Empresa Vinculada</label>
                        <select
                          className="input-field text-xs py-1.5"
                          value={repEmpresaExtracto}
                          onChange={e => setRepEmpresaExtracto(e.target.value)}
                        >
                          <option value="">Seleccioná una empresa...</option>
                          {agreements.map((a, idx) => (
                            <option key={idx} value={a.empresa_vinculada_nombre}>
                              {a.empresa_vinculada_nombre} ({a.cantidad_funcionarios} func.)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Período (YYYY-MM)</label>
                        <input
                          type="month"
                          className="input-field text-xs py-1"
                          value={repPeriodoExtracto}
                          onChange={e => setRepPeriodoExtracto(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                    <button
                      onClick={() => {
                        if (!repEmpresaExtracto) {
                          toast.error("Empresa requerida", "Seleccioná la empresa vinculada para generar sus extractos")
                          return
                        }
                        api.accountsReceivable.downloadExtractosEmpresaPdf(repEmpresaExtracto, repPeriodoExtracto)
                      }}
                      disabled={!repEmpresaExtracto}
                      className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      <span>Generar Extractos Masivos (PDF)</span>
                    </button>
                  </div>
                </div>

                {/* TARJETA 4: Acta de Remisión Consolidada */}
                <div className="card p-5 flex flex-col justify-between border-t-4 border-t-blue-500 shadow-md hover:shadow-lg transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        COBRANZA CORPORATIVA
                      </span>
                      <FileCheck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Acta de Remisión Consolidada (PDF)
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Nota de entrega formal para la gerencia de la empresa vinculada con 4 KPIs ejecutivos, planilla de retenciones y acta de recepción conforme con firma y sello.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700/60 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Lote / Remisión Generada</label>
                        <select
                          className="input-field text-xs py-1.5"
                          value={repSelectedRemissionId}
                          onChange={e => setRepSelectedRemissionId(e.target.value)}
                        >
                          <option value="">Seleccioná un lote remitido...</option>
                          {remissions.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.numero_remision} - {r.empresa_vinculada_nombre} ({r.periodo_mes})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                    <button
                      onClick={() => {
                        if (!repSelectedRemissionId) {
                          toast.error("Lote requerido", "Seleccioná un lote de remisión para descargar el acta")
                          return
                        }
                        const found = remissions.find(r => r.id === repSelectedRemissionId)
                        api.accountsReceivable.downloadRemisionPdf(repSelectedRemissionId, found?.numero_remision)
                      }}
                      disabled={!repSelectedRemissionId}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Descargar Acta Consolidada (PDF)</span>
                    </button>
                  </div>
                </div>

                {/* TARJETA 5: Libro de Cobranzas */}
                <div className="card p-5 flex flex-col justify-between border-t-4 border-t-teal-500 shadow-md hover:shadow-lg transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                        TESORERÍA & BÓVEDA
                      </span>
                      <Wallet className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Libro de Cobranzas y Recaudación
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Historial cronológico de todos los cobros asentados, detallando su canal de ingreso: Bóveda Central (efectivo), Cuentas Bancarias o Cheques.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-slate-800/70 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700/60 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Desde</label>
                          <input type="date" className="input-field text-xs py-1" value={repCobranzasDesde} onChange={e => setRepCobranzasDesde(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Hasta</label>
                          <input type="date" className="input-field text-xs py-1" value={repCobranzasHasta} onChange={e => setRepCobranzasHasta(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => api.accountsReceivable.downloadCobranzasExcel({ fecha_desde: repCobranzasDesde, fecha_hasta: repCobranzasHasta })}
                      className="py-2.5 px-3 btn-outline text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={() => api.accountsReceivable.downloadCobranzasPdf({ fecha_desde: repCobranzasDesde, fecha_hasta: repCobranzasHasta })}
                      className="py-2.5 px-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>Cobranzas PDF</span>
                    </button>
                  </div>
                </div>

                {/* TARJETA 6: Scoring & Matriz de Riesgo */}
                <div className="card p-5 flex flex-col justify-between border-t-4 border-t-amber-500 shadow-md hover:shadow-lg transition">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        GESTIÓN DE RIESGO
                      </span>
                      <ShieldCheck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Scoring y Líneas de Crédito
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Acceso a la evaluación algorítmica del comportamiento de pago (1 a 100), tasa de puntualidad, días de mora histórica y límites asignados a cada cliente.
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl space-y-1.5 border border-amber-200 dark:border-amber-900/60 text-xs">
                      <p className="text-amber-800 dark:text-amber-300 text-[11px] font-medium">
                        Podés consultar la matriz de clientes clasificados por nivel de riesgo (Excelente, Bueno, Regular, Riesgoso) y recalcular automáticamente con base en el historial de ventas.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                    <button
                      onClick={() => setTab("scoring")}
                      className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Ver Módulo de Scoring</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Registrar Cobro Multi-Factura con Cascada FIFO e Imputación a Tesorería */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(null)}>
          <div className="modal-content max-w-3xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                  Registrar Cobro de Cliente · Imputación por Lote / FIFO
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Amortización en cascada a facturas más antiguas, asignación bimonetaria e ingreso real a Tesorería (Bóveda / Bancos / Cheques).
                </p>
              </div>
              <button onClick={() => setShowPaymentModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Tarjeta de Información del Cliente */}
              {paymentCustomerInfo && (
                <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Cliente a Cobrar</div>
                    <div className="text-sm font-black flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-400" />
                      <span>{paymentCustomerInfo.razon_social}</span>
                      {paymentCustomerInfo.ruc && (
                        <span className="text-xs font-mono text-slate-400">({paymentCustomerInfo.ruc})</span>
                      )}
                    </div>
                  </div>
                  {paymentCustomerInfo.empresa_vinculada && (
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase block">Empresa Vinculada</span>
                      <span className="text-xs font-semibold text-white">{paymentCustomerInfo.empresa_vinculada}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Parámetros Básicos del Cobro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label-field">Forma de Pago</label>
                  <select className="input-field text-xs" value={payFormaPago} onChange={e => setPayFormaPago(e.target.value)}>
                    <option value="efectivo">Efectivo (Gs. / R$ / US$)</option>
                    <option value="transferencia">Transferencia Bancaria (SIPAP)</option>
                    <option value="pix">PIX (Banco Central do Brasil)</option>
                    <option value="qr">Cobro QR Dinelco / Bancard</option>
                    <option value="cheque">Cheque Recibido (Al día o Diferido)</option>
                    <option value="tarjeta_debito">Tarjeta Débito</option>
                    <option value="tarjeta_credito">Tarjeta Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">N° Referencia / Boleta</label>
                  <input className="input-field text-xs" placeholder="Ej: Transf. 984124" value={payReferencia} onChange={e => setPayReferencia(e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Fecha de Cobro</label>
                  <input className="input-field text-xs" type="date" value={payFecha} onChange={e => setPayFecha(e.target.value)} />
                </div>
              </div>

              {/* 🏛️ PANEL DINÁMICO DE TESORERÍA / DESTINO DE FONDOS */}
              {payFormaPago === "efectivo" && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                    <Landmark className="w-4 h-4 text-amber-600" />
                    <span>Destino del Efectivo Cobrado</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${
                      payDestinoFondos === "boveda"
                        ? "bg-amber-100/60 dark:bg-amber-900/40 border-amber-400 font-bold"
                        : "border-gray-200 dark:border-slate-700"
                    }`}>
                      <input
                        type="radio"
                        name="destino_fondos"
                        value="boveda"
                        checked={payDestinoFondos === "boveda"}
                        onChange={() => setPayDestinoFondos("boveda")}
                      />
                      <span>🏛️ Bóveda Central (Ingreso directo de Tesorería)</span>
                    </label>
                    <label className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${
                      payDestinoFondos === "caja"
                        ? "bg-amber-100/60 dark:bg-amber-900/40 border-amber-400 font-bold"
                        : "border-gray-200 dark:border-slate-700"
                    }`}>
                      <input
                        type="radio"
                        name="destino_fondos"
                        value="caja"
                        checked={payDestinoFondos === "caja"}
                        onChange={() => setPayDestinoFondos("caja")}
                      />
                      <span>🛒 Caja de Salón (Imputar a sesión de cajera)</span>
                    </label>
                  </div>
                </div>
              )}

              {(payFormaPago === "transferencia" || payFormaPago === "pix" || payFormaPago === "qr") && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-300">
                    <span className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-blue-600" />
                      Cuenta Bancaria Receptora
                    </span>
                    <span className="text-[11px] font-normal text-blue-700 dark:text-blue-400">Acredita saldo y asienta la transacción</span>
                  </div>
                  <select
                    className="input-field text-xs w-full font-medium"
                    value={payBankAccountId}
                    onChange={e => setPayBankAccountId(e.target.value)}
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.banco_nombre} — Cuenta {b.numero_cuenta} ({b.moneda}) · Saldo: {formatPYG(b.saldo_actual)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {payFormaPago === "cheque" && (
                <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-900 dark:text-purple-300">
                    <span className="flex items-center gap-2">
                      <ReceiptText className="w-4 h-4 text-purple-600" />
                      Datos del Cheque Recibido en Pago
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 font-extrabold">
                      CARTERA DE CHEQUES
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">N° de Cheque</label>
                      <input
                        className="input-field text-xs font-mono"
                        placeholder="00012345"
                        value={payChequeNumero}
                        onChange={e => setPayChequeNumero(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Banco Emisor</label>
                      <input
                        className="input-field text-xs"
                        placeholder="Ej: Banco Continental / Itaú"
                        value={payChequeBanco}
                        onChange={e => setPayChequeBanco(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Librador / Titular</label>
                      <input
                        className="input-field text-xs"
                        placeholder="Nombre o razón social"
                        value={payChequeLibrador}
                        onChange={e => setPayChequeLibrador(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">RUC / CI Librador</label>
                      <input
                        className="input-field text-xs font-mono"
                        placeholder="Documento"
                        value={payChequeRuc}
                        onChange={e => setPayChequeRuc(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Fecha Emisión</label>
                      <input
                        type="date"
                        className="input-field text-xs"
                        value={payChequeFechaEmision}
                        onChange={e => setPayChequeFechaEmision(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Fecha de Cobro / Vencimiento</label>
                      <input
                        type="date"
                        className="input-field text-xs"
                        value={payChequeFechaCobro}
                        onChange={e => setPayChequeFechaCobro(e.target.value)}
                      />
                    </div>
                  </div>
                  {payChequeFechaCobro > new Date().toISOString().split("T")[0] && (
                    <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Cheque Diferido: quedará asentado en Cartera de Cheques a Depositar hasta la fecha de cobro indicada.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Herramienta de Pago Global en Cascada FIFO */}
              <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-200 dark:border-indigo-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Pago Global en Cascada FIFO
                  </span>
                  <span className="text-[11px] text-gray-500">Amortiza las más viejas primero</span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs font-bold">₲</span>
                    <input
                      type="number"
                      placeholder="Monto global que abonó el cliente..."
                      className="input-field text-xs pl-7 font-mono font-bold"
                      value={payMontoGlobal}
                      onChange={e => setPayMontoGlobal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleDistribuirFifo() }}
                    />
                  </div>
                  <button
                    onClick={() => handleDistribuirFifo()}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Aplicar Cascada FIFO</span>
                  </button>
                  <button
                    onClick={() => {
                      const totalLote = pendingDocs
                        .filter(d => selectedBatchDocs[d.id] !== false)
                        .reduce((sum, d) => sum + (d.saldo_pendiente || 0), 0)
                      handleDistribuirFifo(totalLote)
                    }}
                    className="px-3 py-2 btn-outline text-xs text-gray-700 dark:text-gray-300 font-semibold"
                    title="Cubre la totalidad de las facturas seleccionadas"
                  >
                    Saldar Lote Completo
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Lote de Facturas Pendientes ({pendingDocs.length})
                </span>
                <span className="text-[11px] text-gray-400">Podés desmarcar facturas o ajustar montos manualmente</span>
              </div>

              {pendingLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : pendingDocs.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">Este cliente no tiene facturas pendientes de cobro</div>
              ) : (
                <div className="space-y-2">
                  {pendingDocs.map(doc => {
                    const isSelected = selectedBatchDocs[doc.id] !== false
                    const allocVal = parseFloat(allocations[doc.id] || "0")
                    const isTotal = allocVal >= doc.saldo_pendiente && allocVal > 0
                    const isPartial = allocVal > 0 && allocVal < doc.saldo_pendiente
                    const saldoRestante = Math.max(0, doc.saldo_pendiente - allocVal)

                    return (
                      <div
                        key={doc.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isSelected
                            ? allocVal > 0
                              ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60"
                              : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                            : "bg-gray-50/50 dark:bg-slate-900/40 border-gray-200 dark:border-slate-800 opacity-60"
                        } flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleDocBatch(doc.id)}
                            className="mt-0.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            title={isSelected ? "Excluir del lote" : "Incluir en el lote"}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-white font-mono">{doc.numero_documento}</span>
                              {isTotal && (
                                <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold">
                                  Cancelada Total
                                </span>
                              )}
                              {isPartial && (
                                <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold">
                                  Pago Parcial
                                </span>
                              )}
                            </div>
                            <div className="text-gray-400 text-[11px] mt-0.5">
                              Vence: {doc.fecha_vencimiento || "—"} · Saldo actual: <span className="font-bold text-gray-700 dark:text-gray-300">{formatPYG(doc.saldo_pendiente)}</span>
                              {allocVal > 0 && (
                                <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-medium">
                                  (Resta: {formatPYG(saldoRestante)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <span className="text-gray-400 text-[11px]">₲</span>
                          <input
                            type="number"
                            placeholder="0"
                            className="input-field text-right w-36 font-mono font-bold text-xs"
                            value={allocations[doc.id] || ""}
                            onChange={e => setAllocations({ ...allocations, [doc.id]: e.target.value })}
                            disabled={!isSelected}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-xs font-bold text-slate-300 block">Total Cobro Imputado</span>
                  <span className="text-[11px] text-slate-400">
                    {Object.values(allocations).filter(v => (parseFloat(v) || 0) > 0).length} factura(s) amortizada(s)
                  </span>
                </div>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">{formatPYG(montoTotalPago)}</span>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPaymentModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handleSubmitPayment}
                disabled={submittingPayment || montoTotalPago <= 0}
                className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-50 flex items-center gap-2"
              >
                {submittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar e Imputar Cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Inicio Rápido de Cobro desde Cabecera */}
      {showQuickCobroModal && (
        <div className="modal-overlay" onClick={() => setShowQuickCobroModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                Registrar Cobro · Seleccionar Cliente
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Buscá al cliente o socio Extra Club por nombre o documento para imputar su pago en cascada FIFO.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nombre del cliente, RUC o cédula de identidad..."
                  className="input-field text-xs pl-9 w-full font-medium"
                  value={quickCustomerSearch}
                  onChange={e => setQuickCustomerSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {quickCustomerLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : quickCustomerResults.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  {quickCustomerSearch.trim() ? "No se encontraron clientes con ese criterio" : "Escribí al menos 2 letras para buscar clientes..."}
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 border rounded-xl">
                  {quickCustomerResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setShowQuickCobroModal(false)
                        openPaymentModal(c.id, {
                          razon_social: c.razon_social || "Cliente sin nombre",
                          ruc: c.ruc,
                          empresa_vinculada: c.empresa_vinculada_nombre,
                        })
                      }}
                      className="w-full text-left p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-extrabold text-gray-900 dark:text-white">{c.razon_social || "Sin nombre"}</div>
                        <div className="text-[11px] text-gray-400 font-mono">CI/RUC: {c.ruc || "—"}</div>
                        {c.empresa_vinculada_nombre && (
                          <div className="text-[10px] text-indigo-500 font-bold mt-0.5">
                            🏛️ Empresa: {c.empresa_vinculada_nombre}
                          </div>
                        )}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <span>Cobrar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setShowQuickCobroModal(false)} className="btn-outline text-xs">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Corte y Remisión a Empresa Vinculada */}
      {showRemitModal && selectedEmpresa && (
        <div className="modal-overlay" onClick={() => setShowRemitModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-500" />
                Corte y Remisión a Empresa Vinculada
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Traspaso formal de la deuda a la empresa y liberación inmediata de crédito para los funcionarios.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
                <div className="text-xs font-bold text-slate-300">Empresa Receptora</div>
                <div className="text-base font-black text-indigo-400">{selectedEmpresa}</div>
                {empresaPending && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div>Funcionarios: <strong className="text-white">{empresaPending.cantidad_funcionarios}</strong></div>
                    <div>Total Deuda: <strong className="text-emerald-400">{formatPYG(empresaPending.total_deuda)}</strong></div>
                  </div>
                )}
              </div>

              <div>
                <label className="label-field">Período de Liquidación (Mes)</label>
                <input
                  type="month"
                  className="input-field text-xs"
                  value={remitPeriodo}
                  onChange={e => setRemitPeriodo(e.target.value)}
                />
              </div>

              <div>
                <label className="label-field">Notas u Observaciones del Lote</label>
                <textarea
                  className="input-field text-xs h-20"
                  placeholder="Ej: Remisión nómina mensual correspondiente a los consumos de supermercado..."
                  value={remitNotas}
                  onChange={e => setRemitNotas(e.target.value)}
                />
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-900 dark:text-emerald-300 leading-relaxed font-medium">
                ✅ <strong>Efecto Inmediato de Línea de Crédito:</strong> Al confirmar la remisión, todas las facturas del período pasarán a estado <code>REMITIDO_EMPRESA</code> y el cupo de crédito disponible de los funcionarios se reestablecerá instantáneamente para que sigan comprando.
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowRemitModal(false)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handleExecuteRemit}
                disabled={remitting}
                className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2"
              >
                {remitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar y Remitir Deuda"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cobro de Remisión por Empresa Vinculada */}
      {showPayRemissionModal && (
        <div className="modal-overlay" onClick={() => setShowPayRemissionModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Registrar Pago de Empresa Vinculada
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Ingreso a tesorería de la transferencia o cheque emitido por la empresa para cancelar el lote remitido.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Lote de Remisión</div>
                <div className="text-sm font-black text-indigo-400">{showPayRemissionModal.numero_remision} · {showPayRemissionModal.empresa_vinculada_nombre}</div>
                <div className="text-xs text-slate-300">Saldo pendiente: <strong className="text-amber-400 font-mono">{formatPYG(showPayRemissionModal.saldo_pendiente)}</strong></div>
              </div>

              <div>
                <label className="label-field">Monto a Cancelar (₲)</label>
                <input
                  type="number"
                  className="input-field text-xs font-mono font-bold"
                  value={payRemForm.monto}
                  onChange={e => setPayRemForm({ ...payRemForm, monto: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Forma de Pago</label>
                  <select
                    className="input-field text-xs"
                    value={payRemForm.forma_pago}
                    onChange={e => setPayRemForm({ ...payRemForm, forma_pago: e.target.value })}
                  >
                    <option value="transferencia">Transferencia Bancaria (SIPAP)</option>
                    <option value="cheque">Cheque Corporativo</option>
                    <option value="efectivo">Efectivo en Bóveda</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Fecha de Pago</label>
                  <input
                    type="date"
                    className="input-field text-xs"
                    value={payRemForm.fecha_pago}
                    onChange={e => setPayRemForm({ ...payRemForm, fecha_pago: e.target.value })}
                  />
                </div>
              </div>

              {payRemForm.forma_pago === "transferencia" && (
                <div>
                  <label className="label-field">Cuenta Bancaria de Depósito</label>
                  <select
                    className="input-field text-xs"
                    value={payRemForm.bank_account_id}
                    onChange={e => setPayRemForm({ ...payRemForm, bank_account_id: e.target.value })}
                  >
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.banco_nombre} — Cta. {b.numero_cuenta} ({b.moneda})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label-field">N° Boleta / Referencia Bancaria</label>
                <input
                  type="text"
                  placeholder="Ej: SIPAP 4589201"
                  className="input-field text-xs"
                  value={payRemForm.referencia}
                  onChange={e => setPayRemForm({ ...payRemForm, referencia: e.target.value })}
                />
              </div>

              <div>
                <label className="label-field">Notas / Observaciones</label>
                <textarea
                  className="input-field text-xs h-16"
                  placeholder="Detalles adicionales del cobro..."
                  value={payRemForm.notas}
                  onChange={e => setPayRemForm({ ...payRemForm, notas: e.target.value })}
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPayRemissionModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button
                onClick={handlePayRemission}
                disabled={payingRemission}
                className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2"
              >
                {payingRemission ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Cobro de Empresa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cobro Exitoso & Recibo A6 con QR */}
      {completedReceipt && (
        <div className="modal-overlay" onClick={() => setCompletedReceipt(null)}>
          <div className="modal-content max-w-md text-center p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">¡Cobro Registrado con Éxito!</h3>
              <p className="text-xs text-gray-500 mt-1">El saldo se ha actualizado en cascada FIFO y se emitió el recibo de cobro oficial.</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 space-y-1">
              <div className="text-xs text-gray-500">Recibo de Cobranza N°</div>
              <div className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">{completedReceipt.numero_recibo}</div>
              <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(completedReceipt.monto_total)}</div>
              <div className="text-[11px] text-gray-400 pt-1">{completedReceipt.documentos_afectados} factura(s) amortizada(s)</div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => api.accountsReceivable.downloadReceiptA6Pdf(completedReceipt.id)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Descargar Recibo A6 con QR (PDF)</span>
              </button>

              <button
                onClick={() => window.open(`/verificar-recibo/${completedReceipt.id}`, "_blank")}
                className="w-full py-2.5 px-4 btn-outline text-xs font-semibold flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4 text-indigo-500" />
                <span>Verificar Recibo en Línea (Página QR)</span>
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </button>
            </div>

            <div className="border-t pt-3">
              <button onClick={() => setCompletedReceipt(null)} className="btn-ghost text-xs w-full">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: Generar Reporte de Cuentas por Cobrar */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileDown className="w-5 h-5 text-primary" />
                Generar Reporte de Cuentas por Cobrar
              </h3>
              <p className="text-xs text-gray-500 mt-1">Antigüedad de saldos (aging) con desglose por cliente, filtrable por período, cliente y empresa vinculada</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Fecha Desde</label>
                  <input
                    type="date" className="input-field text-xs"
                    value={reportFechaDesde}
                    onChange={e => setReportFechaDesde(e.target.value)}
                    max={reportFechaHasta}
                  />
                </div>
                <div>
                  <label className="label-field">Fecha Hasta</label>
                  <input
                    type="date" className="input-field text-xs"
                    value={reportFechaHasta}
                    onChange={e => setReportFechaHasta(e.target.value)}
                    min={reportFechaDesde}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <div className="relative">
                <label className="label-field">Cliente (opcional — dejar vacío trae todos)</label>
                {reportCustomerId ? (
                  <div className="input-field text-xs flex items-center justify-between">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{reportCustomerName}</span>
                    <button
                      onClick={() => { setReportCustomerId(""); setReportCustomerName(""); setCustomerSearchInput("") }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className="input-field text-xs pl-8"
                      placeholder="Buscar por nombre, razón social o RUC..."
                      value={customerSearchInput}
                      onChange={e => { setCustomerSearchInput(e.target.value); setCustomerSearchOpen(true) }}
                      onFocus={() => setCustomerSearchOpen(true)}
                    />
                    {customerSearchOpen && customerSearchInput.trim() && (
                      <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg">
                        {customerSearchLoading ? (
                          <div className="p-3 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /></div>
                        ) : customerSearchResults.length === 0 ? (
                          <div className="p-3 text-xs text-gray-400 text-center">Sin resultados</div>
                        ) : (
                          customerSearchResults.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setReportCustomerId(c.id); setReportCustomerName(c.razon_social)
                                setCustomerSearchOpen(false); setCustomerSearchInput("")
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2"
                            >
                              <span className="font-semibold text-gray-800 dark:text-gray-200">{c.razon_social}</span>
                              {c.ruc && <span className="text-gray-400 font-mono text-[10px]">{c.ruc}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="label-field">Empresa Vinculada (opcional)</label>
                {reportEmpresaVinculada ? (
                  <div className="input-field text-xs flex items-center justify-between">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{reportEmpresaVinculada}</span>
                    <button
                      onClick={() => { setReportEmpresaVinculada(""); setEmpresaSearchInput("") }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className="input-field text-xs pl-8"
                      placeholder="Buscar empresa vinculada..."
                      value={empresaSearchInput}
                      onChange={e => { setEmpresaSearchInput(e.target.value); setEmpresaSearchOpen(true) }}
                      onFocus={() => setEmpresaSearchOpen(true)}
                    />
                    {empresaSearchOpen && empresaSearchInput.trim() && (
                      <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg">
                        {empresaSearchLoading ? (
                          <div className="p-3 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /></div>
                        ) : empresaSearchResults.length === 0 ? (
                          <div className="p-3 text-xs text-gray-400 text-center">Sin resultados</div>
                        ) : (
                          empresaSearchResults.map(nombre => (
                            <button
                              key={nombre}
                              onClick={() => {
                                setReportEmpresaVinculada(nombre)
                                setEmpresaSearchOpen(false); setEmpresaSearchInput("")
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-gray-800 dark:text-gray-200"
                            >
                              {nombre}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <button onClick={resetReportFilters} className="btn-ghost text-xs self-start sm:self-auto">Limpiar filtros</button>
              <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
                <button
                  onClick={() => { handleDownloadAgingExcel(); setShowReportModal(false) }}
                  className="btn-outline text-xs flex items-center gap-1.5"
                  title="Exportar matriz de vencimientos en Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel
                </button>
                <button
                  onClick={() => { handleDownloadAgingPdf(); setShowReportModal(false) }}
                  className="btn-outline text-xs flex items-center gap-1.5"
                  title="Descargar matriz de aging en PDF"
                >
                  <FileDown className="w-4 h-4 text-indigo-500" /> Aging PDF
                </button>
                <button
                  onClick={() => { handleDownloadDeudaDetalladaPdf(); setShowReportModal(false) }}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5 shadow-sm"
                  title="Generar reporte completo con desglose factura por factura y estética oficial Arqueo"
                >
                  <FileText className="w-4 h-4" /> Deuda Detallada (PDF)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Detalle de Factura */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Documento N° {selectedDoc.numero_documento}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedDoc.customer_name}</p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-800">
                <div><span className="text-gray-400 block text-[11px]">Monto Original</span><span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{formatPYG(selectedDoc.monto_original)}</span></div>
                <div><span className="text-gray-400 block text-[11px]">Saldo Pendiente</span><span className="font-mono font-bold text-sm text-primary">{formatPYG(selectedDoc.saldo_pendiente)}</span></div>
                <div><span className="text-gray-400 block text-[11px]">Fecha Emisión</span><span className="font-mono text-gray-700 dark:text-gray-300">{selectedDoc.fecha_emision}</span></div>
                <div><span className="text-gray-400 block text-[11px]">Fecha Vencimiento</span><span className="font-mono text-gray-700 dark:text-gray-300">{selectedDoc.fecha_vencimiento || "—"}</span></div>
              </div>

              {invoiceItems.length > 0 && (
                <div>
                  <h5 className="font-bold text-gray-500 uppercase tracking-wider mb-2 text-[11px]">Ítems Facturados</h5>
                  <div className="space-y-1">
                    {invoiceItems.map(item => (
                      <div key={item.id} className="p-2 rounded border flex items-center justify-between">
                        <span>{item.descripcion || item.producto?.nombre || "Producto"} (x{item.cantidad || 1})</span>
                        <span className="font-mono font-semibold">{formatPYG(item.total || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {docPayments.length > 0 && (
                <div>
                  <h5 className="font-bold text-gray-500 uppercase tracking-wider mb-2 text-[11px]">Historial de Pagos Aplicados</h5>
                  <div className="space-y-1">
                    {docPayments.map(p => (
                      <div key={p.id} className="p-2 rounded bg-emerald-50/50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center justify-between gap-2">
                        <span>{p.fecha} · {p.forma_pago || "Pago"} {p.referencia ? `(${p.referencia})` : ""}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{formatPYG(p.monto)}</span>
                          <button
                            onClick={() => api.accountsReceivable.downloadReceiptA6Pdf(p.id)}
                            className="p-1 rounded hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition"
                            title="Descargar Recibo de Cobro A6 con QR (PDF)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setSelectedDoc(null)} className="btn-outline text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Gestión de Cobranza */}
      {showCollectionForm && (
        <div className="modal-overlay" onClick={() => setShowCollectionForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Gestión de Cobranza</h3>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="label-field">Tipo de Contacto</label>
                <select className="input-field" value={collectionForm.tipo} onChange={e => setCollectionForm({ ...collectionForm, tipo: e.target.value })}>
                  <option value="llamada">Llamada Telefónica</option>
                  <option value="whatsapp">Mensaje de WhatsApp</option>
                  <option value="visita">Visita Presencial</option>
                  <option value="correo">Correo Electrónico</option>
                </select>
              </div>
              <div>
                <label className="label-field">Resultado / Acuerdo</label>
                <input className="input-field" placeholder="Ej: Prometió pagar el viernes" value={collectionForm.resultado} onChange={e => setCollectionForm({ ...collectionForm, resultado: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Fecha Compromiso de Pago</label>
                <input className="input-field" type="date" value={collectionForm.compromiso_pago} onChange={e => setCollectionForm({ ...collectionForm, compromiso_pago: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Monto Comprometido (₲)</label>
                <input className="input-field font-mono" type="number" value={collectionForm.monto_comprometido} onChange={e => setCollectionForm({ ...collectionForm, monto_comprometido: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowCollectionForm(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleCreateCollectionAction} className="btn-primary text-xs">Guardar Gestión</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
