import { useState, useEffect } from "react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import {
  Search, Plus, Loader2, Ship, FileSignature, MapPin, CreditCard,
  BarChart3, Container, DollarSign, TrendingUp, Users, AlertTriangle,
  CheckCircle, XCircle, Truck, ShoppingBag, Globe, Anchor, RefreshCw,
  ClipboardList, Handshake, Percent,
} from "lucide-react"

type Tab = "dashboard" | "importacion" | "acuerdos" | "rutas" | "credito"

const formatPYG = (n?: number | string) => {
  if (n == null) return "Gs 0"
  return "Gs " + Number(n).toLocaleString("es-PY")
}
const formatDate = (d?: string) => {
  if (!d) return "-"
  return new Date(d + "T00:00:00").toLocaleDateString("es-PY", { timeZone: "UTC" })
}
const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    activo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    borrador: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    pendiente: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    en_transito: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    en_aduanas: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    nacionalizado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    en_almacen: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    distribuido: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    visitado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    no_encontrado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    aprobado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    rechazado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }
  return <span className={"px-2 py-0.5 rounded-full text-[11px] font-bold " + (colors[status] || "bg-gray-100 text-gray-600")}>{status.replace(/_/g, " ")}</span>
}

export default function DistribuidoraPage() {
  const { user } = useAuth()
  const companyId = user?.tenant_id || user?.id || ""
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Data states
  const [dashboard, setDashboard] = useState<any>(null)
  const [containers, setContainers] = useState<any[]>([])
  const [customerAgreements, setCustomerAgreements] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [visits, setVisits] = useState<any[]>([])
  const [authorizations, setAuthorizations] = useState<any[]>([])
  const [routeCustomers, setRouteCustomers] = useState<any[]>([])

  // Form states
  const [showContainerForm, setShowContainerForm] = useState(false)
  const [contForm, setContForm] = useState<any>({ supplier_id: "", numero_contenedor: "", puerto_origen: "", puerto_destino: "", incoterm: "FOB", notas: "" })
  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [agrForm, setAgrForm] = useState<any>({ customer_id: "", numero: "", nombre: "", tipo: "precio_especial", fecha_inicio: "", fecha_fin: "", descuento_general_pct: 0, plazo_pago_dias: 0, limite_credito: "" })
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [routeForm, setRouteForm] = useState<any>({ nombre: "", codigo: "", user_id: "", zona: "", dias_semana: [] })
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [visitForm, setVisitForm] = useState<any>({ customer_id: "", fecha_planificada: "", estado: "pendiente" })
  const [showAuthForm, setShowAuthForm] = useState(false)
  const [authForm, setAuthForm] = useState<any>({ customer_id: "", monto_solicitado: "", motivo: "" })
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [creditForm, setCreditForm] = useState<any>({ customer_id: "", limite_credito: "", dias_credito: 0 })
  const [showContainerDetail, setShowContainerDetail] = useState<any>(null)

  // Selected route for customers
  const [selectedRoute, setSelectedRoute] = useState<string>("")
  const [addCustomerRoute, setAddCustomerRoute] = useState("")

  const fetchAll = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      if (tab === "dashboard") {
        const d = await api.distribuidora.dashboard(companyId)
        setDashboard(d)
      } else if (tab === "importacion") {
        const c = await api.distribuidora.containers.list(companyId)
        setContainers(c)
      } else if (tab === "acuerdos") {
        const a = await api.distribuidora.customerAgreements.list(companyId)
        setCustomerAgreements(a)
      } else if (tab === "rutas") {
        const [r, v] = await Promise.all([
          api.distribuidora.routes.list(companyId),
          api.distribuidora.visits.list(companyId),
        ])
        setRoutes(r); setVisits(v)
        if (selectedRoute) {
          const rc = await api.distribuidora.routes.customers.list(selectedRoute)
          setRouteCustomers(rc)
        }
      } else if (tab === "credito") {
        const a = await api.distribuidora.credit.authorizations.list(companyId)
        setAuthorizations(a)
      }
    } catch (e: any) { toast.error("Error", e.message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [tab, companyId, selectedRoute])

  const handleCreateContainer = async () => {
    try {
      await api.distribuidora.containers.create(companyId, contForm)
      toast.success("Contenedor registrado")
      setShowContainerForm(false)
      setContForm({ supplier_id: "", numero_contenedor: "", puerto_origen: "", puerto_destino: "", incoterm: "FOB", notas: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleUpdateContainerStatus = async (id: string, estado: string) => {
    try {
      await api.distribuidora.containers.update(id, { estado })
      toast.success(`Estado actualizado a ${estado}`)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCalculateLanded = async (id: string) => {
    try {
      await api.distribuidora.containers.calculateLanded(id)
      toast.success("Costos landed calculados")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateAgreement = async () => {
    try {
      await api.distribuidora.customerAgreements.create(companyId, agrForm)
      toast.success("Acuerdo creado")
      setShowAgreementForm(false)
      setAgrForm({ customer_id: "", numero: "", nombre: "", tipo: "precio_especial", fecha_inicio: "", fecha_fin: "", descuento_general_pct: 0, plazo_pago_dias: 0, limite_credito: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateRoute = async () => {
    try {
      await api.distribuidora.routes.create(companyId, routeForm)
      toast.success("Ruta creada")
      setShowRouteForm(false)
      setRouteForm({ nombre: "", codigo: "", user_id: "", zona: "", dias_semana: [] })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateVisit = async () => {
    if (!selectedRoute) return toast.error("Error", "Seleccioná una ruta primero")
    try {
      await api.distribuidora.visits.create(selectedRoute, visitForm)
      toast.success("Visita planificada")
      setShowVisitModal(false)
      setVisitForm({ customer_id: "", fecha_planificada: "", estado: "pendiente" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCompleteVisit = async (visitId: string) => {
    try {
      await api.distribuidora.visits.complete(visitId, { estado: "visitado" })
      toast.success("Visita completada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleAddRouteCustomer = async () => {
    if (!selectedRoute || !addCustomerRoute) return
    try {
      await api.distribuidora.routes.customers.add(selectedRoute, { customer_id: addCustomerRoute })
      toast.success("Cliente agregado a ruta")
      setAddCustomerRoute("")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleCreateAuth = async () => {
    try {
      await api.distribuidora.credit.authorizations.create(companyId, authForm)
      toast.success("Solicitud de crédito creada")
      setShowAuthForm(false)
      setAuthForm({ customer_id: "", monto_solicitado: "", motivo: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleApproveAuth = async (id: string, monto: number) => {
    try {
      await api.distribuidora.credit.authorizations.approve(id, monto, user?.id || "")
      toast.success("Autorización aprobada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleRejectAuth = async (id: string) => {
    try {
      await api.distribuidora.credit.authorizations.reject(id)
      toast.success("Autorización rechazada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleSetCredit = async () => {
    try {
      await api.distribuidora.credit.update(companyId, creditForm.customer_id, { limite_credito: Number(creditForm.limite_credito), dias_credito: creditForm.dias_credito })
      toast.success("Límite de crédito actualizado")
      setShowCreditForm(false)
      setCreditForm({ customer_id: "", limite_credito: "", dias_credito: 0 })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Distribuidora</h1>
          <p className="text-sm text-gray-500">Importación, acuerdos con clientes, ruteo de venta, gestión de crédito</p>
        </div>
        <div className="flex gap-2">
          {tab === "importacion" && <button onClick={() => setShowContainerForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo contenedor</button>}
          {tab === "acuerdos" && <button onClick={() => setShowAgreementForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nuevo acuerdo</button>}
          {tab === "rutas" && <button onClick={() => setShowRouteForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva ruta</button>}
          {tab === "credito" && <button onClick={() => setShowAuthForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Solicitar autorización</button>}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
        {[
          { k: "dashboard" as Tab, l: "Dashboard", i: BarChart3 },
          { k: "importacion" as Tab, l: "Importación", i: Ship },
          { k: "acuerdos" as Tab, l: "Acuerdos Clientes", i: Handshake },
          { k: "rutas" as Tab, l: "Ruteo", i: MapPin },
          { k: "credito" as Tab, l: "Crédito", i: CreditCard },
        ].map(({ k, l, i: Icon }) => (
          <button key={k} onClick={() => setTab(k)}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all " +
              (tab === k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700")}>
            <Icon className="w-4 h-4" />{l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : tab === "dashboard" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="card p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-gray-500">Clientes</p><p className="text-xl font-bold">{dashboard?.total_clientes || 0}</p></div></div></div>
            <div className="card p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-gray-500">Ventas del mes</p><p className="text-xl font-bold text-green-600">{formatPYG(dashboard?.ventas_mes)}</p></div></div></div>
            <div className="card p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-yellow-600" /></div><div><p className="text-xs text-gray-500">Facturas vencidas</p><p className="text-xl font-bold">{dashboard?.facturas_vencidas || 0}</p><p className="text-xs text-red-500">{formatPYG(dashboard?.monto_vencido)}</p></div></div></div>
            <div className="card p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Ship className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-gray-500">Contenedores en tránsito</p><p className="text-xl font-bold">{dashboard?.contenedores_en_transito || 0}</p></div></div></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-gray-500">Clientes bloqueados</p><p className="text-xl font-bold">{dashboard?.clientes_bloqueados || 0}</p></div></div></div>
            <div className="card p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"><PackageIcon className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-gray-500">Productos bajo stock</p><p className="text-xl font-bold">{dashboard?.productos_bajo_stock || 0}</p></div></div></div>
            <div className="card p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-gray-500">Visitas hoy</p><p className="text-xl font-bold">{dashboard?.visitas_completadas_hoy || 0} / {dashboard?.visitas_hoy || 0}</p></div></div></div>
          </div>
        </div>
      ) : tab === "importacion" ? (
        <div>
          <div className="relative w-72 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-10" placeholder="Buscar contenedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="table-cell">Contenedor</th><th className="table-cell">Origen → Destino</th>
                <th className="table-cell">Incoterm</th><th className="table-cell">Estado</th>
                <th className="table-cell text-right">FOB</th><th className="table-cell text-right">Landed</th>
                <th className="table-cell">Acciones</th>
              </tr></thead>
              <tbody>
                {containers.filter(c => !search || c.numero_contenedor?.includes(search)).map(c => (
                  <tr key={c.id} className="table-row">
                    <td className="table-td font-mono text-xs font-bold text-primary">{c.numero_contenedor}</td>
                    <td className="table-td text-sm">{c.puerto_origen} → {c.puerto_destino}</td>
                    <td className="table-td"><span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-bold">{c.incoterm}</span></td>
                    <td className="table-td"><StatusBadge status={c.estado} /></td>
                    <td className="table-td text-right font-mono">{formatPYG(c.valor_fob_total)}</td>
                    <td className="table-td text-right font-mono font-bold">{formatPYG(c.costo_landed_total)}</td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        <button onClick={() => setShowContainerDetail(c)} className="p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500" title="Detalle"><Search className="w-4 h-4" /></button>
                        {c.estado === "en_transito" && <button onClick={() => handleUpdateContainerStatus(c.id, "en_aduanas")} className="p-1.5 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600" title="En aduanas"><AlertTriangle className="w-4 h-4" /></button>}
                        {c.estado === "en_aduanas" && <button onClick={() => { handleUpdateContainerStatus(c.id, "nacionalizado"); handleCalculateLanded(c.id) }} className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600" title="Nacionalizar"><CheckCircle className="w-4 h-4" /></button>}
                        {c.estado === "nacionalizado" && <button onClick={() => handleUpdateContainerStatus(c.id, "en_almacen")} className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600" title="A almacén"><PackageIcon className="w-4 h-4" /></button>}
                        <button onClick={() => handleCalculateLanded(c.id)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600" title="Calcular costos"><DollarSign className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showContainerDetail && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowContainerDetail(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-4">{showContainerDetail.numero_contenedor}</h2>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div><span className="text-gray-500">Origen:</span> {showContainerDetail.puerto_origen}</div>
                  <div><span className="text-gray-500">Destino:</span> {showContainerDetail.puerto_destino}</div>
                  <div><span className="text-gray-500">Incoterm:</span> {showContainerDetail.incoterm}</div>
                  <div><span className="text-gray-500">Estado:</span> {showContainerDetail.estado}</div>
                  {showContainerDetail.flete_total > 0 && <div><span className="text-gray-500">Flete:</span> {formatPYG(showContainerDetail.flete_total)}</div>}
                  {showContainerDetail.arancel_total > 0 && <div><span className="text-gray-500">Arancel:</span> {formatPYG(showContainerDetail.arancel_total)}</div>}
                  <div className="col-span-2 font-bold text-primary">Costo Landed: {formatPYG(showContainerDetail.costo_landed_total)}</div>
                </div>
                <div className="text-xs text-gray-400">{showContainerDetail.notas}</div>
                <button onClick={() => setShowContainerDetail(null)} className="btn-primary mt-4">Cerrar</button>
              </div>
            </div>
          )}
        </div>
      ) : tab === "acuerdos" ? (
        <div className="card overflow-hidden">
          <div className="relative w-72 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-10" placeholder="Buscar acuerdo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="table-cell">Número</th><th className="table-cell">Nombre</th><th className="table-cell">Tipo</th>
              <th className="table-cell">Inicio</th><th className="table-cell">Fin</th>
              <th className="table-cell text-right">Dto. %</th><th className="table-cell text-right">Límite</th><th className="table-cell">Estado</th>
            </tr></thead>
            <tbody>
              {customerAgreements.filter(a => !search || a.nombre?.toLowerCase().includes(search.toLowerCase()) || a.numero?.includes(search)).map(a => (
                <tr key={a.id} className="table-row">
                  <td className="table-td font-mono text-xs font-bold text-primary">{a.numero}</td>
                  <td className="table-td font-medium">{a.nombre}</td>
                  <td className="table-td"><span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{a.tipo}</span></td>
                  <td className="table-td text-sm">{formatDate(a.fecha_inicio)}</td>
                  <td className="table-td text-sm">{formatDate(a.fecha_fin)}</td>
                  <td className="table-td text-right">{a.descuento_general_pct}%</td>
                  <td className="table-td text-right font-mono">{formatPYG(a.limite_credito)}</td>
                  <td className="table-td"><StatusBadge status={a.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "rutas" ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white">Rutas</h3>
            <div className="space-y-2">
              {routes.map(r => (
                <button key={r.id} onClick={() => setSelectedRoute(r.id)}
                  className={"w-full text-left p-3 rounded-xl border transition-all " + (selectedRoute === r.id ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700")}>
                  <p className="font-bold text-sm">{r.nombre}</p>
                  <p className="text-xs text-gray-500">{r.codigo} — {r.zona || "Sin zona"}</p>
                  <p className="text-xs text-gray-400 mt-1">Vendedor: {r.user_id?.slice(0, 8)}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 space-y-4">
            {selectedRoute ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white">Clientes de la ruta</h3>
                  <div className="flex gap-2">
                    <input className="input-field text-sm" placeholder="Customer ID" value={addCustomerRoute} onChange={e => setAddCustomerRoute(e.target.value)} />
                    <button onClick={handleAddRouteCustomer} className="btn-primary text-xs px-3 py-1.5">Agregar</button>
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="table-header"><th className="table-cell">Orden</th><th className="table-cell">Cliente</th><th className="table-cell">Día</th></tr></thead>
                    <tbody>
                      {routeCustomers.map((rc: any) => (
                        <tr key={rc.id} className="table-row">
                          <td className="table-td">{rc.orden_visita}</td>
                          <td className="table-td font-mono text-xs">{rc.customer_id}</td>
                          <td className="table-td">{rc.dia_semana != null ? ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][rc.dia_semana] : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white">Visitas</h3>
                  <button onClick={() => { if (selectedRoute) setShowVisitModal(true) }} className="btn-primary text-xs flex items-center gap-1"><Plus className="w-3 h-3" />Planificar visita</button>
                </div>
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="table-header"><th className="table-cell">Cliente</th><th className="table-cell">Fecha</th><th className="table-cell">Estado</th><th className="table-cell">Resultado</th><th className="table-cell text-right">Cobrado</th><th className="table-cell">Acciones</th></tr></thead>
                    <tbody>
                      {visits.filter(v => v.route_id === selectedRoute).length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin visitas planificadas</td></tr>
                      ) : visits.filter(v => v.route_id === selectedRoute).slice(0, 20).map(v => (
                        <tr key={v.id} className="table-row">
                          <td className="table-td font-mono text-xs">{v.customer_id?.slice(0, 8)}</td>
                          <td className="table-td text-sm">{formatDate(v.fecha_planificada)}</td>
                          <td className="table-td"><StatusBadge status={v.estado} /></td>
                          <td className="table-td text-xs">{v.resultado || "-"}</td>
                          <td className="table-td text-right font-mono">{formatPYG(v.monto_cobrado)}</td>
                          <td className="table-td">
                            {v.estado === "pendiente" && <button onClick={() => handleCompleteVisit(v.id)} className="text-xs btn-primary px-2 py-1">Completar</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400">Seleccioná una ruta para ver detalles</div>
            )}
          </div>
        </div>
      ) : (
        /* crédito tab */
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Configurar límite</h3>
              <button onClick={() => setShowCreditForm(true)} className="btn-primary text-xs px-3 py-1.5"><Plus className="w-3 h-3 inline" /> Nuevo límite</button>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr className="table-header"><th className="table-cell">Cliente</th><th className="table-cell text-right">Límite</th><th className="table-cell text-right">Disponible</th><th className="table-cell text-right">Usado</th><th className="table-cell">Bloqueado</th></tr></thead>
                <tbody><tr><td colSpan={5} className="text-center py-8 text-gray-400">Buscá un cliente para ver su límite</td></tr></tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Autorizaciones</h3>
              <button onClick={() => setShowAuthForm(true)} className="btn-primary text-xs px-3 py-1.5"><Plus className="w-3 h-3 inline" /> Nueva solicitud</button>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr className="table-header"><th className="table-cell">Cliente</th><th className="table-cell text-right">Solicitado</th><th className="table-cell text-right">Autorizado</th><th className="table-cell">Estado</th><th className="table-cell">Acciones</th></tr></thead>
                <tbody>
                  {authorizations.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin autorizaciones</td></tr>
                  ) : authorizations.map(a => (
                    <tr key={a.id} className="table-row">
                      <td className="table-td font-mono text-xs">{a.customer_id?.slice(0, 8)}</td>
                      <td className="table-td text-right font-mono">{formatPYG(a.monto_solicitado)}</td>
                      <td className="table-td text-right font-mono">{a.monto_autorizado ? formatPYG(a.monto_autorizado) : "-"}</td>
                      <td className="table-td"><StatusBadge status={a.estado} /></td>
                      <td className="table-td">
                        {a.estado === "pendiente" && (
                          <div className="flex gap-1">
                            <button onClick={() => handleApproveAuth(a.id, a.monto_solicitado)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Aprobar"><CheckCircle className="w-4 h-4" /></button>
                            <button onClick={() => handleRejectAuth(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Rechazar"><XCircle className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showContainerForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowContainerForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Nuevo contenedor</h2>
            <div className="space-y-3">
              <div><label className="label-field">Proveedor ID</label><input className="input-field" value={contForm.supplier_id} onChange={e => setContForm({ ...contForm, supplier_id: e.target.value })} /></div>
              <div><label className="label-field">Número de contenedor</label><input className="input-field" value={contForm.numero_contenedor} onChange={e => setContForm({ ...contForm, numero_contenedor: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">Puerto origen</label><input className="input-field" value={contForm.puerto_origen} onChange={e => setContForm({ ...contForm, puerto_origen: e.target.value })} /></div>
                <div><label className="label-field">Puerto destino</label><input className="input-field" value={contForm.puerto_destino} onChange={e => setContForm({ ...contForm, puerto_destino: e.target.value })} /></div>
              </div>
              <div><label className="label-field">Incoterm</label><select className="input-field" value={contForm.incoterm} onChange={e => setContForm({ ...contForm, incoterm: e.target.value })}>
                <option value="FOB">FOB</option><option value="CIF">CIF</option><option value="EXW">EXW</option><option value="DDP">DDP</option>
              </select></div>
              <div><label className="label-field">Notas</label><textarea className="input-field" rows={3} value={contForm.notas} onChange={e => setContForm({ ...contForm, notas: e.target.value })} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowContainerForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateContainer} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}

      {showAgreementForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAgreementForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Nuevo acuerdo con cliente</h2>
            <div className="space-y-3">
              <div><label className="label-field">Cliente ID</label><input className="input-field" value={agrForm.customer_id} onChange={e => setAgrForm({ ...agrForm, customer_id: e.target.value })} /></div>
              <div><label className="label-field">Número</label><input className="input-field" value={agrForm.numero} onChange={e => setAgrForm({ ...agrForm, numero: e.target.value })} /></div>
              <div><label className="label-field">Nombre</label><input className="input-field" value={agrForm.nombre} onChange={e => setAgrForm({ ...agrForm, nombre: e.target.value })} /></div>
              <div><label className="label-field">Tipo</label><select className="input-field" value={agrForm.tipo} onChange={e => setAgrForm({ ...agrForm, tipo: e.target.value })}>
                <option value="precio_especial">Precio especial</option>
                <option value="descuento_volumen">Descuento por volumen</option>
                <option value="bonificacion">Bonificación</option>
                <option value="contrato">Contrato</option>
              </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-field">Inicio</label><input type="date" className="input-field" value={agrForm.fecha_inicio} onChange={e => setAgrForm({ ...agrForm, fecha_inicio: e.target.value })} /></div>
                <div><label className="label-field">Fin</label><input type="date" className="input-field" value={agrForm.fecha_fin} onChange={e => setAgrForm({ ...agrForm, fecha_fin: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label-field">Dto. %</label><input type="number" className="input-field" value={agrForm.descuento_general_pct} onChange={e => setAgrForm({ ...agrForm, descuento_general_pct: +e.target.value })} /></div>
                <div><label className="label-field">Plazo días</label><input type="number" className="input-field" value={agrForm.plazo_pago_dias} onChange={e => setAgrForm({ ...agrForm, plazo_pago_dias: +e.target.value })} /></div>
                <div><label className="label-field">Límite crédito</label><input type="number" className="input-field" value={agrForm.limite_credito} onChange={e => setAgrForm({ ...agrForm, limite_credito: e.target.value })} /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAgreementForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateAgreement} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}

      {showRouteForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRouteForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Nueva ruta</h2>
            <div className="space-y-3">
              <div><label className="label-field">Nombre</label><input className="input-field" value={routeForm.nombre} onChange={e => setRouteForm({ ...routeForm, nombre: e.target.value })} /></div>
              <div><label className="label-field">Código</label><input className="input-field" value={routeForm.codigo} onChange={e => setRouteForm({ ...routeForm, codigo: e.target.value })} /></div>
              <div><label className="label-field">Vendedor ID</label><input className="input-field" value={routeForm.user_id} onChange={e => setRouteForm({ ...routeForm, user_id: e.target.value })} /></div>
              <div><label className="label-field">Zona</label><input className="input-field" value={routeForm.zona} onChange={e => setRouteForm({ ...routeForm, zona: e.target.value })} /></div>
              <div><label className="label-field">Días de semana</label><div className="flex gap-2">
                {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map((d, i) => (
                  <button key={i} onClick={() => {
                    const arr = [...(routeForm.dias_semana || [])]
                    const idx = arr.indexOf(i)
                    idx >= 0 ? arr.splice(idx, 1) : arr.push(i)
                    setRouteForm({ ...routeForm, dias_semana: arr.sort() })
                  }}
                    className={"w-10 h-10 rounded-full text-xs font-bold transition-all " + (routeForm.dias_semana?.includes(i) ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500")}>
                    {d[0]}
                  </button>
                ))}
              </div></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRouteForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateRoute} className="btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}

      {showVisitModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowVisitModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Planificar visita</h2>
            <div className="space-y-3">
              <div><label className="label-field">Cliente ID</label><input className="input-field" value={visitForm.customer_id} onChange={e => setVisitForm({ ...visitForm, customer_id: e.target.value })} /></div>
              <div><label className="label-field">Fecha planificada</label><input type="date" className="input-field" value={visitForm.fecha_planificada} onChange={e => setVisitForm({ ...visitForm, fecha_planificada: e.target.value })} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowVisitModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateVisit} className="btn-primary flex-1">Planificar</button>
            </div>
          </div>
        </div>
      )}

      {showAuthForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAuthForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Solicitar autorización de crédito</h2>
            <div className="space-y-3">
              <div><label className="label-field">Cliente ID</label><input className="input-field" value={authForm.customer_id} onChange={e => setAuthForm({ ...authForm, customer_id: e.target.value })} /></div>
              <div><label className="label-field">Monto solicitado</label><input type="number" className="input-field" value={authForm.monto_solicitado} onChange={e => setAuthForm({ ...authForm, monto_solicitado: e.target.value })} /></div>
              <div><label className="label-field">Motivo</label><textarea className="input-field" rows={3} value={authForm.motivo} onChange={e => setAuthForm({ ...authForm, motivo: e.target.value })} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAuthForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateAuth} className="btn-primary flex-1">Solicitar</button>
            </div>
          </div>
        </div>
      )}

      {showCreditForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreditForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Configurar límite de crédito</h2>
            <div className="space-y-3">
              <div><label className="label-field">Cliente ID</label><input className="input-field" value={creditForm.customer_id} onChange={e => setCreditForm({ ...creditForm, customer_id: e.target.value })} /></div>
              <div><label className="label-field">Límite de crédito (Gs)</label><input type="number" className="input-field" value={creditForm.limite_credito} onChange={e => setCreditForm({ ...creditForm, limite_credito: e.target.value })} /></div>
              <div><label className="label-field">Días de crédito</label><input type="number" className="input-field" value={creditForm.dias_credito} onChange={e => setCreditForm({ ...creditForm, dias_credito: +e.target.value })} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreditForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSetCredit} className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline icon component to avoid import conflict
function PackageIcon(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>}
