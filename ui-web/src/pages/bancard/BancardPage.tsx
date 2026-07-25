import { useState, useEffect } from "react"
import { CreditCard, ExternalLink, Search, CheckCircle, XCircle, Clock, Loader2, DollarSign, Eye } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

type Tab = "dashboard" | "transacciones"

interface Transaction {
  id: string
  sale_id?: string
  monto?: number
  moneda?: string
  estado: string
  transaccion_id?: string
  numero_tarjeta?: string
  cuotas?: number
  checkout_url?: string
  fecha?: string
  created_at: string
}

export default function BancardPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({ monto: "", descripcion: "", order_id: "" })
  const [creating, setCreating] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState("")
  const [verifying, setVerifying] = useState<string | null>(null)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.bancard.payments()
      setTransactions(data)
    } catch {
      toast.info("Datos demo", "Configurá Bancard en las credenciales de la empresa")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = transactions.filter(t =>
    !search ||
    (t.transaccion_id && t.transaccion_id.toLowerCase().includes(search.toLowerCase())) ||
    (t.sale_id && t.sale_id.toLowerCase().includes(search.toLowerCase()))
  )

  const totalApproved = transactions.filter(t => t.estado === "aprobado" || t.estado === "approved").reduce((a, b) => a + (b.monto || 0), 0)
  const totalPending = transactions.filter(t => t.estado === "pendiente" || t.estado === "pending").reduce((a, b) => a + (b.monto || 0), 0)

  const handleCheckout = async () => {
    if (!checkoutForm.monto || !checkoutForm.order_id) {
      toast.error("Error", "Completá los campos obligatorios")
      return
    }
    setCreating(true)
    try {
      const result = await api.bancard.checkout(parseInt(checkoutForm.monto), checkoutForm.descripcion || `Pago orden ${checkoutForm.order_id}`, checkoutForm.order_id)
      setCheckoutUrl(result.checkout_url || "")
      toast.success("Pago creado", "Redirigiendo al checkout de Bancard...")
      setShowCheckout(false)
      setCheckoutForm({ monto: "", descripcion: "", order_id: "" })
      if (result.checkout_url) window.open(result.checkout_url, "_blank")
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creando pago"
      toast.error("Error", msg)
    } finally {
      setCreating(false)
    }
  }

  const handleVerify = async (paymentId: string) => {
    setVerifying(paymentId)
    try {
      const result = await api.bancard.verify(paymentId)
      toast.success("Verificado", `Estado: ${result.estado}`)
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error verificando pago"
      toast.error("Error", msg)
    } finally {
      setVerifying(null)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "transacciones", label: "Transacciones" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Bancard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pasarela de pagos con tarjeta</p>
        </div>
        <button onClick={() => setShowCheckout(true)} className="btn-primary">
          <DollarSign className="w-4 h-4" />
          Nuevo cobro
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aprobados</span></div>
              <p className="text-2xl font-bold text-green-500">{formatPYG(totalApproved)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pendientes</span></div>
              <p className="text-2xl font-bold text-amber-500">{formatPYG(totalPending)}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><CreditCard className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transacciones</span></div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{transactions.length}</p>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por transacción u orden..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button onClick={fetchData} className="btn-outline">Actualizar</button>
          </div>
        </>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Transacción</th>
              <th className="table-cell text-right">Monto</th>
              <th className="table-cell">Tarjeta</th>
              <th className="table-cell">Cuotas</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Fecha</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay transacciones</td></tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="table-row">
                  <td className="table-td font-mono text-xs font-bold text-primary">{t.transaccion_id || t.id}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(t.monto || 0)}</td>
                  <td className="table-td text-sm">
                    {t.numero_tarjeta ? (
                      <span className="font-mono">•••• {t.numero_tarjeta.slice(-4)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="table-td text-sm">{t.cuotas ? `${t.cuotas}x` : "—"}</td>
                  <td className="table-td">
                    <StatusBadge status={t.estado} map={{
                      approved: "badge-success",
                      aprobado: "badge-success",
                      pending: "badge-warning",
                      pendiente: "badge-warning",
                      rejected: "badge-danger",
                      rechazado: "badge-danger",
                      cancelled: "badge-danger",
                      cancelado: "badge-danger",
                      refunded: "badge-info",
                    }} />
                  </td>
                  <td className="table-td text-sm text-gray-500">{new Date(t.created_at || t.fecha || "").toLocaleDateString("es-PY")}</td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <button className="btn-ghost" title="Verificar" onClick={() => handleVerify(t.id)} disabled={verifying === t.id}>
                        {verifying === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {t.checkout_url && (
                        <button className="btn-ghost" title="Abrir checkout" onClick={() => window.open(t.checkout_url, "_blank")}>
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {checkoutUrl && (
        <div className="card p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-bold text-green-700 dark:text-green-400">Checkout creado</h3>
          </div>
          <p className="text-sm text-green-600 dark:text-green-300 mb-3">Se abrió en una nueva pestaña.</p>
          <div className="flex gap-2">
            <input className="input-field flex-1 font-mono text-xs" value={checkoutUrl} readOnly />
            <button className="btn-outline" onClick={() => { navigator.clipboard.writeText(checkoutUrl); toast.success("Copiado", "Enlace copiado") }}>Copiar</button>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo cobro con Bancard</h3>
              <button onClick={() => setShowCheckout(false)} className="btn-ghost"><XCircle className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label label-required">Monto (PYG)</label>
                <input className="input-field" type="number" placeholder="100000" value={checkoutForm.monto} onChange={(e) => setCheckoutForm({ ...checkoutForm, monto: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Descripción</label>
                <input className="input-field" placeholder="Pago de factura..." value={checkoutForm.descripcion} onChange={(e) => setCheckoutForm({ ...checkoutForm, descripcion: e.target.value })} />
              </div>
              <div>
                <label className="input-label label-required">Nro Orden</label>
                <input className="input-field" placeholder="ORD-001" value={checkoutForm.order_id} onChange={(e) => setCheckoutForm({ ...checkoutForm, order_id: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowCheckout(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleCheckout} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar enlace de pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
