import { useState, useEffect } from "react"
import {
  Webhook, Plus, Edit, Trash2, Loader2, RefreshCw, CheckCircle, XCircle,
  Search, Settings, Activity, Eye, RotateCcw, ToggleLeft, ToggleRight,
} from "lucide-react"
import { api, type IntegrationConfig, type IntegrationDelivery } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Modal } from "../../components/Modal"

const EVENT_LABELS: Record<string, string> = {
  "venta.creada": "Venta creada",
  "venta.anulada": "Venta anulada",
  "pago.recibido": "Pago recibido",
  "pago.enviado": "Pago enviado",
  "entrega.asignada": "Entrega asignada",
  "entrega.entregada": "Entrega entregada",
  "entrega.fallida": "Entrega fallida",
  "entrega.recogida": "Entrega recogida",
  "entrega.transito": "Entrega en tránsito",
  "pedido.actualizado": "Pedido actualizado",
  "pedido.aprobado": "Pedido aprobado",
  "pedido.asignado_repartidor": "Pedido asignado repartidor",
  "pedido.rendido": "Pedido rendido",
  "compra.creada": "Compra creada",
  "compra.recibida": "Compra recibida",
  "producto.creado": "Producto creado",
  "producto.actualizado": "Producto actualizado",
  "stock.actualizado": "Stock actualizado",
  "cliente.creado": "Cliente creado",
  "cliente.actualizado": "Cliente actualizado",
  "ekuatia.emitida": "Ekuatia emitida",
  "ekuatia.anulada": "Ekuatia anulada",
  "timbrado.vencido": "Timbrado vencido",
  "usuario.creado": "Usuario creado",
  "empresa.creada": "Empresa creada",
}

const ALL_EVENTOS = Object.keys(EVENT_LABELS)

export default function IntegrationsPage() {
  const [tab, setTab] = useState<"configs" | "deliveries">("configs")
  const toast = useToast()

  const [configs, setConfigs] = useState<IntegrationConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<IntegrationConfig | null>(null)
  const [form, setForm] = useState({ destino: "", url: "", secret: "", activo: true, eventos: [] as string[] })
  const [saving, setSaving] = useState(false)

  const [deliveries, setDeliveries] = useState<IntegrationDelivery[]>([])
  const [deliveriesLoading, setDeliveriesLoading] = useState(true)
  const [deliverySearch, setDeliverySearch] = useState("")

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const data = await api.integrations.configs()
      setConfigs(Array.isArray(data) ? data : [])
    } catch {
      setConfigs([])
    } finally {
      setLoading(false)
    }
  }

  const fetchDeliveries = async () => {
    setDeliveriesLoading(true)
    try {
      const data = await api.integrations.deliveries()
      setDeliveries(Array.isArray(data) ? data : [])
    } catch {
      setDeliveries([])
    } finally {
      setDeliveriesLoading(false)
    }
  }

  useEffect(() => { fetchConfigs() }, [])
  useEffect(() => { if (tab === "deliveries") fetchDeliveries() }, [tab])

  const handleOpenModal = (cfg?: IntegrationConfig) => {
    if (cfg) {
      setEditing(cfg)
      setForm({
        destino: cfg.destino ?? "",
        url: cfg.url ?? "",
        secret: "",
        activo: cfg.activo ?? false,
        eventos: cfg.eventos ?? [],
      })
    } else {
      setEditing(null)
      setForm({ destino: "", url: "", secret: "", activo: true, eventos: [] })
    }
    setShowModal(true)
  }

  const handleToggleEvento = (ev: string) => {
    setForm(prev => ({
      ...prev,
      eventos: prev.eventos.includes(ev) ? prev.eventos.filter(e => e !== ev) : [...prev.eventos, ev],
    }))
  }

  const handleSave = async () => {
    if (!form.destino.trim() || !form.url.trim()) {
      toast.error("Error", "Destino y URL son requeridos")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.integrations.updateConfig(editing.id, form)
        toast.success("Configuración actualizada", form.destino)
      } else {
        await api.integrations.createConfig(form)
        toast.success("Configuración creada", form.destino)
      }
      setShowModal(false)
      fetchConfigs()
    } catch {
      toast.error("Error", "No se pudo guardar la configuración")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cfg: IntegrationConfig) => {
    if (!confirm(`¿Eliminar configuración "${cfg.destino}"?`)) return
    try {
      await api.integrations.deleteConfig(cfg.id)
      toast.success("Configuración eliminada", cfg.destino)
      fetchConfigs()
    } catch {
      toast.error("Error", "No se pudo eliminar")
    }
  }

  const handleToggleActive = async (cfg: IntegrationConfig) => {
    try {
      await api.integrations.updateConfig(cfg.id, { activo: !cfg.activo })
      setConfigs(configs.map(c => c.id === cfg.id ? { ...c, activo: !c.activo } : c))
    } catch {
      toast.error("Error", "No se pudo cambiar estado")
    }
  }

  const handleTest = async (cfg: IntegrationConfig) => {
    try {
      await api.integrations.testConfig(cfg.id)
      toast.success("Prueba enviada", cfg.destino)
    } catch {
      toast.error("Error", "Fallo la prueba")
    }
  }

  const handleRetry = async (d: IntegrationDelivery) => {
    try {
      await api.integrations.retryDelivery(d.id)
      toast.success("Reintentando", "Entrega reenviada")
      fetchDeliveries()
    } catch {
      toast.error("Error", "No se pudo reintentar")
    }
  }

  const filteredDeliveries = deliverySearch
    ? deliveries.filter(d =>
        (d.evento ?? "").includes(deliverySearch) ||
        (d.config_id ?? "").includes(deliverySearch)
      )
    : deliveries

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integraciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Webhooks y conectores del ecosistema</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab("configs")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "configs" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Settings className="w-4 h-4" />Configuraciones
        </button>
        <button onClick={() => setTab("deliveries")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "deliveries" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Activity className="w-4 h-4" />Entregas
        </button>
      </div>

      {tab === "configs" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
              <Plus className="w-4 h-4" />Nueva Configuración
            </button>
            <button onClick={fetchConfigs} disabled={loading} className="p-2 rounded-lg text-gray-400 hover:text-primary"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="card p-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" /></div>
            ) : configs.length === 0 ? (
              <div className="card p-8 text-center text-gray-500">
                <Webhook className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay configuraciones de integración</p>
                <p className="text-xs mt-1">Crea una para conectar con InteliCont, InteliAudit, SueldOK u otros sistemas</p>
              </div>
            ) : (
              configs.map(cfg => (
                <div key={cfg.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.activo ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        <Webhook className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">{cfg.destino}</span>
                          <button onClick={() => handleToggleActive(cfg)}>{cfg.activo ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}</button>
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-md">{cfg.url}</p>
                        {cfg.eventos && cfg.eventos.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cfg.eventos.map(ev => (
                              <span key={ev} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{EVENT_LABELS[ev] || ev}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleTest(cfg)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Probar">
                        <Activity className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleOpenModal(cfg)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(cfg)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "deliveries" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Buscar entregas..." value={deliverySearch} onChange={e => setDeliverySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
            </div>
            <button onClick={fetchDeliveries} disabled={deliveriesLoading} className="p-2 rounded-lg text-gray-400 hover:text-primary"><RefreshCw className={`w-4 h-4 ${deliveriesLoading ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evento</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tamaño</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {deliveriesLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : filteredDeliveries.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay entregas de webhook</td></tr>
                ) : (
                  filteredDeliveries.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{EVENT_LABELS[d.evento ?? ""] || d.evento}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{d.url ?? "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {d.exitoso || (d.respuesta_status && d.respuesta_status >= 200 && d.respuesta_status < 300)
                          ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" aria-label={`HTTP ${d.respuesta_status}`} />
                          : <XCircle className="w-4 h-4 text-red-500 mx-auto" aria-label={`HTTP ${d.respuesta_status}`} />
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500 font-mono">{d.payload_size ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{d.fecha_envio ? new Date(d.fecha_envio).toLocaleString("es-PY") : "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleRetry(d)} disabled={d.exitoso} className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-30" title="Reintentar">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Configuración" : "Nueva Configuración"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destino</label>
            <input type="text" value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })}
              placeholder="intelicont, inteliaudit, sueldok, custom..."
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL del Webhook</label>
            <input type="text" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://midominio.com/api/webhooks/intelimarket"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secret (firma HMAC)</label>
            <input type="password" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Eventos a suscribir</label>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-600 rounded-lg p-2">
              {ALL_EVENTOS.map(ev => (
                <label key={ev} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded cursor-pointer">
                  <input type="checkbox" checked={form.eventos.includes(ev)} onChange={() => handleToggleEvento(ev)}
                    className="rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{EVENT_LABELS[ev] || ev}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Activo</span>
            <button onClick={() => setForm({ ...form, activo: !form.activo })}>
              {form.activo ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
