import { useState, useEffect } from "react"
import { Wallet, Plus, Search, Loader2, X, Check, DollarSign, TrendingUp, TrendingDown, History } from "lucide-react"
import { api, type CreditAccount, type CreditMovement, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

export default function CreditAccountsPage() {
  const [accounts, setAccounts] = useState<CreditAccount[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
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
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [accountsData, customersData] = await Promise.allSettled([
        api.creditAccounts.list(),
        api.customers.list({ activo: true }),
      ])
      if (accountsData.status === "fulfilled") setAccounts(accountsData.value)
      if (customersData.status === "fulfilled") setCustomers(customersData.value)
    } catch {
      toast.info("Datos demo", "Conectá el backend para ver cuentas de crédito")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = accounts.filter(a => {
    const customer = customers.find(c => c.id === a.customer_id)
    return !search || (customer?.razon_social?.toLowerCase().includes(search.toLowerCase()) ?? false) || (customer?.ruc?.includes(search) ?? false)
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
    setShowMovementsModal(true)
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
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nueva cuenta
        </button>
      </div>

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
                const customer = customers.find(c => c.id === a.customer_id)
                const usoPct = (a.limite_credito || 0) > 0 ? Math.round(((a.saldo_utilizado || 0) / (a.limite_credito || 1)) * 100) : 0
                return (
                  <tr key={a.id} className="table-row">
                    <td className="table-td">
                      <p className="text-sm font-medium">{customer?.razon_social || "—"}</p>
                      <p className="text-xs text-gray-400">{customer?.ruc || customer?.ci || ""}</p>
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
                      <StatusBadge status={a.activo ? "activo" : "inactivo"} map={{ activo: "badge-success", inactivo: "badge-danger" }} />
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button className="btn-ghost text-green-500" title="Registrar pago" onClick={() => { setSelectedAccount(a); setPaymentForm({ monto: "", observaciones: "" }); setShowPaymentModal(true) }}><DollarSign className="w-4 h-4" /></button>
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
                <p className="font-bold">{customers.find(c => c.id === selectedAccount.customer_id)?.razon_social || "—"}</p>
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
              {movements.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Sin movimientos</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          {m.tipo === "compra" ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />}
                          <span className="text-sm font-bold capitalize">{m.tipo}</span>
                        </div>
                        {m.observaciones && <p className="text-xs text-gray-400 mt-1">{m.observaciones}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-mono font-bold ${m.tipo === "compra" ? "text-red-500" : "text-green-500"}`}>
                          {m.tipo === "compra" ? "+" : "-"}{formatPYG(m.monto)}
                        </p>
                        <p className="text-xs text-gray-400">{m.created_at ? new Date(m.created_at).toLocaleDateString("es-PY") : "—"}</p>
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
