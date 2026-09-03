import { useState, useEffect } from "react"
import {
  Banknote, ShieldAlert, ShieldCheck, History, RefreshCw, Loader2,
  TrendingDown, TrendingUp, AlertTriangle, Clock, Landmark, CheckCircle,
  XCircle, FileText, Lock, KeyRound, DollarSign, ArrowUpRight, ArrowDownRight,
  ChevronRight, Building2, Store, Activity, Layers, Download, Check, Sparkles, X,
  PackageCheck, Inbox, Send
} from "lucide-react"
import { api, type BankAccount, type BankTransaction, type VaultDashboard, type VaultEntry } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatDateTime } from "../../utils/format"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function downloadPdf(endpoint: string, filename: string) {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error("No se pudo generar el PDF")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

interface ApSupplierAging {
  supplier_id: string
  razon_social: string
  total_pendiente: string | number
  vencido: string | number
  por_vencer: string | number
}

interface ArCustomerAging {
  customer_id: string
  customer_name: string
  saldo_total: number
}

type ActiveVaultTab = "custodia" | "remesas" | "bancos" | "calce" | "movimientos"

export default function BovedaPage() {
  const [activeTab, setActiveTab] = useState<ActiveVaultTab>("custodia")
  const [remittances, setRemittances] = useState<any[]>([])
  const [receivingRemittanceId, setReceivingRemittanceId] = useState<string | null>(null)
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [deposits, setDeposits] = useState<BankTransaction[]>([])
  const [pendientes, setPendientes] = useState<{ id: string; titulo: string; monto_relacionado?: string; entidad_relacionada?: string }[]>([])
  const [apAging, setApAging] = useState<{ aging_buckets: { rango: string; monto: string; facturas: number }[]; por_supplier: ApSupplierAging[] } | null>(null)
  const [arAging, setArAging] = useState<{ buckets: { rango: string; monto: number; cantidad: number }[]; por_clientes: ArCustomerAging[] } | null>(null)
  const [movements, setMovements] = useState<{ id: string; tipo: string; monto: number; moneda: string; fecha: string; usuario: string; observaciones: string }[]>([])
  const [vault, setVault] = useState<VaultDashboard | null>(null)
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([])
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [depositing, setDepositing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [depositApprovals, setDepositApprovals] = useState<{
    id: string
    entry_ids: string[]
    monto_total_pyg: number
    estado: string
    aprobado_supervisor_id: string | null
    aprobado_gerente_id: string | null
    created_at: string
  }[]>([])
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [searchMovements, setSearchMovements] = useState("")

  const toast = useToast()

  const handleExportMovimientos = async () => {
    setExportingPdf(true)
    try {
      const hasta = new Date().toISOString().slice(0, 10)
      const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      await downloadPdf(`/v1/vault/export/movimientos.pdf?fecha_desde=${desde}&fecha_hasta=${hasta}`, "libro_movimientos_boveda.pdf")
    } catch {
      toast.error("Error", "No se pudo generar el PDF de movimientos")
    } finally {
      setExportingPdf(false)
    }
  }

  const load = async () => {
    try {
      const [bankList, deps, recs, ap, ar, movs, vaultData, entriesData, approvals, remList] = await Promise.all([
        api.financial.banks.list(),
        api.financial.banks.allTransactions({ categoria: "deposito_caja", limit: 100 }),
        api.financeAgent.recommendations("pending"),
        api.financial.aging(),
        api.accountsReceivable.aging(),
        api.caja.registerMovements(),
        api.vault.dashboard(),
        api.vault.entries({ estado: "en_boveda" }),
        api.vault.depositApprovals.list("pendiente"),
        api.caja.treasuryRemittances.list(),
      ])
      setBanks(bankList)
      setDeposits(deps)
      setPendientes(recs.filter(r => r.tipo === "deposito_pendiente"))
      setApAging(ap as any)
      setArAging(ar as any)
      setMovements(movs)
      setVault(vaultData)
      setVaultEntries(entriesData || [])
      setDepositApprovals(approvals)
      setRemittances(remList || [])
    } catch {
      setBanks([])
      setDeposits([])
      setPendientes([])
      setRemittances([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleReceiveRemittance = async (remId: string, numero: string) => {
    const obs = window.prompt(`Confirmar recepción del Remito ${numero} en Bóveda.\nObservaciones de recepción (opcional):`)
    if (obs === null) return
    setReceivingRemittanceId(remId)
    try {
      await api.caja.treasuryRemittances.receive(remId, { observaciones: obs.trim() || undefined })
      toast.success("Remesa Recibida", `Remito ${numero} ingresado formalmente a Bóveda.`)
      load()
    } catch (e: any) {
      toast.error("Error al recibir", e?.message || "No se pudo confirmar la recepción.")
    } finally {
      setReceivingRemittanceId(null)
    }
  }

  const handleDownloadRemitoPdf = async (remId: string, numero: string) => {
    try {
      await downloadPdf(`/v1/caja/treasury-remittances/${remId}/export/remito.pdf`, `remito_${numero}.pdf`)
      toast.success("Remito Descargado", `PDF del remito ${numero} generado.`)
    } catch {
      toast.error("Error", "No se pudo generar el PDF del remito.")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleEntry = (id: string) => {
    setSelectedEntries(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]))
  }

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositBankId, setDepositBankId] = useState("")
  const [depositBoleta, setDepositBoleta] = useState("")
  const [depositTransportadora, setDepositTransportadora] = useState("Prosegur")
  const [depositFecha, setDepositFecha] = useState(new Date().toISOString().slice(0, 10))
  const [depositObservaciones, setDepositObservaciones] = useState("")
  const [submittingDepositToBank, setSubmittingDepositToBank] = useState(false)

  const handleOpenDepositModal = () => {
    if (selectedEntries.length === 0) return
    if (banks.length > 0 && !depositBankId) {
      setDepositBankId(banks[0].id)
    }
    setShowDepositModal(true)
  }

  const handleSubmitDepositToBank = async () => {
    if (!depositBankId) {
      toast.warning("Seleccione una cuenta", "Debe elegir la cuenta bancaria de destino.")
      return
    }
    if (!depositBoleta.trim()) {
      toast.warning("Falta número de boleta", "Ingrese el número de boleta o comprobante bancario.")
      return
    }
    setSubmittingDepositToBank(true)
    try {
      await api.vault.depositToBank({
        entry_ids: selectedEntries,
        bank_account_id: depositBankId,
        numero_boleta: depositBoleta.trim(),
        transportadora: depositTransportadora,
        fecha_deposito: depositFecha,
        observaciones: depositObservaciones.trim() || undefined,
      })
      toast.success(
        "Depósito Bancario Registrado",
        `Boleta #${depositBoleta.trim()} registrada y acreditada en cuenta bancaria.`
      )
      setShowDepositModal(false)
      setSelectedEntries([])
      setDepositBoleta("")
      setDepositObservaciones("")
      load()
    } catch (e: any) {
      toast.error("Error al registrar depósito", e?.message || "Verifique los datos de la remesa.")
    } finally {
      setSubmittingDepositToBank(false)
    }
  }

  const handleApprove = async (id: string) => {
    setApprovalActionId(id)
    try {
      const result = await api.vault.depositApprovals.approve(id)
      toast.success(
        result.completo ? "Remesa ejecutada y depositada" : "Primera firma registrada",
        result.completo
          ? "Ambas firmas completas — los fondos se acreditaron en banco"
          : "Falta la segunda firma (Supervisor o Gerente)"
      )
      load()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo aprobar")
    } finally {
      setApprovalActionId(null)
    }
  }

  const handleReject = async (id: string) => {
    const motivo = window.prompt("Motivo del rechazo de la remesa:")
    if (!motivo) return
    setApprovalActionId(id)
    try {
      await api.vault.depositApprovals.reject(id, motivo)
      toast.success("Remesa rechazada", "La transferencia fue cancelada y los fondos permanecen en bóveda")
      load()
    } catch {
      toast.error("Error", "No se pudo rechazar")
    } finally {
      setApprovalActionId(null)
    }
  }

  // Cálculos
  const saldoTotalPYG = banks.filter(b => b.moneda === "PYG").reduce((s, b) => s + Number(b.saldo_actual || 0), 0)
  const saldoBovedaPYG = vault?.saldo_en_boveda_pyg || 0
  const saldoBovedaUSD = vault?.saldo_en_boveda_usd || 0
  const saldoBovedaBRL = vault?.saldo_en_boveda_brl || 0

  const bankName = (id?: string) => banks.find(b => b.id === id)?.banco || "Banco"

  const apVencido90 = Number(apAging?.aging_buckets?.find(b => b.rango.includes("+90"))?.monto || 0)
  const arVencido90 = Number(arAging?.buckets?.find(b => b.rango.includes("+90"))?.monto || 0)
  const apTotalPendiente = apAging?.aging_buckets?.reduce((s, b) => s + Number(b.monto || 0), 0) || 0

  const topProveedoresVencidos = [...(apAging?.por_supplier || [])]
    .sort((a, b) => Number(b.vencido || 0) - Number(a.vencido || 0))
    .filter(p => Number(p.vencido || 0) > 0)
    .slice(0, 5)

  const topClientesDeuda = [...(arAging?.por_clientes || [])]
    .sort((a, b) => Number(b.saldo_total || 0) - Number(a.saldo_total || 0))
    .slice(0, 5)

  const totalEntradas = movements.filter(m => m.tipo === "entrada" && m.moneda === "PYG").reduce((s, m) => s + m.monto, 0)
  const totalRetiros = movements.filter(m => m.tipo === "retiro" && m.moneda === "PYG").reduce((s, m) => s + m.monto, 0)

  const filteredMovements = movements.filter(m =>
    !searchMovements ||
    (m.usuario || "").toLowerCase().includes(searchMovements.toLowerCase()) ||
    (m.observaciones || "").toLowerCase().includes(searchMovements.toLowerCase()) ||
    (m.fecha || "").includes(searchMovements)
  )

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Lock className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    FINANZAS & TESORERÍA · CUSTODIA DE CAUDALES & REMESAS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Custodia Activa en Bóveda
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Bóveda Central & Tesorería
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Custodia de caudales, preparación de remesas blindadas, doble firma de seguridad (Supervisor / Gerencia) y arqueo multimoneda
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                💰 {formatPYG(saldoBovedaPYG)} en custodia
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                🏦 {banks.length} cuentas bancarias conciliadas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => { setRefreshing(true); load(); }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={handleExportMovimientos}
              disabled={exportingPdf}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-emerald-400" />}
              <span>Libro PDF</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Custodia en Bóveda</span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(saldoBovedaPYG)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">USD ${saldoBovedaUSD.toLocaleString("es-PY")} · BRL R${saldoBovedaBRL.toLocaleString("es-PY")}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldos Bancarios (PYG)</span>
              <Landmark className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {formatPYG(saldoTotalPYG)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">{banks.length} cuentas conciliadas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Entregas en Tránsito</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {vault?.entregas_pendientes || 0}
            </p>
            <p className="text-[11px] text-slate-400">Cierres POS esperando custodia</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Remesas Doble Firma</span>
              <KeyRound className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {depositApprovals.length}
            </p>
            <p className="text-[11px] text-slate-400">Supervisor + Gerencia</p>
          </div>
        </div>
      </div>

      {/* Alerta de Remesas con Doble Firma */}
      {depositApprovals.length > 0 && (
        <div className="p-4 border border-purple-500/30 bg-purple-500/10 rounded-3xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              Remesas de Bóveda a Banco Pendientes de Doble Autorización
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">{depositApprovals.length} solicitud(es) activa(s)</span>
          </div>
          <p className="text-xs text-slate-400">
            Las remesas que superan el límite de seguridad requieren la firma de dos usuarios distintos (Supervisor de Bóveda y Gerente de Finanzas).
          </p>

          <div className="space-y-2 pt-1">
            {depositApprovals.map(appr => (
              <div
                key={appr.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-purple-400">
                      {formatPYG(appr.monto_total_pyg)}
                    </span>
                    <span className="text-xs text-slate-400">· {appr.entry_ids?.length || 1} entrega(s)</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      {appr.aprobado_supervisor_id ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-amber-400" />}
                      Supervisor: {appr.aprobado_supervisor_id ? "Aprobado" : "Pendiente"}
                    </span>
                    <span className="flex items-center gap-1">
                      {appr.aprobado_gerente_id ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-amber-400" />}
                      Gerente: {appr.aprobado_gerente_id ? "Aprobado" : "Pendiente"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(appr.id)}
                    disabled={approvalActionId === appr.id}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs flex items-center gap-1.5 rounded-xl font-bold transition shadow-sm"
                  >
                    {approvalActionId === appr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Firmar</span>
                  </button>
                  <button
                    onClick={() => handleReject(appr.id)}
                    disabled={approvalActionId === appr.id}
                    className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-rose-500 border border-slate-200 dark:border-slate-700 text-xs rounded-xl hover:bg-rose-500/10 font-bold transition"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "custodia", label: "Custodia Física & Bóveda", icon: Lock, count: vaultEntries.length },
          { key: "remesas", label: "Sobres de Supervisión", icon: PackageCheck, count: remittances.filter(r => r.estado === "en_transito").length },
          { key: "bancos", label: "Cuentas Bancarias & Depósitos", icon: Landmark, count: banks.length },
          { key: "calce", label: "Auditoría de Calce (AP vs AR)", icon: Activity },
          { key: "movimientos", label: "Libro Diario de Bóveda", icon: History },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as ActiveVaultTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB 1: CUSTODIA FÍSICA & REMESAS */}
      {activeTab === "custodia" && (
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  Efectivo en Bóveda Listo para Remesa Bancaria
                </h3>
                <p className="text-xs text-gray-400">
                  Seleccioná las entregas de caja para preparar el depósito a la cuenta bancaria de Extra Supermercado.
                </p>
              </div>

              {selectedEntries.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedEntries.length} seleccionada(s)
                  </span>
                  <button
                    onClick={handleOpenDepositModal}
                    className="btn-primary !bg-indigo-600 hover:!bg-indigo-500 text-xs flex items-center gap-1.5"
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    Preparar Remesa a Banco
                  </button>
                </div>
              )}
            </div>

            {vaultEntries.length === 0 ? (
              <div className="text-center py-10 text-gray-400 space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500 opacity-50" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">No hay efectivo pendiente de remesa</p>
                <p className="text-xs text-gray-400">Todo el efectivo recibido de cajas ya fue depositado o está en proceso de remesa.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedEntries.length === vaultEntries.length}
                          onChange={() =>
                            setSelectedEntries(
                              selectedEntries.length === vaultEntries.length
                                ? []
                                : vaultEntries.map((e: VaultEntry) => e.id)
                            )
                          }
                          className="rounded text-indigo-600"
                        />
                      </th>
                      <th className="p-3">Fecha Recepción</th>
                      <th className="p-3">Origen</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Monto (PYG)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {vaultEntries.map((e: VaultEntry) => (
                      <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(e.id)}
                            onChange={() => toggleEntry(e.id)}
                            className="rounded text-indigo-600"
                          />
                        </td>
                        <td className="p-3 font-mono text-gray-500">{formatDateTime(e.created_at)}</td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white capitalize">{e.origen || "Recaudación de Caja"}</td>
                        <td className="p-3">
                          <span className="badge-info text-[10px]">{e.estado || "En Bóveda"}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatPYG(e.monto_pyg)}
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

      {/* TAB REMESAS: SOBRES ENVIADOS POR SUPERVISORES DE PISO */}
      {activeTab === "remesas" && (
        <div className="card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-indigo-600" />
                Lotes de Sobres Recibidos de Supervisores
              </h3>
              <p className="text-xs text-gray-400">
                Lotes de sobres de cierre de turno y sangrías (drop cash) entregados por supervisión para custodia en bóveda.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
              {remittances.length} remesa(s) registrada(s)
            </span>
          </div>

          {remittances.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <Inbox className="w-10 h-10 mx-auto text-indigo-400 opacity-50" />
              <p className="font-semibold text-gray-700 dark:text-gray-300">No hay remesas de sobres enviadas aún</p>
              <p className="text-xs text-gray-400">Cuando un supervisor consolide los sobres de caja en su PWA, aparecerán aquí para su recepción formal.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {remittances.map((r) => {
                const isPending = r.estado === "en_transito"
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPending
                        ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {r.numero}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isPending
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 animate-pulse"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                          >
                            {isPending ? "⏳ En Tránsito (Por Recibir)" : "✓ En Bóveda Central"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                          <span>Supervisor/a: <strong className="text-slate-700 dark:text-slate-200">{r.supervisor_nombre || "Supervisor"}</strong></span>
                          <span>·</span>
                          <span>Envío: {formatDateTime(r.fecha_envio || r.created_at)}</span>
                          {r.tesorero_nombre && (
                            <>
                              <span>·</span>
                              <span>Recibió: <strong className="text-slate-700 dark:text-slate-200">{r.tesorero_nombre}</strong> ({formatDateTime(r.fecha_recepcion)})</span>
                            </>
                          )}
                        </div>
                        {r.observaciones && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-0.5">
                            "{r.observaciones}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-slate-800">
                        <div className="text-left md:text-right">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            {r.total_sobres} sobre(s)
                          </span>
                          <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                            {formatPYG(r.total_pyg)}
                          </span>
                          {(r.total_usd > 0 || r.total_brl > 0) && (
                            <div className="text-[10px] font-mono text-slate-500">
                              {r.total_usd > 0 ? `US$ ${r.total_usd.toFixed(2)} ` : ""}
                              {r.total_brl > 0 ? `· R$ ${r.total_brl.toFixed(2)}` : ""}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleReceiveRemittance(r.id, r.numero)}
                              disabled={receivingRemittanceId === r.id}
                              className="btn-primary !bg-emerald-600 hover:!bg-emerald-500 text-xs flex items-center gap-1.5 shadow-sm"
                            >
                              {receivingRemittanceId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Recibir en Bóveda</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadRemitoPdf(r.id, r.numero)}
                            title="Descargar Remito Oficial PDF"
                            className="btn-outline !text-blue-600 dark:!text-blue-400 !border-blue-300 dark:!border-blue-800 text-xs flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Remito PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUENTAS BANCARIAS & DEPÓSITOS */}
      {activeTab === "bancos" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks.map(b => (
              <div key={b.id} className="card p-5 border hover:border-indigo-300 dark:hover:border-indigo-700 transition">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {b.banco}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{b.moneda}</span>
                </div>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white font-mono">
                  {formatPYG(Number(b.saldo_actual || 0))}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>N° de Cuenta:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">{b.numero_cuenta || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tipo:</span>
                    <span className="capitalize text-gray-700 dark:text-gray-300">{b.tipo || "Corriente"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Historial de Depósitos de Bóveda a Bancos
            </h3>

            {deposits.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No hay registros de depósitos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 font-bold uppercase">
                    <tr>
                      <th className="p-3">Banco Destino</th>
                      <th className="p-3">Concepto</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3 text-right">Monto</th>
                      <th className="p-3 text-center">Conciliado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {deposits.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-bold text-gray-900 dark:text-white">{bankName(tx.bank_account_id)}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{tx.descripcion || "Depósito de recaudación"}</td>
                        <td className="p-3 font-mono text-gray-500">{formatDate(tx.fecha)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          +{formatPYG(tx.monto)} {tx.moneda !== "PYG" ? tx.moneda : ""}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.conciliado
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          }`}>
                            {tx.conciliado ? "✓ Conciliado" : "Pendiente"}
                          </span>
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

      {/* TAB 3: CALCE DE LIQUIDEZ (AP VS AR) */}
      {activeTab === "calce" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pasivos Comerciales a Proveedores */}
            <div className={`card p-6 border ${apVencido90 > arVencido90 * 2 ? "border-red-500/30 bg-red-950/10" : ""}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Deuda Vencida a Proveedores (+90 días)
                </h3>
                {apVencido90 > arVencido90 * 2 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Atención Prioritaria
                  </span>
                )}
              </div>
              <p className="text-3xl font-extrabold text-red-500 font-mono mb-1">{formatPYG(apVencido90)}</p>
              <p className="text-xs text-gray-400 mb-4">de {formatPYG(apTotalPendiente)} total adeudado a proveedores</p>

              {topProveedoresVencidos.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedores Principales:</p>
                  {topProveedoresVencidos.map(p => (
                    <div key={p.supplier_id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                      <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{p.razon_social}</span>
                      <span className="font-mono font-bold text-red-500 shrink-0 ml-2">{formatPYG(Number(p.vencido))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Sin facturas vencidas a proveedores.</p>
              )}
            </div>

            {/* Cuentas por Cobrar a Clientes */}
            <div className="card p-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Cartera Vencida a Cobrar (+90 días)
              </h3>
              <p className="text-3xl font-extrabold text-amber-500 font-mono mb-1">{formatPYG(arVencido90)}</p>
              <p className="text-xs text-gray-400 mb-4">
                de {formatPYG(arAging?.buckets?.reduce((s, b) => s + b.monto, 0) || 0)} total a cobrar
              </p>

              {topClientesDeuda.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Clientes con Mayor Saldo:</p>
                  {topClientesDeuda.map(c => (
                    <div key={c.customer_id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-slate-800">
                      <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{c.customer_name}</span>
                      <span className="font-mono font-bold text-amber-500 shrink-0 ml-2">{formatPYG(c.saldo_total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Sin clientes en mora prolongada.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LIBRO DIARIO DE BÓVEDA */}
      {activeTab === "movimientos" && (
        <div className="card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Libro Diario de Movimientos de Bóveda
              </h3>
              <p className="text-xs text-gray-400">
                Registro de entradas (cierres de POS, sangrías) y salidas (remesas, pagos)
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="text-emerald-600 font-bold font-mono">+{formatPYG(totalEntradas)} Entradas</span>
              <span className="text-red-500 font-bold font-mono">-{formatPYG(totalRetiros)} Salidas</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 font-bold uppercase sticky top-0">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3">Concepto / Observaciones</th>
                  <th className="p-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">No hay movimientos registrados.</td>
                  </tr>
                ) : (
                  filteredMovements.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          m.tipo === "entrada"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}>
                          {m.tipo === "entrada" ? "↓ Entrada" : "↑ Salida / Retiro"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-gray-500">{formatDate(m.fecha)}</td>
                      <td className="p-3 font-bold text-gray-800 dark:text-gray-200">{m.usuario || "Supervisor"}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300 max-w-xs truncate" title={m.observaciones}>
                        {m.observaciones || "Recaudación de caja"}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold text-sm ${
                        m.tipo === "entrada" ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {m.tipo === "entrada" ? "+" : "-"}{formatPYG(m.monto)} {m.moneda !== "PYG" ? m.moneda : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL FORMAL: PREPARAR REMESA Y DEPÓSITO A BANCO ── */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in-up border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                Registrar Remesa Bancaria
              </h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete los datos del comprobante y transportadora de caudales para transferir formalmente las remesas de bóveda a la cuenta bancaria de Extra Supermercado.
            </p>

            {/* Resumen del Lote de Remesas Seleccionadas */}
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total a Depositar</span>
                <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {formatPYG(
                    vaultEntries
                      .filter((e) => selectedEntries.includes(e.id))
                      .reduce((sum, e) => sum + Number(e.monto_pyg || 0), 0)
                  )}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800/50">
                {selectedEntries.length} entrega(s) de caja
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Selector de Cuenta Bancaria */}
              <div>
                <label className="input-label font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Cuenta Bancaria Destino *
                </label>
                <select
                  value={depositBankId}
                  onChange={(e) => setDepositBankId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.banco} — {b.numero_cuenta || "Sin número"} ({b.moneda || "PYG"}) · Saldo: {formatPYG(b.saldo_actual || 0)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Número de Boleta de Depósito */}
              <div>
                <label className="input-label font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Número de Boleta / Comprobante Bancario *
                </label>
                <input
                  type="text"
                  value={depositBoleta}
                  onChange={(e) => setDepositBoleta(e.target.value)}
                  placeholder="Ej: 10849201"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Transportadora de Caudales */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="input-label font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Transportadora / Canal
                  </label>
                  <select
                    value={depositTransportadora}
                    onChange={(e) => setDepositTransportadora(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  >
                    <option value="Prosegur">Prosegur</option>
                    <option value="Yrendagüe">Yrendagüe</option>
                    <option value="Depósito en Ventanilla">Depósito Directo en Ventanilla</option>
                    <option value="Otro">Otro medio</option>
                  </select>
                </div>
                <div>
                  <label className="input-label font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Fecha de Depósito
                  </label>
                  <input
                    type="date"
                    value={depositFecha}
                    onChange={(e) => setDepositFecha(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="input-label font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  value={depositObservaciones}
                  onChange={(e) => setDepositObservaciones(e.target.value)}
                  placeholder="Ej: Remesa cierre de fin de semana turno tarde"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                disabled={submittingDepositToBank}
                className="btn-outline text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitDepositToBank}
                disabled={submittingDepositToBank}
                className="btn-primary !bg-indigo-600 hover:!bg-indigo-500 text-xs flex items-center gap-1.5"
              >
                {submittingDepositToBank ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar Depósito a Banco</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
