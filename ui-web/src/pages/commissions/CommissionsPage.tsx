import { useState, useEffect } from "react"
import { Percent, Plus, Search, Loader2, X, DollarSign, CheckCircle, Clock } from "lucide-react"
import { api, type CommissionRule, type SalesCommission } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG, formatDate } from "../../utils/format"

type RuleForm = {
  nombre: string
  tipo: string
  vendedor_id: string
  porcentaje: number | null
  aplica_a: string
  producto_ids: string
  categoria_ids: string
  monto_minimo: number | null
  monto_maximo: number | null
  valido_desde: string
  valido_hasta: string
}

type CommissionSummary = {
  vendedor_id: string
  total_ventas: number
  total_comisiones: number
  cantidad_operaciones: number
  pendiente_pago: number
}

const emptyRuleForm: RuleForm = {
  nombre: "", tipo: "porcentaje", vendedor_id: "",
  porcentaje: null, aplica_a: "total",
  producto_ids: "", categoria_ids: "",
  monto_minimo: null, monto_maximo: null,
  valido_desde: "", valido_hasta: "",
}

export default function CommissionsPage() {
  const [activeTab, setActiveTab] = useState<"rules" | "commissions">("rules")
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [commissions, setCommissions] = useState<SalesCommission[]>([])
  const [summary, setSummary] = useState<CommissionSummary[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rulesData, commissionsData, summaryData] = await Promise.allSettled([
        api.commissions.rules.list(),
        api.commissions.list(),
        api.commissions.summary(),
      ])
      if (rulesData.status === "fulfilled") setRules(rulesData.value)
      if (commissionsData.status === "fulfilled") setCommissions(commissionsData.value)
      if (summaryData.status === "fulfilled") setSummary(summaryData.value)
    } catch {
      toast.info("Datos demo", "Conectá el backend para ver comisiones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filteredRules = rules.filter(r =>
    !search || r.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCommissions = commissions.filter(c =>
    !search || (c.vendedor_id?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const totalComisiones = commissions.reduce((a, c) => a + Number(c.monto_comision || 0), 0)
  const pendientes = commissions.filter(c => c.estado === "pendiente").reduce((a, c) => a + Number(c.monto_comision || 0), 0)
  const pagadas = commissions.filter(c => c.estado === "pagada").reduce((a, c) => a + Number(c.monto_comision || 0), 0)

  const handleSubmitRule = async () => {
    if (!ruleForm.nombre || ruleForm.porcentaje == null) {
      toast.error("Error", "Nombre y porcentaje son obligatorios")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        nombre: ruleForm.nombre,
        tipo: ruleForm.tipo,
        porcentaje: ruleForm.porcentaje,
        vendedor_id: ruleForm.vendedor_id || undefined,
        aplica_a: ruleForm.aplica_a,
        producto_ids: ruleForm.producto_ids ? ruleForm.producto_ids.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        categoria_ids: ruleForm.categoria_ids ? ruleForm.categoria_ids.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        monto_minimo: ruleForm.monto_minimo ?? undefined,
        monto_maximo: ruleForm.monto_maximo ?? undefined,
        valido_desde: ruleForm.valido_desde || undefined,
        valido_hasta: ruleForm.valido_hasta || undefined,
      }
      if (editingRuleId) {
        await api.commissions.rules.update(editingRuleId, payload)
        toast.success("Actualizada", "Regla actualizada correctamente")
      } else {
        await api.commissions.rules.create(payload)
        toast.success("Creada", "Regla creada correctamente")
      }
      setShowRuleModal(false)
      setEditingRuleId(null)
      setRuleForm(emptyRuleForm)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo guardar la regla")
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditRule = (r: CommissionRule) => {
    setEditingRuleId(r.id)
    setRuleForm({
      nombre: r.nombre,
      tipo: r.tipo,
      vendedor_id: r.vendedor_id || "",
      porcentaje: r.porcentaje ?? null,
      aplica_a: r.aplica_a || "",
      producto_ids: (r.producto_ids || []).join(", "),
      categoria_ids: (r.categoria_ids || []).join(", "),
      monto_minimo: r.monto_minimo ?? null,
      monto_maximo: r.monto_maximo ?? null,
      valido_desde: r.valido_desde?.slice(0, 10) || "",
      valido_hasta: r.valido_hasta?.slice(0, 10) || "",
    })
    setShowRuleModal(true)
  }

  const handleToggleRule = async (r: CommissionRule) => {
    const ok = await confirm({
      title: r.activo ? "Desactivar regla" : "Activar regla",
      message: `¿${r.activo ? "Desactivar" : "Activar"} "${r.nombre}"?`,
      confirmText: r.activo ? "Desactivar" : "Activar",
      variant: r.activo ? "warning" : "info",
    })
    if (!ok) return
    try {
      await api.commissions.rules.update(r.id, { activo: !r.activo })
      toast.success(r.activo ? "Desactivada" : "Activada", "Regla actualizada correctamente")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo cambiar el estado")
    }
  }

  const handlePayCommission = async (c: SalesCommission) => {
    const ok = await confirm({
      title: "Pagar comisión",
      message: `¿Confirmás el pago de ${formatPYG(c.monto_comision)}?`,
      confirmText: "Pagar",
      variant: "info",
    })
    if (!ok) return
    try {
      await api.commissions.pay(c.id)
      toast.success("Pagada", "Comisión marcada como pagada")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo procesar el pago")
    }
  }

  const reglaEstadoMap: Record<string, string> = {
    activo: "badge-success",
    inactivo: "badge-danger",
  }

  const comisionEstadoMap: Record<string, string> = {
    pendiente: "badge-warning",
    pagada: "badge-success",
    cancelada: "badge-danger",
  }

  const aplicaLabels: Record<string, string> = {
    producto: "Producto",
    categoria: "Categoría",
    total: "Total",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Percent className="w-6 h-6 text-primary" />
            Comisiones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de reglas y liquidación de comisiones</p>
        </div>
        {activeTab === "rules" && (
          <button onClick={() => { setEditingRuleId(null); setRuleForm(emptyRuleForm); setShowRuleModal(true) }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nueva regla
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total comisiones</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPYG(totalComisiones)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pendientes pago</span></div>
          <p className="text-2xl font-bold text-amber-500">{formatPYG(pendientes)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pagadas</span></div>
          <p className="text-2xl font-bold text-green-500">{formatPYG(pagadas)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("rules")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "rules" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Reglas</button>
        <button onClick={() => setActiveTab("commissions")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "commissions" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Comisiones</button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder={activeTab === "rules" ? "Buscar por nombre de regla..." : "Buscar por vendedor..."} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Nombre</th>
                <th className="table-cell">Vendedor</th>
                <th className="table-cell text-right">%</th>
                <th className="table-cell">Aplica a</th>
                <th className="table-cell">Vigencia</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredRules.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay reglas de comisión</td></tr>
              ) : (
                filteredRules.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td">
                      <p className="text-sm font-medium">{r.nombre}</p>
                    </td>
                    <td className="table-td text-sm text-gray-500">{r.vendedor_id || "Todos"}</td>
                    <td className="table-td text-right font-mono font-bold text-primary">{r.porcentaje}%</td>
                    <td className="table-td text-sm capitalize">{r.aplica_a ? aplicaLabels[r.aplica_a] || r.aplica_a : "-"}</td>
                    <td className="table-td text-sm text-gray-500">
                      {r.valido_desde ? (
                        <span>{formatDate(r.valido_desde)} — {formatDate(r.valido_hasta)}</span>
                      ) : (
                        <span className="text-gray-400">Indefinido</span>
                      )}
                    </td>
                    <td className="table-td">
                      <StatusBadge status={r.activo ? "activo" : "inactivo"} map={reglaEstadoMap} />
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button className="btn-ghost" title="Editar" onClick={() => handleEditRule(r)}><EditIcon /></button>
                        <button className="btn-ghost" title={r.activo ? "Desactivar" : "Activar"} onClick={() => handleToggleRule(r)}>
                          {r.activo ? <span className="text-amber-500 font-bold text-xs px-1">OFF</span> : <span className="text-green-500 font-bold text-xs px-1">ON</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Commissions Tab */}
      {activeTab === "commissions" && (
        <div className="space-y-6">
          {summary.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.map((s) => (
                <div key={s.vendedor_id} className="card p-4">
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">{s.vendedor_id}</p>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between"><span>Ventas</span><span className="font-mono font-bold">{s.cantidad_operaciones}</span></div>
                    <div className="flex justify-between"><span>Total ventas</span><span className="font-mono">{formatPYG(s.total_ventas)}</span></div>
                    <div className="flex justify-between"><span>Comisiones</span><span className="font-mono font-bold text-primary">{formatPYG(s.total_comisiones)}</span></div>
                    <div className="flex justify-between"><span>Pendiente</span><span className="font-mono font-bold text-amber-500">{formatPYG(s.pendiente_pago)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Vendedor</th>
                  <th className="table-cell text-right">Base</th>
                  <th className="table-cell text-right">%</th>
                  <th className="table-cell text-right">Monto</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell">Fecha</th>
                  <th className="table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filteredCommissions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No hay comisiones calculadas</td></tr>
                ) : (
                  filteredCommissions.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="table-td text-sm font-medium">{c.vendedor_id || "—"}</td>
                      <td className="table-td text-right font-mono">{formatPYG(c.base_calculo)}</td>
                      <td className="table-td text-right font-mono font-bold text-primary">{c.porcentaje}%</td>
                      <td className="table-td text-right font-mono font-bold">{formatPYG(c.monto_comision)}</td>
                      <td className="table-td">
                        <StatusBadge status={c.estado || "-"} map={comisionEstadoMap} />
                      </td>
                      <td className="table-td text-sm text-gray-500">{formatDate(c.created_at)}</td>
                      <td className="table-td">
                        {c.estado === "pendiente" && (
                          <button className="btn-ghost text-green-500" title="Pagar" onClick={() => handlePayCommission(c)}>
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingRuleId ? "Editar regla" : "Nueva regla de comisión"}</h3>
              <button onClick={() => setShowRuleModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="input-label label-required">Nombre</label>
                <input className="input-field" placeholder="Ej: Comisión 5% ventas" value={ruleForm.nombre} onChange={(e) => setRuleForm({ ...ruleForm, nombre: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label label-required">Tipo</label>
                  <select className="input-field" value={ruleForm.tipo} onChange={(e) => setRuleForm({ ...ruleForm, tipo: e.target.value })}>
                    <option value="porcentaje">Porcentaje</option>
                    <option value="monto_fijo">Monto fijo</option>
                  </select>
                </div>
                <div>
                  <label className="input-label label-required">Porcentaje</label>
                  <input className="input-field" type="number" min={0} max={100} step={0.1} placeholder="5" value={ruleForm.porcentaje ?? ""} onChange={(e) => setRuleForm({ ...ruleForm, porcentaje: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
              </div>
              <div>
                <label className="input-label">Vendedor (opcional)</label>
                <input className="input-field" placeholder="ID del vendedor (vacío = todos)" value={ruleForm.vendedor_id} onChange={(e) => setRuleForm({ ...ruleForm, vendedor_id: e.target.value })} />
              </div>
              <div>
                <label className="input-label label-required">Aplica a</label>
                <select className="input-field" value={ruleForm.aplica_a} onChange={(e) => setRuleForm({ ...ruleForm, aplica_a: e.target.value })}>
                  <option value="total">Total de la venta</option>
                  <option value="producto">Productos específicos</option>
                  <option value="categoria">Categorías</option>
                </select>
              </div>
              {ruleForm.aplica_a === "producto" && (
                <div>
                  <label className="input-label">IDs de productos (separados por coma)</label>
                  <input className="input-field" placeholder="uuid-1, uuid-2" value={ruleForm.producto_ids} onChange={(e) => setRuleForm({ ...ruleForm, producto_ids: e.target.value })} />
                </div>
              )}
              {ruleForm.aplica_a === "categoria" && (
                <div>
                  <label className="input-label">IDs de categorías (separados por coma)</label>
                  <input className="input-field" placeholder="uuid-1, uuid-2" value={ruleForm.categoria_ids} onChange={(e) => setRuleForm({ ...ruleForm, categoria_ids: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Monto mínimo</label>
                  <input className="input-field" type="number" min={0} placeholder="50000" value={ruleForm.monto_minimo ?? ""} onChange={(e) => setRuleForm({ ...ruleForm, monto_minimo: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
                <div>
                  <label className="input-label">Monto máximo</label>
                  <input className="input-field" type="number" min={0} placeholder="5000000" value={ruleForm.monto_maximo ?? ""} onChange={(e) => setRuleForm({ ...ruleForm, monto_maximo: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Válido desde</label>
                  <input className="input-field" type="date" value={ruleForm.valido_desde} onChange={(e) => setRuleForm({ ...ruleForm, valido_desde: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Válido hasta</label>
                  <input className="input-field" type="date" value={ruleForm.valido_hasta} onChange={(e) => setRuleForm({ ...ruleForm, valido_hasta: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="btn-outline flex-1" onClick={() => setShowRuleModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleSubmitRule} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingRuleId ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
