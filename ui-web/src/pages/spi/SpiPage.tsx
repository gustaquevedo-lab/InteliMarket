import { useState, useEffect } from "react"
import { QrCode, Search, CheckCircle, XCircle, Clock, Loader2, DollarSign, RefreshCw } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

export default function SpiPage() {
  const [transactions, setTransactions] = useState<Array<{ id: string; order_id?: string; amount?: number; status?: string; merchant_name?: string | null; description?: string | null; customer_email?: string | null; customer_name?: string | null; bcp_transaction_id?: string | null; created_at?: string; updated_at?: string | null }>>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({ amount: "", order_id: "", description: "" })
  const [creating, setCreating] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<{ qr_image_url?: string; qr_image_base64?: string; order_id?: string } | null>(null)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await api.spi.transactions()
      setTransactions(data)
    } catch {
      toast.info("SPI QR", "Configurá SPI QR en las credenciales de la empresa")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = transactions.filter(t =>
    !search ||
    (t.order_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (t.customer_name ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const totalApproved = transactions.filter(t => t.status === "approved").reduce((a, b) => a + (b.amount ?? 0), 0)
  const totalPending = transactions.filter(t => t.status === "pending").reduce((a, b) => a + (b.amount ?? 0), 0)

  const handleCheckout = async () => {
    if (!checkoutForm.amount || !checkoutForm.order_id) {
      toast.error("Error", "Completá monto y orden")
      return
    }
    setCreating(true)
    try {
      const result = await api.spi.checkout({
        amount: parseInt(checkoutForm.amount),
        order_id: checkoutForm.order_id,
        description: checkoutForm.description || `Pago orden ${checkoutForm.order_id}`,
      })
      setCheckoutResult({ qr_image_url: result.qr_image_url, qr_image_base64: result.qr_image_base64, order_id: result.order_id })
      toast.success("QR generado", "Escaneá con cualquier app bancaria")
    } catch {
      toast.error("Error", "No se pudo generar QR SPI")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><QrCode className="w-6 h-6 text-cyan-500" />SPI QR BCP</h1>
          <p className="text-sm text-gray-500">Pagos interoperables — QR Hub del Banco Central del Paraguay</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={fetchData}><RefreshCw className="w-4 h-4" /></button>
          <button className="btn-primary text-sm" onClick={() => { setShowCheckout(!showCheckout); setCheckoutResult(null) }}>Nuevo QR</button>
        </div>
      </div>

      {showCheckout && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Generar código QR de cobro</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="input-label">Monto (Gs.)</label>
              <input className="input-field" type="number" placeholder="Ej: 50000" value={checkoutForm.amount} onChange={e => setCheckoutForm({ ...checkoutForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Orden / Referencia</label>
              <input className="input-field" placeholder="Ej: VENTA-001" value={checkoutForm.order_id} onChange={e => setCheckoutForm({ ...checkoutForm, order_id: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Descripción</label>
              <input className="input-field" placeholder="Opcional" value={checkoutForm.description} onChange={e => setCheckoutForm({ ...checkoutForm, description: e.target.value })} />
            </div>
          </div>
          <button className="btn-primary" onClick={handleCheckout} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Generar QR
          </button>

          {checkoutResult && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl text-center">
              <p className="text-sm text-gray-500 mb-2">Escaneá el QR con tu app bancaria</p>
              <img src={checkoutResult.qr_image_url ?? checkoutResult.qr_image_base64 ?? ""} alt="QR" className="w-48 h-48 mx-auto border rounded-lg" />
              <p className="text-xs text-gray-400 mt-2">Orden: {checkoutResult.order_id}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1"><CheckCircle className="w-4 h-4" /><span className="text-xs uppercase tracking-wider">Cobrado</span></div>
          <p className="text-xl font-bold">{formatPYG(totalApproved)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-yellow-600 mb-1"><Clock className="w-4 h-4" /><span className="text-xs uppercase tracking-wider">Pendiente</span></div>
          <p className="text-xl font-bold">{formatPYG(totalPending)}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-4 h-4 text-gray-400" />
          <input className="input-field flex-1" placeholder="Buscar por orden o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                <th className="pb-2 font-medium">Orden</th>
                <th className="pb-2 font-medium">Monto</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Comercio</th>
                <th className="pb-2 font-medium">BCP ID</th>
                <th className="pb-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /> Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Sin transacciones</td></tr>
              ) : filtered.map(tx => (
                <tr key={tx.id} className="border-b dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="py-2 font-medium">{tx.order_id ?? "-"}</td>
                  <td className="py-2">{formatPYG(tx.amount ?? 0)}</td>
                  <td className="py-2"><StatusBadge status={tx.status ?? "unknown"} /></td>
                  <td className="py-2 text-gray-500">{tx.merchant_name ?? "-"}</td>
                  <td className="py-2 text-xs text-gray-400">{tx.bcp_transaction_id ?? "-"}</td>
                  <td className="py-2 text-gray-500">{tx.created_at ? new Date(tx.created_at).toLocaleString("es-PY") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
