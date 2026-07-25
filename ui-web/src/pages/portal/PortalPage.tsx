import { useState, useEffect } from "react"
import {
  Users, Search, Loader2, CreditCard, ShoppingCart, DollarSign, FileText, RefreshCcw, CheckCircle, XCircle,
  UserCheck, Calendar,
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

export default function PortalPage() {
  const [tab, setTab] = useState("clientes")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portal del Cliente</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión y consulta de datos del portal público para clientes</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "clientes", label: "Clientes Portal", icon: Users },
            { key: "consultas", label: "Consultas",       icon: Search },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "clientes" && <ClientesTab />}
      {tab === "consultas" && <ConsultasTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
    orange: "bg-orange-50 text-orange-600",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function ClientesTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [sales, setSales] = useState<any[] | null>(null)
  const [balance, setBalance] = useState<any>(null)
  const [info, setInfo] = useState<any>(null)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const { error: showError } = useToast()

  const loadPortalData = async (c: any) => {
    setSelectedCustomer(c)
    setLoadingPortal(true)
    try {
      const [s, b, i] = await Promise.allSettled([
        api.portal.customerSales(c.id),
        api.portal.customerBalance(c.id),
        api.portal.customerInfo(c.id),
      ])
      if (s.status === "fulfilled") setSales(s.value as any[])
      else setSales(null)
      if (b.status === "fulfilled") setBalance(b.value)
      else setBalance(null)
      if (i.status === "fulfilled") setInfo(i.value)
      else setInfo(null)
    } catch (e: any) { showError("Error al cargar datos del portal", e.message) }
    setLoadingPortal(false)
  }

  useEffect(() => {
    if (search.length < 2) { setCustomers([]); return }
    const t = setTimeout(() => {
      setLoadingCustomers(true)
      api.customers.list({ search }).then(setCustomers).catch(() => {}).finally(() => setLoadingCustomers(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente por nombre, email o RUC..."
              className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
        </div>

        {loadingCustomers && <div className="flex justify-center py-4"><Spinner /></div>}

        {customers.length > 0 && (
          <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
            {customers.map((c: any) => (
              <button key={c.id} onClick={() => loadPortalData(c)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition ${selectedCustomer?.id === c.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                <span className="font-medium">{c.nombre}</span>
                {c.email && <span className="text-gray-500 ml-2">{c.email}</span>}
                {c.ruc && <span className="text-gray-400 ml-2">{c.ruc}</span>}
              </button>
            ))}
          </div>
        )}

        {search.length >= 2 && !loadingCustomers && customers.length === 0 && (
          <p className="text-center text-gray-500 py-4 text-sm">Sin resultados</p>
        )}
      </div>

      {loadingPortal && <div className="flex justify-center py-8"><Spinner /></div>}

      {selectedCustomer && !loadingPortal && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> {selectedCustomer.nombre}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={DollarSign} label="Saldo" value={balance?.saldo != null ? `Gs. ${(balance.saldo).toLocaleString()}` : "—"} color={balance?.saldo > 0 ? "red" : "green"} />
              <KpiCard icon={CreditCard} label="Límite de Crédito" value={balance?.limite_credito != null ? `Gs. ${(balance.limite_credito).toLocaleString()}` : "—"} color="indigo" />
              <KpiCard icon={ShoppingCart} label="Total Compras" value={info?.total_compras != null ? `Gs. ${(info.total_compras).toLocaleString()}` : "—"} color="blue" />
              <KpiCard icon={Calendar} label="Última Compra" value={info?.ultima_compra ? new Date(info.ultima_compra).toLocaleDateString() : "—"} color="orange" />
            </div>
          </div>

          {sales && sales.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Últimas Ventas</h3>
              <div className="space-y-2">
                {sales.slice(0, 10).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{s.numero || `#${s.id?.slice(0, 8)}`}</p>
                        <p className="text-xs text-gray-500">{s.fecha ? new Date(s.fecha).toLocaleDateString() : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">Gs. {(s.total ?? 0).toLocaleString()}</p>
                      <p className={`text-xs ${s.estado === "completed" || s.estado === "paid" ? "text-green-600" : "text-yellow-600"}`}>
                        {s.estado || s.condicion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!sales && !balance && !info && (
            <p className="text-center text-gray-500 py-4">Este cliente no tiene datos en el portal</p>
          )}
        </div>
      )}
    </div>
  )
}

function ConsultasTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [actionResult, setActionResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    if (search.length < 2) { setCustomers([]); return }
    const t = setTimeout(() => {
      setLoading(true)
      api.customers.list({ search }).then(setCustomers).catch(() => {}).finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const quickAction = async (action: string, customerId: string, customerName: string) => {
    setLoading(true)
    try {
      switch (action) {
        case "balance": {
          const b = await api.portal.customerBalance(customerId)
          setActionResult({ type: "balance", data: b, customer: customerName })
          success("Saldo consultado", `${customerName}: Gs. ${(b.saldo ?? 0).toLocaleString()}`)
          break
        }
        case "sales": {
          const s = await api.portal.customerSales(customerId)
          setActionResult({ type: "sales", data: s, customer: customerName })
          success("Ventas consultadas", `${customerName}: ${s.length} ventas`)
          break
        }
        case "info": {
          const i = await api.portal.customerInfo(customerId)
          setActionResult({ type: "info", data: i, customer: customerName })
          success("Información consultada", customerName)
          break
        }
      }
    } catch (e: any) { showError("Error en consulta", e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
              className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" />
          </div>
        </div>

        {loading && <div className="flex justify-center py-4"><Spinner /></div>}

        {customers.length > 0 && (
          <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
            {customers.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                <div>
                  <span className="text-sm font-medium">{c.nombre}</span>
                  {c.email && <span className="text-gray-500 text-xs ml-2">{c.email}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => quickAction("balance", c.id, c.nombre)}
                    className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                    Saldo
                  </button>
                  <button onClick={() => quickAction("sales", c.id, c.nombre)}
                    className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                    Ventas
                  </button>
                  <button onClick={() => quickAction("info", c.id, c.nombre)}
                    className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                    Info
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {search.length >= 2 && !loading && customers.length === 0 && (
          <p className="text-center text-gray-500 py-4 text-sm">Sin resultados</p>
        )}
      </div>

      {actionResult && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Resultado: {actionResult.customer}</h3>

          {actionResult.type === "balance" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KpiCard icon={DollarSign} label="Saldo Pendiente" value={`Gs. ${(actionResult.data.saldo ?? 0).toLocaleString()}`} color={actionResult.data.saldo > 0 ? "red" : "green"} />
              <KpiCard icon={CreditCard} label="Límite de Crédito" value={`Gs. ${(actionResult.data.limite_credito ?? 0).toLocaleString()}`} color="indigo" />
            </div>
          )}

          {actionResult.type === "sales" && Array.isArray(actionResult.data) && (
            <div>
              <p className="text-xs text-gray-500 mb-2">{actionResult.data.length} ventas encontradas</p>
              {actionResult.data.length === 0 ? (
                <p className="text-sm text-gray-400">Sin ventas registradas</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {actionResult.data.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                      <span className="text-gray-700">{s.numero || `#${s.id?.slice(0, 8)}`}</span>
                      <span className="text-gray-500">{s.fecha ? new Date(s.fecha).toLocaleDateString() : ""}</span>
                      <span className="font-medium">Gs. {(s.total ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {actionResult.type === "info" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard icon={ShoppingCart} label="Total Compras" value={actionResult.data.total_compras != null ? `Gs. ${(actionResult.data.total_compras).toLocaleString()}` : "—"} color="blue" />
              <KpiCard icon={Calendar} label="Última Compra" value={actionResult.data.ultima_compra ? new Date(actionResult.data.ultima_compra).toLocaleDateString() : "—"} color="orange" />
              <KpiCard icon={UserCheck} label="Nombre" value={actionResult.data.nombre || "—"} color="purple" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
