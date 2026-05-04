import {
  TrendingUp,
  Package,
  ShoppingCart,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Clock,
} from "lucide-react"

const kpis = [
  { label: "Ventas hoy", value: "1.450.000", change: "+12.5%", up: true, icon: DollarSign, color: "text-secondary" },
  { label: "Transacciones", value: "47", change: "+8", up: true, icon: ShoppingCart, color: "text-primary" },
  { label: "Productos activos", value: "1.234", change: "+23", up: true, icon: Package, color: "text-accent" },
  { label: "Stock bajo", value: "18", change: "-3", up: false, icon: AlertTriangle, color: "text-red-500" },
]

const recentSales = [
  { id: "001-001-000123", customer: "Juan P\u00e9rez", amount: "125.000", time: "14:32", status: "completed" },
  { id: "001-001-000122", customer: "Mar\u00eda Garc\u00eda", amount: "89.500", time: "14:15", status: "completed" },
  { id: "001-001-000121", customer: "Carlos L\u00f3pez", amount: "234.000", time: "13:58", status: "pending" },
  { id: "001-001-000120", customer: "Ana Mart\u00ednez", amount: "67.000", time: "13:42", status: "completed" },
  { id: "001-001-000119", customer: "Roberto D\u00edaz", amount: "456.000", time: "13:20", status: "completed" },
]

const lowStock = [
  { name: "Coca Cola 2L", sku: "BEB-001", current: 3, min: 10 },
  { name: "Arroz 1kg", sku: "ALI-045", current: 5, min: 20 },
  { name: "Leche Entera 1L", sku: "LAC-012", current: 8, min: 15 },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Resumen de tu negocio</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              <div className={`flex items-center gap-1 text-xs font-bold ${kpi.up ? "text-green-600" : "text-red-500"}`}>
                {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.change}
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-1">
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales chart placeholder */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Ventas \u00faltimos 7 d\u00edas</h3>
          <div className="h-64 flex items-end gap-2 justify-center">
            {[65, 42, 78, 55, 90, 72, 85].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className="w-10 bg-gradient-to-t from-primary to-primary-light rounded-t-lg transition-all duration-500"
                  style={{ height: `${h * 2}px` }}
                />
                <span className="text-[10px] text-gray-400">
                  {["Lun", "Mar", "Mi\u00e9", "Jue", "Vie", "S\u00e1b", "Dom"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alert */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Stock bajo
          </h3>
          <div className="space-y-3">
            {lowStock.map((item) => (
              <div key={item.sku} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-500">{item.current}</p>
                  <p className="text-[10px] text-gray-400">m\u00edn: {item.min}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent sales */}
      <div className="card p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Ventas recientes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Comprobante</th>
                <th className="table-cell">Cliente</th>
                <th className="table-cell">Monto</th>
                <th className="table-cell">Hora</th>
                <th className="table-cell">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => (
                <tr key={sale.id} className="table-row">
                  <td className="table-td font-mono text-xs">{sale.id}</td>
                  <td className="table-td text-sm font-medium">{sale.customer}</td>
                  <td className="table-td font-mono text-sm font-bold">\u20b2 {sale.amount}</td>
                  <td className="table-td text-sm">{sale.time}</td>
                  <td className="table-td">
                    <span className={`badge-${sale.status === "completed" ? "success" : "warning"}`}>
                      {sale.status === "completed" ? "Completado" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
