import { useState, useEffect } from "react"
import { Landmark, Search, Loader2, X, History, CheckCircle2, XCircle, ArrowRightLeft, Banknote } from "lucide-react"
import { api, type Check, type CheckEvent, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

const ESTADO_MAP: Record<string, string> = {
  cartera: "badge-info",
  depositado: "badge-warning",
  acreditado: "badge-success",
  rechazado: "badge-danger",
  reemplazado: "badge-info",
  endosado: "badge-info",
}

export default function ChecksPage() {
  const [checks, setChecks] = useState<Check[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Check | null>(null)
  const [events, setEvents] = useState<CheckEvent[]>([])
  const [showDetail, setShowDetail] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [replaceForm, setReplaceForm] = useState({ numero: "", banco: "", titular: "", fecha_vencimiento: "" })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [checksData, customersData] = await Promise.allSettled([
        api.checks.list({ estado: estadoFiltro || undefined, limit: 200 }),
        api.customers.list({ activo: true }),
      ])
      if (checksData.status === "fulfilled") setChecks(checksData.value)
      if (customersData.status === "fulfilled") setCustomers(customersData.value)
    } catch {
      toast.info("Sin datos", "Conectá el backend para ver cheques y pagarés")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [estadoFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = checks.filter(c => {
    const customer = customers.find(cu => cu.id === c.customer_id)
    const term = search.toLowerCase()
    return !search || c.numero.toLowerCase().includes(term) || (customer?.razon_social?.toLowerCase().includes(term) ?? false)
  })

  const totalCartera = checks.filter(c => c.estado === "cartera" || c.estado === "depositado").reduce((s, c) => s + c.monto, 0)
  const totalRechazado = checks.filter(c => c.estado === "rechazado").reduce((s, c) => s + c.monto, 0)

  const customerName = (id: string) => customers.find(c => c.id === id)?.razon_social || "—"

  const openDetail = async (check: Check) => {
    setSelected(check)
    try {
      setEvents(await api.checks.events(check.id))
    } catch {
      setEvents([])
    }
    setShowDetail(true)
  }

  const handleAdvance = async (check: Check) => {
    const siguiente = check.estado === "cartera" ? "depositado" : "acreditado"
    try {
      await api.checks.changeStatus(check.id, { estado: siguiente })
      toast.success("Actualizado", `Marcado como ${siguiente}`)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo actualizar el estado")
    }
  }

  const handleReject = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await api.checks.changeStatus(selected.id, { estado: "rechazado", motivo: motivo || undefined })
      toast.success("Rechazado", "El cheque/pagaré fue marcado como rechazado y se reabrió la deuda asociada")
      setShowReject(false)
      setMotivo("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo rechazar")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReplace = async () => {
    if (!selected || !replaceForm.numero || !replaceForm.fecha_vencimiento) {
      toast.error("Error", "Completá número y fecha de vencimiento del nuevo cheque")
      return
    }
    setSubmitting(true)
    try {
      await api.checks.replace(selected.id, replaceForm)
      toast.success("Reemplazado", "Se registró el nuevo cheque/pagaré en cartera")
      setShowReplace(false)
      setReplaceForm({ numero: "", banco: "", titular: "", fecha_vencimiento: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo reemplazar")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Landmark className="w-6 h-6 text-primary" />
          Cheques y Pagarés
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Cartera de cheques y pagarés recibidos de clientes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Banknote className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">En cartera</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPYG(totalCartera)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><XCircle className="w-5 h-5 text-red-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rechazados</span></div>
          <p className="text-2xl font-bold text-red-500">{formatPYG(totalRechazado)}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por número o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-48" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="cartera">Cartera</option>
          <option value="depositado">Depositado</option>
          <option value="acreditado">Acreditado</option>
          <option value="rechazado">Rechazado</option>
          <option value="reemplazado">Reemplazado</option>
        </select>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Cliente</th>
              <th className="table-cell">Tipo</th>
              <th className="table-cell">Número</th>
              <th className="table-cell">Banco</th>
              <th className="table-cell text-right">Monto</th>
              <th className="table-cell">Vencimiento</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay cheques/pagarés</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="table-row cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="table-td text-sm font-medium">{customerName(c.customer_id)}</td>
                  <td className="table-td text-sm capitalize">{c.tipo}</td>
                  <td className="table-td text-sm font-mono">{c.numero}</td>
                  <td className="table-td text-sm text-gray-500">{c.banco || "—"}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(c.monto)}</td>
                  <td className="table-td text-sm">{new Date(c.fecha_vencimiento).toLocaleDateString("es-PY")}</td>
                  <td className="table-td"><StatusBadge status={c.estado} map={ESTADO_MAP} /></td>
                  <td className="table-td">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {(c.estado === "cartera" || c.estado === "depositado") && (
                        <button className="btn-ghost text-green-500" title={c.estado === "cartera" ? "Marcar depositado" : "Marcar acreditado"} onClick={() => handleAdvance(c)}>
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {(c.estado === "cartera" || c.estado === "depositado") && (
                        <button className="btn-ghost text-red-500" title="Rechazar" onClick={() => { setSelected(c); setShowReject(true) }}>
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {c.estado === "rechazado" && (
                        <button className="btn-ghost text-primary" title="Reemplazar" onClick={() => { setSelected(c); setShowReplace(true) }}>
                          <ArrowRightLeft className="w-4 h-4" />
                        </button>
                      )}
                      <button className="btn-ghost" title="Historial" onClick={() => openDetail(c)}><History className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail / history modal */}
      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selected.tipo === "cheque" ? "Cheque" : "Pagaré"} {selected.numero}</h3>
              <button onClick={() => setShowDetail(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-400">Cliente</p><p className="font-medium">{customerName(selected.customer_id)}</p></div>
                <div><p className="text-gray-400">Monto</p><p className="font-bold font-mono">{formatPYG(selected.monto)}</p></div>
                <div><p className="text-gray-400">Banco</p><p>{selected.banco || "—"}</p></div>
                <div><p className="text-gray-400">Titular</p><p>{selected.titular || "—"}</p></div>
                <div><p className="text-gray-400">Vencimiento</p><p>{new Date(selected.fecha_vencimiento).toLocaleDateString("es-PY")}</p></div>
                <div><p className="text-gray-400">Estado</p><StatusBadge status={selected.estado} map={ESTADO_MAP} /></div>
              </div>
              {selected.observaciones && <p className="text-xs text-gray-400 whitespace-pre-line border-t border-gray-100 dark:border-gray-700 pt-3">{selected.observaciones}</p>}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Historial</p>
                {events.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin eventos</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {events.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between text-sm">
                        <span>{ev.estado_anterior ? `${ev.estado_anterior} → ${ev.estado_nuevo}` : `Creado (${ev.estado_nuevo})`}</span>
                        <span className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleString("es-PY")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && selected && (
        <div className="modal-overlay" onClick={() => setShowReject(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rechazar {selected.tipo}</h3>
              <button onClick={() => setShowReject(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Se reabrirá la deuda del cliente por {formatPYG(selected.monto)}.</p>
              <div>
                <label className="input-label">Motivo</label>
                <input className="input-field" placeholder="Fondos insuficientes..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowReject(false)}>Cancelar</button>
                <button className="btn-primary flex-1 bg-red-500 hover:bg-red-600" onClick={handleReject} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rechazar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replace modal */}
      {showReplace && selected && (
        <div className="modal-overlay" onClick={() => setShowReplace(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reemplazar {selected.tipo}</h3>
              <button onClick={() => setShowReplace(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label label-required">Número nuevo</label>
                <input className="input-field" value={replaceForm.numero} onChange={(e) => setReplaceForm({ ...replaceForm, numero: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Banco</label>
                <input className="input-field" value={replaceForm.banco} onChange={(e) => setReplaceForm({ ...replaceForm, banco: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Titular</label>
                <input className="input-field" value={replaceForm.titular} onChange={(e) => setReplaceForm({ ...replaceForm, titular: e.target.value })} />
              </div>
              <div>
                <label className="input-label label-required">Nueva fecha de vencimiento</label>
                <input className="input-field" type="date" value={replaceForm.fecha_vencimiento} onChange={(e) => setReplaceForm({ ...replaceForm, fecha_vencimiento: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowReplace(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleReplace} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reemplazar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
