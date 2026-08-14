import { useState, useEffect } from "react"
import { Wallet, CreditCard, Search, TrendingUp, ArrowUpRight, ArrowDownRight, Loader2, Plus, X } from "lucide-react"
import { api, type PaymentMethod, type Payment } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

export default function PaymentsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    tipo: "cobro",
    payment_method_id: "",
    monto: "",
    moneda: "PYG",
    referencia: "",
  })
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [methods, paymentsData] = await Promise.allSettled([
        api.paymentMethods.list(),
        api.payments.list(),
      ])
      if (methods.status === "fulfilled") setPaymentMethods(methods.value)
      if (paymentsData.status === "fulfilled") setPayments(paymentsData.value)
      if (methods.status === "rejected") toast.error("Error de conexión", "Conectá el backend para ver datos reales")
    } catch {
      toast.error("Error", "No se pudo cargar")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filteredPayments = payments.filter(p =>
    !search ||
    p.referencia?.toLowerCase().includes(search.toLowerCase()) ||
    (p.tipo || "").includes(search)
  )

  const cobros = payments.filter(p => p.tipo === "cobro").reduce((a, b) => a + Number(b.monto || 0), 0)
  const pagos = payments.filter(p => p.tipo === "pago").reduce((a, b) => a + Number(b.monto || 0), 0)

  const handleCreatePayment = async () => {
    if (!paymentForm.payment_method_id || !paymentForm.monto) {
      toast.error("Error", "Seleccioná un método y monto")
      return
    }
    try {
      await api.payments.create({
        tipo: paymentForm.tipo,
        payment_method_id: paymentForm.payment_method_id,
        monto: parseFloat(paymentForm.monto),
        moneda: paymentForm.moneda,
        referencia: paymentForm.referencia,
      })
      toast.success("Pago registrado", `${paymentForm.tipo} de ${formatPYG(parseFloat(paymentForm.monto))}`)
      setShowCreateModal(false)
      setPaymentForm({ tipo: "cobro", payment_method_id: "", monto: "", moneda: "PYG", referencia: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo registrar el pago")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pagos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Métodos de pago, cuentas corrientes y movimientos</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo movimiento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><ArrowUpRight className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cobros</span></div>
          <p className="text-2xl font-bold text-green-500">{formatPYG(cobros)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><ArrowDownRight className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pagos</span></div>
          <p className="text-2xl font-bold text-red-500">{formatPYG(pagos)}</p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Métodos de pago</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {paymentMethods.length > 0 ? (
          paymentMethods.map((m) => (
            <div key={m.id} className="card p-4 text-center">
              <CreditCard className={`w-6 h-6 mx-auto mb-2 ${m.activo ? "text-primary" : "text-gray-400"}`} />
              <p className="text-sm font-bold text-gray-900 dark:text-white">{m.nombre}</p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${m.activo ? "badge-success" : "badge-danger"}`}>{m.activo ? "Activo" : "Inactivo"}</span>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-gray-400 text-sm">
            No hay métodos de pago configurados todavía.
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar pago..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pagos recientes</h2>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Tipo</th>
              <th className="table-cell">Método</th>
              <th className="table-cell text-right">Monto</th>
              <th className="table-cell">Referencia</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filteredPayments.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No se encontraron pagos</td></tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="table-td"><span className={(p.tipo || "") === "cobro" ? "badge-success" : "badge-danger"}>{p.tipo || "—"}</span></td>
                  <td className="table-td text-sm">{p.metodo_pago?.nombre || p.payment_method_id || "—"}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(p.monto)}</td>
                  <td className="table-td font-mono text-xs">{p.referencia || "—"}</td>
                  <td className="table-td"><StatusBadge status={p.estado || "-"} /></td>
                  <td className="table-td text-sm text-gray-500">{p.fecha ? new Date(p.fecha).toLocaleDateString("es-PY") : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo movimiento</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPaymentForm({ ...paymentForm, tipo: "cobro" })} className={`p-3 rounded-xl text-sm font-bold transition-all ${paymentForm.tipo === "cobro" ? "bg-green-50 dark:bg-green-900/20 text-green-600 border-2 border-green-200 dark:border-green-800" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>Cobro</button>
                  <button onClick={() => setPaymentForm({ ...paymentForm, tipo: "pago" })} className={`p-3 rounded-xl text-sm font-bold transition-all ${paymentForm.tipo === "pago" ? "bg-red-50 dark:bg-red-900/20 text-red-600 border-2 border-red-200 dark:border-red-800" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>Pago</button>
                </div>
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select className="input-field" value={paymentForm.payment_method_id} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method_id: e.target.value })}>
                  <option value="">Seleccionar</option>
                  {paymentMethods.filter(m => m.activo).map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Monto</label>
                <input className="input-field" type="number" placeholder="0" value={paymentForm.monto} onChange={(e) => setPaymentForm({ ...paymentForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="label">Referencia (opcional)</label>
                <input className="input-field" placeholder="Nro comprobante, transferencia..." value={paymentForm.referencia} onChange={(e) => setPaymentForm({ ...paymentForm, referencia: e.target.value })} />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCreatePayment}>Registrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
