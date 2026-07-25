import { useState, useEffect } from "react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { DollarSign, BarChart3, Plus, Search, Loader2, Check, X, AlertTriangle, TrendingUp, Shield, Brain } from "lucide-react"
import { formatPYG, formatDate, formatDateTime } from "../../utils/format"

type SubTab = "dashboard" | "zones" | "competitors" | "audit" | "psychological"

const MOCK_ZONES = [
  { id: "z1", nombre: "Sucursal Centro", tipo: "sucursal", activa: true },
  { id: "z2", nombre: "Sucursal Shopping", tipo: "sucursal", activa: true },
  { id: "z3", nombre: "Canal Mayorista", tipo: "canal", activa: true },
  { id: "z4", nombre: "Zona Norte", tipo: "zona_geografica", activa: false },
]

const MOCK_COMPETITORS = [
  { id: "c1", producto_nombre: "Leche Entera 1L", competidor: "Superseis", precio: 6200, diferencia_pct: -4.6, fecha_captura: new Date().toISOString() },
  { id: "c2", producto_nombre: "Leche Entera 1L", competidor: "Stock", precio: 6500, diferencia_pct: 0, fecha_captura: new Date().toISOString() },
  { id: "c3", producto_nombre: "Pan Artesanal kg", competidor: "Superseis", precio: 18000, diferencia_pct: -5.3, fecha_captura: new Date(Date.now() - 86400000).toISOString() },
]

const MOCK_AUDITS = [
  { id: "a1", producto_nombre: "Leche Entera 1L", precio_anterior: 6500, precio_nuevo: 5800, diferencia_pct: -10.8, motivo: "Price match Superseis", estado: "pendiente", cambiado_at: new Date().toISOString() },
  { id: "a2", producto_nombre: "Arroz 1kg", precio_anterior: 4200, precio_nuevo: 4500, diferencia_pct: 7.1, motivo: "Ajuste por inflación", estado: "aplicado", cambiado_at: new Date(Date.now() - 86400000).toISOString() },
]

const MOCK_PSYCH = [
  { id: "p1", nombre: "Default .990", tipo_redondeo: ".990", limite_superior: 50000, activa: true },
  { id: "p2", nombre: "Premium .000", tipo_redondeo: ".000", limite_superior: 100000, activa: true },
]

export default function PricingTab() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<any[]>(MOCK_ZONES)
  const [competitors, setCompetitors] = useState<any[]>(MOCK_COMPETITORS)
  const [audits, setAudits] = useState<any[]>(MOCK_AUDITS)
  const [psychRules, setPsychRules] = useState<any[]>(MOCK_PSYCH)
  const [dashData, setDashData] = useState<any>({})
  const [search, setSearch] = useState("")
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [showCompetitorModal, setShowCompetitorModal] = useState(false)
  const [showPsychModal, setShowPsychModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { fetchAll() }, [subTab])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const p: Promise<any>[] = []
      if (subTab === "zones") p.push(api.pricing.zones.list().then(setZones))
      if (subTab === "competitors") p.push(api.pricing.competitorPrices.list().then(setCompetitors))
      if (subTab === "audit") p.push(api.pricing.auditLogs.list().then(setAudits))
      if (subTab === "psychological") p.push(api.pricing.psychologicalRules.list().then(setPsychRules))
      if (subTab === "dashboard") p.push(api.pricing.dashboard().then(setDashData))
      await Promise.all(p.map(p => p.catch(() => {})))
    } finally { setLoading(false) }
  }

  const handleApprove = async (id: string) => {
    try { await api.pricing.auditLogs.approve(id); toast.success("Cambio aprobado"); fetchAll() }
    catch (e: any) { toast.error(e.message) }
  }

  const subTabs: { k: SubTab; l: string; i: any }[] = [
    { k: "dashboard", l: "Dashboard", i: BarChart3 },
    { k: "zones", l: "Zonas", i: DollarSign },
    { k: "competitors", l: "Competencia", i: TrendingUp },
    { k: "audit", l: "Auditoría", i: Shield },
    { k: "psychological", l: "Psicológico", i: Brain },
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
            { label: "Zonas Activas", value: dashData.zonas_activas || 0, icon: DollarSign },
            { label: "Competidores", value: dashData.competidores_seguidos || 0, icon: TrendingUp },
            { label: "Cambios 24h", value: dashData.cambios_24h || 0, icon: Shield },
            { label: "Pend. Aprob.", value: dashData.cambios_pendientes_aprobacion || 0, icon: AlertTriangle },
          ].map((s, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-sm text-gray-500">{s.label}</p><s.icon className="w-5 h-5 text-gray-400" /></div>
              <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-2">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {subTab === "zones" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold">Zonas de Precio</h3>
            <button onClick={() => setShowZoneModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Nueva Zona</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200/50"><th className="text-left py-3 px-2 font-medium text-gray-500">Nombre</th><th className="text-left py-3 px-2 font-medium text-gray-500">Tipo</th><th className="text-center py-3 px-2 font-medium text-gray-500">Activa</th></tr></thead>
              <tbody>{zones.map(z => (
                <tr key={z.id} className="border-b border-gray-100/50"><td className="py-3 px-2 font-medium">{z.nombre}</td><td className="py-3 px-2"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{z.tipo}</span></td><td className="py-3 px-2 text-center">{z.activa ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-red-600 mx-auto" />}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">💡 Las zonas permiten tener precios distintos por sucursal o canal. Activá la zona y asignale productos desde la configuración de precios.</p>
        </div>
      )}

      {subTab === "competitors" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between mb-4">
            <h3 className="font-semibold">Precios de Competencia</h3>
            <button onClick={() => setShowCompetitorModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /> Cargar Precio</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200/50"><th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th><th className="text-left py-3 px-2 font-medium text-gray-500">Competidor</th><th className="text-right py-3 px-2 font-medium text-gray-500">Precio</th><th className="text-right py-3 px-2 font-medium text-gray-500">Diff%</th><th className="text-left py-3 px-2 font-medium text-gray-500">Captura</th></tr></thead>
              <tbody>{competitors.map(c => (
                <tr key={c.id} className="border-b border-gray-100/50">
                  <td className="py-3 px-2 font-medium">{c.producto_nombre}</td>
                  <td className="py-3 px-2">{c.competidor}</td>
                  <td className="py-3 px-2 text-right font-medium">{formatPYG(c.precio)}</td>
                  <td className={`py-3 px-2 text-right font-medium ${(c.diferencia_pct || 0) < 0 ? "text-green-600" : (c.diferencia_pct || 0) > 0 ? "text-red-600" : ""}`}>{c.diferencia_pct ? `${c.diferencia_pct > 0 ? "+" : ""}${c.diferencia_pct}%` : "-"}</td>
                  <td className="py-3 px-2 text-gray-500">{formatDate(c.fecha_captura)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">💡 Diferencia negativa (verde) = estamos más caros que la competencia. Diferencia &gt;5% activa alerta automática.</p>
        </div>
      )}

      {subTab === "audit" && (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4">Auditoría de Cambios de Precio</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200/50"><th className="text-left py-3 px-2 font-medium text-gray-500">Producto</th><th className="text-right py-3 px-2 font-medium text-gray-500">Anterior</th><th className="text-right py-3 px-2 font-medium text-gray-500">Nuevo</th><th className="text-right py-3 px-2 font-medium text-gray-500">Diff%</th><th className="text-left py-3 px-2 font-medium text-gray-500">Motivo</th><th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th><th className="text-center py-3 px-2 font-medium text-gray-500"></th></tr></thead>
              <tbody>{audits.map(a => (
                <tr key={a.id} className="border-b border-gray-100/50">
                  <td className="py-3 px-2 font-medium">{a.producto_nombre}</td>
                  <td className="py-3 px-2 text-right">{formatPYG(a.precio_anterior)}</td>
                  <td className="py-3 px-2 text-right font-bold">{formatPYG(a.precio_nuevo)}</td>
                  <td className={`py-3 px-2 text-right font-medium ${Math.abs(a.diferencia_pct || 0) > 10 ? "text-red-600 font-bold" : ""}`}>{a.diferencia_pct ? `${a.diferencia_pct > 0 ? "+" : ""}${a.diferencia_pct}%` : "-"}</td>
                  <td className="py-3 px-2 text-gray-500 text-xs">{a.motivo}</td>
                  <td className="py-3 px-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.estado === "aplicado" ? "bg-green-100 text-green-700" : a.estado === "pendiente" ? "bg-amber-100 text-amber-700" : ""}`}>{a.estado}</span></td>
                  <td className="py-3 px-2 text-center">{a.estado === "pendiente" && <button onClick={() => handleApprove(a.id)} className="px-2 py-1 bg-green-600 text-white rounded-lg text-xs"><Check className="w-3 h-3 inline" /> Aprobar</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">⚠️ Cambios &gt;10% requieren aprobación automática. Revisá el motivo antes de aprobar.</p>
        </div>
      )}

      {subTab === "psychological" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold">Reglas de Precio Psicológico</h3>
              <button onClick={() => setShowPsychModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"><Plus className="w-3.5 h-3.5" /> Nueva</button>
            </div>
            <div className="space-y-2">
              {psychRules.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-slate-700/50">
                  <div><p className="font-medium text-sm">{r.nombre}</p><p className="text-xs text-gray-400">Terminación {r.tipo_redondeo} {r.limite_superior ? `(hasta ${formatPYG(r.limite_superior)})` : ""}</p></div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${r.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.activa ? "Activa" : "Inactiva"}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">💡 Ejemplo: regla .990 convierte 2.000 → 1.990. El cliente percibe "mucho más barato" aunque la diferencia sea mínima.</p>
          </div>
          <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Cómo Aplicar</h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2"><span className="font-bold text-emerald-600">1.</span> Creá una regla de redondeo (ej: .990 para productos &lt;50.000)</li>
              <li className="flex gap-2"><span className="font-bold text-emerald-600">2.</span> Buscá el producto y seleccioná "Aplicar precio psicológico"</li>
              <li className="flex gap-2"><span className="font-bold text-emerald-600">3.</span> El sistema redondea automáticamente al formato elegido</li>
              <li className="flex gap-2"><span className="font-bold text-emerald-600">4.</span> El cambio queda registrado en la auditoría de precios</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
