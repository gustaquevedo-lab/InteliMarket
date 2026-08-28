import React, { useState, useEffect, useCallback } from "react"
import {
  Carrot, Sparkles, AlertTriangle, TrendingDown, Plus, Search,
  Loader2, CheckCircle2, DollarSign, Calendar, RefreshCw, Tag, Info, Package,
  Layers, ChevronRight, ShieldCheck, Scale, BarChart3
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
  }, [toast])

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
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Carrot className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    OPERACIONES DE SALÓN · HORTIFRUTI & CONTROL DE CALIDAD
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {recepciones.length} Lotes Recibidos
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Verdulería & Frutas Frescas
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Control de maduración, recepción con clasificación A/B/C/D, auditorías de góndola y liquidación inteligente por vencimiento
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                🌿 {auditorias.length} auditorías de frescura
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                🏷️ {markdowns.length} markdowns automáticos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleAutoMarkdown}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Tag className="w-3.5 h-3.5" />
              Markdown Auto
            </button>

            <button
              onClick={() => setShowFrescuraForm(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              Auditar Frescura
            </button>

            <button
              onClick={() => setShowRecepForm(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 transition shadow-lg shadow-emerald-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Recepción
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recepciones Hoy</span>
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {dash.recepciones_hoy ?? recepciones.filter((r: any) => r.fecha_recepcion === new Date().toISOString().split("T")[0]).length}
            </p>
            <p className="text-[11px] text-slate-400">Lotes de proveedores</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kg Recibidos Hoy</span>
              <Scale className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {(dash.kg_recibidos_hoy ?? 0).toFixed(0)} <span className="text-xs font-semibold text-slate-400">kg</span>
            </p>
            <p className="text-[11px] text-slate-400">Volumen verificado</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Auditorías Hoy</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {dash.auditorias_hoy ?? auditorias.length}
            </p>
            <p className="text-[11px] text-slate-400">Inspecciones de lote</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alerta Frescura</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {dash.alertas_frescura ?? alertas.length}
            </p>
            <p className="text-[11px] text-slate-400">Calidad C o D</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Markdowns</span>
              <Tag className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {markdowns.length}
            </p>
            <p className="text-[11px] text-slate-400">Ofertas en góndola</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Dashboard & Scorecards", icon: BarChart3 },
          { id: "recepciones", label: `Recepciones`, count: recepciones.length, icon: Package },
          { id: "frescura", label: `Auditorías de Frescura`, count: auditorias.length, icon: Sparkles },
          { id: "markdown", label: `Markdowns Activos`, count: markdowns.length, icon: Tag },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: DASHBOARD & SCORECARDS ══════════════════════ */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Scorecards de Proveedores</h3>
              <button onClick={handleGenerateScorecard} className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Recalcular
              </button>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" />Cargando...</div>
            ) : scorecards.length > 0 ? (
              <div className="space-y-2">
                {scorecards.map((sc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{sc.proveedor_nombre || sc.proveedor_id}</p>
                      <p className="text-slate-400 text-[10px]">Lotes: {sc.total_lotes} · Rechazos: {sc.rechazos}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-black font-mono text-base ${sc.score >= 90 ? "text-emerald-500" : sc.score >= 70 ? "text-amber-500" : "text-rose-500"}`}>{sc.score?.toFixed(0)}%</p>
                      <p className="text-[10px] text-slate-400 font-bold">{sc.calidad_promedio}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin datos de proveedores aún.</p>
                <p className="mt-1">Registrá recepciones para generar scorecards.</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Markdowns Activos por Vencimiento</h3>
            {markdowns.length > 0 ? (
              <div className="space-y-2">
                {markdowns.slice(0, 6).map((md: any) => (
                  <div key={md.id} className="flex items-center justify-between p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{md.producto_nombre || md.producto_id}</p>
                      <p className="text-slate-400">Motivo: {md.motivo}</p>
                    </div>
                    <span className="font-black text-amber-600 dark:text-amber-400 font-mono text-sm">{md.descuento_pct}% OFF</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-emerald-600 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p className="font-bold">Sin markdowns activos.</p>
                <p className="text-slate-400 mt-1">Todos los productos están en calidad óptima.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: RECEPCIONES ══════════════════════ */}
      {tab === "recepciones" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs text-slate-400"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" />Cargando recepciones...</div>
          ) : recepciones.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin recepciones registradas</p>
              <p className="mt-1 max-w-xs mx-auto">Registrá cada lote de mercadería que ingresa con su calidad, proveedor y cantidad.</p>
              <button onClick={() => setShowRecepForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Registrar Primera Recepción
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Producto / Lote</th>
                    <th className="p-4 text-right">Recibido</th>
                    <th className="p-4 text-right">Aceptado</th>
                    <th className="p-4 text-center">Calidad</th>
                    <th className="p-4 text-right">Precio</th>
                    <th className="p-4 text-left">Vencimiento Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {recepciones.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <p className="font-extrabold text-slate-900 dark:text-white">{r.producto_nombre || r.producto_id}</p>
                        <p className="text-[10px] font-mono text-slate-400">Lote: {r.lote_codigo_interno || r.lote_proveedor || "—"}</p>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">{r.cantidad_recibida} kg</td>
                      <td className="p-4 text-right font-mono text-slate-500">{r.cantidad_aceptada} kg</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          r.calidad === "A" ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" :
                          r.calidad === "B" ? "text-blue-600 bg-blue-500/10 border border-blue-500/20" :
                          "text-rose-600 bg-rose-500/10 border border-rose-500/20"
                        }`}>
                          {r.calidad}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{formatPYG(r.precio_unitario)}</td>
                      <td className="p-4 text-slate-500 font-mono">{r.fecha_vencimiento_estimada || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: FRESCURA ══════════════════════ */}
      {tab === "frescura" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {auditorias.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin auditorías de frescura registradas</p>
              <p className="mt-1 max-w-xs mx-auto">Auditá la frescura de cada lote en góndola para detectar degradación temprana y aplicar descuentos.</p>
              <button onClick={() => setShowFrescuraForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Iniciar Auditoría
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Lote</th>
                    <th className="p-4 text-center">Calidad</th>
                    <th className="p-4 text-center">Firmeza</th>
                    <th className="p-4 text-center">Color</th>
                    <th className="p-4 text-center">Markdown</th>
                    <th className="p-4 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {auditorias.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-bold text-slate-900 dark:text-white font-mono">{a.batch_id?.slice(0, 8)}...</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${a.calidad_actual === "A" ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-amber-600 bg-amber-500/10 border border-amber-500/20"}`}>{a.calidad_actual}</span>
                      </td>
                      <td className="p-4 text-center text-slate-500 capitalize">{a.firmeza}</td>
                      <td className="p-4 text-center text-slate-500 capitalize">{a.color}</td>
                      <td className="p-4 text-center">{a.triggered_markdown ? <span className="text-amber-500 font-bold text-[10px] bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">✓ Aplicado</span> : <span className="text-slate-400 text-[10px]">—</span>}</td>
                      <td className="p-4 text-slate-400">{a.notas || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 4: MARKDOWN ══════════════════════ */}
      {tab === "markdown" && (
        <div className="space-y-3">
          {markdowns.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-500">Sin markdowns activos</p>
              <p className="mt-1">Usá "Markdown Automático" para aplicar descuentos según fechas de vencimiento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {markdowns.map((md: any) => (
                <div key={md.id} className="p-4 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-3xl flex items-center justify-between gap-4 text-xs shadow-sm">
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">{md.producto_nombre || md.producto_id}</p>
                    <p className="text-slate-400 text-[11px]">Motivo: {md.motivo} · Lote: {md.lote_id || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black font-mono text-amber-500">{md.descuento_pct}% OFF</p>
                    <p className="text-[10px] text-slate-400">en góndola</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL NUEVA RECEPCIÓN ── */}
      {showRecepForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Carrot className="w-5 h-5 text-emerald-600" /> Registrar Recepción de Mercadería
            </h2>
            <form onSubmit={handleSaveRecep} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">ID Producto *</label>
                  <input required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none" value={recepForm.producto_id} onChange={e => setRecepForm(f => ({ ...f, producto_id: e.target.value }))} placeholder="Código o ID del producto" />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">ID Proveedor</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={recepForm.proveedor_id} onChange={e => setRecepForm(f => ({ ...f, proveedor_id: e.target.value }))} placeholder="Código del productor / importador" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Kg Recibidos *</label>
                  <input required type="number" step="0.1" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={recepForm.cantidad_recibida} onChange={e => setRecepForm(f => ({ ...f, cantidad_recibida: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Kg Aceptados</label>
                  <input type="number" step="0.1" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={recepForm.cantidad_aceptada} onChange={e => setRecepForm(f => ({ ...f, cantidad_aceptada: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Calidad</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={recepForm.calidad} onChange={e => setRecepForm(f => ({ ...f, calidad: e.target.value }))}>
                    <option value="A">A — Excelente / Exportación</option>
                    <option value="B">B — Buena Comercial</option>
                    <option value="C">C — Regular (Requiere Rotación Rápida)</option>
                    <option value="D">D — Deficiente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Precio/kg (₲)</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={recepForm.precio_unitario} onChange={e => setRecepForm(f => ({ ...f, precio_unitario: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Vencimiento Estimado</label>
                  <input type="date" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={recepForm.fecha_vencimiento_estimada} onChange={e => setRecepForm(f => ({ ...f, fecha_vencimiento_estimada: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Nota de Calidad</label>
                  <textarea className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-14" value={recepForm.nota_calidad} onChange={e => setRecepForm(f => ({ ...f, nota_calidad: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowRecepForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingRecep} className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition">
                  {savingRecep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Guardar Recepción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL AUDITORÍA FRESCURA ── */}
      {showFrescuraForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-500" /> Auditoría de Frescura en Góndola
            </h2>
            <form onSubmit={handleSaveFrescura} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Lote a Auditar *</label>
                <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none" value={frescuraForm.batch_id} onChange={e => setFrescuraForm(f => ({ ...f, batch_id: e.target.value }))}>
                  <option value="">Seleccioná un lote...</option>
                  {recepciones.map((r: any) => <option key={r.id} value={r.id}>{r.producto_nombre || r.producto_id} — {r.lote_codigo_interno || r.id.slice(0, 8)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Calidad Actual</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={frescuraForm.calidad_actual} onChange={e => setFrescuraForm(f => ({ ...f, calidad_actual: e.target.value }))}>
                    <option value="A">A — Óptima</option>
                    <option value="B">B — Buena</option>
                    <option value="C">C — Degradada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Firmeza</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={frescuraForm.firmeza} onChange={e => setFrescuraForm(f => ({ ...f, firmeza: e.target.value }))}>
                    <option value="firme">Firme</option>
                    <option value="suave">Suave</option>
                    <option value="blando">Blando</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Color</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={frescuraForm.color} onChange={e => setFrescuraForm(f => ({ ...f, color: e.target.value }))}>
                    <option value="optimo">Óptimo</option>
                    <option value="leve_cambio">Leve cambio</option>
                    <option value="alterado">Alterado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Aspecto General</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={frescuraForm.aspecto_general} onChange={e => setFrescuraForm(f => ({ ...f, aspecto_general: e.target.value }))}>
                    <option value="aceptable">Aceptable</option>
                    <option value="deteriorado">Deteriorado</option>
                    <option value="descarte">Descarte</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Notas del Inspector</label>
                <textarea className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-14" value={frescuraForm.notas} onChange={e => setFrescuraForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowFrescuraForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingFrescura} className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition">
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
