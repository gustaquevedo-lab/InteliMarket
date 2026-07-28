import { useState, useEffect } from "react"
import { Banknote, ShieldAlert, ShieldCheck, History, RefreshCw, Loader2 } from "lucide-react"
import { api, type BankAccount, type BankTransaction } from "../../api"
import { formatPYG, formatDate } from "../../utils/format"

export default function BovedaPage() {
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [deposits, setDeposits] = useState<BankTransaction[]>([])
  const [pendientes, setPendientes] = useState<{ id: string; titulo: string; monto_relacionado?: string; entidad_relacionada?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const [bankList, deps, recs] = await Promise.all([
        api.financial.banks.list(),
        api.financial.banks.allTransactions({ categoria: "deposito_caja", limit: 100 }),
        api.financeAgent.recommendations("pending"),
      ])
      setBanks(bankList)
      setDeposits(deps)
      setPendientes(recs.filter(r => r.tipo === "deposito_pendiente"))
    } catch {
      setBanks([]); setDeposits([]); setPendientes([])
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const saldoTotalPYG = banks.filter(b => b.moneda === "PYG").reduce((s, b) => s + Number(b.saldo_actual || 0), 0)
  const bankName = (id?: string) => banks.find(b => b.id === id)?.banco || "—"

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
