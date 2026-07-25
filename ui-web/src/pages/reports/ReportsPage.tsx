import { useState, useEffect, useRef } from "react"
import { BarChart3, TrendingUp, Package, FileText, Download, Loader2, ChevronDown, FileSpreadsheet, Layers, ArrowUpDown } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

interface SalesSummary {
  total_ventas: number
  monto_total: number
  monto_iva_10: number
  monto_iva_5: number
  monto_exento: number
  ticket_promedio: number
  total_items: number
}

interface InventorySummary {
  total_productos: number
  total_unidades: number
  valor_total: number
  bajo_stock: number
  sin_stock: number
}

interface FinancialSummary {
  ingresos: number
  egresos: number
  saldo: number
  cuentas_por_cobrar: number
  cuentas_por_pagar: number
  flujo_caja: number
}

interface ExportOption {
  label: string
  endpoint: string
  filename: string
}

const reportTypes = [
  {
    id: "sales",
    titulo: "Ventas",
    descripcion: "Análisis de ventas por período, producto y cliente",
    icono: "sales" as const,
    exports: [
      { label: "Resumen ventas", endpoint: "/reports/export/sales-summary", filename: "resumen_ventas.xlsx" },
      { label: "Ventas por período", endpoint: "/reports/export/sales-by-period", filename: "ventas_por_periodo.xlsx" },
      { label: "Ventas por categoría", endpoint: "/reports/export/sales-by-category", filename: "ventas_por_categoria.xlsx" },
      { label: "Top productos", endpoint: "/reports/export/sales-by-product", filename: "top_productos.xlsx" },
      { label: "Ventas por cliente", endpoint: "/reports/export/sales-by-client", filename: "ventas_por_cliente.xlsx" },
    ],
  },
  {
    id: "inventory",
    titulo: "Inventario",
    descripcion: "Estado de stock, rotación y valorización",
    icono: "inventory" as const,
    exports: [
      { label: "Inventario completo", endpoint: "/reports/export/inventory", filename: "inventario.xlsx" },
      { label: "Rotación de stock", endpoint: "/reports/export/inventory-rotation", filename: "rotacion_inventario.xlsx" },
      { label: "Costeo FIFO", endpoint: "/reports/export/fifo", filename: "costeo_fifo.xlsx" },
      { label: "Costeo LIFO", endpoint: "/reports/export/lifo", filename: "costeo_lifo.xlsx" },
      { label: "Comparación costos", endpoint: "/reports/export/cost-comparison", filename: "comparacion_costos.xlsx" },
    ],
  },
  {
    id: "financial",
    titulo: "Financiero",
    descripcion: "Flujo de caja, cobros y pagos",
    icono: "financial" as const,
    exports: [
      { label: "Resumen financiero", endpoint: "/reports/export/financial", filename: "resumen_financiero.xlsx" },
    ],
  },
  {
    id: "fiscal",
    titulo: "Fiscal",
    descripcion: "Libros fiscales y reportes tributarios",
    icono: "fiscal" as const,
    exports: [
      { label: "Libro de ventas", endpoint: "/reports/export/fiscal-book?tipo_libro=ventas", filename: "libro_ventas.xlsx" },
      { label: "Libro de compras", endpoint: "/reports/export/fiscal-book?tipo_libro=compras", filename: "libro_compras.xlsx" },
    ],
  },
]

function ExportDropdown({ options, periodo }: { options: ExportOption[]; periodo: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleExport = async (opt: ExportOption) => {
    try {
      const days = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90
      const desde = new Date()
      desde.setDate(desde.getDate() - days)
      const params = new URLSearchParams({
        fecha_desde: desde.toISOString().split("T")[0],
        fecha_hasta: new Date().toISOString().split("T")[0],
      })
      const url = `${API_BASE}${opt.endpoint}?${params}`
      const token = localStorage.getItem("access_token")
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!resp.ok) throw new Error("Error al generar el archivo")
      const blob = await resp.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = opt.filename
      a.click()
      URL.revokeObjectURL(a.href)
      setOpen(false)
    } catch {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="btn-ghost text-xs flex items-center gap-1">
        <FileSpreadsheet className="w-3 h-3" />
        Exportar
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleExport(opt)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState("7d")
  const [costingTab, setCostingTab] = useState<"fifo" | "lifo" | "comparison">("fifo")
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null)
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null)
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [salesByCategory, setSalesByCategory] = useState<{ categoria: string; monto: number }[]>([])
  const [salesByPeriod, setSalesByPeriod] = useState<{ periodo: string; monto: number }[]>([])
  const [fifoData, setFifoData] = useState<any[]>([])
  const [lifoData, setLifoData] = useState<any[]>([])
  const [costComparison, setCostComparison] = useState<any[]>([])
  const [costingLoading, setCostingLoading] = useState(false)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sales, inventory, financial, category, period] = await Promise.allSettled([
        api.reports.salesSummary(),
        api.reports.inventorySummary(),
        api.reports.financialSummary(),
        api.reports.salesByCategory(),
        api.reports.salesByPeriod({ agrupar_por: "dia" }),
      ])
      if (sales.status === "fulfilled") setSalesSummary(sales.value)
      if (inventory.status === "fulfilled") setInventorySummary(inventory.value)
      if (financial.status === "fulfilled") setFinancialSummary(financial.value)
      if (category.status === "fulfilled") setSalesByCategory(category.value)
      if (period.status === "fulfilled") setSalesByPeriod(period.value)
      if (sales.status === "rejected") toast.info("Datos demo", "Conectá el backend para ver datos reales")
    } catch {
      toast.error("Error", "No se pudieron cargar los reportes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [periodo])
  useEffect(() => { fetchCosting() }, [costingTab])

  const fetchCosting = async () => {
    setCostingLoading(true)
    try {
      if (costingTab === "fifo") {
        const data = await api.reports.fifoCosting()
        setFifoData(data)
      } else if (costingTab === "lifo") {
        const data = await api.reports.lifoCosting()
        setLifoData(data)
      } else {
        const data = await api.reports.costComparison()
        setCostComparison(data)
      }
    } catch {
      toast.info("Sin datos", "No hay datos de costeo disponibles")
    } finally {
      setCostingLoading(false)
    }
  }

  const maxSalesValue = salesByPeriod.length > 0 ? Math.max(...salesByPeriod.map(d => d.monto)) : 0
  const maxCatValue = salesByCategory.length > 0 ? Math.max(...salesByCategory.map(d => d.monto)) : 0
  const chartDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
  const catColors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-pink-500", "bg-teal-500"]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Análisis y reportes del negocio</p>
        </div>
        <div className="flex gap-2">
          <select className="input-field w-fit" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
          </select>
          <button onClick={fetchData} className="btn-outline"><Download className="w-4 h-4" />Actualizar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ventas período</span></div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{salesSummary ? formatPYG(salesSummary.monto_total) : "₲ 28.1M"}</p>
              {salesSummary && <p className="text-xs text-green-500 font-bold mt-1">{salesSummary.total_ventas} ventas</p>}
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><Package className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transacciones</span></div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{salesSummary?.total_ventas || 156}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><span className="w-5 h-5 flex items-center justify-center text-lg font-bold text-amber-500">₲</span><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ticket promedio</span></div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{salesSummary ? formatPYG(Math.round(salesSummary.ticket_promedio)) : "₲ 180K"}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><BarChart3 className="w-5 h-5 text-secondary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Flujo caja</span></div>
              <p className={`text-2xl font-bold ${financialSummary && financialSummary.flujo_caja >= 0 ? "text-green-500" : "text-red-500"}`}>
                {financialSummary ? formatPYG(financialSummary.flujo_caja) : "₲ 13.1M"}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Ventas por día</h3>
              {salesByPeriod.length > 0 ? (
                <div className="flex items-end gap-3 h-40">
                  {salesByPeriod.slice(-7).map((d, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 gap-2">
                      <span className="text-xs font-mono text-gray-500">₲{(d.monto / 1000000).toFixed(1)}M</span>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t-lg relative overflow-hidden" style={{ height: "100%" }}>
                        <div className="absolute bottom-0 w-full bg-primary rounded-t-lg transition-all" style={{ height: `${maxSalesValue > 0 ? (d.monto / maxSalesValue) * 100 : 10}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-500">{d.periodo}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-end gap-3 h-40">
                  {[3.5, 4.2, 2.8, 5.1, 6.8, 4.5, 1.2].map((h, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 gap-2">
                      <span className="text-xs font-mono text-gray-500">{h}M</span>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t-lg relative overflow-hidden" style={{ height: "100%" }}>
                        <div className="absolute bottom-0 w-full bg-primary rounded-t-lg transition-all" style={{ height: `${(h / 6.8) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-500">{chartDays[i]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Ventas por categoría</h3>
              {salesByCategory.length > 0 ? (
                <div className="flex items-end gap-3 h-40">
                  {salesByCategory.map((d, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 gap-2">
                      <span className="text-xs font-mono text-gray-500">{d.monto > 0 ? `₲ ${(d.monto / 1000000).toFixed(1)}M` : "—"}</span>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t-lg relative overflow-hidden" style={{ height: "100%" }}>
                        <div className={`absolute bottom-0 w-full ${catColors[i % catColors.length]} rounded-t-lg transition-all`} style={{ height: `${maxCatValue > 0 ? (d.monto / maxCatValue) * 100 : 10}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-500 text-center leading-tight">{d.categoria}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-end gap-3 h-40">
                  {[
                    { label: "Bebidas", value: 85 },
                    { label: "Alimentos", value: 72 },
                    { label: "Lácteos", value: 63 },
                    { label: "Limpieza", value: 45 },
                    { label: "Panadería", value: 38 },
                  ].map((d, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 gap-2">
                      <span className="text-xs font-mono text-gray-500">{d.value}%</span>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t-lg relative overflow-hidden" style={{ height: "100%" }}>
                        <div className={`absolute bottom-0 w-full ${catColors[i]} rounded-t-lg transition-all`} style={{ height: `${d.value}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-500 text-center leading-tight">{d.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* FIFO/LIFO Costing */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Costeo de Inventario</h3>
              </div>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button onClick={() => setCostingTab("fifo")} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${costingTab === "fifo" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>FIFO</button>
                <button onClick={() => setCostingTab("lifo")} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${costingTab === "lifo" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>LIFO</button>
                <button onClick={() => setCostingTab("comparison")} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${costingTab === "comparison" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Comparación</button>
              </div>
            </div>

            {costingLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : costingTab === "fifo" ? (
              fifoData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Producto</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Stock</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Costo FIFO</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Valor Total</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Lotes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fifoData.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3">
                            <div className="font-medium">{item.producto}</div>
                            <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{item.total_stock}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{formatPYG(item.fifo_costo_unitario)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{formatPYG(item.total_costo)}</td>
                          <td className="py-2 px-3 text-xs text-gray-500">
                            {item.lotes.slice(0, 2).map((l: any, j: number) => (
                              <div key={j}>{l.cantidad}u x {formatPYG(l.costo_unitario)}</div>
                            ))}
                            {item.lotes.length > 2 && <div className="text-gray-400">+{item.lotes.length - 2} más</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-400">Sin datos de lotes FIFO</p>
              )
            ) : costingTab === "lifo" ? (
              lifoData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Producto</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Stock</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Costo LIFO</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Valor Total</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Lotes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lifoData.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3">
                            <div className="font-medium">{item.producto}</div>
                            <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{item.total_stock}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{formatPYG(item.lifo_costo_unitario)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{formatPYG(item.total_costo)}</td>
                          <td className="py-2 px-3 text-xs text-gray-500">
                            {item.lotes.slice(0, 2).map((l: any, j: number) => (
                              <div key={j}>{l.cantidad}u x {formatPYG(l.costo_unitario)}</div>
                            ))}
                            {item.lotes.length > 2 && <div className="text-gray-400">+{item.lotes.length - 2} más</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-400">Sin datos de lotes LIFO</p>
              )
            ) : (
              costComparison.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Producto</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Stock</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">FIFO</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">LIFO</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Prom. Ponderado</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Diferencia</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Dif. %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costComparison.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3">
                            <div className="font-medium">{item.producto}</div>
                            <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{item.total_stock}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatPYG(item.fifo_costo)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatPYG(item.lifo_costo)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatPYG(item.weighted_avg_costo)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${item.diferencia_fifo_lifo >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {item.diferencia_fifo_lifo >= 0 ? "+" : ""}{formatPYG(item.diferencia_fifo_lifo)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${item.diferencia_pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                              <ArrowUpDown className="w-3 h-3" />
                              {item.diferencia_pct >= 0 ? "+" : ""}{item.diferencia_pct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-400">Sin datos para comparación</p>
              )
            )}
          </div>

          {/* Report types with export */}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tipos de reporte</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportTypes.map((r) => (
              <div key={r.id} className="card p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {r.icono === "sales" && <TrendingUp className="w-6 h-6 text-primary" />}
                    {r.icono === "inventory" && <Package className="w-6 h-6 text-primary" />}
                    {r.icono === "financial" && <BarChart3 className="w-6 h-6 text-primary" />}
                    {r.icono === "fiscal" && <FileText className="w-6 h-6 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{r.titulo}</h3>
                      <ExportDropdown options={r.exports} periodo={periodo} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{r.descripcion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
