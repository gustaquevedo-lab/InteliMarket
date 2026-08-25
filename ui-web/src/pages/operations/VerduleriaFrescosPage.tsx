import { useState, useEffect, useCallback } from "react"
import {
  Carrot, Sparkles, AlertTriangle, TrendingDown, Plus, Search,
  Loader2, CheckCircle2, DollarSign, Calendar, RefreshCw, Tag, Info, Package
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "dashboard" | "recepciones" | "frescura" | "markdown"

export default function VerduleriaFrescosPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [dashboard, setDashboard] = useState<any>(null)
  const [recepciones, setRecepciones] = useState<any[]>([])
  const [auditorias, setAuditorias] = useState<any[]>([])
  const [markdowns, setMarkdowns] = useState<any[]>([])
  const [scorecards, setScorecards] = useState<any[]>([])

  // Formulario nueva recepción
  const [showRecepForm, setShowRecepForm] = useState(false)
  const [savingRecep, setSavingRecep] = useState(false)
  const [recepForm, setRecepForm] = useState({
    producto_id: "", proveedor_id: "", cantidad_recibida: "", cantidad_aceptada: "",
    calidad: "A", precio_unitario: "", fecha_vencimiento_estimada: "", nota_calidad: ""
  })

  // Formulario nueva auditoría de frescura
  const [showFrescuraForm, setShowFrescuraForm] = useState(false)
  const [savingFrescura, setSavingFrescura] = useState(false)
  const [frescuraForm, setFrescuraForm] = useState({
    batch_id: "", calidad_actual: "A", firmeza: "firme", color: "optimo", aspecto_general: "aceptable", notas: ""
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, recs, auds, mds, scs] = await Promise.allSettled([
        api.supermer.produce.dashboard(),
        api.supermer.produce.receiveBatches.list(),
        api.supermer.produce.freshness.list(),
        api.supermer.markdowns.list(),
        api.supermer.produce.scorecards.list(),
      ])
      if (dash.status === "fulfilled") setDashboard(dash.value)
      if (recs.status === "fulfilled" && Array.isArray(recs.value)) setRecepciones(recs.value)
      if (auds.status === "fulfilled" && Array.isArray(auds.value)) setAuditorias(auds.value)
      if (mds.status === "fulfilled" && Array.isArray(mds.value)) setMarkdowns(mds.value.filter((m: any) => m.activo))
      if (scs.status === "fulfilled" && Array.isArray(scs.value)) setScorecards(scs.value)
    } catch (e: any) {
      toast.error("Error al cargar verdulería", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAutoMarkdown = async () => {
    try {
      await api.supermer.produce.markdownByBatch({})
      toast.success("Markdowns aplicados", "Se generaron descuentos automáticos por proximidad de vencimiento.")
      loadData()
    } catch (e: any) {
      toast.error("Error al aplicar markdowns", e.message)
    }
  }

  const handleGenerateScorecard = async () => {
    try {
      await api.supermer.produce.scorecards.generate()
      toast.success("Scorecards actualizados", "Se calcularon los scorecards de proveedores de verdulería.")
      loadData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleSaveRecep = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingRecep(true)
    try {
      await api.supermer.produce.receiveBatches.create({
        ...recepForm,
        cantidad_recibida: parseFloat(recepForm.cantidad_recibida),
        cantidad_aceptada: parseFloat(recepForm.cantidad_aceptada || recepForm.cantidad_recibida),
        precio_unitario: parseFloat(recepForm.precio_unitario),
        fecha_recepcion: new Date().toISOString().split("T")[0],
      })
      toast.success("Recepción registrada", "Lote de mercadería ingresado correctamente.")
      setShowRecepForm(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al registrar", err.message)
    } finally {
      setSavingRecep(false)
    }
  }

  const handleSaveFrescura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!frescuraForm.batch_id) { toast.error("Seleccioná un lote", ""); return }
    setSavingFrescura(true)
    try {
      await api.supermer.produce.freshness.create({
        ...frescuraForm,
        audited_at: new Date().toISOString(),
      })
      toast.success("Auditoría registrada", "Control de frescura guardado correctamente.")
      setShowFrescuraForm(false)
      loadData()
    } catch (err: any) {
      toast.error("Error", err.message)
    } finally {
      setSavingFrescura(false)
    }
  }

  const dash = dashboard || {}
  const alertas = recepciones.filter((r: any) => r.calidad === "C" || r.calidad === "D")

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">Verdulería & Frescos</h1>
            {alertas.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 uppercase animate-pulse">
                {alertas.length} calidad baja
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Gestión integral de productos perecederos: recepción por lote con control de calidad, auditorías de frescura en góndola, markdowns dinámicos automáticos por proximidad de vencimiento y scorecard de proveedores de hortifruti.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleAutoMarkdown} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-amber-700 border-amber-300">
            <Tag className="w-3.5 h-3.5" /><span>Markdown Automático</span>
          </button>
          <button onClick={() => setShowFrescuraForm(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /><span>Auditar Frescura</span>
          </button>
          <button onClick={() => setShowRecepForm(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /><span>Registrar Recepción</span>
          </button>
        </div>
      </div>

      {/* BANNER */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3 text-xs">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-900 dark:text-emerald-300 mb-0.5">Control de Perecederos & Reducción de Merma en Verdulería</p>
          <p className="text-emerald-800 dark:text-emerald-400 leading-relaxed">
            Cada lote de mercadería que ingresa queda registrado con su calidad (A/B/C/D), proveedor y vencimiento. El sistema audita la frescura en góndola y aplica markdowns automáticos cuando la calidad baja, permitiendo recuperar valor antes de que el producto se convierta en merma.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Recepciones Hoy", val: dash.recepciones_hoy ?? recepciones.filter((r: any) => r.fecha_recepcion === new Date().toISOString().split("T")[0]).length, color: "text-blue-600" },
          { label: "Kg Recibidos Hoy", val: `${(dash.kg_recibidos_hoy ?? 0).toFixed(0)} kg`, color: "text-emerald-600" },
          { label: "Auditorías Hoy", val: dash.auditorias_hoy ?? 0, color: "text-purple-600" },
          { label: "Con Alerta Frescura", val: dash.alertas_frescura ?? alertas.length, color: "text-amber-600" },
          { label: "Markdowns Activos", val: markdowns.length, color: "text-red-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight mb-1">{kpi.label}</p>
            <p className={`text-lg font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "recepciones", label: `Recepciones (${recepciones.length})` },
            { id: "frescura", label: `Auditorías de Frescura (${auditorias.length})` },
            { id: "markdown", label: `Markdowns Activos (${markdowns.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-emerald-600 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB DASHBOARD */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Scorecards de Proveedores</h3>
            <div className="flex justify-end mb-3">
              <button onClick={handleGenerateScorecard} className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />Recalcular
              </button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" />Cargando...</div>
            ) : scorecards.length > 0 ? (
              <div className="space-y-2">
                {scorecards.map((sc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{sc.proveedor_nombre || sc.proveedor_id}</p>
                      <p className="text-gray-400">Lotes: {sc.total_lotes} · Rechazos: {sc.rechazos}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-black font-mono text-base ${sc.score >= 90 ? "text-emerald-600" : sc.score >= 70 ? "text-amber-600" : "text-red-600"}`}>{sc.score?.toFixed(0)}%</p>
                      <p className="text-[10px] text-gray-400">{sc.calidad_promedio}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-xs">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin datos de proveedores aún.</p>
                <p className="mt-1">Registrá recepciones para generar scorecards.</p>
              </div>
            )}
          </div>
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4">Markdowns Activos por Vencimiento</h3>
            {markdowns.length > 0 ? (
              <div className="space-y-2">
                {markdowns.slice(0, 6).map((md: any) => (
                  <div key={md.id} className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 text-xs">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{md.producto_nombre || md.producto_id}</p>
                      <p className="text-gray-500">Motivo: {md.motivo}</p>
                    </div>
                    <span className="font-black text-amber-700 dark:text-amber-400 font-mono">{md.descuento_pct}% OFF</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-emerald-600 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="font-bold">Sin markdowns activos.</p>
                <p className="text-gray-400 mt-1">Todos los productos están en calidad óptima.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB RECEPCIONES */}
      {tab === "recepciones" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs text-gray-400"><Loader2 className="w-5 h-5 animate-spin" />Cargando recepciones...</div>
          ) : recepciones.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin recepciones registradas</p>
              <p className="mt-1 max-w-xs mx-auto">Registrá cada lote de mercadería que ingresa con su calidad, proveedor y cantidad para habilitar la trazabilidad completa.</p>
              <button onClick={() => setShowRecepForm(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Registrar Primera Recepción
              </button>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Producto / Lote</th>
                  <th className="p-3.5 text-right">Recibido</th>
                  <th className="p-3.5 text-right">Aceptado</th>
                  <th className="p-3.5 text-center">Calidad</th>
                  <th className="p-3.5 text-right">Precio</th>
                  <th className="p-3.5 text-left">Vencimiento Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {recepciones.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <p className="font-extrabold text-gray-900 dark:text-white">{r.producto_nombre || r.producto_id}</p>
                      <p className="text-[10px] text-gray-400">Lote: {r.lote_codigo_interno || r.lote_proveedor || "—"}</p>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold">{r.cantidad_recibida} kg</td>
                    <td className="p-3.5 text-right font-mono text-gray-600">{r.cantidad_aceptada} kg</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.calidad === "A" ? "text-emerald-600 bg-emerald-50" : r.calidad === "B" ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"}`}>
                        {r.calidad}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono">{formatPYG(r.precio_unitario)}</td>
                    <td className="p-3.5 text-gray-500">{r.fecha_vencimiento_estimada || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB FRESCURA */}
      {tab === "frescura" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {auditorias.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin auditorías de frescura registradas</p>
              <p className="mt-1 max-w-xs mx-auto">Auditá la frescura de cada lote en góndola para detectar degradación temprana y aplicar descuentos antes de que sea merma.</p>
              <button onClick={() => setShowFrescuraForm(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Iniciar Auditoría
              </button>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Lote</th>
                  <th className="p-3.5 text-center">Calidad</th>
                  <th className="p-3.5 text-center">Firmeza</th>
                  <th className="p-3.5 text-center">Color</th>
                  <th className="p-3.5 text-center">Markdown</th>
                  <th className="p-3.5 text-left">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {auditorias.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200">{a.batch_id?.slice(0, 8)}...</td>
                    <td className="p-3.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${a.calidad_actual === "A" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>{a.calidad_actual}</span></td>
                    <td className="p-3.5 text-center text-gray-500 capitalize">{a.firmeza}</td>
                    <td className="p-3.5 text-center text-gray-500 capitalize">{a.color}</td>
                    <td className="p-3.5 text-center">{a.triggered_markdown ? <span className="text-amber-600 font-bold text-[10px]">✓ Aplicado</span> : <span className="text-gray-400 text-[10px]">—</span>}</td>
                    <td className="p-3.5 text-gray-400">{a.notas || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB MARKDOWN */}
      {tab === "markdown" && (
        <div className="space-y-3">
          {markdowns.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-600">Sin markdowns activos</p>
              <p className="mt-1">Usá "Markdown Automático" para aplicar descuentos según fechas de vencimiento.</p>
            </div>
          ) : markdowns.map((md: any) => (
            <div key={md.id} className="card p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-center justify-between gap-4 text-xs">
              <div>
                <p className="font-extrabold text-amber-800 dark:text-amber-300">{md.producto_nombre || md.producto_id}</p>
                <p className="text-amber-600">Motivo: {md.motivo} · Lote: {md.lote_id || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-amber-700 dark:text-amber-400 font-mono">{md.descuento_pct}%</p>
                <p className="text-[10px] text-amber-600">descuento aplicado</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVA RECEPCIÓN */}
      {showRecepForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Registrar Recepción de Mercadería</h2>
            <form onSubmit={handleSaveRecep} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label-sm">ID Producto *</label><input required className="input text-xs" value={recepForm.producto_id} onChange={e => setRecepForm(f => ({ ...f, producto_id: e.target.value }))} placeholder="UUID del producto" /></div>
                <div className="col-span-2"><label className="label-sm">ID Proveedor</label><input className="input text-xs" value={recepForm.proveedor_id} onChange={e => setRecepForm(f => ({ ...f, proveedor_id: e.target.value }))} placeholder="UUID del proveedor" /></div>
                <div><label className="label-sm">Kg Recibidos *</label><input required type="number" step="0.1" className="input text-xs" value={recepForm.cantidad_recibida} onChange={e => setRecepForm(f => ({ ...f, cantidad_recibida: e.target.value }))} /></div>
                <div><label className="label-sm">Kg Aceptados</label><input type="number" step="0.1" className="input text-xs" value={recepForm.cantidad_aceptada} onChange={e => setRecepForm(f => ({ ...f, cantidad_aceptada: e.target.value }))} /></div>
                <div><label className="label-sm">Calidad</label>
                  <select className="input text-xs" value={recepForm.calidad} onChange={e => setRecepForm(f => ({ ...f, calidad: e.target.value }))}>
                    <option value="A">A — Excelente</option><option value="B">B — Buena</option><option value="C">C — Regular</option><option value="D">D — Deficiente</option>
                  </select>
                </div>
                <div><label className="label-sm">Precio/kg (Gs.)</label><input type="number" className="input text-xs" value={recepForm.precio_unitario} onChange={e => setRecepForm(f => ({ ...f, precio_unitario: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label-sm">Vencimiento Estimado</label><input type="date" className="input text-xs" value={recepForm.fecha_vencimiento_estimada} onChange={e => setRecepForm(f => ({ ...f, fecha_vencimiento_estimada: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label-sm">Nota de Calidad</label><textarea className="input text-xs h-14" value={recepForm.nota_calidad} onChange={e => setRecepForm(f => ({ ...f, nota_calidad: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRecepForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingRecep} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingRecep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDITORÍA FRESCURA */}
      {showFrescuraForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Auditoría de Frescura en Góndola</h2>
            <form onSubmit={handleSaveFrescura} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Lote a Auditar *</label>
                <select className="input text-xs" value={frescuraForm.batch_id} onChange={e => setFrescuraForm(f => ({ ...f, batch_id: e.target.value }))}>
                  <option value="">Seleccioná un lote...</option>
                  {recepciones.map((r: any) => <option key={r.id} value={r.id}>{r.producto_nombre || r.producto_id} — {r.lote_codigo_interno || r.id.slice(0, 8)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-sm">Calidad Actual</label>
                  <select className="input text-xs" value={frescuraForm.calidad_actual} onChange={e => setFrescuraForm(f => ({ ...f, calidad_actual: e.target.value }))}>
                    <option value="A">A — Óptima</option><option value="B">B — Buena</option><option value="C">C — Degradada</option>
                  </select>
                </div>
                <div><label className="label-sm">Firmeza</label>
                  <select className="input text-xs" value={frescuraForm.firmeza} onChange={e => setFrescuraForm(f => ({ ...f, firmeza: e.target.value }))}>
                    <option value="firme">Firme</option><option value="suave">Suave</option><option value="blando">Blando</option>
                  </select>
                </div>
                <div><label className="label-sm">Color</label>
                  <select className="input text-xs" value={frescuraForm.color} onChange={e => setFrescuraForm(f => ({ ...f, color: e.target.value }))}>
                    <option value="optimo">Óptimo</option><option value="leve_cambio">Leve cambio</option><option value="alterado">Alterado</option>
                  </select>
                </div>
                <div><label className="label-sm">Aspecto General</label>
                  <select className="input text-xs" value={frescuraForm.aspecto_general} onChange={e => setFrescuraForm(f => ({ ...f, aspecto_general: e.target.value }))}>
                    <option value="aceptable">Aceptable</option><option value="deteriorado">Deteriorado</option><option value="descarte">Descarte</option>
                  </select>
                </div>
              </div>
              <div><label className="label-sm">Notas del Inspector</label><textarea className="input text-xs h-14" value={frescuraForm.notas} onChange={e => setFrescuraForm(f => ({ ...f, notas: e.target.value }))} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowFrescuraForm(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingFrescura} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingFrescura ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}Guardar Auditoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
