import { useState, useEffect } from "react"
import { FileText, Search, Plus, Eye, CheckCircle, XCircle, ShoppingCart, Loader2, Download, Clock, AlertTriangle, X, DollarSign, Ban, RefreshCw, ChevronDown, User } from "lucide-react"
import { api, type Quote, type QuoteItem, type Customer, type Product, type Sale } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate } from "../../utils/format"

const statusMap: Record<string, string> = {
  vigente: "badge-success",
  aceptada: "badge-info",
  rechazada: "badge-danger",
  expirada: "badge-accent",
  convertida: "badge-success",
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const toast = useToast()

  // Create form state
  const [formCustomer, setFormCustomer] = useState("")
  const [formValidoHasta, setFormValidoHasta] = useState("")
  const [formMoneda, setFormMoneda] = useState("PYG")
  const [formObservaciones, setFormObservaciones] = useState("")
  const [formCondicionesPago, setFormCondicionesPago] = useState("")
  const [formItems, setFormItems] = useState<{
    product_id: string
    product_nombre: string
    cantidad: number
    precio_unitario: number
    iva_tasa: number
  }[]>([])
  const [creating, setCreating] = useState(false)

  // Convert to sale state
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null)
  const [convertBranch, setConvertBranch] = useState("")
  const [convertCondicion, setConvertCondicion] = useState("contado")
  const [convertTipo, setConvertTipo] = useState("factura_credito")
  const [converting, setConverting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [quotesData, customersData, productsData] = await Promise.all([
        api.quotes.list(filterStatus !== "todos" ? { estado: filterStatus } : undefined),
        api.customers.list({ activo: true }),
        api.products.list({ activo: true }),
      ])
      setQuotes(quotesData)
      setCustomers(customersData)
      setProducts(productsData)
    } catch {
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filterStatus])

  const filtered = quotes.filter((q) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (q.numero || "").toLowerCase().includes(s) ||
      (q.customer?.razon_social || "").toLowerCase().includes(s) ||
      (q.customer?.ruc || "").includes(s)
    )
  })

  const vigentes = quotes.filter((q) => q.estado === "vigente")
  const aceptadas = quotes.filter((q) => q.estado === "aceptada")
  const convertidas = quotes.filter((q) => q.estado === "convertida")
  const montoTotal = quotes.reduce((a, b) => a + Number(b.total || 0), 0)

  const handleViewQuote = async (quote: Quote) => {
    setViewingQuote(quote)
    setLoadingItems(true)
    try {
      const full = await api.quotes.get(quote.id)
      setQuoteItems(full.items || [])
    } catch {
      setQuoteItems([])
    } finally {
      setLoadingItems(false)
    }
  }

  const handleChangeStatus = async (id: string, estado: string) => {
    try {
      const updated = await api.quotes.changeStatus(id, estado)
      setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)))
      toast.success("Estado actualizado", `Cotización marcada como ${estado}`)
    } catch {
      toast.error("Error", "No se pudo actualizar el estado")
    }
  }

  const handleExpireAll = async () => {
    try {
      const result = await api.quotes.expire()
      toast.success("Expiradas", `${result.expiradas} cotizaciones expiradas`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudieron expirar cotizaciones")
    }
  }

  const addItemToForm = (product: Product) => {
    setFormItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_nombre: product.nombre,
        cantidad: 1,
        precio_unitario: product.precio || 0,
        iva_tasa: product.iva_tasa || 10,
      },
    ])
    setProductSearch("")
  }

  const removeFormItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateFormItem = (index: number, field: string, value: number) => {
    setFormItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const formSubtotal = formItems.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0)
  const formIva10 = formItems.reduce(
    (a, i) => a + (i.iva_tasa === 10 ? i.cantidad * i.precio_unitario * 0.1 : 0),
    0
  )
  const formIva5 = formItems.reduce(
    (a, i) => a + (i.iva_tasa === 5 ? i.cantidad * i.precio_unitario * 0.05 : 0),
    0
  )
  const formTotal = formSubtotal + formIva10 + formIva5

  const handleCreate = async () => {
    if (!formCustomer) {
      toast.error("Error", "Seleccione un cliente")
      return
    }
    if (formItems.length === 0) {
      toast.error("Error", "Agregue al menos un producto")
      return
    }
    setCreating(true)
    try {
      const quote = await api.quotes.create({
        customer_id: formCustomer,
        valido_hasta: formValidoHasta || undefined,
        moneda: formMoneda,
        items: formItems.map((i) => ({
          product_id: i.product_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          iva_tasa: i.iva_tasa,
        })),
        observaciones: formObservaciones || undefined,
        condiciones_pago: formCondicionesPago || undefined,
      })
      setQuotes((prev) => [quote, ...prev])
      setShowCreateModal(false)
      resetForm()
      toast.success("Creada", `Cotización ${quote.numero} creada exitosamente`)
    } catch {
      toast.error("Error", "No se pudo crear la cotización")
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormCustomer("")
    setFormValidoHasta("")
    setFormMoneda("PYG")
    setFormObservaciones("")
    setFormCondicionesPago("")
    setFormItems([])
  }

  const handleConvertToSale = async () => {
    if (!convertingQuote) return
    setConverting(true)
    try {
      const result = await api.quotes.convertToSale(convertingQuote.id, {
        branch_id: convertBranch || undefined,
        condicion: convertCondicion,
        tipo_comprobante: convertTipo,
      })
      setQuotes((prev) =>
        prev.map((q) => (q.id === convertingQuote.id ? result.quote : q))
      )
      setShowConvertModal(false)
      setConvertingQuote(null)
      toast.success("Convertida", `Venta ${result.sale.numero} generada desde cotización`)
    } catch {
      toast.error("Error", "No se pudo convertir la cotización a venta")
    } finally {
      setConverting(false)
    }
  }

  const productoFiltrados = products.filter(
    (p) =>
      p.activo &&
      (p.nombre.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Cotizaciones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {quotes.length} cotizaciones registradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpireAll}
            className="btn-outline flex items-center gap-2 text-xs"
            title="Expirar cotizaciones vencidas"
          >
            <Clock className="w-4 h-4" />
            Expirar vencidas
          </button>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true) }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Cotización
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Total Cotizaciones
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{quotes.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-green-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vigentes</span>
          </div>
          <p className="text-2xl font-bold text-green-500">{vigentes.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aceptadas</span>
          </div>
          <p className="text-2xl font-bold text-blue-500">{aceptadas.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Convertidas</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">{convertidas.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto Total</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{formatPYG(montoTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-10"
            placeholder="Buscar por número, cliente o RUC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="vigente">Vigente</option>
          <option value="aceptada">Aceptada</option>
          <option value="rechazada">Rechazada</option>
          <option value="expirada">Expirada</option>
          <option value="convertida">Convertida</option>
        </select>
        <button onClick={fetchData} className="btn-primary">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Quotes Table */}
      {loading ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-bold">No se encontraron cotizaciones</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Número</th>
                  <th className="table-cell">Cliente</th>
                  <th className="table-cell">Fecha</th>
                  <th className="table-cell">Válido hasta</th>
                  <th className="table-cell text-right">Monto total</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => {
                  const isExpired =
                    q.valido_hasta &&
                    new Date(q.valido_hasta) < new Date() &&
                    q.estado === "vigente"
                  return (
                    <tr key={q.id} className="table-row">
                      <td className="table-td font-mono text-xs font-bold text-primary">
                        {q.numero}
                      </td>
                      <td className="table-td">
                        <p className="text-sm font-medium">
                          {q.customer?.razon_social || "—"}
                        </p>
                        {q.customer?.ruc && (
                          <p className="text-xs text-gray-400">{q.customer.ruc}</p>
                        )}
                      </td>
                      <td className="table-td text-sm text-gray-500">
                        {formatDate(q.fecha)}
                      </td>
                      <td className="table-td text-sm">
                        <span
                          className={
                            isExpired
                              ? "text-red-500 font-bold"
                              : "text-gray-500"
                          }
                        >
                          {q.valido_hasta ? formatDate(q.valido_hasta) : "—"}
                          {isExpired && (
                            <AlertTriangle className="w-3 h-3 inline ml-1 text-red-500" />
                          )}
                        </span>
                      </td>
                      <td className="table-td text-right font-mono font-bold">
                        {formatPYG(q.total)}
                      </td>
                      <td className="table-td">
                        <StatusBadge status={q.estado!} map={statusMap} />
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          <button
                            className="btn-ghost p-1.5"
                            title="Ver detalle"
                            onClick={() => handleViewQuote(q)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {q.estado === "vigente" && (
                            <>
                              <button
                                className="btn-ghost p-1.5 text-green-500"
                                title="Aceptar"
                                onClick={() => handleChangeStatus(q.id, "aceptada")}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                className="btn-ghost p-1.5 text-red-500"
                                title="Rechazar"
                                onClick={() => handleChangeStatus(q.id, "rechazada")}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                className="btn-ghost p-1.5 text-amber-500"
                                title="Convertir a Venta"
                                onClick={() => {
                                  setConvertingQuote(q)
                                  setConvertBranch("")
                                  setConvertCondicion("contado")
                                  setConvertTipo("factura_credito")
                                  setShowConvertModal(true)
                                }}
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {q.estado === "convertida" && q.sale_id && (
                            <span className="text-xs text-green-500 font-medium ml-1">
                              Vendida
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Quote Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div
            className="modal-content max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Nueva Cotización
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-ghost">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Customer & Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="label-field">Cliente</label>
                  <select
                    className="input-field"
                    value={formCustomer}
                    onChange={(e) => setFormCustomer(e.target.value)}
                  >
                    <option value="">Seleccionar cliente...</option>
                    {customers
                      .filter((c) => c.activo)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.razon_social} {c.ruc ? `(${c.ruc})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">Válido hasta</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formValidoHasta}
                    onChange={(e) => setFormValidoHasta(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Moneda</label>
                  <select
                    className="input-field"
                    value={formMoneda}
                    onChange={(e) => setFormMoneda(e.target.value)}
                  >
                    <option value="PYG">Guaraníes (PYG)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Condiciones de pago</label>
                  <input
                    className="input-field"
                    placeholder="Ej: 50% anticipo, 50% contra entrega"
                    value={formCondicionesPago}
                    onChange={(e) => setFormCondicionesPago(e.target.value)}
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <label className="label-field">Productos</label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50 overflow-hidden">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="w-full px-10 py-2.5 bg-transparent border-b border-gray-200 dark:border-gray-700 text-sm focus:outline-none"
                      placeholder="Buscar producto por nombre o SKU..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  {productSearch && (
                    <div className="max-h-40 overflow-y-auto border-b border-gray-200 dark:border-gray-700">
                      {productoFiltrados.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-400">Sin resultados</p>
                      ) : (
                        productoFiltrados.slice(0, 10).map((p) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-primary/10 flex items-center justify-between transition-colors"
                            onClick={() => addItemToForm(p)}
                          >
                            <span className="font-medium">{p.nombre}</span>
                            <span className="text-xs text-gray-400">
                              {p.sku} — {formatPYG(p.precio || 0)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {formItems.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                            <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">
                              Producto
                            </th>
                            <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-20">
                              Cant.
                            </th>
                            <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-28">
                              P. Unitario
                            </th>
                            <th className="text-center px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-16">
                              IVA
                            </th>
                            <th className="text-right px-4 py-2 font-semibold text-gray-600 dark:text-gray-300 w-28">
                              Total
                            </th>
                            <th className="w-10 px-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formItems.map((item, i) => {
                            const itemTotal =
                              item.cantidad * item.precio_unitario +
                              (item.iva_tasa === 10
                                ? item.cantidad * item.precio_unitario * 0.1
                                : 0) +
                              (item.iva_tasa === 5
                                ? item.cantidad * item.precio_unitario * 0.05
                                : 0)
                            return (
                              <tr
                                key={i}
                                className="border-b border-gray-100 dark:border-gray-700/50"
                              >
                                <td className="px-4 py-2">
                                  <p className="font-medium text-sm">{item.product_nombre}</p>
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    min={1}
                                    className="input-field w-20 text-right text-sm py-1"
                                    value={item.cantidad}
                                    onChange={(e) =>
                                      updateFormItem(
                                        i,
                                        "cantidad",
                                        Math.max(1, parseInt(e.target.value) || 1)
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step={100}
                                    className="input-field w-28 text-right text-sm py-1"
                                    value={item.precio_unitario}
                                    onChange={(e) =>
                                      updateFormItem(
                                        i,
                                        "precio_unitario",
                                        Math.max(0, parseFloat(e.target.value) || 0)
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <select
                                    className="input-field text-sm py-1"
                                    value={item.iva_tasa}
                                    onChange={(e) =>
                                      updateFormItem(i, "iva_tasa", parseInt(e.target.value))
                                    }
                                  >
                                    <option value={10}>10%</option>
                                    <option value={5}>5%</option>
                                    <option value={0}>0%</option>
                                  </select>
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-sm">
                                  {formatPYG(itemTotal)}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    className="btn-ghost p-1 text-red-400 hover:text-red-600"
                                    onClick={() => removeFormItem(i)}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Totals */}
              {formItems.length > 0 && (
                <div className="flex justify-end">
                  <div className="w-72 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatPYG(formSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>IVA 10%</span>
                      <span className="font-mono">{formatPYG(formIva10)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>IVA 5%</span>
                      <span className="font-mono">{formatPYG(formIva5)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span>Total</span>
                      <span className="text-primary">{formatPYG(formTotal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="label-field">Observaciones</label>
                <textarea
                  className="input-field w-full min-h-[80px] resize-none"
                  placeholder="Notas adicionales para la cotización..."
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  className="btn-ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  {creating ? "Creando..." : "Crear Cotización"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Quote Detail Modal */}
      {viewingQuote && (
        <div className="modal-overlay" onClick={() => setViewingQuote(null)}>
          <div
            className="modal-content max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Cotización {viewingQuote.numero}
              </h3>
              <button onClick={() => setViewingQuote(null)} className="btn-ghost">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Estado</span>
                  <p className="mt-0.5">
                    <StatusBadge status={viewingQuote.estado!} map={statusMap} />
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Fecha</span>
                  <p className="font-bold mt-0.5">
                    {formatDate(viewingQuote.fecha)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Válido hasta</span>
                  <p className="font-bold mt-0.5">
                    {viewingQuote.valido_hasta
                      ? formatDate(viewingQuote.valido_hasta)
                      : "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 text-xs">Cliente</span>
                  <p className="font-bold mt-0.5">
                    {viewingQuote.customer?.razon_social || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">RUC</span>
                  <p className="font-mono mt-0.5">
                    {viewingQuote.customer?.ruc || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Moneda</span>
                  <p className="font-mono font-bold mt-0.5">
                    {viewingQuote.moneda}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Condiciones de pago</span>
                  <p className="mt-0.5">
                    {viewingQuote.condiciones_pago || "—"}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                  Items ({quoteItems.length})
                </h4>
                {loadingItems ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left py-2 text-gray-500 font-semibold">
                          Producto
                        </th>
                        <th className="text-right py-2 text-gray-500 font-semibold">
                          Cant
                        </th>
                        <th className="text-right py-2 text-gray-500 font-semibold">
                          P.U.
                        </th>
                        <th className="text-right py-2 text-gray-500 font-semibold">
                          IVA
                        </th>
                        <th className="text-right py-2 text-gray-500 font-semibold">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-gray-400">
                            Sin items
                          </td>
                        </tr>
                      ) : (
                        quoteItems.map((i) => (
                          <tr
                            key={i.id}
                            className="border-b border-gray-50 dark:border-gray-800"
                          >
                            <td className="py-2">
                              <p className="font-medium">
                                {i.descripcion || i.product?.nombre || "—"}
                              </p>
                              {i.product?.sku && (
                                <p className="text-xs text-gray-400">{i.product.sku}</p>
                              )}
                            </td>
                            <td className="text-right py-2">{i.cantidad}</td>
                            <td className="text-right py-2 font-mono">
                              {formatPYG(i.precio_unitario)}
                            </td>
                            <td className="text-right py-2">{i.iva_tasa}%</td>
                            <td className="text-right py-2 font-bold font-mono">
                              {formatPYG(i.total)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="max-w-xs ml-auto space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span className="font-mono">
                      {formatPYG(viewingQuote.subtotal)}
                    </span>
                  </div>
                  {viewingQuote.descuento_total ? (
                    <div className="flex justify-between text-gray-500">
                      <span>Descuento</span>
                      <span className="font-mono text-red-500">
                        -{formatPYG(viewingQuote.descuento_total)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-gray-500">
                    <span>IVA 10%</span>
                    <span className="font-mono">
                      {formatPYG(viewingQuote.iva_10)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>IVA 5%</span>
                    <span className="font-mono">
                      {formatPYG(viewingQuote.iva_5)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatPYG(viewingQuote.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              {viewingQuote.observaciones && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <span className="text-xs text-gray-500 font-semibold">
                    Observaciones
                  </span>
                  <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                    {viewingQuote.observaciones}
                  </p>
                </div>
              )}

              {/* Actions */}
              {viewingQuote.estado === "vigente" && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex gap-2 justify-end">
                  <button
                    className="btn-outline text-green-600 border-green-500/30 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"
                    onClick={() => {
                      handleChangeStatus(viewingQuote.id, "aceptada")
                      setViewingQuote(null)
                    }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aceptar
                  </button>
                  <button
                    className="btn-outline text-red-600 border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                    onClick={() => {
                      handleChangeStatus(viewingQuote.id, "rechazada")
                      setViewingQuote(null)
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </button>
                  <button
                    className="btn-primary flex items-center gap-2"
                    onClick={() => {
                      setViewingQuote(null)
                      setConvertingQuote(viewingQuote)
                      setConvertBranch("")
                      setConvertCondicion("contado")
                      setConvertTipo("factura_credito")
                      setShowConvertModal(true)
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Convertir a Venta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert to Sale Modal */}
      {showConvertModal && convertingQuote && (
        <div className="modal-overlay" onClick={() => { setShowConvertModal(false); setConvertingQuote(null) }}>
          <div
            className="modal-content max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Convertir a Venta
              </h3>
              <button onClick={() => { setShowConvertModal(false); setConvertingQuote(null) }} className="btn-ghost">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                Se generará una venta desde la cotización{" "}
                <span className="font-bold text-gray-900 dark:text-white">
                  {convertingQuote.numero}
                </span>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="label-field">Condición</label>
                  <select
                    className="input-field"
                    value={convertCondicion}
                    onChange={(e) => setConvertCondicion(e.target.value)}
                  >
                    <option value="contado">Contado</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Tipo de comprobante</label>
                  <select
                    className="input-field"
                    value={convertTipo}
                    onChange={(e) => setConvertTipo(e.target.value)}
                  >
                    <option value="factura_credito">Factura de Crédito</option>
                    <option value="factura_contado">Factura de Contado</option>
                    <option value="nota_remision">Nota de Remisión</option>
                    <option value="comprobante_venta">Comprobante de Venta</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  className="btn-ghost"
                  onClick={() => { setShowConvertModal(false); setConvertingQuote(null) }}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleConvertToSale}
                  disabled={converting}
                >
                  {converting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  {converting ? "Convirtiendo..." : "Convertir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
