import { useState, useEffect } from "react"
import { Landmark, Search, Loader2, X, History, CheckCircle2, XCircle, ArrowRightLeft, Banknote, Plus, AlertTriangle, FileText } from "lucide-react"
import { api, type Check, type CheckEvent, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate } from "../../utils/format"

const ESTADO_MAP: Record<string, string> = {
  cartera: "badge-info",
  depositado: "badge-warning",
  acreditado: "badge-success",
  rechazado: "badge-danger",
  reemplazado: "badge-info",
  endosado: "badge-info",
}

interface ChecksSummary {
  total_documentos: number
  total_cartera: number
  cant_cartera: number
  total_rechazado: number
  cant_rechazado: number
  total_acreditado: number
  cant_acreditado: number
  total_pagares: number
}

export default function ChecksPage() {
  const [checks, setChecks] = useState<any[]>([])
  const [summary, setSummary] = useState<ChecksSummary | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")
  const [loading, setLoading] = useState(true)
  
  const [selected, setSelected] = useState<any | null>(null)
  const [events, setEvents] = useState<CheckEvent[]>([])
  const [showDetail, setShowDetail] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  const [motivo, setMotivo] = useState("")
  const [replaceForm, setReplaceForm] = useState({ numero: "", banco: "", titular: "", fecha_vencimiento: "" })
  const [createForm, setCreateForm] = useState({ customer_id: "", tipo: "cheque", numero: "", banco: "", titular: "", monto: "", fecha_emision: new Date().toISOString().split("T")[0], fecha_vencimiento: "" })
  
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [checksData, summaryData, customersData] = await Promise.allSettled([
        api.checks.list({ estado: estadoFiltro || undefined, limit: 200 }),
        api.checks.summary(),
        api.customers.list({ activo: true }),
      ])
      if (checksData.status === "fulfilled") setChecks(checksData.value)
      if (summaryData.status === "fulfilled") setSummary(summaryData.value)
      if (customersData.status === "fulfilled") setCustomers(customersData.value)
    } catch {
      toast.info("Sin datos", "Conectá el backend para ver cheques y pagarés")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [estadoFiltro])

  const filtered = checks.filter(c => {
    const custName = c.customer_name || customers.find(cu => cu.id === c.customer_id)?.razon_social || ""
    const custRuc = c.customer_ruc || customers.find(cu => cu.id === c.customer_id)?.ruc || ""
    const term = search.toLowerCase()
    return !search || (c.numero || "").toLowerCase().includes(term) || custName.toLowerCase().includes(term) || custRuc.toLowerCase().includes(term)
  })

  const openDetail = async (check: any) => {
    setSelected(check)
    try {
      setEvents(await api.checks.events(check.id))
    } catch {
      setEvents([])
    }
    setShowDetail(true)
  }

  const handleAdvance = async (check: any) => {
    const siguiente = check.estado === "cartera" ? "depositado" : "acreditado"
    try {
      await api.checks.changeStatus(check.id, { estado: siguiente })
      toast.success("Estado Actualizado", `Cheque/Pagaré marcado como ${siguiente}`)
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
      toast.success("Cheque Rechazado", "El documento fue marcado como rechazado y se reabrió la deuda asociada")
      setShowReject(false)
      setMotivo("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo rechazar el cheque")
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
      toast.success("Cheque Reemplazado", "Se registró el nuevo cheque/pagaré en cartera")
      setShowReplace(false)
      setReplaceForm({ numero: "", banco: "", titular: "", fecha_vencimiento: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo reemplazar el cheque")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateCheck = async () => {
    if (!createForm.customer_id || !createForm.numero || !createForm.monto || !createForm.fecha_vencimiento) {
      toast.error("Atención", "Completá cliente, número, monto y fecha de vencimiento")
      return
    }
    setSubmitting(true)
    try {
      await api.checks.create({
        ...createForm,
        monto: parseFloat(createForm.monto),
      })
      toast.success("Documento Registrado", "Cheque/Pagaré ingresado correctamente en cartera")
      setShowCreateModal(false)
      setCreateForm({ customer_id: "", tipo: "cheque", numero: "", banco: "", titular: "", monto: "", fecha_emision: new Date().toISOString().split("T")[0], fecha_vencimiento: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear el cheque/pagaré")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Cartera de Cheques & Pagarés Operativos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Custodia, depósito, clearing bancario y gestión de rechazos</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>+ Ingresar Cheque / Pagaré</span>
        </button>
      </div>

      {/* Unified Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4 border-l-4 border-l-primary flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>En Cartera / Depositado</span>
            <Banknote className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold font-mono text-gray-900 dark:text-white">{formatPYG(summary?.total_cartera || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">{summary?.cant_cartera || 0} cheques/pagarés en cartera</span>
        </div>

        <div className="card p-4 border-l-4 border-l-red-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Cheques Rechazados</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-xl font-bold font-mono text-red-600 dark:text-red-400">{formatPYG(summary?.total_rechazado || 0)}</p>
          <span className="text-[10px] text-red-500/80 mt-1 block font-semibold">{summary?.cant_rechazado || 0} docs exigen reclamo judicial</span>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Pagarés Activos</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{formatPYG(summary?.total_pagares || 0)}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Pagarés promesas de pago</span>
        </div>

        <div className="card p-4 border-l-4 border-l-blue-500 flex flex-col justify-between transition-all hover:shadow-md">
          <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
            <span>Documentos Totales</span>
            <Landmark className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{summary?.total_documentos || 0}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Total histórico custodiado</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10 text-xs font-medium" placeholder="Buscar por cliente, RUC, número o banco..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-48 text-xs font-medium" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="cartera">En Cartera</option>
          <option value="depositado">Depositado</option>
          <option value="acreditado">Acreditado</option>
          <option value="rechazado">Rechazado</option>
          <option value="reemplazado">Reemplazado</option>
        </select>
        <button onClick={fetchData} className="btn-primary text-xs">Actualizar</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Cliente</th>
              <th className="table-cell">Tipo</th>
              <th className="table-cell">Número</th>
              <th className="table-cell">Banco / Titular</th>
              <th className="table-cell text-right">Monto</th>
              <th className="table-cell">Vencimiento</th>
              <th className="table-cell text-center">Estado</th>
              <th className="table-cell text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No se encontraron cheques o pagarés</td></tr>
            ) : (
              filtered.map((c) => {
                const custName = c.customer_name || customers.find(cu => cu.id === c.customer_id)?.razon_social || "Cliente Sin Nombre"
                const custRuc = c.customer_ruc || customers.find(cu => cu.id === c.customer_id)?.ruc || "Sin RUC"
                const numericMonto = typeof c.monto === "number" ? c.monto : parseFloat(c.monto || "0")

                return (
                  <tr key={c.id} className="table-row">
                    <td className="table-td">
                      <p className="font-bold text-gray-900 dark:text-white">{custName}</p>
                      <p className="text-[11px] text-gray-400 font-mono">RUC: {custRuc}</p>
                    </td>
                    <td className="table-td uppercase font-bold text-gray-700 dark:text-gray-300">{c.tipo}</td>
                    <td className="table-td font-mono font-bold text-primary">{c.numero}</td>
                    <td className="table-td">
                      <p className="font-medium text-gray-900 dark:text-white">{c.banco || "—"}</p>
                      <p className="text-[10px] text-gray-400">{c.titular || "Titular no especificado"}</p>
                    </td>
                    <td className="table-td text-right font-mono font-bold text-gray-900 dark:text-white">{formatPYG(numericMonto)}</td>
                    <td className="table-td font-medium text-gray-700 dark:text-gray-300">{c.fecha_vencimiento ? formatDate(c.fecha_vencimiento) : "—"}</td>
                    <td className="table-td text-center">
                      <StatusBadge status={c.estado || "-"} map={ESTADO_MAP} />
                    </td>
                    <td className="table-td text-center">
                      <div className="flex items-center justify-center gap-1">
                        {(c.estado === "cartera" || c.estado === "depositado") && (
                          <button
                            onClick={() => handleAdvance(c)}
                            className="btn-ghost text-green-600 p-1.5"
                            title={c.estado === "cartera" ? "Marcar como Depositado" : "Marcar como Acreditado"}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {(c.estado === "cartera" || c.estado === "depositado") && (
                          <button
                            onClick={() => { setSelected(c); setMotivo(""); setShowReject(true) }}
                            className="btn-ghost text-red-500 p-1.5"
                            title="Marcar como Rechazado"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {c.estado === "rechazado" && (
                          <button
                            onClick={() => { setSelected(c); setReplaceForm({ numero: "", banco: c.banco || "", titular: c.titular || "", fecha_vencimiento: "" }); setShowReplace(true) }}
                            className="btn-ghost text-amber-500 p-1.5"
                            title="Reemplazar por nuevo cheque"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openDetail(c)} className="btn-ghost p-1.5" title="Ver historial de eventos">
                          <History className="w-4 h-4 text-primary" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ingresar Cheque / Pagaré</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Cliente</label>
                <select className="input-field font-medium text-sm" value={createForm.customer_id} onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}>
                  <option value="">-- Seleccionar cliente --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.razon_social} ({c.ruc || "Sin RUC"})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">Tipo Documento</label>
                  <select className="input-field font-medium" value={createForm.tipo} onChange={(e) => setCreateForm({ ...createForm, tipo: e.target.value })}>
                    <option value="cheque">Cheque</option>
                    <option value="pagare">Pagaré</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">N° Documento</label>
                  <input className="input-field font-mono font-bold" placeholder="0041823" value={createForm.numero} onChange={(e) => setCreateForm({ ...createForm, numero: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label uppercase tracking-wider font-bold">Banco Emisor</label>
                  <input className="input-field font-medium" placeholder="Banco Continental" value={createForm.banco} onChange={(e) => setCreateForm({ ...createForm, banco: e.target.value })} />
                </div>
                <div>
                  <label className="input-label uppercase tracking-wider font-bold">Librador / Titular</label>
                  <input className="input-field font-medium" placeholder="Nombre titular" value={createForm.titular} onChange={(e) => setCreateForm({ ...createForm, titular: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Monto (₲)</label>
                <input className="input-field font-mono text-base text-primary font-bold" type="number" placeholder="1500000" value={createForm.monto} onChange={(e) => setCreateForm({ ...createForm, monto: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label uppercase tracking-wider font-bold">Fecha Emisión</label>
                  <input className="input-field" type="date" value={createForm.fecha_emision} onChange={(e) => setCreateForm({ ...createForm, fecha_emision: e.target.value })} />
                </div>
                <div>
                  <label className="input-label label-required uppercase tracking-wider font-bold">Fecha Vencimiento</label>
                  <input className="input-field" type="date" value={createForm.fecha_vencimiento} onChange={(e) => setCreateForm({ ...createForm, fecha_vencimiento: e.target.value })} />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCreateCheck} disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Documento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && selected && (
        <div className="modal-overlay" onClick={() => setShowReject(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Marcar Cheque Rechazado</h3>
              <button onClick={() => setShowReject(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-gray-500">
                Al rechazar el cheque <strong className="font-mono text-primary">{selected.numero}</strong> por <strong className="font-mono text-red-500">{formatPYG(selected.monto)}</strong>, la deuda asociada del cliente volverá a estado pendiente.
              </p>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Motivo de Rechazo</label>
                <textarea className="input-field font-medium" rows={3} placeholder="Ej. Fondos insuficientes / Firma no coincide" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowReject(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleReject} disabled={submitting} className="btn-primary bg-red-600 hover:bg-red-700">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Rechazo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replace Modal */}
      {showReplace && selected && (
        <div className="modal-overlay" onClick={() => setShowReplace(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reemplazar Cheque Rechazado</h3>
              <button onClick={() => setShowReplace(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-gray-500">
                Ingresá los datos del nuevo cheque que reemplaza al N° <strong className="font-mono text-primary">{selected.numero}</strong> por monto <strong className="font-mono text-emerald-600">{formatPYG(selected.monto)}</strong>.
              </p>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Nuevo N° de Cheque</label>
                <input className="input-field font-mono font-bold" placeholder="Nuevo número" value={replaceForm.numero} onChange={(e) => setReplaceForm({ ...replaceForm, numero: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label uppercase tracking-wider font-bold">Banco</label>
                  <input className="input-field" placeholder="Banco" value={replaceForm.banco} onChange={(e) => setReplaceForm({ ...replaceForm, banco: e.target.value })} />
                </div>
                <div>
                  <label className="input-label uppercase tracking-wider font-bold">Titular</label>
                  <input className="input-field" placeholder="Titular" value={replaceForm.titular} onChange={(e) => setReplaceForm({ ...replaceForm, titular: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="input-label label-required uppercase tracking-wider font-bold">Nueva Fecha Vencimiento</label>
                <input className="input-field" type="date" value={replaceForm.fecha_vencimiento} onChange={(e) => setReplaceForm({ ...replaceForm, fecha_vencimiento: e.target.value })} />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setShowReplace(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleReplace} disabled={submitting} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Reemplazo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-content max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Trazabilidad de Documento</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{selected.tipo?.toUpperCase()} N° {selected.numero}</h3>
              </div>
              <button onClick={() => setShowDetail(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-bold text-sm text-gray-900 dark:text-white">{selected.customer_name || "Cliente"}</p>
                <p className="text-gray-400 mt-1">Monto: <span className="font-mono font-bold text-emerald-500">{formatPYG(selected.monto)}</span></p>
                <p className="text-gray-400">Banco: <span className="font-medium text-gray-700 dark:text-gray-300">{selected.banco || "—"}</span></p>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-gray-500">Historial de Eventos de Clearing</h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {events.length === 0 ? (
                    <p className="p-4 text-center text-gray-400">Sin eventos registrados</p>
                  ) : events.map(ev => (
                    <div key={ev.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{ev.estado_anterior || "creado"} → <span className="text-primary uppercase">{ev.estado_nuevo}</span></p>
                        {ev.motivo && <p className="text-gray-400 text-[11px] mt-0.5">{ev.motivo}</p>}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{new Date(ev.created_at).toLocaleString("es-PY")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
