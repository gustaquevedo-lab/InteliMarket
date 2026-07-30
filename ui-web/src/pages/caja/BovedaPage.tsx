import { useState, useEffect } from "react"
import { Banknote, ShieldAlert, ShieldCheck, History, RefreshCw, Loader2, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import { api, type BankAccount, type BankTransaction } from "../../api"
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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const [bankList, deps, recs, ap, ar, movs] = await Promise.all([
        api.financial.banks.list(),
        api.financial.banks.allTransactions({ categoria: "deposito_caja", limit: 100 }),
        api.financeAgent.recommendations("pending"),
        api.financial.aging(),
        api.accountsReceivable.aging(),
        api.caja.registerMovements(),
      ])
      setBanks(bankList)
      setDeposits(deps)
      setPendientes(recs.filter(r => r.tipo === "deposito_pendiente"))
      setApAging(ap as any)
      setArAging(ar as any)
      setMovements(movs)
    } catch {
      setBanks([]); setDeposits([]); setPendientes([])
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

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
            Depósitos reales de cierres de caja hacia las cuentas bancarias — datos sincronizados desde el sistema legacy.
          </p>
        </div>
        <button onClick={() => { setRefreshing(true); load() }} disabled={refreshing} className="btn-ghost p-2 rounded-lg disabled:opacity-50">
          <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
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
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Cierres sin depositar
          </h3>
          {pendientes.length === 0 ? (
            <p className="text-xs text-gray-400">Sin cierres pendientes de depósito.</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-amber-500">{pendientes.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cierres de caja con efectivo contado sin ningún depósito bancario vinculado.{" "}
                <a href="/finance-agent" className="text-primary hover:underline font-semibold">Ver en el Gerente Financiero IA</a>
              </p>
            </>
          )}
        </div>
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
            <Banknote className="w-5 h-5 text-primary" /> Movimientos de caja principal
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
            <History className="w-5 h-5 text-primary" /> Últimos depósitos de caja
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
