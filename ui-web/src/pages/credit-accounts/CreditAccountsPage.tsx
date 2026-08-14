import { useState, useEffect } from "react"
import { Wallet, Plus, Search, Loader2, X, Check, DollarSign, TrendingUp, TrendingDown, History, ShieldAlert, Percent, Settings2, AlertCircle, Ban, FileX, MessageCircle, PiggyBank, ArrowRightLeft } from "lucide-react"
import { api, type CreditAccount, type CreditMovement, type Customer, type MoraConfig, type MoraPreviewResponse, type WriteoffRequest, type DunningConfig, type DunningPreviewResponse, type CustomerAdvance } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

export default function CreditAccountsPage() {
  const [accounts, setAccounts] = useState<CreditAccount[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [approvalRequests, setApprovalRequests] = useState<any[]>([])
  const [approvalRequestsVisible, setApprovalRequestsVisible] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showMovementsModal, setShowMovementsModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<CreditAccount | null>(null)
  const [movements, setMovements] = useState<CreditMovement[]>([])
  const [form, setForm] = useState({ customer_id: "", limite_credito: "" })
  const [paymentForm, setPaymentForm] = useState({ monto: "", observaciones: "" })
  const [submitting, setSubmitting] = useState(false)
  const [moraConfig, setMoraConfig] = useState<MoraConfig | null>(null)
  const [moraConfigVisible, setMoraConfigVisible] = useState(false)
  const [moraPreview, setMoraPreview] = useState<MoraPreviewResponse | null>(null)
  const [showMoraSettings, setShowMoraSettings] = useState(false)
  const [moraForm, setMoraForm] = useState({ activo: false, porcentaje_mensual: "2", dias_gracia: "0" })
  const [savingMora, setSavingMora] = useState(false)
  const [applyingMora, setApplyingMora] = useState(false)
  const [writeoffRequests, setWriteoffRequests] = useState<WriteoffRequest[]>([])
  const [writeoffRequestsVisible, setWriteoffRequestsVisible] = useState(false)
  const [writeoffApprovingId, setWriteoffApprovingId] = useState<string | null>(null)
  const [requestingWriteoffId, setRequestingWriteoffId] = useState<string | null>(null)
  const [dunningConfig, setDunningConfig] = useState<DunningConfig | null>(null)
  const [dunningConfigVisible, setDunningConfigVisible] = useState(false)
  const [dunningPreview, setDunningPreview] = useState<DunningPreviewResponse | null>(null)
  const [showDunningSettings, setShowDunningSettings] = useState(false)
  const [dunningForm, setDunningForm] = useState({ activo: false, buckets_dias: "3,7,15,30", mensaje_template: "" })
  const [savingDunning, setSavingDunning] = useState(false)
  const [runningDunning, setRunningDunning] = useState(false)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [advanceForm, setAdvanceForm] = useState({ monto: "", forma_pago: "", referencia: "", observaciones: "" })
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
      // 403 -- el usuario no tiene rol para ver/gestionar dunning
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
      await fetchDunning()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar la configuración (se requiere rol Gerente o Finanzas)")
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
        toast.success("Recordatorios enviados", `${result.enviados} mensaje(s) enviados${result.omitidos > 0 ? `, ${result.omitidos} omitidos (WhatsApp no configurado)` : ""}`)
      } else {
        toast.error("No se envió nada", "WhatsApp no está configurado para esta empresa (Twilio) — configuralo en IntelliZapp primero")
      }
      await fetchDunning()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo ejecutar el envío (se requiere rol Gerente o Finanzas)")
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
      // 403 -- el usuario no tiene rol para ver/gestionar recargo por mora
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
      // Un 403 aca significa que el usuario no es Supervisor/Gerente -- no
      // es un error, simplemente no ve la seccion de aprobaciones.
      if (requestsData.status === "fulfilled") {
        setApprovalRequests(requestsData.value)
        setApprovalRequestsVisible(true)
      }
      if (writeoffData.status === "fulfilled") {
        setWriteoffRequests(writeoffData.value)
        setWriteoffRequestsVisible(true)
      }
    } catch {
      toast.error("Error de conexión", "Conectá el backend para ver cuentas de crédito")
    } finally {
      setLoading(false)
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
      await fetchMora()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar la configuración (se requiere rol Gerente o Finanzas)")
    } finally {
      setSavingMora(false)
    }
  }

  const handleApplyMora = async () => {
    if (!moraPreview || moraPreview.items.length === 0) return
    if (!window.confirm(`Se van a generar ${moraPreview.items.length} cargo(s) por mora, por un total de ${formatPYG(moraPreview.total_recargo)}. Cada uno queda como documento separado en la cuenta del cliente. ¿Confirmar?`)) return
    setApplyingMora(true)
    try {
      const result = await api.creditAccounts.applyMora()
      toast.success("Recargos aplicados", `${result.aplicados} cuenta(s) por un total de ${formatPYG(result.total)}`)
      await fetchMora()
      await fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo aplicar el recargo (se requiere rol Gerente o Finanzas)")
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

  const handleRequestWriteoff = async (accountsReceivableId: string, referencia?: string) => {
    const motivo = window.prompt(`Motivo de la baja de incobrable${referencia ? ` (${referencia})` : ""}:`)
    if (!motivo) return
    setRequestingWriteoffId(accountsReceivableId)
    try {
      await api.writeoffRequests.create({ accounts_receivable_id: accountsReceivableId, motivo })
      toast.success("Solicitud creada", "Queda pendiente de aprobación de Gerente y Finanzas")
      fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo crear la solicitud de baja")
    } finally {
      setRequestingWriteoffId(null)
    }
  }

  const handleApproveWriteoff = async (id: string) => {
    setWriteoffApprovingId(id)
    try {
      const result = await api.writeoffRequests.approve(id)
      toast.success(
        result.completo ? "Baja aprobada" : "Aprobación registrada",
        result.completo ? "Ambas aprobaciones completas — el documento pasó a incobrable" : "Falta la segunda aprobación (Gerente o Finanzas)"
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

  const filtered = accounts.filter(a => {
    return !search || (a.customer_nombre?.toLowerCase().includes(search.toLowerCase()) ?? false) || (a.customer_ruc?.includes(search) ?? false)
  })

  const totalCredito = accounts.reduce((sum, a) => sum + (a.limite_credito || 0), 0)
  const totalUtilizado = accounts.reduce((sum, a) => sum + Number(a.saldo_utilizado || 0), 0)
  const totalDisponible = accounts.reduce((sum, a) => sum + Number(a.saldo_disponible || 0), 0)

  const handleSubmit = async () => {
    if (!form.customer_id || !form.limite_credito) {
      toast.error("Error", "Seleccioná un cliente y definí el límite")
      return
    }
    setSubmitting(true)
    try {
      await api.creditAccounts.create({ customer_id: form.customer_id, limite_credito: parseFloat(form.limite_credito) })
      toast.success("Creada", "Cuenta de crédito creada correctamente")
      setShowModal(false)
      setForm({ customer_id: "", limite_credito: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la cuenta")
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
      toast.success("Pago registrado", "El pago fue aplicado a la cuenta")
      setShowPaymentModal(false)
      setPaymentForm({ monto: "", observaciones: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el pago")
    } finally {
      setSubmitting(false)
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
      toast.success("Anticipo registrado", "Queda disponible para aplicar a futuras facturas")
      setShowAdvanceModal(false)
      setAdvanceForm({ monto: "", forma_pago: "", referencia: "", observaciones: "" })
      await handleViewMovements(selectedAccount)
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo registrar el anticipo")
    } finally {
      setSubmittingAdvance(false)
    }
  }

  const handleApplyAdvance = async (accountsReceivableId: string, saldoPendiente: number, referencia?: string) => {
    if (customerAdvancesList.length === 0) return
    const maxAplicable = Math.min(saldoPendiente, advanceBalance)
    const input = window.prompt(`Aplicar anticipo a ${referencia || "este documento"} (disponible: ${formatPYG(advanceBalance)}, saldo del documento: ${formatPYG(saldoPendiente)}). Monto a aplicar:`, String(maxAplicable))
    if (!input) return
    const monto = parseFloat(input)
    if (isNaN(monto) || monto <= 0) return
    setApplyingAdvanceId(accountsReceivableId)
    try {
      // Aplica contra el anticipo con mas saldo disponible primero
      const advance = customerAdvancesList.sort((a, b) => b.monto_disponible - a.monto_disponible)[0]
      const result = await api.customerAdvances.apply(advance.id, { accounts_receivable_id: accountsReceivableId, monto })
      toast.success("Anticipo aplicado", result.estado_documento === "pagado" ? "El documento quedó saldado" : `Saldo pendiente restante: ${formatPYG(result.saldo_pendiente_documento)}`)
      if (selectedAccount) await handleViewMovements(selectedAccount)
      fetchData()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo aplicar el anticipo")
    } finally {
      setApplyingAdvanceId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Cuentas de Crédito
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de crédito para clientes</p>
        </div>
        <div className="flex items-center gap-2">
          {moraConfigVisible && (
            <button onClick={() => setShowMoraSettings(true)} className="btn-outline flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Recargo por mora {moraConfig?.activo ? <span className="badge-success text-[10px]">activo</span> : <span className="badge-danger text-[10px]">apagado</span>}
            </button>
          )}
          {dunningConfigVisible && (
            <button onClick={() => setShowDunningSettings(true)} className="btn-outline flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Dunning WhatsApp {dunningConfig?.activo ? <span className="badge-success text-[10px]">activo</span> : <span className="badge-danger text-[10px]">apagado</span>}
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nueva cuenta
          </button>
        </div>
      </div>

      {moraConfig?.activo && moraPreview && moraPreview.items.length > 0 && (
        <div className="card p-5 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <h2 className="font-bold text-gray-900 dark:text-white">Recargo por mora pendiente de aplicar</h2>
              <span className="badge-warning">{moraPreview.items.length} cuenta(s)</span>
            </div>
            <button className="btn-primary" disabled={applyingMora} onClick={handleApplyMora}>
              {applyingMora ? <Loader2 className="w-4 h-4 animate-spin" /> : `Aplicar recargos — ${formatPYG(moraPreview.total_recargo)}`}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {moraConfig.porcentaje_mensual}% mensual, con {moraConfig.dias_gracia} día(s) de gracia — se calcula prorrateado por día sobre cada documento vencido. Al aplicar, cada cargo se crea como un documento nuevo y separado, nunca se mezcla con el monto original de la factura.
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {moraPreview.items.map(i => (
              <div key={i.credit_account_id} className="flex items-center justify-between text-sm px-2 py-1.5 bg-orange-50 dark:bg-orange-900/10 rounded">
                <span>{i.customer_nombre || "—"} <span className="text-xs text-gray-400">({i.documentos_afectados} doc.)</span></span>
                <span className="font-mono font-semibold text-orange-600">{formatPYG(i.recargo_total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dunningConfig?.activo && dunningPreview && dunningPreview.items.length > 0 && (
        <div className="card p-5 border-l-4 border-teal-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-teal-500" />
              <h2 className="font-bold text-gray-900 dark:text-white">Recordatorios de cobro pendientes de enviar</h2>
              <span className="badge-warning">{dunningPreview.items.length} cliente(s)</span>
            </div>
            <button className="btn-primary" disabled={runningDunning} onClick={handleRunDunning}>
              {runningDunning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar recordatorios ahora"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Clientes con deuda vencida que cruzaron un umbral de días de mora sin haber recibido aviso todavía para ese umbral. Solo se envía a clientes con teléfono cargado.
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {dunningPreview.items.map(i => (
              <div key={`${i.customer_id}-${i.bucket_dias}`} className="flex items-center justify-between text-sm px-2 py-1.5 bg-teal-50 dark:bg-teal-900/10 rounded">
                <span>{i.customer_nombre || "—"} <span className="text-xs text-gray-400">({i.documentos_count} doc., {i.dias_mora}d mora, umbral {i.bucket_dias}d)</span></span>
                <span className="font-mono font-semibold text-teal-600">{formatPYG(i.monto_total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {writeoffRequestsVisible && writeoffRequests.length > 0 && (
        <div className="card p-5 border-l-4 border-red-500">
          <div className="flex items-center gap-2 mb-4">
            <FileX className="w-5 h-5 text-red-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Bajas de incobrables pendientes</h2>
            <span className="badge-danger">{writeoffRequests.length}</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">Documentos propuestos como incobrables — no salen de la cartera hasta que un Gerente y alguien de Finanzas aprueben, cada uno por separado. La deuda sigue siendo real, solo se reconoce como pérdida esperada.</p>
          <div className="space-y-3">
            {writeoffRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{r.customer_nombre || "Cliente"}</p>
                    {r.numero_documento && <span className="text-xs text-gray-400 font-mono">{r.numero_documento}</span>}
                  </div>
                  <p className="text-xs text-gray-500">Monto: {formatPYG(r.monto)}</p>
                  <p className="text-xs text-gray-400 mt-1 italic">"{r.motivo}"</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Gerente: {r.aprobado_gerente_id ? "✓ aprobado" : "pendiente"} · Finanzas: {r.aprobado_finanzas_id ? "✓ aprobado" : "pendiente"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-primary" disabled={writeoffApprovingId === r.id} onClick={() => handleApproveWriteoff(r.id)}>
                    {writeoffApprovingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Aprobar</>}
                  </button>
                  <button className="btn-outline text-red-500" disabled={writeoffApprovingId === r.id} onClick={() => handleRejectWriteoff(r.id)}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvalRequestsVisible && approvalRequests.length > 0 && (
        <div className="card p-5 border-l-4 border-amber-500">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Aprobaciones de crédito pendientes</h2>
            <span className="badge-warning">{approvalRequests.length}</span>
          </div>
          <p className="text-xs text-gray-400 mb-4">Ventas a crédito que exceden el límite disponible o que quedaron retenidas por mora del cliente — sin stock descontado hasta que un Supervisor y un Gerente aprueben, cada uno por separado.</p>
          <div className="space-y-3">
            {approvalRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{r.customer_nombre || "Cliente"}</p>
                    {r.motivo === "mora" ? <span className="badge-danger text-[10px]">retenido por mora</span> : <span className="badge-warning text-[10px]">excede límite</span>}
                  </div>
                  <p className="text-xs text-gray-500">
                    Monto: {formatPYG(r.monto)} · Límite: {formatPYG(r.limite_credito)}
                    {r.motivo === "mora" ? "" : ` · Excedente: ${formatPYG(Math.max(0, r.monto - (r.saldo_disponible || 0)))}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Supervisor: {r.aprobado_supervisor_id ? "✓ aprobado" : "pendiente"} · Gerente: {r.aprobado_gerente_id ? "✓ aprobado" : "pendiente"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-primary" disabled={approvingId === r.id} onClick={() => handleApprove(r.id)}>
                    {approvingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Aprobar</>}
                  </button>
                  <button className="btn-outline text-red-500" disabled={approvingId === r.id} onClick={() => handleReject(r.id)}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Crédito Total</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPYG(totalCredito)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Utilizado</span></div>
          <p className="text-2xl font-bold text-amber-500">{formatPYG(totalUtilizado)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingDown className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Disponible</span></div>
          <p className="text-2xl font-bold text-green-500">{formatPYG(totalDisponible)}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por cliente o RUC..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Cliente</th>
              <th className="table-cell text-right">Límite</th>
              <th className="table-cell text-right">Utilizado</th>
              <th className="table-cell text-right">Disponible</th>
              <th className="table-cell">Uso</th>
              <th className="table-cell">Mora</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay cuentas de crédito</td></tr>
            ) : (
              filtered.map((a) => {
                const usoPct = (a.limite_credito || 0) > 0 ? Math.round(((a.saldo_utilizado || 0) / (a.limite_credito || 1)) * 100) : 0
                return (
                  <tr key={a.id} className="table-row">
                    <td className="table-td">
                      <p className="text-sm font-medium">{a.customer_nombre || "—"}</p>
                      <p className="text-xs text-gray-400">{a.customer_ruc || ""}</p>
                    </td>
                    <td className="table-td text-right font-mono font-bold">{formatPYG(a.limite_credito)}</td>
                    <td className="table-td text-right font-mono text-amber-500">{formatPYG(a.saldo_utilizado)}</td>
                    <td className="table-td text-right font-mono text-green-500">{formatPYG(a.saldo_disponible)}</td>
                    <td className="table-td">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className={`h-2 rounded-full ${usoPct > 80 ? "bg-red-500" : usoPct > 50 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${usoPct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{usoPct}%</p>
                    </td>
                    <td className="table-td">
                      {(a.dias_mora_max ?? 0) > 0 ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${a.en_mora ? "bg-red-50 dark:bg-red-900/20 text-red-600" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600"}`}>
                          {a.dias_mora_max}d
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="table-td">
                      {a.en_mora ? (
                        <span className="badge-danger" title="Bloqueado para nuevas ventas a crédito por mora — requiere aprobación Supervisor+Gerente">Bloqueado (mora)</span>
                      ) : (
                        <StatusBadge status={a.activo ? "activo" : "inactivo"} map={{ activo: "badge-success", inactivo: "badge-danger" }} />
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button className="btn-ghost text-green-500" title="Registrar pago" onClick={() => { setSelectedAccount(a); setPaymentForm({ monto: "", observaciones: "" }); setShowPaymentModal(true) }}><DollarSign className="w-4 h-4" /></button>
                        <button className="btn-ghost text-teal-500" title="Registrar anticipo" onClick={() => { setSelectedAccount(a); setAdvanceForm({ monto: "", forma_pago: "", referencia: "", observaciones: "" }); setShowAdvanceModal(true) }}><PiggyBank className="w-4 h-4" /></button>
                        <button className="btn-ghost" title="Ver movimientos" onClick={() => handleViewMovements(a)}><History className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mora Settings Modal */}
      {showMoraSettings && (
        <div className="modal-overlay" onClick={() => setShowMoraSettings(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Recargo por mora
              </h3>
              <button onClick={() => setShowMoraSettings(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
                <div>
                  <p className="text-sm font-bold">Activar recargo por mora</p>
                  <p className="text-xs text-gray-400">Apagado por defecto. No afecta facturas ya emitidas hasta que apliques los cargos.</p>
                </div>
                <input type="checkbox" className="w-5 h-5" checked={moraForm.activo} onChange={(e) => setMoraForm({ ...moraForm, activo: e.target.checked })} />
              </label>
              <div>
                <label className="input-label">Porcentaje mensual (%)</label>
                <input className="input-field" type="number" step="0.1" min="0" value={moraForm.porcentaje_mensual} onChange={(e) => setMoraForm({ ...moraForm, porcentaje_mensual: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Días de gracia</label>
                <input className="input-field" type="number" min="0" value={moraForm.dias_gracia} onChange={(e) => setMoraForm({ ...moraForm, dias_gracia: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Días de mora que no generan recargo antes de empezar a contar.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowMoraSettings(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleSaveMoraConfig} disabled={savingMora}>
                  {savingMora ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dunning Settings Modal */}
      {showDunningSettings && (
        <div className="modal-overlay" onClick={() => setShowDunningSettings(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Dunning automático (WhatsApp)
              </h3>
              <button onClick={() => setShowDunningSettings(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer">
                <div>
                  <p className="text-sm font-bold">Activar recordatorios automáticos</p>
                  <p className="text-xs text-gray-400">Apagado por defecto. Corre todos los días a las 9am si está activo, y requiere WhatsApp configurado en IntelliZapp.</p>
                </div>
                <input type="checkbox" className="w-5 h-5" checked={dunningForm.activo} onChange={(e) => setDunningForm({ ...dunningForm, activo: e.target.checked })} />
              </label>
              <div>
                <label className="input-label">Umbrales de días de mora</label>
                <input className="input-field" placeholder="3,7,15,30" value={dunningForm.buckets_dias} onChange={(e) => setDunningForm({ ...dunningForm, buckets_dias: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Separados por coma. Un aviso por cliente y umbral cruzado, nunca se repite el mismo umbral.</p>
              </div>
              <div>
                <label className="input-label">Mensaje</label>
                <textarea className="input-field" rows={4} value={dunningForm.mensaje_template} onChange={(e) => setDunningForm({ ...dunningForm, mensaje_template: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Variables disponibles: {"{cliente}"}, {"{empresa}"}, {"{monto}"}, {"{dias_mora}"}</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowDunningSettings(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleSaveDunningConfig} disabled={savingDunning}>
                  {savingDunning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advance (Anticipo) Modal */}
      {showAdvanceModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowAdvanceModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="w-5 h-5" />
                Registrar anticipo
              </h3>
              <button onClick={() => setShowAdvanceModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-500">Cliente</p>
                <p className="font-bold">{selectedAccount.customer_nombre || "—"}</p>
              </div>
              <div>
                <label className="input-label label-required">Monto (PYG)</label>
                <input className="input-field" type="number" placeholder="1000000" value={advanceForm.monto} onChange={(e) => setAdvanceForm({ ...advanceForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Forma de pago</label>
                <input className="input-field" placeholder="efectivo, transferencia..." value={advanceForm.forma_pago} onChange={(e) => setAdvanceForm({ ...advanceForm, forma_pago: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Referencia</label>
                <input className="input-field" placeholder="Nro. de recibo, comprobante..." value={advanceForm.referencia} onChange={(e) => setAdvanceForm({ ...advanceForm, referencia: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Observaciones</label>
                <input className="input-field" value={advanceForm.observaciones} onChange={(e) => setAdvanceForm({ ...advanceForm, observaciones: e.target.value })} />
              </div>
              <p className="text-xs text-gray-400">Queda como saldo a favor disponible para aplicar a futuras facturas de este cliente.</p>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowAdvanceModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleCreateAdvance} disabled={submittingAdvance}>
                  {submittingAdvance ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva cuenta de crédito</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label label-required">Cliente</label>
                <select className="input-field" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Seleccionar cliente...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.razon_social} {c.ruc ? `(${c.ruc})` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label label-required">Límite de crédito (PYG)</label>
                <input className="input-field" type="number" placeholder="5000000" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar pago</h3>
              <button onClick={() => setShowPaymentModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-sm text-gray-500">Cliente</p>
                <p className="font-bold">{selectedAccount.customer_nombre || "—"}</p>
                <p className="text-sm text-gray-500 mt-2">Saldo actual</p>
                <p className="text-xl font-bold text-amber-500">{formatPYG(selectedAccount.saldo_utilizado)}</p>
              </div>
              <div>
                <label className="input-label label-required">Monto (PYG)</label>
                <input className="input-field" type="number" placeholder="1000000" value={paymentForm.monto} onChange={(e) => setPaymentForm({ ...paymentForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Observaciones</label>
                <input className="input-field" placeholder="Referencia del pago..." value={paymentForm.observaciones} onChange={(e) => setPaymentForm({ ...paymentForm, observaciones: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowPaymentModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handlePayment} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movements Modal */}
      {showMovementsModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowMovementsModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5" />
                Movimientos
              </h3>
              <button onClick={() => setShowMovementsModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6">
              {advanceBalance > 0 && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-teal-50 dark:bg-teal-900/10 rounded-lg">
                  <PiggyBank className="w-4 h-4 text-teal-600" />
                  <p className="text-sm text-teal-700 dark:text-teal-400">
                    Saldo a favor disponible: <span className="font-bold">{formatPYG(advanceBalance)}</span> — se puede aplicar a cualquier factura pendiente de abajo.
                  </p>
                </div>
              )}
              {movements.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Sin movimientos</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          {m.tipo === "compra" || m.tipo === "recargo_mora" ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />}
                          <span className="text-sm font-bold capitalize">{m.tipo === "compra" ? "Factura" : m.tipo === "recargo_mora" ? "Recargo por mora" : "Pago"}</span>
                          {m.referencia && <span className="text-xs text-gray-400 font-mono">{m.referencia}</span>}
                          {m.estado === "pendiente" && (m.dias_mora ?? 0) > 0 && <span className="badge-danger text-[10px]">{m.dias_mora}d mora</span>}
                          {m.estado === "pagado" && <span className="badge-success text-[10px]">pagada</span>}
                          {m.estado === "incobrable" && <span className="badge-danger text-[10px]">incobrable</span>}
                        </div>
                        {m.observaciones && <p className="text-xs text-gray-400 mt-1">{m.observaciones}</p>}
                        {m.saldo_pendiente != null && m.saldo_pendiente > 0 && <p className="text-xs text-amber-500 mt-1">Saldo pendiente: {formatPYG(m.saldo_pendiente)}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-mono font-bold ${m.tipo === "compra" || m.tipo === "recargo_mora" ? "text-red-500" : "text-green-500"}`}>
                          {m.tipo === "compra" || m.tipo === "recargo_mora" ? "+" : "-"}{formatPYG(m.monto)}
                        </p>
                        <p className="text-xs text-gray-400">{m.fecha ? new Date(m.fecha).toLocaleDateString("es-PY") : "—"}</p>
                        {m.tipo === "compra" && m.estado === "pendiente" && advanceBalance > 0 && (
                          <button
                            className="text-xs text-teal-500 hover:underline flex items-center gap-1 mt-1 ml-auto"
                            disabled={applyingAdvanceId === m.id}
                            onClick={() => handleApplyAdvance(m.id, m.saldo_pendiente ?? 0, m.referencia)}
                            title="Aplicar anticipo disponible"
                          >
                            <ArrowRightLeft className="w-3 h-3" />Aplicar anticipo
                          </button>
                        )}
                        {m.tipo === "compra" && m.estado === "pendiente" && (
                          <button
                            className="text-xs text-red-500 hover:underline flex items-center gap-1 mt-1 ml-auto"
                            disabled={requestingWriteoffId === m.id}
                            onClick={() => handleRequestWriteoff(m.id, m.referencia)}
                            title="Solicitar baja de incobrable"
                          >
                            <Ban className="w-3 h-3" />Dar de baja
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
