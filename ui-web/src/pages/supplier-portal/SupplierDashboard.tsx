import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

function apiGet(endpoint: string) {
  const token = localStorage.getItem("supplier_token")
  return fetch(`${API_BASE}/v1/supplier-portal${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => { if (!r.ok) throw new Error(); return r.json() })
}

const statusLabels: Record<string, string> = {
  borrador: "Borrador", enviada: "Enviada", confirmada: "Confirmada",
  en_proceso: "En Proceso", completada: "Completada", cancelada: "Cancelada",
}
const statusColors: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-600", enviada: "bg-blue-100 text-blue-700",
  confirmada: "bg-green-100 text-green-700", en_proceso: "bg-yellow-100 text-yellow-700",
  completada: "bg-green-100 text-green-700", cancelada: "bg-red-100 text-red-600",
}

export default function SupplierDashboard() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem("supplier_token")
    if (!token) { navigate("/portal/proveedores/login"); return }
    Promise.all([
      apiGet("/dashboard").catch(() => null),
      apiGet("/me").catch(() => null),
    ]).then(([d, p]) => { setDashboard(d); setProfile(p); setLoading(false) })
  }, [])

  const loadOrders = () => { apiGet("/orders").then(setOrders).catch(() => {}) }
  const loadProducts = () => { apiGet("/products").then(setProducts).catch(() => {}) }
  const loadDocuments = () => { apiGet("/documents").then(setDocuments).catch(() => {}) }
  const loadPayments = () => { apiGet("/payments").then(setPayments).catch(() => {}) }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === "ordenes") loadOrders()
    else if (tab === "productos") loadProducts()
    else if (tab === "documentos") loadDocuments()
    else if (tab === "pagos") loadPayments()
  }

  const handleLogout = () => { localStorage.removeItem("supplier_token"); navigate("/portal/proveedores/login") }

  const handleConfirmOrder = async (orderId: string) => {
    try {
      await fetch(`${API_BASE}/v1/supplier-portal/orders/${orderId}/confirm`, {
        method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("supplier_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ observaciones: "Confirmado por proveedor" }),
      })
      loadOrders()
    } catch {}
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Portal de Proveedores</h1>
            <p className="text-xs text-gray-500">{profile?.nombre || "Proveedor"}</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-600 transition">Cerrar sesión</button>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "ordenes", label: "Órdenes de Compra" },
            { key: "productos", label: "Catálogo" },
            { key: "documentos", label: "Documentos" },
            { key: "pagos", label: "Pagos" },
            { key: "chat", label: "Chat" },
          ].map((t) => (
            <button key={t.key} onClick={() => handleTabChange(t.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${activeTab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500">Pendientes de confirmar</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{dashboard?.pending_confirmations || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500">Órdenes este mes</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{dashboard?.monthly_orders || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500">Documentos subidos</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">{dashboard?.document_count || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500">Total O/C</p>
                <p className="text-3xl font-bold text-gray-700 mt-1">
                  {Object.values(dashboard?.order_counts || {}).reduce((a: number, b: number) => a + b, 0)}
                </p>
              </div>
            </div>

            {/* Recent orders */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">Órdenes Recientes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="text-left px-5 py-3 text-gray-500 font-medium">Número</th>
                      <th className="text-left px-5 py-3 text-gray-500 font-medium">Fecha</th>
                      <th className="text-left px-5 py-3 text-gray-500 font-medium">Estado</th>
                      <th className="text-right px-5 py-3 text-gray-500 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard?.recent_orders || []).map((o: any) => (
                      <tr key={o.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => { handleTabChange("ordenes"); setActiveTab("ordenes") }}>
                        <td className="px-5 py-3 font-medium">#{o.numero}</td>
                        <td className="px-5 py-3 text-gray-500">{new Date(o.fecha).toLocaleDateString("es-PY")}</td>
                        <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[o.estado] || "bg-gray-100"}`}>{statusLabels[o.estado] || o.estado}</span></td>
                        <td className="px-5 py-3 text-right font-medium">Gs. {o.total.toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!dashboard?.recent_orders || dashboard.recent_orders.length === 0) && (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Sin órdenes recientes</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ordenes" && <OrdersTab orders={orders} onConfirm={handleConfirmOrder} />}
        {activeTab === "productos" && <ProductsTab products={products} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
        {activeTab === "documentos" && <DocumentsTab documents={documents} />}
        {activeTab === "pagos" && <PaymentsTab payments={payments} />}
        {activeTab === "chat" && <ChatTab />}
      </main>
    </div>
  )
}

/* ── Orders Tab ──────────────────────────────────────────────── */
function OrdersTab({ orders, onConfirm }: { orders: any[]; onConfirm: (id: string) => void }) {
  const [selected, setSelected] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)

  const loadDetail = async (id: string) => {
    const token = localStorage.getItem("supplier_token")
    const API_BASE = import.meta.env.VITE_API_URL || "/api"
    const res = await fetch(`${API_BASE}/v1/supplier-portal/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setDetail(data)
    setSelected(id)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Órdenes de Compra</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
          {orders.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400">Sin órdenes</p>
          ) : orders.map((o) => (
            <div key={o.id} className={`px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition ${selected === o.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`} onClick={() => loadDetail(o.id)}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900 dark:text-white">#{o.numero}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[o.estado] || "bg-gray-100"}`}>{statusLabels[o.estado] || o.estado}</span>
              </div>
              <p className="text-xs text-gray-500">{new Date(o.fecha).toLocaleDateString("es-PY")} · {o.item_count} items · Gs. {o.total.toLocaleString()}</p>
              {o.estado === "enviada" && (
                <button onClick={(e) => { e.stopPropagation(); onConfirm(o.id) }} className="mt-2 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg transition">
                  Confirmar Pedido
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        {!detail ? (
          <p className="text-gray-400 text-center py-12">Seleccioná una orden para ver detalles</p>
        ) : (
          <div>
            <h3 className="font-semibold text-lg mb-1">Orden #{detail.numero}</h3>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-4 ${statusColors[detail.estado]}`}>{statusLabels[detail.estado]}</span>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Moneda:</span> {detail.moneda}</p>
              {detail.fecha_entrega_estimada && <p><span className="text-gray-500">Entrega estimada:</span> {detail.fecha_entrega_estimada}</p>}
              {detail.condiciones_pago && <p><span className="text-gray-500">Condiciones:</span> {detail.condiciones_pago}</p>}
              {detail.observaciones && <p><span className="text-gray-500">Observaciones:</span> {detail.observaciones}</p>}
            </div>
            <table className="w-full text-sm mt-4">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-2">Producto</th><th className="text-right py-2">Cant.</th><th className="text-right py-2">Precio</th><th className="text-right py-2">Total</th></tr></thead>
              <tbody>
                {(detail.items || []).map((i: any) => (
                  <tr key={i.id} className="border-b border-gray-100">
                    <td className="py-2">{i.descripcion || "Producto"}</td>
                    <td className="text-right py-2">{i.cantidad}</td>
                    <td className="text-right py-2">Gs. {i.precio_unitario.toLocaleString()}</td>
                    <td className="text-right py-2 font-medium">Gs. {i.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3} className="text-right py-2 font-semibold">Total</td><td className="text-right py-2 font-bold text-blue-600">Gs. {detail.total.toLocaleString()}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Products Tab ─────────────────────────────────────────────── */
function ProductsTab({ products, searchTerm, setSearchTerm }: { products: any[]; searchTerm: string; setSearchTerm: (s: string) => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Catálogo de Productos</h2>
        <input type="text" placeholder="Buscar productos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none w-64" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr><th className="text-left px-5 py-3 text-gray-500 font-medium">Producto</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Precio</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Unidad</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Estado</th></tr>
          </thead>
          <tbody>
            {products.filter((p) => !searchTerm || p.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map((p) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-medium">{p.nombre}</td>
                <td className="px-5 py-3">Gs. {p.precio.toLocaleString()}</td>
                <td className="px-5 py-3 text-gray-500">{p.unidad_medida || "-"}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${p.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>{p.activo ? "Activo" : "Inactivo"}</span></td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Sin productos disponibles</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Documents Tab ────────────────────────────────────────────── */
function DocumentsTab({ documents }: { documents: any[] }) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    const nombre = prompt("Nombre del documento:")
    if (!nombre) return
    const tipo = prompt("Tipo (factura/remito/certificado/ficha_tecnica/otro):") || "otro"
    const filename = prompt("Nombre del archivo (ej: factura.pdf):") || "documento.pdf"
    const fileUrl = prompt("URL del archivo:") || ""
    if (!fileUrl) return
    setUploading(true)
    try {
      const token = localStorage.getItem("supplier_token")
      const API_BASE = import.meta.env.VITE_API_URL || "/api"
      await fetch(`${API_BASE}/v1/supplier-portal/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, nombre, filename, file_url: fileUrl }),
      })
      window.location.reload()
    } catch {}
    setUploading(false)
  }

  const tipoLabels: Record<string, string> = {
    factura: "Factura", remito: "Remito", certificado: "Certificado", ficha_tecnica: "Ficha Técnica", otro: "Otro",
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Documentos</h2>
        <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50">
          {uploading ? "Subiendo..." : "+ Subir Documento"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr><th className="text-left px-5 py-3">Nombre</th><th className="text-left px-5 py-3">Tipo</th><th className="text-left px-5 py-3">Archivo</th><th className="text-left px-5 py-3">Estado</th><th className="text-left px-5 py-3">Fecha</th></tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-medium">{d.nombre}</td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700">{tipoLabels[d.tipo] || d.tipo}</span></td>
                <td className="px-5 py-3"><a href={d.file_url} target="_blank" className="text-blue-600 hover:underline">{d.filename}</a></td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${d.estado === "aprobado" ? "bg-green-100 text-green-700" : d.estado === "rechazado" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>{d.estado}</span></td>
                <td className="px-5 py-3 text-gray-500">{new Date(d.created_at).toLocaleDateString("es-PY")}</td>
              </tr>
            ))}
            {documents.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Sin documentos subidos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Payments Tab ─────────────────────────────────────────────── */
function PaymentsTab({ payments }: { payments: any[] }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">Historial de Pagos</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr><th className="text-left px-5 py-3">Factura</th><th className="text-left px-5 py-3">Fecha</th><th className="text-right px-5 py-3">Total</th><th className="text-right px-5 py-3">Pagado</th><th className="text-right px-5 py-3">Saldo</th><th className="text-left px-5 py-3">Estado</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.invoice_id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-medium">{p.numero || p.invoice_id.slice(0, 8)}</td>
                <td className="px-5 py-3 text-gray-500">{new Date(p.fecha).toLocaleDateString("es-PY")}</td>
                <td className="px-5 py-3 text-right">Gs. {p.total.toLocaleString()}</td>
                <td className="px-5 py-3 text-right text-green-600">Gs. {p.pagado.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-medium">Gs. {p.saldo.toLocaleString()}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${p.saldo <= 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.saldo <= 0 ? "Pagado" : "Pendiente"}</span></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Sin pagos registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Chat Tab ─────────────────────────────────────────────────── */
function ChatTab() {
  const [whatsappUrl, setWhatsappUrl] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("supplier_token")
    const API_BASE = import.meta.env.VITE_API_URL || "/api"
    fetch(`${API_BASE}/v1/supplier-portal/chat/whatsapp-url`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).then((d) => setWhatsappUrl(d.url)).catch(() => {})
  }, [])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
      <div className="max-w-sm mx-auto">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Chat con el Comprador</h3>
        <p className="text-sm text-gray-500 mb-6">Comunicate directamente con el equipo de compras de la distribuidora por WhatsApp.</p>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          Abrir WhatsApp
        </a>
      </div>
    </div>
  )
}
