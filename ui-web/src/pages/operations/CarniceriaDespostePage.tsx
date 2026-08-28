import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Scale, Beef, TrendingUp, AlertTriangle, Plus, Loader2,
  DollarSign, CheckCircle2, RefreshCw, Info, Package, ChevronRight, ClipboardList,
  Sparkles, Layers, ArrowRight
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "wizard" | "templates" | "ordenes" | "rendimientos"

const ESPECIES = ["Vacuno Novillo", "Vacuno Vaquilla", "Porcino", "Ovino", "Pollos (Unidad)"]

export default function CarniceriaDespostePage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("wizard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [templates, setTemplates] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [yieldReport, setYieldReport] = useState<any[]>([])

  // Wizard desposte
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [pesoEntradaKg, setPesoEntradaKg] = useState<number>(250)
  const [costoTotalGs, setCostoTotalGs] = useState<number>(0)
  const [fechaVencimiento, setFechaVencimiento] = useState<string>("")
  const [notas, setNotas] = useState<string>("")
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  // Formulario nuevo template
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({ nombre: "", especie: "Vacuno Novillo", peso_promedio_kg: "", descripcion: "" })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tmpl, ords, yield_] = await Promise.allSettled([
        api.supermer.butchery.templates.list(),
        api.supermer.butchery.orders(),
        api.supermer.butchery.yieldReport(),
      ])
      if (tmpl.status === "fulfilled" && Array.isArray(tmpl.value)) setTemplates(tmpl.value)
      if (ords.status === "fulfilled" && Array.isArray(ords.value)) setOrders(ords.value)
      if (yield_.status === "fulfilled" && Array.isArray(yield_.value)) setYieldReport(yield_.value)
    } catch (e: any) {
      toast.error("Error al cargar datos de carnicería", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const costoKg = costoTotalGs && pesoEntradaKg ? costoTotalGs / pesoEntradaKg : 0

  const cortesMapa = useMemo(() => {
    if (!selectedTemplate?.cuts) return []
    return selectedTemplate.cuts.map((c: any) => ({
      ...c,
      kg_estimado: (pesoEntradaKg * (c.rendimiento_porcentual || 0)) / 100,
      costo_asignado: costoKg * (c.rendimiento_porcentual || 0) / 100 * pesoEntradaKg,
    }))
  }, [selectedTemplate, pesoEntradaKg, costoKg])

  const pesoTotalCortes = cortesMapa.reduce((acc: number, c: any) => acc + c.kg_estimado, 0)
  const rendimientoTotal = pesoEntradaKg > 0 ? (pesoTotalCortes / pesoEntradaKg) * 100 : 0

  const handleEjecutarDesposte = async () => {
    if (!selectedTemplate) { toast.error("Seleccioná un template", ""); return }
    if (!pesoEntradaKg || pesoEntradaKg <= 0) { toast.error("Peso de entrada inválido", ""); return }
    if (!costoTotalGs || costoTotalGs <= 0) { toast.error("Ingresá el costo total", ""); return }
    setEjecutando(true)
    try {
      const res = await api.supermer.butchery.desposte({
        template_id: selectedTemplate.id,
        peso_entrada_kg: pesoEntradaKg,
        costo_total_gs: costoTotalGs,
        fecha_vencimiento: fechaVencimiento || undefined,
        notas,
      })
      setResultado(res)
      toast.success("✅ Desposte Ejecutado", `Se generaron ${res.cortes?.length || 0} cortes registrados en stock.`)
      loadData()
    } catch (err: any) {
      toast.error("Error al ejecutar desposte", err.message)
    } finally {
      setEjecutando(false)
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTemplate(true)
    try {
      await api.supermer.butchery.templates.create({ ...templateForm, peso_promedio_kg: parseFloat(templateForm.peso_promedio_kg || "0"), activa: true, cuts: [] })
      toast.success("Template creado", `Abrí el template "${templateForm.nombre}" para agregar los cortes con sus rendimientos.`)
      setShowTemplateForm(false)
      setTemplateForm({ nombre: "", especie: "Vacuno Novillo", peso_promedio_kg: "", descripcion: "" })
      loadData()
    } catch (err: any) {
      toast.error("Error al crear template", err.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950/90 text-white p-7 border border-red-500/20 shadow-2xl shadow-red-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 border border-red-400/30 text-white flex items-center justify-center shadow-lg shadow-red-500/25">
                  <Scale className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-red-400 uppercase bg-red-500/10 px-2.5 py-0.5 rounded-md border border-red-500/20">
                    OPERACIONES DE SALÓN · CÁMARA FRIGORÍFICA & CORTES
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    {orders.length} Despostes Ejecutados
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Carnicería & Desposte por Rendimiento
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Despiece por media res, costeo por corte, trazabilidad de tropa SENACSA y stock automático en balanza
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-red-300">
                🥩 {templates.length} plantillas de cortes
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ⚖️ {orders.reduce((acc: number, o: any) => acc + (o.cantidad_objetivo || 0), 0).toFixed(0)} kg procesados
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-red-400" : ""}`} />
              Recargar
            </button>

            <button
              onClick={() => setShowTemplateForm(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 transition shadow-lg shadow-red-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Template
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Templates de Corte</span>
              <Beef className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-red-300">
              {templates.length}
            </p>
            <p className="text-[11px] text-slate-400">Especies configuradas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Despostes Totales</span>
              <Scale className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {orders.length}
            </p>
            <p className="text-[11px] text-slate-400">Órdenes ejecutadas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kg Procesados</span>
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {orders.reduce((acc: number, o: any) => acc + (o.cantidad_objetivo || 0), 0).toFixed(0)} <span className="text-xs text-slate-400 font-semibold">kg</span>
            </p>
            <p className="text-[11px] text-slate-400">Histórico de medias reses</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rendimiento Promedio</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {yieldReport.length > 0 ? `${(yieldReport.reduce((a: number, r: any) => a + (r.rendimiento_pct || 0), 0) / yieldReport.length).toFixed(1)}%` : "—"}
            </p>
            <p className="text-[11px] text-slate-400">Eficiencia en despiece</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "wizard", label: "Wizard de Desposte", icon: Beef },
          { id: "templates", label: `Plantillas de Corte`, count: templates.length, icon: Layers },
          { id: "ordenes", label: `Historial de Órdenes`, count: orders.length, icon: ClipboardList },
          { id: "rendimientos", label: "Rendimiento por Corte", icon: TrendingUp },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: WIZARD DE DESPOSTE ══════════════════════ */}
      {tab === "wizard" && !resultado && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel Izquierdo: Configuración */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">1. Seleccionar Template de Corte</h3>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin text-red-500" />Cargando templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Sin templates configurados.</p>
                  <button onClick={() => setShowTemplateForm(true)} className="px-4 py-2 mt-3 rounded-2xl bg-red-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />Crear Primer Template
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t: any) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t)}
                      className={`w-full p-3.5 rounded-2xl text-xs text-left transition-all border ${
                        selectedTemplate?.id === t.id
                          ? "border-red-500 bg-red-50/50 dark:bg-red-950/30"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-extrabold text-slate-900 dark:text-white">{t.nombre}</p>
                          <p className="text-slate-400 text-[10px]">{t.especie} · Peso promedio: {t.peso_promedio_kg || "—"} kg · {t.cuts?.length || 0} cortes</p>
                        </div>
                        {selectedTemplate?.id === t.id && <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">2. Datos de Entrada (Media Res / Tropa)</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Peso de Entrada (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white text-xs outline-none"
                    value={pesoEntradaKg}
                    onChange={e => setPesoEntradaKg(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Costo Total Compra (₲) *</label>
                  <input
                    type="number"
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-black text-red-600 dark:text-red-400 text-sm outline-none"
                    value={costoTotalGs}
                    onChange={e => setCostoTotalGs(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 5625000"
                  />
                  {costoTotalGs > 0 && pesoEntradaKg > 0 && <p className="mt-1 text-slate-400 font-mono font-bold">= {formatPYG(costoKg)}/kg entrada</p>}
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Fecha de Vencimiento Estimada</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none"
                    value={fechaVencimiento}
                    onChange={e => setFechaVencimiento(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Notas / Número de Tropa SENACSA</label>
                  <input
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs outline-none"
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    placeholder="Ej: TRP-8492 / Frigorífico Concepción"
                  />
                </div>
                <button
                  onClick={handleEjecutarDesposte}
                  disabled={ejecutando || !selectedTemplate || !costoTotalGs}
                  className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md shadow-red-500/20 transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {ejecutando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Beef className="w-4 h-4" />}
                  {ejecutando ? "Ejecutando desposte..." : "Ejecutar Desposte en Stock"}
                </button>
              </div>
            </div>
          </div>

          {/* Panel Derecho: Preview de Cortes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">3. Simulación & Cortes Obtenidos</h3>
            {!selectedTemplate ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                <Beef className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Seleccioná un template para ver la simulación de cortes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cortesMapa.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    <p>El template no tiene cortes configurados aún.</p>
                    <p className="mt-1 text-amber-500 font-bold">Editá el template para agregar los cortes con su rendimiento %.</p>
                  </div>
                ) : (
                  <>
                    {cortesMapa.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{c.producto_nombre || "Corte " + (i + 1)}</p>
                          <p className="text-slate-400 font-mono">{c.rendimiento_porcentual}% rendimiento</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black font-mono text-slate-900 dark:text-white">{c.kg_estimado.toFixed(2)} kg</p>
                          {c.costo_asignado > 0 && <p className="text-[10px] text-slate-400 font-mono">{formatPYG(c.costo_asignado)}</p>}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl mt-3 shadow-sm">
                      <span className="font-extrabold text-xs uppercase">Total Cortes Generados</span>
                      <div className="text-right">
                        <span className="font-black font-mono text-sm">{pesoTotalCortes.toFixed(2)} kg</span>
                        <span className="ml-2 text-red-200 text-[10px]">({rendimientoTotal.toFixed(1)}% rend.)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESULTADO DEL DESPOSTE */}
      {tab === "wizard" && resultado && (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div>
              <h3 className="font-extrabold text-base text-emerald-600 dark:text-emerald-300 uppercase">Desposte Ejecutado Exitosamente</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">Los cortes fueron registrados en el inventario de carnicería con sus respectivos lotes.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-500/20">
              <p className="font-bold text-slate-400 uppercase text-[10px]">Orden ID</p>
              <p className="font-mono text-slate-900 dark:text-white font-black mt-1">{resultado.order_id?.slice(0, 8) || "—"}...</p>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-500/20">
              <p className="font-bold text-slate-400 uppercase text-[10px]">Peso Entrada</p>
              <p className="font-mono text-slate-900 dark:text-white font-black mt-1">{resultado.peso_entrada_kg || pesoEntradaKg} kg</p>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-500/20">
              <p className="font-bold text-slate-400 uppercase text-[10px]">Lotes Generados</p>
              <p className="font-mono text-emerald-600 dark:text-emerald-400 font-black mt-1">{resultado.cortes?.length || resultado.lotes_generados || "—"}</p>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-500/20">
              <p className="font-bold text-slate-400 uppercase text-[10px]">Rendimiento Real</p>
              <p className="font-mono text-emerald-600 dark:text-emerald-400 font-black mt-1">{resultado.rendimiento_real ? `${parseFloat(resultado.rendimiento_real).toFixed(1)}%` : "—"}</p>
            </div>
          </div>
          <button onClick={() => setResultado(null)} className="px-5 py-2.5 rounded-2xl bg-red-600 text-white font-extrabold text-xs shadow-md shadow-red-500/20 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo Desposte
          </button>
        </div>
      )}

      {/* ══════════════════════ TAB 2: TEMPLATES ══════════════════════ */}
      {tab === "templates" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {templates.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin templates configurados</p>
              <p className="mt-1 max-w-xs mx-auto">Creá un template por especie (vacuno, porcino) con los porcentajes de rendimiento de cada corte (lomo, costilla, asado, etc.).</p>
              <button onClick={() => setShowTemplateForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-red-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Crear Primer Template
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {templates.map((t: any) => (
                <div key={t.id} className="p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white text-sm">{t.nombre}</p>
                      <p className="text-slate-400">{t.especie} · Peso promedio: {t.peso_promedio_kg || "—"} kg · {t.cuts?.length || 0} cortes</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${t.activa ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-slate-400 bg-slate-100"}`}>
                      {t.activa ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  {t.cuts?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.cuts.map((c: any, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-[10px] font-bold">
                          {c.producto_nombre || "Corte"} {c.rendimiento_porcentual}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: ORDENES ══════════════════════ */}
      {tab === "ordenes" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {orders.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin despostes registrados</p>
              <p className="mt-1">Ejecutá el primer desposte desde el Wizard para iniciar el historial.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Orden</th>
                    <th className="p-4 text-right">Kg Entrada</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-right">Rend. Real</th>
                    <th className="p-4 text-left">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <p className="font-extrabold text-slate-900 dark:text-white font-mono">{o.id?.slice(0, 8)}...</p>
                        <p className="text-[10px] text-slate-400">{o.notas || "—"}</p>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">{o.cantidad_objetivo?.toFixed(1)} kg</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${o.estado === "completada" ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-amber-600 bg-amber-500/10 border border-amber-500/20"}`}>
                          {o.estado}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-600 font-bold">{o.rendimiento_real ? `${parseFloat(o.rendimiento_real).toFixed(1)}%` : "—"}</td>
                      <td className="p-4 text-slate-500 font-mono text-[11px]">{o.fecha_fin ? formatDate(o.fecha_fin) : o.fecha_inicio ? formatDate(o.fecha_inicio) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 4: RENDIMIENTOS ══════════════════════ */}
      {tab === "rendimientos" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {yieldReport.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin datos de rendimiento</p>
              <p className="mt-1">El reporte de rendimiento por corte se genera automáticamente con los despostes completados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Corte / Producto</th>
                    <th className="p-4 text-right">Kg Producidos</th>
                    <th className="p-4 text-right">Rendimiento</th>
                    <th className="p-4 text-right">Costo / kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {yieldReport.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-extrabold text-slate-900 dark:text-white">{r.producto_nombre || r.producto_id || "—"}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">{parseFloat(r.kg_producidos || r.total_obtenido || 0).toFixed(2)} kg</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600">{r.rendimiento_pct ? `${parseFloat(r.rendimiento_pct).toFixed(1)}%` : "—"}</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-600 dark:text-slate-300">{r.costo_unitario ? formatPYG(r.costo_unitario) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL NUEVO TEMPLATE ── */}
      {showTemplateForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Scale className="w-5 h-5 text-red-600" /> Nuevo Template de Desposte
            </h2>
            <p className="text-[11px] text-slate-400">Creá el template con la especie y el rendimiento base. Luego agregá cada corte con su % de rendimiento.</p>
            <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nombre del Template *</label>
                <input
                  required
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none"
                  value={templateForm.nombre}
                  onChange={e => setTemplateForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Vacuno Novillo Estándar"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Especie</label>
                <select
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none"
                  value={templateForm.especie}
                  onChange={e => setTemplateForm(f => ({ ...f, especie: e.target.value }))}
                >
                  {ESPECIES.map(esp => <option key={esp}>{esp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Peso Promedio Entrada (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none"
                  value={templateForm.peso_promedio_kg}
                  onChange={e => setTemplateForm(f => ({ ...f, peso_promedio_kg: e.target.value }))}
                  placeholder="Ej: 250"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Descripción</label>
                <textarea
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-16"
                  value={templateForm.descripcion}
                  onChange={e => setTemplateForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowTemplateForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingTemplate} className="px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md shadow-red-500/20 flex items-center gap-1.5 transition">
                  {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Crear Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
