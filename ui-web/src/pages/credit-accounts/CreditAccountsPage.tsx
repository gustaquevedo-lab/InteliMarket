import { useState, useEffect } from "react"
import {
  Wallet, Plus, Search, Loader2, X, Check, DollarSign, TrendingUp, TrendingDown,
  History, ShieldAlert, Percent, Settings2, AlertCircle, Ban, FileX, MessageCircle,
  PiggyBank, ArrowRightLeft, ShieldCheck, RefreshCw, UserCheck, Phone, CheckCircle2,
  Clock, ArrowUpRight, ChevronRight, Eye
} from "lucide-react"
import { api, type CreditAccount, type CreditMovement, type Customer, type MoraConfig, type MoraPreviewResponse, type WriteoffRequest, type DunningConfig, type DunningPreviewResponse, type CustomerAdvance } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type TabType = "cuentas" | "mora" | "dunning" | "anticipos" | "aprobaciones"

export default function CreditAccountsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("cuentas")
  const [accounts, setAccounts] = useState<CreditAccount[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [approvalRequests, setApprovalRequests] = useState<any[]>([])
  const [approvalRequestsVisible, setApprovalRequestsVisible] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modales
  const [showModal, setShowModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showMovementsModal, setShowMovementsModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<CreditAccount | null>(null)
  const [movements, setMovements] = useState<CreditMovement[]>([])
  const [form, setForm] = useState({ customer_id: "", limite_credito: "" })
  const [paymentForm, setPaymentForm] = useState({ monto: "", observaciones: "" })
  const [submitting, setSubmitting] = useState(false)

  // Motor de Mora
  const [moraConfig, setMoraConfig] = useState<MoraConfig | null>(null)
  const [moraConfigVisible, setMoraConfigVisible] = useState(false)
  const [moraPreview, setMoraPreview] = useState<MoraPreviewResponse | null>(null)
  const [showMoraSettings, setShowMoraSettings] = useState(false)
  const [moraForm, setMoraForm] = useState({ activo: false, porcentaje_mensual: "2", dias_gracia: "0" })
  const [savingMora, setSavingMora] = useState(false)
  const [applyingMora, setApplyingMora] = useState(false)

  // Bajas de incobrables (Write-offs)
  const [writeoffRequests, setWriteoffRequests] = useState<WriteoffRequest[]>([])
  const [writeoffRequestsVisible, setWriteoffRequestsVisible] = useState(false)
  const [writeoffApprovingId, setWriteoffApprovingId] = useState<string | null>(null)
  const [requestingWriteoffId, setRequestingWriteoffId] = useState<string | null>(null)

  // Dunning (Cobranzas WhatsApp)
  const [dunningConfig, setDunningConfig] = useState<DunningConfig | null>(null)
  const [dunningConfigVisible, setDunningConfigVisible] = useState(false)
  const [dunningPreview, setDunningPreview] = useState<DunningPreviewResponse | null>(null)
  const [showDunningSettings, setShowDunningSettings] = useState(false)
  const [dunningForm, setDunningForm] = useState({ activo: false, buckets_dias: "3,7,15,30", mensaje_template: "" })
  const [savingDunning, setSavingDunning] = useState(false)
  const [runningDunning, setRunningDunning] = useState(false)

  // Anticipos de Clientes
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [advanceForm, setAdvanceForm] = useState({ monto: "", forma_pago: "efectivo", referencia: "", observaciones: "" })
  const [submittingAdvance, setSubmittingAdvance] = useState(false)
  const [advanceBalance, setAdvanceBalance] = useState(0)
  const [customerAdvancesList, setCustomerAdvancesList] = useState<CustomerAdvance[]>([])
  const [applyingAdvanceId, setApplyingAdvanceId] = useState<string | null>(null)

  const toast = useToast()

  const fetchDunning = async () => {
    try {
      const config = await api.creditAccounts.getDunningConfig()
      setDunningConfig(config)
      setDunningConfigVisible(true)
      setDunningForm({ activo: config.activo, buckets_dias: config.buckets_dias.join(","), mensaje_template: config.mensaje_template })
      if (config.activo) {
        const preview = await api.creditAccounts.previewDunning()
        setDunningPreview(preview)
      } else {
        setDunningPreview(null)
      }
    } catch {
      // 403 o no configurado
    }
  }

  const handleSaveDunningConfig = async () => {
    setSavingDunning(true)
    try {
      const buckets = dunningForm.buckets_dias.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
      const data: DunningConfig = { activo: dunningForm.activo, buckets_dias: buckets, mensaje_template: dunningForm.mensaje_template }
      const saved = await api.creditAccounts.updateDunningConfig(data)
      setDunningConfig(saved)
      toast.success("Guardado", saved.activo ? "Dunning automático activado" : "Dunning automático desactivado")
      setShowDunningSettings(false)
      await fetchDunning()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar la configuración")
    } finally {
      setSavingDunning(false)
    }
  }

  const handleRunDunning = async () => {
    if (!dunningPreview || dunningPreview.items.length === 0) return
    if (!window.confirm(`Se van a enviar ${dunningPreview.items.length} mensaje(s) de WhatsApp reales a clientes con deuda vencida. ¿Confirmar el envío?`)) return
    setRunningDunning(true)
    try {
      const result = await api.creditAccounts.runDunning()
      if (result.enviados > 0) {
        toast.success("Recordatorios enviados", `${result.enviados} mensaje(s) enviados${result.omitidos > 0 ? `, ${result.omitidos} omitidos (sin teléfono)` : ""}`)
      } else {
        toast.error("No se envió nada", "WhatsApp no está configurado para esta empresa — configuralo en IntelliZapp primero")
      }
      await fetchDunning()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo ejecutar el envío")
    } finally {
      setRunningDunning(false)
    }
  }

  const fetchMora = async () => {
    try {
      const config = await api.creditAccounts.getMoraConfig()
      setMoraConfig(config)
      setMoraConfigVisible(true)
      setMoraForm({ activo: config.activo, porcentaje_mensual: String(config.porcentaje_mensual), dias_gracia: String(config.dias_gracia) })
      if (config.activo) {
        const preview = await api.creditAccounts.previewMora()
        setMoraPreview(preview)
      } else {
        setMoraPreview(null)
      }
    } catch {
      // 403
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [accountsData, customersData, requestsData, writeoffData] = await Promise.allSettled([
        api.creditAccounts.list(),
        api.customers.list({ activo: true }),
        api.creditApprovalRequests.list({ estado: "pendiente" }),
        api.writeoffRequests.list({ estado: "pendiente" }),
      ])
      if (accountsData.status === "fulfilled") setAccounts(accountsData.value)
      if (customersData.status === "fulfilled") setCustomers(customersData.value)
      if (requestsData.status === "fulfilled") {
        setApprovalRequests(requestsData.value)
        setApprovalRequestsVisible(true)
      }
      if (writeoffData.status === "fulfilled") {
        setWriteoffRequests(writeoffData.value)
        setWriteoffRequestsVisible(true)
      }
    } catch {
      toast.error("Error de conexión", "No se pudieron cargar las cuentas de crédito")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData(); fetchMora(); fetchDunning() }, [])

  const handleSaveMoraConfig = async () => {
    setSavingMora(true)
    try {
      const data: MoraConfig = {
        activo: moraForm.activo,
        porcentaje_mensual: parseFloat(moraForm.porcentaje_mensual) || 0,
        dias_gracia: parseInt(moraForm.dias_gracia) || 0,
      }
      const saved = await api.creditAccounts.updateMoraConfig(data)
      setMoraConfig(saved)
      toast.success("Guardado", saved.activo ? "Recargo por mora activado" : "Recargo por mora desactivado")
      setShowMoraSettings(false)
      await fetchMora()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar la configuración")
    } finally {
      setSavingMora(false)
    }
  }

  const handleApplyMora = async () => {
    if (!moraPreview || moraPreview.items.length === 0) return
    if (!window.confirm(`Se van a generar ${moraPreview.items.length} cargo(s) por mora, por un total de ${formatPYG(moraPreview.total_recargo)}. ¿Confirmar?`)) return
    setApplyingMora(true)
    try {
      const result = await api.creditAccounts.applyMora()
      toast.success("Recargos aplicados", `${result.aplicados} cuenta(s) por un total de ${formatPYG(result.total)}`)
      await fetchMora()
      await fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo aplicar el recargo")
    } finally {
      setApplyingMora(false)
    }
  }

  const handleApprove = async (id: string) => {
    setApprovingId(id)
    try {
      const result = await api.creditApprovalRequests.approve(id)
      toast.success(
        result.completo ? "Venta aprobada" : "Aprobación registrada",
        result.completo ? "Ambas aprobaciones completas — la venta ya se confirmó" : "Falta la segunda aprobación (Supervisor o Gerente)"
      )
      fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo aprobar")
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (id: string) => {
    const motivo = window.prompt("Motivo del rechazo:") || ""
    setApprovingId(id)
    try {
      await api.creditApprovalRequests.reject(id, motivo)
      toast.success("Venta rechazada", "La venta quedó cancelada")
      fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo rechazar")
    } finally {
      setApprovingId(null)
    }
  }

  const handleApproveWriteoff = async (id: string) => {
    setWriteoffApprovingId(id)
    try {
      const result = await api.writeoffRequests.approve(id)
      toast.success(
        result.completo ? "Baja aprobada" : "Aprobación registrada",
        result.completo ? "Ambas aprobaciones completas — el documento pasó a incobrable" : "Falta la segunda aprobación"
      )
      fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo aprobar")
    } finally {
      setWriteoffApprovingId(null)
    }
  }

  const handleRejectWriteoff = async (id: string) => {
    const motivo = window.prompt("Motivo del rechazo:") || ""
    setWriteoffApprovingId(id)
    try {
      await api.writeoffRequests.reject(id, motivo)
      toast.success("Solicitud rechazada", "El documento sigue pendiente en la cartera")
      fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo rechazar")
    } finally {
      setWriteoffApprovingId(null)
    }
  }

  const handleViewMovements = async (account: CreditAccount) => {
    setSelectedAccount(account)
    try {
      const data = await api.creditAccounts.movements(account.id)
      setMovements(data)
    } catch {
      setMovements([])
    }
    if (account.customer_id) {
      try {
        const [balance, advances] = await Promise.all([
          api.customerAdvances.getBalance(account.customer_id),
          api.customerAdvances.list({ customer_id: account.customer_id }),
        ])
        setAdvanceBalance(balance.monto_disponible)
        setCustomerAdvancesList(advances.filter(a => a.monto_disponible > 0))
      } catch {
        setAdvanceBalance(0)
        setCustomerAdvancesList([])
      }
    }
    setShowMovementsModal(true)
  }

  const handleCreateAdvance = async () => {
    if (!selectedAccount?.customer_id || !advanceForm.monto) {
      toast.error("Error", "Ingresá el monto del anticipo")
      return
    }
    setSubmittingAdvance(true)
    try {
      await api.customerAdvances.create({
        customer_id: selectedAccount.customer_id,
        monto: parseFloat(advanceForm.monto),
        forma_pago: advanceForm.forma_pago || undefined,
        referencia: advanceForm.referencia || undefined,
        observaciones: advanceForm.observaciones || undefined,
      })
      toast.success("Anticipo registrado", "Queda disponible para aplicar a futuras compras")
      setShowAdvanceModal(false)
      setAdvanceForm({ monto: "", forma_pago: "efectivo", referencia: "", observaciones: "" })
      await handleViewMovements(selectedAccount)
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo registrar el anticipo")
    } finally {
      setSubmittingAdvance(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.customer_id || !form.limite_credito) {
      toast.error("Error", "Seleccioná un cliente y definí el límite")
      return
    }
    setSubmitting(true)
    try {
      await api.creditAccounts.create({ customer_id: form.customer_id, limite_credito: parseFloat(form.limite_credito) })
      toast.success("Creada", "Línea de crédito habilitada correctamente")
      setShowModal(false)
      setForm({ customer_id: "", limite_credito: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la cuenta de crédito")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayment = async () => {
    if (!selectedAccount || !paymentForm.monto) {
      toast.error("Error", "Ingresá el monto del pago")
      return
    }
    setSubmitting(true)
    try {
      await api.creditAccounts.payment(selectedAccount.id, {
        monto: parseFloat(paymentForm.monto),
        observaciones: paymentForm.observaciones || undefined,
      })
      toast.success("Pago registrado", "El pago fue aplicado a la cuenta de crédito")
      setShowPaymentModal(false)
      setPaymentForm({ monto: "", observaciones: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el pago")
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = accounts.filter(a =>
    !search ||
    (a.customer_nombre?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (a.customer_ruc?.includes(search) ?? false)
  )

  const totalCredito = accounts.reduce((sum, a) => sum + (a.limite_credito || 0), 0)
  const totalUtilizado = accounts.reduce((sum, a) => sum + Number(a.saldo_utilizado || 0), 0)
  const totalDisponible = accounts.reduce((sum, a) => sum + Number(a.saldo_disponible || 0), 0)
  const clientesConMora = accounts.filter(a => Number(a.saldo_utilizado || 0) > (a.limite_credito || 0)).length

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up">
      {/* ── HEADER OPERATIVO ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
              Líneas de Crédito & Cupos
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Crédito Comercial & Cobranzas
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Gestión de cupos crediticios, recargo por mora, dunning automatizado vía WhatsApp y anticipos.
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRefreshing(true); fetchData(); fetchMora(); fetchDunning(); }}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-primary rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {moraConfigVisible && (
            <button onClick={() => setShowMoraSettings(true)} className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-gray-50">
              <Percent className="w-3.5 h-3.5 text-orange-500" />
              <span>Mora {moraConfig?.activo ? <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600">Activa</span> : <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-gray-100 text-gray-400">Off</span>}</span>
            </button>
          )}
          {dunningConfigVisible && (
            <button onClick={() => setShowDunningSettings(true)} className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-gray-50">
              <MessageCircle className="w-3.5 h-3.5 text-teal-500" />
              <span>Dunning {dunningConfig?.activo ? <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600">Activo</span> : <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-gray-100 text-gray-400">Off</span>}</span>
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="btn bg-primary text-white font-extrabold text-xs flex items-center gap-2 px-4 py-2 rounded-xl shadow-sm hover:opacity-90">
            <Plus className="w-4 h-4" /> <span>Nueva Línea de Crédito</span>
          </button>
        </div>
      </div>

      {/* ── KPIS CONSOLIDADOS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Cupo Otorgado</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">{formatPYG(totalCredito)}</div>
          <p className="text-[11px] text-gray-400 mt-1">{accounts.length} clientes con línea</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Crédito Utilizado</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-amber-500 mt-2">{formatPYG(totalUtilizado)}</div>
          <p className="text-[11px] text-gray-400 mt-1">
            {totalCredito > 0 ? `${Math.round((totalUtilizado / totalCredito) * 100)}% del cupo global` : "0%"}
          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Cupo Disponible</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-2">{formatPYG(totalDisponible)}</div>
          <p className="text-[11px] text-gray-400 mt-1">Disponible para compras</p>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Sobregiro / Excedidos</span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-red-600 dark:text-red-400 mt-2">{clientesConMora}</div>
          <p className="text-[11px] text-gray-400 mt-1">Cuentas que superan el límite</p>
        </div>
      </div>

      {/* ── NAVEGACIÓN POR PESTAÑAS (TABS OPERATIVAS) ───────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { key: "cuentas", label: "Líneas de Crédito & Cupos", icon: Wallet, count: accounts.length },
          { key: "mora", label: "Motor de Mora", icon: Percent, count: moraPreview?.items?.length },
          { key: "dunning", label: "Cobranzas (Dunning WhatsApp)", icon: MessageCircle, count: dunningPreview?.items?.length },
          { key: "aprobaciones", label: "Aprobaciones & Write-offs", icon: ShieldAlert, count: approvalRequests.length + writeoffRequests.length },
        ].map((t) => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
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
          {/* TAB 1: CUENTAS DE CRÉDITO */}
          {activeTab === "cuentas" && (
            <div className="space-y-5">
              {/* Buscador */}
              <div className="card p-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente o RUC..."
                    className="input-field pl-9 w-full text-xs"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Tabla de Cuentas */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                        <th className="p-3.5">Cliente</th>
                        <th className="p-3.5">RUC / CI</th>
                        <th className="p-3.5">Límite Otorgado</th>
                        <th className="p-3.5">Saldo Utilizado</th>
                        <th className="p-3.5">Disponible</th>
                        <th className="p-3.5">Uso del Cupo</th>
                        <th className="p-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                      {filtered.map(a => {
                        const limite = a.limite_credito || 0
                        const utilizado = Number(a.saldo_utilizado || 0)
                        const pctUso = limite > 0 ? Math.min(100, Math.round((utilizado / limite) * 100)) : 0
                        const isExcedido = utilizado > limite
                        return (
                          <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                              {a.customer_nombre || "Cliente"}
                            </td>
                            <td className="p-3.5 font-mono text-xs text-gray-500">
                              {a.customer_ruc || "—"}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                              {formatPYG(a.limite_credito)}
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-amber-600">
                              {formatPYG(a.saldo_utilizado || 0)}
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-emerald-600">
                              {formatPYG(a.saldo_disponible || 0)}
                            </td>
                            <td className="p-3.5 w-44">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px]">
                                  <span className={isExcedido ? "text-red-600 font-bold" : "text-gray-500"}>{pctUso}%</span>
                                  {isExcedido && <span className="text-red-600 text-[10px] font-bold">Sobregiro</span>}
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isExcedido ? "bg-red-500" : pctUso > 75 ? "bg-amber-500" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${pctUso}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleViewMovements(a)}
                                  className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1"
                                >
                                  <History className="w-3.5 h-3.5" /> Movimientos
                                </button>
                                <button
                                  onClick={() => { setSelectedAccount(a); setShowPaymentModal(true); }}
                                  className="btn-primary py-1 px-2.5 text-xs"
                                >
                                  Pagar a Cuenta
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
            </div>
          )}

          {/* TAB 2: MOTOR DE MORA */}
          {activeTab === "mora" && (
            <div className="space-y-5">
              <div className="card p-6 bg-gradient-to-br from-orange-900/10 to-slate-900 border border-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-orange-400 font-black uppercase tracking-wider block">Cálculo Diario de Intereses Moratorios</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Motor de Recargo por Mora</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                    Tasa actual: <span className="font-bold text-orange-600">{moraConfig?.porcentaje_mensual}% mensual</span> con <span className="font-bold text-orange-600">{moraConfig?.dias_gracia} días de gracia</span>. Cada recargo se aplica como un débito independiente en la cuenta del cliente.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowMoraSettings(true)} className="btn-outline text-xs">
                    <Settings2 className="w-3.5 h-3.5" /> Configurar Parámetros
                  </button>
                  <button
                    onClick={handleApplyMora}
                    disabled={applyingMora || !moraPreview || moraPreview.items.length === 0}
                    className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {applyingMora ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Percent className="w-3.5 h-3.5" />}
                    Aplicar Recargos ({formatPYG(moraPreview?.total_recargo || 0)})
                  </button>
                </div>
              </div>

              {/* Previsualización de Cuentas Afectadas */}
              <div className="card p-5">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3">
                  Cuentas con Recargo por Mora Pendiente ({moraPreview?.items?.length || 0})
                </h4>

                {!moraConfig?.activo ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    El motor de recargo por mora está desactivado. Activalo desde la configuración.
                  </div>
                ) : !moraPreview || moraPreview.items.length === 0 ? (
                  <div className="text-center py-10 text-emerald-600 space-y-2">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                    <div className="font-bold">No hay recargos por mora pendientes</div>
                    <p className="text-xs text-gray-400">Todas las cuentas están al día o dentro del período de gracia.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {moraPreview.items.map(i => (
                      <div key={i.credit_account_id} className="p-3.5 rounded-xl border bg-orange-50/30 dark:bg-orange-950/10 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-sm">{i.customer_nombre || "Cliente"}</div>
                          <div className="text-gray-400 text-[11px] mt-0.5">
                            {i.documentos_afectados} documento(s) vencido(s)
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block">Recargo Calculado</span>
                          <span className="font-mono font-bold text-sm text-orange-600">{formatPYG(i.recargo_total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DUNNING WHATSAPP */}
          {activeTab === "dunning" && (
            <div className="space-y-5">
              <div className="card p-6 bg-gradient-to-br from-teal-900/10 to-slate-900 border border-teal-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-teal-400 font-black uppercase tracking-wider block">Gestión Proactiva de Cobranzas</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Dunning Automatizado por WhatsApp</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                    Envío de recordatorios automáticos escalonados a clientes que superan los {dunningConfig?.buckets_dias.join(", ")} días de atraso.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDunningSettings(true)} className="btn-outline text-xs">
                    <Settings2 className="w-3.5 h-3.5" /> Plantilla & Tramos
                  </button>
                  <button
                    onClick={handleRunDunning}
                    disabled={runningDunning || !dunningPreview || dunningPreview.items.length === 0}
                    className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {runningDunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    Enviar Recordatorios ({dunningPreview?.items?.length || 0})
                  </button>
                </div>
              </div>

              <div className="card p-5">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3">
                  Clientes a Notificar Hoy ({dunningPreview?.items?.length || 0})
                </h4>

                {!dunningConfig?.activo ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    El sistema de dunning está desactivado. Activalo desde la configuración.
                  </div>
                ) : !dunningPreview || dunningPreview.items.length === 0 ? (
                  <div className="text-center py-10 text-emerald-600 space-y-2">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                    <div className="font-bold">No hay clientes pendientes de notificación</div>
                    <p className="text-xs text-gray-400">Todos los clientes en mora ya fueron notificados en sus respectivos tramos.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dunningPreview.items.map(i => (
                      <div key={`${i.customer_id}-${i.bucket_dias}`} className="p-3.5 rounded-xl border bg-teal-50/30 dark:bg-teal-950/10 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-sm">{i.customer_nombre || "Cliente"}</div>
                          <div className="text-gray-400 text-[11px] mt-0.5">
                            {i.documentos_count} facturas · {i.dias_mora} días de atraso (Tramo {i.bucket_dias}d)
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block">Deuda Vencida</span>
                          <span className="font-mono font-bold text-sm text-teal-600">{formatPYG(i.monto_total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: APROBACIONES & WRITE-OFFS */}
          {activeTab === "aprobaciones" && (
            <div className="space-y-6">
              {/* Bajas de Incobrables */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileX className="w-5 h-5 text-red-500" />
                      Bajas de Incobrables Pendientes (Write-offs)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Requiere doble aprobación de Gerencia y Finanzas antes de castigar la deuda</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                    {writeoffRequests.length} pendientes
                  </span>
                </div>

                {writeoffRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">No hay solicitudes de baja pendientes</div>
                ) : (
                  <div className="space-y-3">
                    {writeoffRequests.map(r => (
                      <div key={r.id} className="p-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="font-bold text-sm text-gray-900 dark:text-white">{r.customer_nombre || "Cliente"}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Monto propuesto: <span className="font-mono font-bold text-red-600">{formatPYG(r.monto)}</span></div>
                          <div className="text-xs text-gray-400 mt-1 italic">"{r.motivo}"</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveWriteoff(r.id)} disabled={writeoffApprovingId === r.id} className="btn-primary text-xs">
                            Aprobar Baja
                          </button>
                          <button onClick={() => handleRejectWriteoff(r.id)} disabled={writeoffApprovingId === r.id} className="btn-ghost text-xs text-red-600">
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Aprobaciones de Crédito */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                      Aprobaciones de Crédito Pendientes
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Ventas con sobregiro o aumento de límite temporal en el POS</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                    {approvalRequests.length} pendientes
                  </span>
                </div>

                {approvalRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">No hay ventas a crédito pendientes de autorización</div>
                ) : (
                  <div className="space-y-3">
                    {approvalRequests.map(req => (
                      <div key={req.id} className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="font-bold text-sm text-gray-900 dark:text-white">{req.customer_nombre || "Cliente"}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Monto de la Venta: <span className="font-mono font-bold text-amber-600">{formatPYG(req.monto_solicitado)}</span></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(req.id)} disabled={approvingId === req.id} className="btn-primary text-xs">
                            Aprobar
                          </button>
                          <button onClick={() => handleReject(req.id)} disabled={approvingId === req.id} className="btn-ghost text-xs text-red-600">
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Nueva Cuenta de Crédito */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Habilitar Línea de Crédito</h3>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="label-field">Cliente *</label>
                <select className="input-field" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Seleccionar cliente...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.razon_social || c.nombre} ({c.ruc || "Sin RUC"})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Límite de Crédito (₲) *</label>
                <input className="input-field font-mono" type="number" placeholder="Ej: 5000000" value={form.limite_credito} onChange={e => setForm({ ...form, limite_credito: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleSubmit} disabled={submitting || !form.customer_id || !form.limite_credito} className="btn-primary text-xs disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Habilitar Línea"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pago a Cuenta */}
      {showPaymentModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pago a Cuenta de Crédito</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selectedAccount.customer_nombre}</p>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="label-field">Monto a Pagar (₲) *</label>
                <input className="input-field font-mono" type="number" placeholder="0" value={paymentForm.monto} onChange={e => setPaymentForm({ ...paymentForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Observaciones</label>
                <input className="input-field" placeholder="Ej: Pago parcial entregado en caja central" value={paymentForm.observaciones} onChange={e => setPaymentForm({ ...paymentForm, observaciones: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowPaymentModal(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handlePayment} disabled={submitting || !paymentForm.monto} className="btn-primary text-xs disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Historial de Movimientos */}
      {showMovementsModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowMovementsModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Movimientos de Cuenta</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedAccount.customer_nombre} — Límite: {formatPYG(selectedAccount.limite_credito)}</p>
              </div>
              <button onClick={() => setShowAdvanceModal(true)} className="btn-outline text-xs flex items-center gap-1">
                <PiggyBank className="w-3.5 h-3.5 text-primary" /> Registrar Anticipo
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {advanceBalance > 0 && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <span>Saldo a Favor Disponible (Anticipos):</span>
                  <span className="font-mono font-bold text-sm">{formatPYG(advanceBalance)}</span>
                </div>
              )}

              {movements.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">Sin movimientos registrados en esta cuenta</div>
              ) : (
                <div className="space-y-2">
                  {movements.map(m => (
                    <div key={m.id} className="p-3 rounded-lg border flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white capitalize">{(m.tipo || "movimiento").replace("_", " ")}</div>
                        <div className="text-gray-400 text-[11px]">{m.created_at ? new Date(m.created_at).toLocaleString("es-PY") : ""} {m.observaciones ? `· ${m.observaciones}` : ""}</div>
                      </div>
                      <span className={`font-mono font-bold ${m.tipo === "cargo" ? "text-red-600" : "text-emerald-600"}`}>
                        {m.tipo === "cargo" ? "+ " : "- "}{formatPYG(m.monto || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setShowMovementsModal(false)} className="btn-outline text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Configurar Parámetros de Mora */}
      {showMoraSettings && (
        <div className="modal-overlay" onClick={() => setShowMoraSettings(false)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Parámetros de Recargo por Mora</h3>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="mora_active" checked={moraForm.activo} onChange={e => setMoraForm({ ...moraForm, activo: e.target.checked })} className="rounded text-primary" />
                <label htmlFor="mora_active" className="font-bold">Activar cálculo de mora</label>
              </div>
              <div>
                <label className="label-field">Tasa Mensual (%)</label>
                <input className="input-field font-mono" type="number" step="0.1" value={moraForm.porcentaje_mensual} onChange={e => setMoraForm({ ...moraForm, porcentaje_mensual: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Días de Gracia</label>
                <input className="input-field font-mono" type="number" value={moraForm.dias_gracia} onChange={e => setMoraForm({ ...moraForm, dias_gracia: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowMoraSettings(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleSaveMoraConfig} disabled={savingMora} className="btn-primary text-xs disabled:opacity-50">
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Configurar Dunning WhatsApp */}
      {showDunningSettings && (
        <div className="modal-overlay" onClick={() => setShowDunningSettings(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Configuración de Dunning (WhatsApp)</h3>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="dunning_active" checked={dunningForm.activo} onChange={e => setDunningForm({ ...dunningForm, activo: e.target.checked })} className="rounded text-primary" />
                <label htmlFor="dunning_active" className="font-bold">Activar envíos automáticos</label>
              </div>
              <div>
                <label className="label-field">Tramos de Días de Mora (separados por coma)</label>
                <input className="input-field font-mono" placeholder="3,7,15,30" value={dunningForm.buckets_dias} onChange={e => setDunningForm({ ...dunningForm, buckets_dias: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Plantilla del Mensaje</label>
                <textarea className="input-field" rows={4} placeholder="Hola {nombre}, te recordamos que tenés facturas vencidas..." value={dunningForm.mensaje_template} onChange={e => setDunningForm({ ...dunningForm, mensaje_template: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowDunningSettings(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleSaveDunningConfig} disabled={savingDunning} className="btn-primary text-xs disabled:opacity-50">
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Anticipo */}
      {showAdvanceModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowAdvanceModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Anticipo de Cliente</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selectedAccount.customer_nombre}</p>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div>
                <label className="label-field">Monto del Anticipo (₲) *</label>
                <input className="input-field font-mono" type="number" placeholder="0" value={advanceForm.monto} onChange={e => setAdvanceForm({ ...advanceForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Forma de Pago</label>
                <select className="input-field" value={advanceForm.forma_pago} onChange={e => setAdvanceForm({ ...advanceForm, forma_pago: e.target.value })}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="label-field">N° Referencia</label>
                <input className="input-field" placeholder="Ej: Transf. 129384" value={advanceForm.referencia} onChange={e => setAdvanceForm({ ...advanceForm, referencia: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Observaciones</label>
                <input className="input-field" placeholder="Ej: Anticipo para pedido especial" value={advanceForm.observaciones} onChange={e => setAdvanceForm({ ...advanceForm, observaciones: e.target.value })} />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowAdvanceModal(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleCreateAdvance} disabled={submittingAdvance || !advanceForm.monto} className="btn-primary text-xs disabled:opacity-50">
                {submittingAdvance ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Anticipo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
