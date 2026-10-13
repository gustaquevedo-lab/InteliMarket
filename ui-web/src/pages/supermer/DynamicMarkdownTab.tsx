import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Sparkles, BarChart3, Plus, Search, Loader2, Check, X, AlertTriangle, RefreshCw, Brain, TrendingDown, Clock, Tag } from "lucide-react"
import { formatPYG, formatDateTime } from "../../utils/format"

type SubTab = "dashboard" | "rules" | "recommendations"

const MOCK_RULES = [
  { id: "r1", producto_nombre: "Leche Entera 1L", categoria: "lacteos", estrategia: "agresiva", descuento_maximo_pct: 50, descuento_minimo_pct: 10, horas_limite: 48, activa: true },
  { id: "r2", producto_nombre: null, categoria: "panaderia", estrategia: "moderada", descuento_maximo_pct: 30, descuento_minimo_pct: 5, horas_limite: 24, activa: true },
  { id: "r3", producto_nombre: "Carne Vacuna kg", categoria: "carnes", estrategia: "conservadora", descuento_maximo_pct: 20, descuento_minimo_pct: 5, activa: true },
]

const MOCK_RECOMMENDATIONS = [
  { id: "rec1", producto_nombre: "Leche Entera 1L", precio_original: 6500, descuento_recomendado_pct: 35, precio_recomendado: 4225, motivo: "proximo_vencer", score_urgencia: 92, aplicada: false, created_at: new Date().toISOString() },
  { id: "rec2", producto_nombre: "Yogurt Natural 200g", precio_original: 4500, descuento_recomendado_pct: 25, precio_recomendado: 3375, motivo: "excedente", score_urgencia: 78, aplicada: false, created_at: new Date().toISOString() },
  { id: "rec3", producto_nombre: "Pan Artesanal kg", precio_original: 19000, descuento_recomendado_pct: 40, precio_recomendado: 11400, motivo: "fin_dia", score_urgencia: 85, aplicada: true, aplicada_at: new Date().toISOString() },
]

export default function DynamicMarkdownTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<any[]>(MOCK_RULES)
  const [recommendations, setRecommendations] = useState<any[]>(MOCK_RECOMMENDATIONS)
  const [dashData, setDashData] = useState<any>({})
  const [selectedRecs, setSelectedRecs] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "rules") p.push(api.dynamicMarkdown.rules.list().then(setRules))
      if (subTab === "recommendations") p.push(api.dynamicMarkdown.recommendations.list().then(setRecommendations))
      if (subTab === "dashboard") p.push(api.dynamicMarkdown.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await api.dynamicMarkdown.generate()
      setRecommendations(prev => [...res, ...prev])
      toast.success(`${res.length} recomendaciones generadas`)
    } catch (e: any) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const handleApply = async () => {
    if (selectedRecs.size === 0) { toast.warning("Seleccioná al menos una recomendación"); return }
    setApplying(true)
    try {
      const res = await api.dynamicMarkdown.apply({ recommendation_ids: Array.from(selectedRecs) })
      setRecommendations(prev => prev.map(r => selectedRecs.has(r.id) ? { ...r, aplicada: true, aplicada_at: new Date().toISOString() } : r))
      setSelectedRecs(new Set())
      toast.success(`${res.length} descuentos aplicados`)
    } catch (e: any) { toast.error(e.message) } finally { setApplying(false) }
  }

  const toggleRec = (id: string) => {
    setSelectedRecs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "rules", l: "Reglas", i: Brain },
    { k: "recommendations", l: "Recomendaciones", i: Sparkles },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {subTabs.map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              subTab === t.k ? "bg-white dark:bg-slate-700 shadow-lg text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}><t.i className="w-4 h-4" />{t.l}</button>
        ))}
      </div>

      {subTab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Reglas Activas", value: dashData.reglas_activas || 0, icon: Brain },
            { label: "Recom. Hoy", value: dashData.recomendaciones_hoy || 0, icon: Sparkles },
            { label: "Aplicadas Hoy", value: dashData.aplicadas_hoy || 0, icon: Check },
            { label: "Urgencia Alta", value: dashData.urgencia_alta || 0, icon: AlertTriangle },
          ].map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm text-gray-500">{s.label}</p><s.icon className="w-5 h-5 text-gray-400" /></div>
              <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-gray-800 mt-2">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {subTab === "rules" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold">Reglas de Markdown Dinámico</h3>
            <button onClick={() => setShowRuleModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nueva Regla</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules.map(r => (
              <div key={r.id} className="p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{r.producto_nombre || `Categoría: ${r.categoria}`}</p>
                    <div className="flex gap-1 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.estrategia === "agresiva" ? "bg-red-100 text-red-700" :
                        r.estrategia === "moderada" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      }`}>{r.estrategia}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${r.activa ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>{r.activa ? "Activa" : "Inactiva"}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
                  <p>Máx desc: <strong className="text-gray-800">{r.descuento_maximo_pct}%</strong></p>
                  <p>Mín desc: <strong className="text-gray-800">{r.descuento_minimo_pct || 0}%</strong></p>
                  {r.horas_limite && <p>Límite: <strong className="text-gray-800">{r.horas_limite}h</strong></p>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">🧠 Las reglas definen el comportamiento del motor de markdown. Estrategia agresiva = máximo descuento permitido para liquidar rápido.</p>
        </div>
      )}

      {subTab === "recommendations" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recomendaciones de Markdown</h3>
            <div className="flex gap-2">
              <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} /> Generar</button>
              <button onClick={handleApply} disabled={applying || selectedRecs.size === 0} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"><Tag className="w-4 h-4" /> Aplicar ({selectedRecs.size})</button>
            </div>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div> : (
            <div className="space-y-3">
              {recommendations.map(r => (
                <div key={r.id} className={`p-4 rounded-xl border cursor-pointer transition-all ${r.aplicada ? "border-gray-200/50 opacity-60" : selectedRecs.has(r.id) ? "border-emerald-500 bg-emerald-50/50" : "border-gray-200/50 hover:border-emerald-300"}`} onClick={() => !r.aplicada && toggleRec(r.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {!r.aplicada && <input type="checkbox" checked={selectedRecs.has(r.id)} onChange={() => toggleRec(r.id)} className="rounded accent-emerald-600" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{r.producto_nombre}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.motivo === "proximo_vencer" ? "bg-red-100 text-red-700" :
                            r.motivo === "excedente" ? "bg-amber-100 text-amber-700" :
                            r.motivo === "fin_dia" ? "bg-purple-100 text-purple-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>{r.motivo}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{formatPYG(r.precio_original)} → <strong className="text-red-600">{formatPYG(r.precio_recomendado)}</strong> (-{r.descuento_recomendado_pct}%)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-lg text-xs font-bold ${r.score_urgencia >= 80 ? "bg-red-100 text-red-700" : r.score_urgencia >= 60 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        Urgencia: {r.score_urgencia}/100
                      </div>
                      {r.aplicada && <p className="text-xs text-green-600 mt-1">✓ Aplicada {r.aplicada_at ? formatDateTime(r.aplicada_at) : ""}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-700/30 rounded-2xl p-4 mt-4">
            <p className="text-xs flex items-center gap-2"><Brain className="w-4 h-4 text-blue-600" /> <strong>Cómo funciona el motor de markdown dinámico</strong></p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 mt-2 space-y-1">
              <li>⏰ <strong>Horario:</strong> después de las 18:00 el descuento recomendado aumenta (urgencia por cierre)</li>
              <li>📦 <strong>Stock:</strong> productos con mucho stock reciben descuentos más agresivos</li>
              <li>📅 <strong>Vencimiento:</strong> a menos días, mayor descuento (critical si &lt;3 días)</li>
              <li>📊 <strong>Elasticidad:</strong> lácteos (elástico) = más descuento necesario; limpieza (inelástico) = menos</li>
              <li>🎯 <strong>Score de urgencia 1-100:</strong> ≥80 es crítico, priorizá aplicar esos primero</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
