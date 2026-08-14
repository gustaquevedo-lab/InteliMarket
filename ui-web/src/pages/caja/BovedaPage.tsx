import { useState, useEffect } from "react"
import { Banknote, ShieldAlert, ShieldCheck, History, RefreshCw, Loader2, TrendingDown, TrendingUp, AlertTriangle, Vault, Clock, Landmark, CheckCircle, XCircle, FileText } from "lucide-react"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function downloadPdf(endpoint: string, filename: string) {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error("No se pudo generar el PDF")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
import { api, type BankAccount, type BankTransaction, type VaultDashboard } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

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

export default function BovedaPage() {
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [deposits, setDeposits] = useState<BankTransaction[]>([])
  const [pendientes, setPendientes] = useState<{ id: string; titulo: string; monto_relacionado?: string; entidad_relacionada?: string }[]>([])
  const [apAging, setApAging] = useState<{ aging_buckets: { rango: string; monto: string; facturas: number }[]; por_supplier: ApSupplierAging[] } | null>(null)
  const [arAging, setArAging] = useState<{ buckets: { rango: string; monto: number; cantidad: number }[]; por_clientes: ArCustomerAging[] } | null>(null)
  const [movements, setMovements] = useState<{ id: string; tipo: string; monto: number; moneda: string; fecha: string; usuario: string; observaciones: string }[]>([])
  const [vault, setVault] = useState<VaultDashboard | null>(null)
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [depositing, setDepositing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [depositApprovals, setDepositApprovals] = useState<{ id: string; entry_ids: string[]; monto_total_pyg: number; estado: string; aprobado_supervisor_id: string | null; aprobado_gerente_id: string | null; created_at: string }[]>([])
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const toast = useToast()

  const handleExportMovimientos = async () => {
    setExportingPdf(true)
    try {
      const hasta = new Date().toISOString().slice(0, 10)
      const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      await downloadPdf(`/v1/vault/export/movimientos.pdf?fecha_desde=${desde}&fecha_hasta=${hasta}`, "movimientos_de_boveda.pdf")
    } catch {
      toast.error("Error", "No se pudo generar el PDF de movimientos")
    } finally {
      setExportingPdf(false)
    }
  }

  const load = async () => {
    try {
      const [bankList, deps, recs, ap, ar, movs, vaultData, approvals] = await Promise.all([
        api.financial.banks.list(),
        api.financial.banks.allTransactions({ categoria: "deposito_caja", limit: 100 }),
        api.financeAgent.recommendations("pending"),
        api.financial.aging(),
        api.accountsReceivable.aging(),
        api.caja.registerMovements(),
        api.vault.dashboard(),
        api.vault.depositApprovals.list("pendiente"),
      ])
      setBanks(bankList)
      setDeposits(deps)
      setPendientes(recs.filter(r => r.tipo === "deposito_pendiente"))
      setApAging(ap as any)
      setArAging(ar as any)
      setMovements(movs)
      setVault(vaultData)
      setDepositApprovals(approvals)
    } catch {
      setBanks([]); setDeposits([]); setPendientes([])
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleEntry = (id: string) => setSelectedEntries(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const handleDeposit = async () => {
    if (selectedEntries.length === 0) return
    setDepositing(true)
    try {
      const result = await api.vault.deposit({ entry_ids: selectedEntries })
      if (result.pending_approval) {
        toast.success("Pendiente de aprobación", `Monto ${formatPYG(result.monto_total_pyg || 0)} supera el umbral — requiere aprobación de Supervisor y Gerente antes de depositarse`)
      } else {
        toast.success("Depósito registrado", `${result.depositadas} entrada(s) marcadas como depositadas`)
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
      toast.success(result.completo ? "Depósito ejecutado" : "Aprobación registrada", result.completo ? "Ambas firmas completas — el depósito se ejecutó" : "Falta la segunda firma (Supervisor o Gerente distinto)")
      load()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo aprobar")
    } finally {
      setApprovalActionId(null)
    }
  }

  const handleReject = async (id: string) => {
    const motivo = window.prompt("Motivo del rechazo:")
    if (!motivo) return
    setApprovalActionId(id)
    try {
      await api.vault.depositApprovals.reject(id, motivo)
      toast.success("Solicitud rechazada", "El depósito no se ejecutó")
      load()
    } catch {
      toast.error("Error", "No se pudo rechazar")
    } finally {
      setApprovalActionId(null)
    }
  }

  const saldoTotalPYG = banks.filter(b => b.moneda === "PYG").reduce((s, b) => s + Number(b.saldo_actual || 0), 0)
  const bankName = (id?: string) => banks.find(b => b.id === id)?.banco || "—"

  const apVencido90 = Number(apAging?.aging_buckets.find(b => b.rango.includes("+90"))?.monto || 0)
  const arVencido90 = Number(arAging?.buckets.find(b => b.rango.includes("+90"))?.monto || 0)
  const apTotalPendiente = apAging?.aging_buckets.reduce((s, b) => s + Number(b.monto || 0), 0) || 0
  const topProveedoresVencidos = [...(apAging?.por_supplier || [])]
    .sort((a, b) => Number(b.vencido || 0) - Number(a.vencido || 0))
    .filter(p => Number(p.vencido || 0) > 0)
    .slice(0, 5)
  const topClientesDeuda = [...(arAging?.por_clientes || [])]
    .sort((a, b) => Number(b.saldo_total || 0) - Number(a.saldo_total || 0))
    .slice(0, 5)

  const totalEntradas = movements.filter(m => m.tipo === "entrada" && m.moneda === "PYG").reduce((s, m) => s + m.monto, 0)
  const totalRetiros = movements.filter(m => m.tipo === "retiro" && m.moneda === "PYG").reduce((s, m) => s + m.monto, 0)

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary" size={28} /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-6 h-6 text-green-500" />
            Bóveda Central
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Custodia del efectivo: cajera → supervisor → bóveda → banco.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportMovimientos} disabled={exportingPdf} className="btn-ghost text-xs flex items-center gap-1.5 disabled:opacity-50">
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-red-500" />} Movimientos (PDF, 30 días)
          </button>
          <button onClick={() => { setRefreshing(true); load() }} disabled={refreshing} className="btn-ghost p-2 rounded-lg disabled:opacity-50">
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 bg-gradient-to-br from-green-900/10 to-slate-900 border border-green-500/20 md:col-span-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-green-400 font-black uppercase tracking-wider block">Saldo bancario total (PYG)</span>
            <p className="text-4xl font-extrabold text-white font-mono mt-2">{formatPYG(saldoTotalPYG)}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-green-400 font-semibold bg-green-500/10 py-1 px-3 rounded-full w-max">
              <ShieldCheck className="w-4 h-4" /> {banks.length} cuentas bancarias reales
            </div>
          </div>
          <Banknote className="w-20 h-20 text-green-500/20 hidden sm:block" />
        </div>

        <div className="card p-6 space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Entregas de cajeras sin confirmar
          </h3>
          {!vault || vault.entregas_pendientes === 0 ? (
            <p className="text-xs text-gray-400">Sin entregas pendientes.</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-amber-500">{vault.entregas_pendientes}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cierres de caja esperando que un supervisor confirme la recepción del efectivo.{" "}
                <a href="/caja" className="text-primary hover:underline font-semibold">Confirmar en Caja → Entregas</a>
              </p>
            </>
          )}
        </div>
      </div>

      {depositApprovals.length > 0 && (
        <div className="card p-5 border border-amber-500/30 bg-amber-500/[0.04] space-y-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Depósitos a bóveda pendientes de doble aprobación
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">Superan el umbral configurado — requieren firma de Supervisor y Gerente (personas distintas) antes de ejecutarse.</p>
          <div className="space-y-2">
            {depositApprovals.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white dark:bg-slate-800/60 rounded-lg p-3">
                <div>
                  <p className="font-mono font-bold text-gray-900 dark:text-white">{formatPYG(r.monto_total_pyg)}</p>
                  <p className="text-[10px] text-gray-400">{r.entry_ids.length} entrada(s) · {formatDate(r.created_at)}</p>
                  <div className="flex gap-2 mt-1 text-[10px] font-bold">
                    <span className={r.aprobado_supervisor_id ? "text-green-500" : "text-gray-400"}>{r.aprobado_supervisor_id ? "✓" : "○"} Supervisor</span>
                    <span className={r.aprobado_gerente_id ? "text-green-500" : "text-gray-400"}>{r.aprobado_gerente_id ? "✓" : "○"} Gerente</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(r.id)} disabled={approvalActionId === r.id} className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50">
                    {approvalActionId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Aprobar
                  </button>
                  <button onClick={() => handleReject(r.id)} disabled={approvalActionId === r.id} className="btn-ghost text-xs flex items-center gap-1 text-red-500 disabled:opacity-50">
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bóveda real — efectivo que efectivamente entró vía el flujo cajera -> supervisor de InteliMarket */}
      <div className="card p-6 space-y-4 border border-primary/20 bg-primary/[0.02]">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Vault className="w-5 h-5 text-primary" /> Efectivo real en bóveda
          </h3>
          {selectedEntries.length > 0 && (
            <button onClick={handleDeposit} disabled={depositing} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {depositing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
              Marcar {selectedEntries.length} como depositado{selectedEntries.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 -mt-2">Efectivo que un supervisor confirmó haber recibido de una cajera — a diferencia de la tabla de abajo (sincronizada del legado), esto lo produce el propio flujo de InteliMarket.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
            <span className="text-[10px] text-gray-400 font-black uppercase">En bóveda (₲)</span>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white font-mono">{formatPYG(vault?.saldo_en_boveda_pyg || 0)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
            <span className="text-[10px] text-gray-400 font-black uppercase">USD / R$ en bóveda</span>
            <p className="text-lg font-bold text-gray-900 dark:text-white font-mono">${(vault?.saldo_en_boveda_usd || 0).toFixed(2)} · R${(vault?.saldo_en_boveda_brl || 0).toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
            <span className="text-[10px] text-gray-400 font-black uppercase">Entradas sin depositar</span>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{vault?.entradas_en_boveda ?? 0}</p>
          </div>
        </div>
        {vault && vault.movimientos_recientes.filter(m => m.estado === "en_boveda").length > 0 && (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="table-cell w-8"></th>
                  <th className="table-cell">Origen</th>
                  <th className="table-cell">Fecha</th>
                  <th className="table-cell text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {vault.movimientos_recientes.filter(m => m.estado === "en_boveda").map((m) => (
                  <tr key={m.id} className="table-row cursor-pointer" onClick={() => toggleEntry(m.id)}>
                    <td className="table-td"><input type="checkbox" checked={selectedEntries.includes(m.id)} onChange={() => toggleEntry(m.id)} onClick={(e) => e.stopPropagation()} /></td>
                    <td className="table-td text-xs capitalize">{m.origen.replace("_", " ")}</td>
                    <td className="table-td text-xs text-gray-400">{formatDate(m.created_at)}</td>
                    <td className="table-td text-right font-mono font-bold text-green-600">
                      {formatPYG(m.monto_pyg)}{m.monto_usd > 0 ? ` +$${m.monto_usd.toFixed(2)}` : ""}{m.monto_brl > 0 ? ` +R$${m.monto_brl.toFixed(2)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alertas de cobranza y pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`card p-6 border ${apVencido90 > arVencido90 * 2 ? "border-red-500/30 bg-red-900/5" : "border-transparent"}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" /> Vencido a pagar (+90 días)
            </h3>
            {apVencido90 > arVencido90 * 2 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Riesgo alto
              </span>
            )}
          </div>
          <p className="text-3xl font-extrabold text-red-500 font-mono mb-1">{formatPYG(apVencido90)}</p>
          <p className="text-xs text-gray-400 mb-4">de {formatPYG(apTotalPendiente)} pendiente en total a proveedores</p>
          {topProveedoresVencidos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedores más vencidos</p>
              {topProveedoresVencidos.map((p) => (
                <div key={p.supplier_id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 truncate">{p.razon_social}</span>
                  <span className="font-mono font-bold text-red-500 flex-shrink-0 ml-2">{formatPYG(Number(p.vencido))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Sin facturas vencidas a proveedores.</p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-amber-500" /> Vencido a cobrar (+90 días)
          </h3>
          <p className="text-3xl font-extrabold text-amber-500 font-mono mb-1">{formatPYG(arVencido90)}</p>
          <p className="text-xs text-gray-400 mb-4">de {formatPYG(arAging?.buckets.reduce((s, b) => s + b.monto, 0) || 0)} pendiente en total de clientes</p>
          {topClientesDeuda.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Clientes con mayor saldo</p>
              {topClientesDeuda.map((c) => (
                <div key={c.customer_id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 truncate">{c.customer_name}</span>
                  <span className="font-mono font-bold text-amber-500 flex-shrink-0 ml-2">{formatPYG(c.saldo_total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Sin saldos pendientes de clientes.</p>
          )}
        </div>
      </div>

      {/* Movimientos de caja principal */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" /> Movimientos de caja principal (histórico, sincronizado del legado)
          </h3>
          <div className="flex gap-4 text-xs">
            <span className="text-green-500 font-bold">+{formatPYG(totalEntradas)} entradas</span>
            <span className="text-red-500 font-bold">-{formatPYG(totalRetiros)} retiros</span>
          </div>
        </div>
        {movements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin movimientos de caja principal registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Tipo</th>
                  <th className="table-cell">Fecha</th>
                  <th className="table-cell">Usuario</th>
                  <th className="table-cell">Observaciones</th>
                  <th className="table-cell text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 15).map((m) => (
                  <tr key={m.id} className="table-row">
                    <td className="table-td">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${m.tipo === "entrada" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {m.tipo === "entrada" ? "Entrada" : "Retiro"}
                      </span>
                    </td>
                    <td className="table-td text-xs text-gray-400">{formatDate(m.fecha)}</td>
                    <td className="table-td text-xs">{m.usuario || "—"}</td>
                    <td className="table-td text-xs text-gray-500 max-w-xs truncate" title={m.observaciones}>{m.observaciones || "—"}</td>
                    <td className={`table-td text-right font-mono font-bold ${m.tipo === "entrada" ? "text-green-600" : "text-red-500"}`}>
                      {m.tipo === "entrada" ? "+" : "-"}{formatPYG(m.monto)} {m.moneda !== "PYG" ? m.moneda : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Últimos depósitos bancarios (histórico, sincronizado del legado)
          </h3>
          <span className="text-xs text-gray-400">{deposits.length} movimientos</span>
        </div>

        {deposits.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">Sin depósitos registrados todavía.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Cuenta bancaria</th>
                  <th className="table-cell">Descripción</th>
                  <th className="table-cell">Fecha</th>
                  <th className="table-cell text-right">Monto</th>
                  <th className="table-cell">Conciliado</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((tx) => (
                  <tr key={tx.id} className="table-row">
                    <td className="table-td font-medium">{bankName(tx.bank_account_id)}</td>
                    <td className="table-td text-gray-600 dark:text-gray-300">{tx.descripcion || "—"}</td>
                    <td className="table-td text-xs text-gray-400">{formatDate(tx.fecha)}</td>
                    <td className="table-td text-right font-mono font-bold text-green-600">
                      +{formatPYG(tx.monto)} {tx.moneda !== "PYG" ? tx.moneda : ""}
                    </td>
                    <td className="table-td">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        tx.conciliado ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"
                      }`}>
                        {tx.conciliado ? <ShieldCheck className="w-3.5 h-3.5" /> : null} {tx.conciliado ? "Sí" : "No"}
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
  )
}
