import { useState, useEffect } from "react"
import { Wallet, Plus, Search, Loader2, X, DollarSign, TrendingUp, TrendingDown, History, AlertTriangle } from "lucide-react"
import { api, type CreditAccount, type CreditMovement, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

export default function CreditAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showMovementsModal, setShowMovementsModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null)
  const [movements, setMovements] = useState<CreditMovement[]>([])
  const [form, setForm] = useState({ customer_id: "", limite_credito: "", dias_plazo: "30" })
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
      toast.info("Sin datos", "Conectá el backend para ver cuentas de crédito")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = accounts.filter(a => {
    const custName = a.customer_name || customers.find(c => c.id === a.customer_id)?.razon_social || ""
    const custRuc = a.customer_ruc || customers.find(c => c.id === a.customer_id)?.ruc || ""
    const term = search.toLowerCase()
    return !search || custName.toLowerCase().includes(term) || custRuc.toLowerCase().includes(term)
  })

  const totalCredito = accounts.reduce((sum, a) => sum + (a.limite_credito || 0), 0)
  const totalUtilizado = accounts.reduce((sum, a) => sum + (a.saldo_utilizado || 0), 0)
  const totalDisponible = accounts.reduce((sum, a) => sum + (a.saldo_disponible || 0), 0)

  const handleSubmit = async () => {
    if (!form.customer_id || !form.limite_credito) {
      toast.error("Error", "Seleccioná un cliente y definí el límite")
      return
    }
    setSubmitting(true)
    try {
      await api.creditAccounts.create({ customer_id: form.customer_id, limite_credito: parseFloat(form.limite_credito), dias_plazo: parseInt(form.dias_plazo) || 30 })
      toast.success("Creada", "Cuenta de crédito creada correctamente")
      setShowModal(false)
      setForm({ customer_id: "", limite_credito: "", dias_plazo: "30" })
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

  const handleViewMovements = async (account: any) => {
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Líneas y Cuentas de Crédito
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de cupos crediticios, saldos utilizados y cobranzas</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>+ Nueva Línea de Crédito</span>
        </button>
      </div>

      {/* Unified Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 border-l-4 border-l-blue-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Crédito Total Concedido</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{formatPYG(totalCredito)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Línea de crédito autorizada</span>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Crédito Utilizado</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{formatPYG(totalUtilizado)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Deuda cliente en cartera</span>
        </div>

        <div className="card p-4 border-l-4 border-l-emerald-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Crédito Disponible</span>
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(totalDisponible)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Margen disponible para ventas</span>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10 text-xs font-medium" placeholder="Buscar por Razón Social de Cliente o RUC..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-outline text-xs">Actualizar</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Cliente</th>
              <th className="table-cell text-right">Límite Crédito</th>
              <th className="table-cell text-right">Utilizado (Deuda)</th>
              <th className="table-cell text-right">Disponible</th>
              <th className="table-cell text-center min-w-[140px]">Consumo Cupo</th>
              <th className="table-cell text-right">Plazo</th>
              <th className="table-cell text-center">Estado</th>
              <th className="table-cell text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay cuentas de crédito registradas</td></tr>
            ) : (
              filtered.map((a) => {
                const custName = a.customer_name || customers.find(c => c.id === a.customer_id)?.razon_social || "Cliente Sin Nombre"
                const custRuc = a.customer_ruc || customers.find(c => c.id === a.customer_id)?.ruc || "Sin RUC"
                
                const usoPct = (a.limite_credito || 0) > 0 ? Math.round(((a.saldo_utilizado || 0) / a.limite_credito) * 100) : ((a.saldo_utilizado || 0) > 0 ? 100 : 0)
                const isOverflow = (a.limite_credito || 0) > 0 && a.saldo_utilizado > a.limite_credito

                return (
                  <tr key={a.id} className="table-row">
                    <td className="table-td">
                      <p className="font-bold text-gray-900 dark:text-white">{custName}</p>
                      <p className="text-[11px] text-gray-400 font-mono">RUC: {custRuc}</p>
                    </td>
                    <td className="table-td text-right font-mono font-bold">{formatPYG(a.limite_credito)}</td>
                    <td className="table-td text-right font-mono font-bold text-amber-500">{formatPYG(a.saldo_utilizado)}</td>
                    <td className="table-td text-right font-mono font-bold text-emerald-500">{formatPYG(a.saldo_disponible)}</td>
                    <td className="table-td text-center">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${isOverflow ? "bg-red-600" : usoPct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(Math.max(usoPct, 0), 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        {isOverflow ? (
                          <span className="px-1.5 py-0.2 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-black rounded text-[9px] uppercase tracking-wider">
                            Excedido ({usoPct}%)
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-mono font-medium">{usoPct}%</span>
                        )}
                      </div>
                    </td>
                    <td className="table-td text-right font-mono text-gray-500">{a.dias_plazo ?? 30} días</td>
                    <td className="table-td text-center">
                      <StatusBadge status={a.activo ? "activo" : "inactivo"} map={{ activo: "badge-success", inactivo: "badge-danger" }} />
                    </td>
                    <td className="table-td text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="btn-ghost text-emerald-600 hover:text-emerald-700 p-1.5" title="Registrar entrega de valor / pago" onClick={() => { setSelectedAccount(a); setPaymentForm({ monto: "", observaciones: "" }); setShowPaymentModal(true) }}>
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button className="btn-ghost p-1.5" title="Ver historial de movimientos" onClick={() => handleViewMovements(a)}>
                          <History className="w-4 h-4 text-primary" />
                        </button>
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
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Línea de Crédito</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Cliente</label>
                <select className="input-field font-medium text-sm" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">-- Seleccionar cliente --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.razon_social} ({c.ruc || "Sin RUC"})</option>)}
                </select>
              </div>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Límite de Crédito (₲)</label>
                <input className="input-field font-mono text-sm" type="number" placeholder="5000000" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} />
              </div>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Plazo de Pago (Días)</label>
                <input className="input-field font-mono text-sm" type="number" placeholder="30" value={form.dias_plazo} onChange={(e) => setForm({ ...form, dias_plazo: e.target.value })} />
                <p className="text-gray-400 mt-1 text-[11px]">Días desde la emisión de la factura hasta el vencimiento</p>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Línea"}
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
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Registrar Pago a la Cuenta</h3>
              <button onClick={() => setShowPaymentModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-bold text-sm text-gray-900 dark:text-white">{selectedAccount.customer_name || "Cliente"}</p>
                <p className="text-gray-400">Saldo Utilizado: <span className="font-mono font-bold text-amber-500">{formatPYG(selectedAccount.saldo_utilizado)}</span></p>
              </div>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Monto del Pago (₲)</label>
                <input className="input-field font-mono text-lg text-emerald-600 font-bold" type="number" placeholder="Monto a abonar" value={paymentForm.monto} onChange={(e) => setPaymentForm({ ...paymentForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="input-label uppercase tracking-wider font-bold">Observaciones / Referencia</label>
                <input className="input-field font-medium" placeholder="Ej. Recibo de dinero N° 1082" value={paymentForm.observaciones} onChange={(e) => setPaymentForm({ ...paymentForm, observaciones: e.target.value })} />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowPaymentModal(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handlePayment} disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar Pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movements Modal */}
      {showMovementsModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowMovementsModal(false)}>
          <div className="modal-content max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Historial de Cuenta de Crédito</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{selectedAccount.customer_name || "Cliente"}</h3>
              </div>
              <button onClick={() => setShowMovementsModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-cell">Fecha</th>
                      <th className="table-cell">Tipo</th>
                      <th className="table-cell text-right">Monto</th>
                      <th className="table-cell text-right">Saldo Ant.</th>
                      <th className="table-cell text-right">Saldo Nuevo</th>
                      <th className="table-cell">Ref / Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin movimientos registrados</td></tr>
                    ) : movements.map(m => (
                      <tr key={m.id} className="table-row">
                        <td className="table-td text-gray-500">{new Date(m.created_at).toLocaleString("es-PY")}</td>
                        <td className="table-td font-bold uppercase">{m.tipo}</td>
                        <td className="table-td text-right font-mono font-bold">{formatPYG(m.monto)}</td>
                        <td className="table-td text-right font-mono text-gray-400">{formatPYG(m.saldo_anterior)}</td>
                        <td className="table-td text-right font-mono font-bold text-primary">{formatPYG(m.saldo_nuevo)}</td>
                        <td className="table-td text-gray-500">{m.observaciones || m.referencia_type || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
