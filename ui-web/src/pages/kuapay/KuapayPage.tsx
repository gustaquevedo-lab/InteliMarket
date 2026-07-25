import { useState, useEffect } from "react"
import { QrCode, ExternalLink, Search, CheckCircle, XCircle, Clock, Loader2, DollarSign, Copy } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

export default function KuapayPage() {
  const [transactions, setTransactions] = useState<Array<{ id: string; order_id: string; amount: number; status: string; payment_method: string | null; qr_code: string | null; customer_email: string; customer_name: string; checkout_url: string | null; kuapay_id: string | null; created_at: string; updated_at: string | null }>>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({
    amount: "",
    description: "",
    order_id: "",
    customer_email: "",
    customer_name: "",
    customer_phone: "",
    customer_ci: "",
    payment_method: "qr",
  })
  const [creating, setCreating] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<{ qr_image_url: string | null; checkout_url: string | null; order_id: string } | null>(null)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.kuapay.transactions()
      setTransactions(data)
    } catch {
      toast.info("Kuapay", "Configurá Kuapay en las credenciales de la empresa")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = transactions.filter(t =>
    !search ||
    t.order_id.toLowerCase().includes(search.toLowerCase()) ||
    t.customer_email.toLowerCase().includes(search.toLowerCase()) ||
    t.customer_name.toLowerCase().includes(search.toLowerCase())
  )

  const totalApproved = transactions.filter(t => t.status === "approved").reduce((a, b) => a + b.amount, 0)
  const totalPending = transactions.filter(t => t.status === "pending").reduce((a, b) => a + b.amount, 0)

  const handleCheckout = async () => {
    if (!checkoutForm.amount || !checkoutForm.order_id || !checkoutForm.customer_email || !checkoutForm.customer_name) {
      toast.error("Error", "Completá los campos obligatorios")
      return
    }
    setCreating(true)
    try {
      const result = await api.kuapay.checkout({
        amount: parseInt(checkoutForm.amount),
        description: checkoutForm.description || `Pago orden ${checkoutForm.order_id}`,
        order_id: checkoutForm.order_id,
        customer_email: checkoutForm.customer_email,
        customer_name: checkoutForm.customer_name,
        customer_phone: checkoutForm.customer_phone || undefined,
        customer_ci: checkoutForm.customer_ci || undefined,
        payment_method: checkoutForm.payment_method || "qr",
      })
      setCheckoutResult({ qr_image_url: result.qr_image_url, checkout_url: result.checkout_url, order_id: result.order_id })
      toast.success("Pago creado", "QR generado exitosamente")
      setShowCheckout(false)
      setCheckoutForm({ amount: "", description: "", order_id: "", customer_email: "", customer_name: "", customer_phone: "", customer_ci: "", payment_method: "qr" })
      if (result.checkout_url) window.open(result.checkout_url, "_blank")
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creando pago"
      toast.error("Error", msg)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-6 h-6 text-primary" />
            Kuapay
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pagos por QR y billeteras digitales</p>
        </div>
        <button onClick={() => setShowCheckout(true)} className="btn-primary">
          <DollarSign className="w-4 h-4" />
          Nuevo cobro
        </button>
      </div>

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
          <div className="flex items-center gap-3 mb-2"><QrCode className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transacciones</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{transactions.length}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por orden, email o nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Orden</th>
              <th className="table-cell">Cliente</th>
              <th className="table-cell text-right">Monto</th>
              <th className="table-cell">Método</th>
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
                  <td className="table-td font-mono text-xs font-bold text-primary">{t.order_id}</td>
                  <td className="table-td">
                    <p className="text-sm font-medium">{t.customer_name}</p>
                    <p className="text-xs text-gray-400">{t.customer_email}</p>
                  </td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(t.amount)}</td>
                  <td className="table-td text-sm">
                    {t.payment_method ? (
                      <span className="font-mono">{t.payment_method}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="table-td">
                    <StatusBadge status={t.status} map={{
                      approved: "badge-success",
                      pending: "badge-warning",
                      rejected: "badge-danger",
                      refunded: "badge-info",
                      cancelled: "badge-danger",
                    }} />
                  </td>
                  <td className="table-td text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString("es-PY")}</td>
                  <td className="table-td">
                    <button className="btn-ghost" title="Ver QR / Checkout" onClick={async () => {
                      try {
                        const tx = await api.kuapay.getTransaction(t.id)
                        if (tx.checkout_url) window.open(tx.checkout_url, "_blank")
                        else if (tx.qr_image_url) {
                          setCheckoutResult({ qr_image_url: tx.qr_image_url, checkout_url: null, order_id: t.order_id })
                        }
                      } catch {
                        toast.error("Error", "No se pudo obtener el enlace")
                      }
                    }}>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {checkoutResult && (
        <div className="card p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3 mb-3">
            <QrCode className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-bold text-green-700 dark:text-green-400">Pago #{checkoutResult.order_id}</h3>
          </div>
          {checkoutResult.qr_image_url && (
            <div className="flex flex-col items-center gap-3 mb-4">
              <img src={checkoutResult.qr_image_url} alt="QR Code" className="w-48 h-48 border rounded-lg" />
              <p className="text-xs text-gray-500">Escaneá el QR con tu billetera digital</p>
            </div>
          )}
          {checkoutResult.checkout_url && (
            <div className="flex gap-2">
              <input className="input-field flex-1 font-mono text-xs" value={checkoutResult.checkout_url} readOnly />
              <button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(checkoutResult.checkout_url!); toast.success("Copiado", "Enlace copiado") }}><Copy className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      )}

      {showCheckout && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo cobro con Kuapay</h3>
              <button onClick={() => setShowCheckout(false)} className="btn-ghost"><XCircle className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Monto (PYG)</label>
                  <input className="input-field" type="number" placeholder="100000" value={checkoutForm.amount} onChange={(e) => setCheckoutForm({ ...checkoutForm, amount: e.target.value })} />
                </div>
                <div>
                  <label className="input-label label-required">Nro Orden</label>
                  <input className="input-field" placeholder="ORD-001" value={checkoutForm.order_id} onChange={(e) => setCheckoutForm({ ...checkoutForm, order_id: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label">Descripción</label>
                <input className="input-field" placeholder="Pago de factura..." value={checkoutForm.description} onChange={(e) => setCheckoutForm({ ...checkoutForm, description: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Método de pago</label>
                <select className="input-field" value={checkoutForm.payment_method} onChange={(e) => setCheckoutForm({ ...checkoutForm, payment_method: e.target.value })}>
                  <option value="qr">QR</option>
                  <option value="billetera">Billetera Digital</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Email cliente</label>
                  <input className="input-field" type="email" placeholder="cliente@email.com" value={checkoutForm.customer_email} onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_email: e.target.value })} />
                </div>
                <div>
                  <label className="input-label label-required">Nombre cliente</label>
                  <input className="input-field" placeholder="Juan Pérez" value={checkoutForm.customer_name} onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Teléfono</label>
                  <input className="input-field" placeholder="0981 123 456" value={checkoutForm.customer_phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_phone: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">CI/RUC</label>
                  <input className="input-field" placeholder="1234567" value={checkoutForm.customer_ci} onChange={(e) => setCheckoutForm({ ...checkoutForm, customer_ci: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowCheckout(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleCheckout} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generar QR de pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
