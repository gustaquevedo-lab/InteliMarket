import { useState, useEffect } from "react"
import {
  Banknote, ShieldAlert, ShieldCheck, History, RefreshCw, Loader2,
  TrendingDown, TrendingUp, AlertTriangle, Clock, Landmark, CheckCircle,
  XCircle, FileText, Lock, KeyRound, DollarSign, ArrowUpRight, ArrowDownRight,
  ChevronRight, Building2, Store, Activity, Layers, Download, Check, Sparkles
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

type ActiveVaultTab = "custodia" | "bancos" | "calce" | "movimientos"

export default function BovedaPage() {
  const [activeTab, setActiveTab] = useState<ActiveVaultTab>("custodia")
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
      const [bankList, deps, recs, ap, ar, movs, vaultData, entriesData, approvals] = await Promise.all([
        api.financial.banks.list(),
        api.financial.banks.allTransactions({ categoria: "deposito_caja", limit: 100 }),
        api.financeAgent.recommendations("pending"),
        api.financial.aging(),
        api.accountsReceivable.aging(),
        api.caja.registerMovements(),
        api.vault.dashboard(),
        api.vault.entries({ estado: "en_boveda" }),
        api.vault.depositApprovals.list("pendiente"),
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
    } catch {
      setBanks([])
      setDeposits([])
      setPendientes([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleEntry = (id: string) => {
    setSelectedEntries(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]))
  }

  const handleDeposit = async () => {
    if (selectedEntries.length === 0) return
    setDepositing(true)
    try {
      const result = await api.vault.deposit({ entry_ids: selectedEntries })
      if (result.pending_approval) {
        toast.success(
          "Remesa pendiente de doble aprobación",
          `Monto ${formatPYG(result.monto_total_pyg || 0)} supera el umbral de seguridad — requiere autorización de Supervisor y Gerente`
        )
      } else {
        toast.success("Depósito a banco registrado", `${result.depositadas} remesa(s) transferidas a cuenta bancaria`)
      }
      setSelectedEntries([])
      load()
    } catch {
      toast.error("Error", "No se pudo registrar el depósito")
    } finally {
      setDepositing(false)
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
      {/* ── HEADER OPERATIVO ──────────────────────────────────────────────── */}
            {/* ── BANNER HERO EJECUTIVO BÓVEDA CENTRAL ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-emerald-400 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Custodia de Caudales & Remesas Bancarias
                </span>
                <h1 className="text-2xl sm:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate tracking-tight text-white">
                  Bóveda Central & Tesorería
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium">
              Custodia física de caudales en bóveda, preparación de remesas blindadas a bancos, doble firma de seguridad (Supervisor / Gerencia) y arqueo multimoneda.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Custodia Total en Bóveda
              </span>
              <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-emerald-400 leading-tight">
                {formatPYG(saldoBovedaPYG)}
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                USD ${saldoBovedaUSD.toLocaleString("es-PY")} · BRL R${saldoBovedaBRL.toLocaleString("es-PY")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setRefreshing(true); load(); }}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition shadow-xs"
                title="Actualizar datos en vivo"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleExportMovimientos}
                disabled={exportingPdf}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-primary" />}
                <span>Libro PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

{/* ── KPIS CONSOLIDADOS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Efectivo en Bóveda */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Custodia en Bóveda
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
            {formatPYG(saldoBovedaPYG)}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs font-mono text-gray-500">
            <span>USD ${saldoBovedaUSD.toLocaleString("es-PY")}</span>
            <span>·</span>
            <span>BRL R${saldoBovedaBRL.toLocaleString("es-PY")}</span>
          </div>
        </div>

        {/* Saldos Bancarios */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Saldos Bancarios (PYG)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-blue-600 dark:text-blue-400 mt-2">
            {formatPYG(saldoTotalPYG)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1 font-mono">
            {banks.length} cuentas bancarias conciliadas
          </p>
        </div>

        {/* Entregas de Caja Pendientes */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Entregas en Tránsito
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-amber-600 dark:text-amber-400 mt-2">
            {vault?.entregas_pendientes || 0}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Cierres de POS esperando custodia
          </p>
        </div>

        {/* Doble Aprobación Remesas */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Remesas Doble Firma
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-purple-600 dark:text-purple-400 mt-2">
            {depositApprovals.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Supervisor + Gerencia
          </p>
        </div>
      </div>

      {/* Alerta de Remesas con Doble Firma */}
      {depositApprovals.length > 0 && (
        <div className="card p-4 border border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-600" />
              Remesas de Bóveda a Banco Pendientes de Doble Autorización
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-600 border border-purple-500/20">{depositApprovals.length} solicitud(es) activa(s)</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Las remesas que superan el límite de seguridad requieren la firma de dos usuarios distintos (Supervisor de Bóveda y Gerente de Finanzas).
          </p>

          <div className="space-y-2 pt-1">
            {depositApprovals.map(appr => (
              <div
                key={appr.id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-purple-600 dark:text-purple-400">
                      {formatPYG(appr.monto_total_pyg)}
                    </span>
                    <span className="text-xs text-gray-400">· {appr.entry_ids?.length || 1} entrega(s)</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      {appr.aprobado_supervisor_id ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Clock className="w-3 h-3 text-amber-500" />}
                      Supervisor: {appr.aprobado_supervisor_id ? "Aprobado" : "Pendiente"}
                    </span>
                    <span className="flex items-center gap-1">
                      {appr.aprobado_gerente_id ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Clock className="w-3 h-3 text-amber-500" />}
                      Gerente: {appr.aprobado_gerente_id ? "Aprobado" : "Pendiente"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(appr.id)}
                    disabled={approvalActionId === appr.id}
                    className="btn bg-purple-600 hover:bg-purple-700 text-white !py-1.5 !px-3 text-xs flex items-center gap-1.5 rounded-xl font-bold"
                  >
                    {approvalActionId === appr.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Firmar</span>
                  </button>
                  <button
                    onClick={() => handleReject(appr.id)}
                    disabled={approvalActionId === appr.id}
                    className="btn bg-white dark:bg-slate-800 text-red-600 border border-gray-200 dark:border-gray-700 !py-1.5 !px-3 text-xs rounded-xl hover:bg-red-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs de Navegación */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "custodia", label: "Custodia Física & Remesas", icon: Lock, count: vaultEntries.length },
            { key: "bancos", label: "Cuentas Bancarias & Depósitos", icon: Landmark, count: banks.length },
            { key: "calce", label: "Auditoría de Calce (AP vs AR)", icon: Activity },
            { key: "movimientos", label: "Libro Diario de Bóveda", icon: History },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as ActiveVaultTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${activeTab === t.key
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === t.key ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
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
                    onClick={handleDeposit}
                    disabled={depositing}
                    className="btn-primary !bg-indigo-600 hover:!bg-indigo-500 text-xs flex items-center gap-1.5"
                  >
                    {depositing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
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
    </div>
  )
}
