import { useState, useEffect } from "react"
import { api, type Promotion, type PromotionUsage } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Search, Plus, Loader2, AlertTriangle, Percent, DollarSign, ShoppingCart, Tag, Clock, Hash, CheckCircle, XCircle, Eye, EyeOff, Copy, Trash2, Sparkles, Calendar } from "lucide-react"

type Tab = "activas" | "programadas" | "vencidas" | "cupones" | "usage"

const TIPO_OPTS = [
  { v: "porcentaje", l: "% Descuento" },
  { v: "monto_fijo", l: "Monto fijo" },
  { v: "dos_por_uno", l: "2x1" },
  { v: "combo_precio", l: "Precio combo" },
  { v: "cantidad_lleva", l: "Lleva X paga Y" },
]

const APLICA_OPTS = [
  { v: "producto", l: "Producto específico" },
  { v: "categoria", l: "Categoría" },
  { v: "carrito", l: "Carrito completo" },
]

export default function PromotionsPage() {
  const [tab, setTab] = useState<Tab>("activas")
  const [loading, setLoading] = useState(true)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [usage, setUsage] = useState<PromotionUsage[]>([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [viewUsage, setViewUsage] = useState<string | null>(null)
  const [form, setForm] = useState<any>({
    nombre: "", descripcion: "", tipo: "porcentaje", valor: "", valor_maximo: "",
    aplica_a: "producto", producto_ids: "", categoria_ids: "",
    monto_minimo_compra: "", cantidad_minima: "", cantidad_maxima_items: "",
    combinable: false, valido_desde: "", valido_hasta: "",
    horario_desde: "", horario_hasta: "", dias_semana: [] as number[],
    codigo_cupon: "", requiere_cupon: false, usos_maximos: "", activo: true,
  })
  const toast = useToast()

  const fetchPromotions = async () => {
    setLoading(true)
    try {
      const p = await api.promotions.list({ activo: tab === "activas" ? true : tab === "vencidas" ? false : undefined })
      setPromotions(p)
    } catch (e: any) { toast.error("Error", e.message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchPromotions() }, [tab])

  const fetchUsage = async (id: string) => {
    try {
      const u = await api.promotions.usage(id)
      setUsage(u)
      setViewUsage(id)
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleSubmit = async () => {
    try {
      const data: any = {
        ...form,
        valor: form.valor ? Number(form.valor) : undefined,
        valor_maximo: form.valor_maximo ? Number(form.valor_maximo) : undefined,
        monto_minimo_compra: form.monto_minimo_compra ? Number(form.monto_minimo_compra) : undefined,
        cantidad_minima: form.cantidad_minima ? Number(form.cantidad_minima) : undefined,
        cantidad_maxima_items: form.cantidad_maxima_items ? Number(form.cantidad_maxima_items) : undefined,
        usos_maximos: form.usos_maximos ? Number(form.usos_maximos) : undefined,
        producto_ids: form.producto_ids ? form.producto_ids.split(",").map((s: string) => s.trim()) : undefined,
        categoria_ids: form.categoria_ids ? form.categoria_ids.split(",").map((s: string) => s.trim()) : undefined,
        horario_desde: form.horario_desde || undefined,
        horario_hasta: form.horario_hasta || undefined,
      }
      delete data.producto_ids_joined; delete data.categoria_ids_joined
      if (editing) {
        await api.promotions.update(editing, data)
        toast.success("Promoción actualizada")
      } else {
        await api.promotions.create(data)
        toast.success("Promoción creada")
      }
      setShowForm(false); setEditing(null); fetchPromotions()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta promoción?")) return
    try { await api.promotions.delete(id); toast.success("Eliminada"); fetchPromotions() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handleToggle = async (p: Promotion) => {
    try { await api.promotions.update(p.id, { activo: !p.activo }); fetchPromotions() }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const openEdit = (p: Promotion) => {
    setForm({
      nombre: p.nombre, descripcion: p.descripcion || "",
      tipo: p.tipo, valor: p.valor?.toString() || "", valor_maximo: p.valor_maximo?.toString() || "",
      aplica_a: p.aplica_a,
      producto_ids: (p.producto_ids || []).join(", "), categoria_ids: (p.categoria_ids || []).join(", "),
      monto_minimo_compra: p.monto_minimo_compra?.toString() || "",
      cantidad_minima: p.cantidad_minima?.toString() || "",
      cantidad_maxima_items: p.cantidad_maxima_items?.toString() || "",
      combinable: p.combinable || false,
      valido_desde: p.valido_desde || "", valido_hasta: p.valido_hasta || "",
      horario_desde: p.horario_desde || "", horario_hasta: p.horario_hasta || "",
      dias_semana: p.dias_semana || [],
      codigo_cupon: p.codigo_cupon || "", requiere_cupon: p.requiere_cupon || false,
      usos_maximos: p.usos_maximos?.toString() || "", activo: p.activo ?? true,
    })
    setEditing(p.id); setShowForm(true)
  }

  const toggleDia = (d: number) => {
    const dias = form.dias_semana.includes(d) ? form.dias_semana.filter((x: number) => x !== d) : [...form.dias_semana, d]
    setForm({ ...form, dias_semana: dias })
  }

  const now = new Date()
  const filtered = promotions.filter(p => {
    if (tab === "activas") return p.activo && new Date(p.valido_hasta || "") >= now
    if (tab === "programadas") return p.activo && new Date(p.valido_desde || "") > now
    if (tab === "vencidas") return !p.activo || new Date(p.valido_hasta || "") < now
    return true
  }).filter(p => !search || p.nombre.toLowerCase().includes(search.toLowerCase()))

  const renderForm = () => (
    <div className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null) }}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold">{editing ? "Editar" : "Nueva"} promoción</h3>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label-field">Nombre</label><input className="input-field" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
            <div className="col-span-2"><label className="label-field">Descripción</label><textarea className="input-field" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} /></div>
            <div><label className="label-field">Tipo</label><select className="input-field" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{TIPO_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
            <div><label className="label-field">Aplica a</label><select className="input-field" value={form.aplica_a} onChange={e => setForm({ ...form, aplica_a: e.target.value })}>{APLICA_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
            <div><label className="label-field">Valor</label><input className="input-field" type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder={form.tipo === "porcentaje" ? "%" : "Gs"} /></div>
            <div><label className="label-field">Valor máximo</label><input className="input-field" type="number" value={form.valor_maximo} onChange={e => setForm({ ...form, valor_maximo: e.target.value })} /></div>
            <div><label className="label-field">Producto IDs (separados por coma)</label><input className="input-field" value={form.producto_ids} onChange={e => setForm({ ...form, producto_ids: e.target.value })} /></div>
            <div><label className="label-field">Categoría IDs</label><input className="input-field" value={form.categoria_ids} onChange={e => setForm({ ...form, categoria_ids: e.target.value })} /></div>
            <div><label className="label-field">Monto mínimo compra</label><input className="input-field" type="number" value={form.monto_minimo_compra} onChange={e => setForm({ ...form, monto_minimo_compra: e.target.value })} /></div>
            <div><label className="label-field">Cantidad mínima</label><input className="input-field" type="number" value={form.cantidad_minima} onChange={e => setForm({ ...form, cantidad_minima: e.target.value })} /></div>
            <div><label className="label-field">Cantidad máxima items</label><input className="input-field" type="number" value={form.cantidad_maxima_items} onChange={e => setForm({ ...form, cantidad_maxima_items: e.target.value })} /></div>
            <div><label className="label-field">Usos máximos</label><input className="input-field" type="number" value={form.usos_maximos} onChange={e => setForm({ ...form, usos_maximos: e.target.value })} /></div>
          </div>
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2 text-sm text-gray-500">Vigencia y horario</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label-field">Válido desde</label><input className="input-field" type="date" value={form.valido_desde} onChange={e => setForm({ ...form, valido_desde: e.target.value })} /></div>
              <div><label className="label-field">Válido hasta</label><input className="input-field" type="date" value={form.valido_hasta} onChange={e => setForm({ ...form, valido_hasta: e.target.value })} /></div>
              <div><label className="label-field">Desde hora</label><input className="input-field" type="time" value={form.horario_desde} onChange={e => setForm({ ...form, horario_desde: e.target.value })} /></div>
              <div><label className="label-field">Hasta hora</label><input className="input-field" type="time" value={form.horario_hasta} onChange={e => setForm({ ...form, horario_hasta: e.target.value })} /></div>
            </div>
            <div className="mt-3">
              <label className="text-sm text-gray-500 mb-1 block">Días de semana</label>
              <div className="flex gap-2">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => (
                  <button key={i} onClick={() => toggleDia(i)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${form.dias_semana.includes(i) ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>{d}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2 text-sm text-gray-500">Cupón</h4>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label-field">Código cupón</label><input className="input-field" value={form.codigo_cupon} onChange={e => setForm({ ...form, codigo_cupon: e.target.value })} placeholder="VERANO20" /></div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.requiere_cupon} onChange={e => setForm({ ...form, requiere_cupon: e.target.checked })} className="rounded" /> Requiere cupón</label>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.combinable} onChange={e => setForm({ ...form, combinable: e.target.checked })} className="rounded" /> Combinable con otras promos</label>
            </div>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={() => { setShowForm(false); setEditing(null) }} className="btn-ghost">Cancelar</button>
          <button onClick={handleSubmit} disabled={!form.nombre || !form.valido_desde || !form.valido_hasta} className="btn-primary disabled:opacity-50">{editing ? "Actualizar" : "Crear"}</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Promociones</h1><p className="text-sm text-gray-500">Reglas, cupones, horarios inteligentes</p></div>
        <button onClick={() => { setEditing(null); setForm({ nombre: "", descripcion: "", tipo: "porcentaje", valor: "", valor_maximo: "", aplica_a: "producto", producto_ids: "", categoria_ids: "", monto_minimo_compra: "", cantidad_minima: "", cantidad_maxima_items: "", combinable: false, valido_desde: "", valido_hasta: "", horario_desde: "", horario_hasta: "", dias_semana: [], codigo_cupon: "", requiere_cupon: false, usos_maximos: "", activo: true }); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Nueva promoción</button>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {[
          { k: "activas" as Tab, l: "Activas", i: Tag },
          { k: "programadas" as Tab, l: "Programadas", i: Calendar },
          { k: "vencidas" as Tab, l: "Vencidas", i: AlertTriangle },
          { k: "cupones" as Tab, l: "Cupones", i: Copy },
          { k: "usage" as Tab, l: "Usos", i: Hash },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.k ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {tab === "cupones" ? (
        <div>
          <p className="text-sm text-gray-500 mb-4">Promociones que requieren código de cupón</p>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Cupón</th><th className="p-3">Promoción</th><th className="p-3">Tipo</th><th className="p-3">Desc.</th><th className="p-3">Usos</th><th className="p-3">Vence</th><th className="p-3">Activo</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.filter(p => p.requiere_cupon && p.codigo_cupon).map(p => (
                  <tr key={p.id} className="table-row">
                    <td className="p-3"><span className="font-mono font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{p.codigo_cupon}</span></td>
                    <td className="p-3 font-medium">{p.nombre}</td>
                    <td className="p-3 capitalize">{p.tipo}</td>
                    <td className="p-3">{p.valor}{p.tipo === "porcentaje" ? "%" : " Gs"}</td>
                    <td className="p-3">{p.usos_actuales ?? 0}{p.usos_maximos ? `/${p.usos_maximos}` : ""}</td>
                    <td className="p-3 text-sm">{p.valido_hasta ? new Date(p.valido_hasta).toLocaleDateString("es-PY") : "-"}</td>
                    <td className="p-3"><button onClick={() => handleToggle(p)}>{p.activo ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</button></td>
                  </tr>
                ))}
                {filtered.filter(p => p.requiere_cupon && p.codigo_cupon).length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-500">Sin cupones</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "usage" ? (
        <div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="p-3">Promoción</th><th className="p-3">Venta</th><th className="p-3">Cliente</th><th className="p-3">Descuento</th><th className="p-3">Cupón</th><th className="p-3">Fecha</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {promotions.filter(p => (p.usos_actuales ?? 0) > 0).slice(0, 10).map(p => (
                  <tr key={p.id} className="table-row cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800" onClick={() => fetchUsage(p.id)}>
                    <td className="p-3 font-medium">{p.nombre}</td>
                    <td className="p-3">{p.usos_actuales ?? 0} usos</td>
                    <td className="p-3">-</td>
                    <td className="p-3">{p.valor}{p.tipo === "porcentaje" ? "%" : " Gs"}</td>
                    <td className="p-3">{p.codigo_cupon || "-"}</td>
                    <td className="p-3 text-sm">-</td>
                  </tr>
                ))}
                {promotions.filter(p => (p.usos_actuales ?? 0) > 0).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Sin usos registrados</td></tr>}
              </tbody>
            </table>
          </div>
          {viewUsage && (
            <div className="mt-4 card p-4">
              <h4 className="font-semibold mb-2">Detalle de usos</h4>
              <pre className="text-xs max-h-48 overflow-y-auto">{JSON.stringify(usage, null, 2)}</pre>
              <button onClick={() => setViewUsage(null)} className="btn-ghost text-sm mt-2">Cerrar</button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex gap-3 items-center mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar promoción..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(p => (
                <div key={p.id} className={`card p-5 ${!p.activo ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold">{p.nombre}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${
                        p.tipo === "porcentaje" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" :
                        p.tipo === "dos_por_uno" ? "bg-green-50 dark:bg-green-900/20 text-green-600" :
                        p.tipo === "combo_precio" ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600" :
                        p.tipo === "cantidad_lleva" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                        "bg-gray-50 dark:bg-gray-700 text-gray-600"
                      }`}>{TIPO_OPTS.find(t => t.v === p.tipo)?.l || p.tipo}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleToggle(p)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title={p.activo ? "Desactivar" : "Activar"}>
                        {p.activo ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Percent className="w-4 h-4 text-blue-500" /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500">
                    <div className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" /><span>{p.valor}{p.tipo === "porcentaje" ? "%" : p.tipo === "monto_fijo" ? " Gs" : ""}{p.valor_maximo ? ` (max ${p.valor_maximo} Gs)` : ""}</span></div>
                    <div className="flex items-center gap-2"><ShoppingCart className="w-3.5 h-3.5" /><span className="capitalize">{p.aplica_a}</span></div>
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /><span>{p.valido_desde ? new Date(p.valido_desde).toLocaleDateString("es-PY") : ""} - {p.valido_hasta ? new Date(p.valido_hasta).toLocaleDateString("es-PY") : ""}</span></div>
                    {p.horario_desde && <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /><span>{p.horario_desde} - {p.horario_hasta}</span></div>}
                    {p.codigo_cupon && <div className="flex items-center gap-2"><Copy className="w-3.5 h-3.5" /><span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{p.codigo_cupon}</span></div>}
                    <div className="flex items-center gap-2"><Hash className="w-3.5 h-3.5" /><span>Usos: {p.usos_actuales ?? 0}{p.usos_maximos ? `/${p.usos_maximos}` : ""}</span></div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No hay promociones</div>}
            </div>
          )}
        </div>
      )}

      {showForm && renderForm()}
    </div>
  )
}
