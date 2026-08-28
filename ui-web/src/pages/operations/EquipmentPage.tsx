import React, { useState, useEffect, useCallback } from "react"
import {
  Wrench, AlertTriangle, CheckCircle2, Plus, RefreshCw, Loader2,
  Thermometer, Zap, Clock, Calendar, Settings, Info, ShieldAlert,
  ChevronDown, ClipboardList, Activity, Layers, ArrowRight
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatDate } from "../../utils/format"

const CATEGORIAS = ["Refrigeración", "Producción", "Cocción", "Lavado & Limpieza", "Pesaje", "Elevación & Transporte", "HVAC", "Eléctrico"]
const AREAS = ["Carnicería", "Verdulería", "Panadería", "Rotisería", "Cámara Frigorífica", "Salón", "Almacén", "Farmacia"]

export default function EquipmentPage() {
  const toast = useToast()
  const [tab, setTab] = useState<"equipos" | "ordenes" | "alertas" | "dashboard">("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos
  const [dashboard, setDashboard] = useState<any>(null)
  const [equipos, setEquipos] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])

  // Formulario de nuevo equipo
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: "", categoria: "Refrigeración", marca: "", modelo: "",
    area: "Carnicería", numero_serie: "", codigo_inventario: "",
    fecha_instalacion: "", prioridad: "media",
    temp_min_operacion: "", temp_max_operacion: "",
    proveedor_mantenimiento: "", notas: ""
  })

  // Formulario de orden de trabajo
  const [showWOForm, setShowWOForm] = useState(false)
  const [savingWO, setSavingWO] = useState(false)
  const [woForm, setWoForm] = useState({
    equipo_id: "", tipo: "preventivo", descripcion: "",
    prioridad: "media", fecha_programada: ""
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, eqs, wos, alts] = await Promise.allSettled([
        api.equipment.dashboard(),
        api.equipment.list(),
        api.equipment.workOrders.list(),
        api.equipment.alerts.list(),
      ])
      if (dash.status === "fulfilled") setDashboard(dash.value)
      if (eqs.status === "fulfilled" && Array.isArray(eqs.value)) setEquipos(eqs.value)
      if (wos.status === "fulfilled" && Array.isArray(wos.value)) setWorkOrders(wos.value)
      if (alts.status === "fulfilled" && Array.isArray(alts.value)) setAlertas(alts.value)
    } catch (e: any) {
      toast.error("Error al cargar equipos", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveEquipo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.equipment.create({ ...form, activo: true, alerta_habilitada: true })
      toast.success("Equipo registrado", `${form.nombre} agregado al inventario de mantenimiento.`)
      setShowForm(false)
      setForm({ nombre: "", categoria: "Refrigeración", marca: "", modelo: "", area: "Carnicería", numero_serie: "", codigo_inventario: "", fecha_instalacion: "", prioridad: "media", temp_min_operacion: "", temp_max_operacion: "", proveedor_mantenimiento: "", notas: "" })
      loadData()
    } catch (err: any) {
      toast.error("Error al guardar", err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveWO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!woForm.equipo_id) { toast.error("Seleccioná un equipo", ""); return }
    setSavingWO(true)
    try {
      await api.equipment.workOrders.create(woForm)
      toast.success("Orden creada", "La orden de trabajo fue registrada correctamente.")
      setShowWOForm(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al crear orden", err.message)
    } finally {
      setSavingWO(false)
    }
  }

  const handleCheckAlerts = async () => {
    try {
      const r = await api.equipment.checkAlerts()
      toast.success("Verificación completa", `Se generaron ${Array.isArray(r) ? r.length : 0} alertas de mantenimiento predictivo.`)
      loadData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.equipment.alerts.resolve(alertId)
      toast.success("Alerta resuelta", "")
      loadData()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const dash = dashboard || {}
  const priorColor = (p: string) =>
    p === "critica" ? "text-rose-500 bg-rose-500/10 border border-rose-500/20" :
    p === "alta" ? "text-amber-500 bg-amber-500/10 border border-amber-500/20" :
    "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Wrench className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    OPERACIONES DE SALÓN · MANTENIMIENTO PREDICTIVO & EQUIPAMIENTO
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    {dash.total_equipos ?? equipos.length} Maquinarias Registradas
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Mantenimiento & Equipos
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Cámaras frigoríficas, hornos industriales, balanzas y generadores con monitoreo de alertas preventivas
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                ⚙️ {workOrders.length} órdenes de trabajo
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🔧 {dash.equipos_activos ?? 0} equipos operativos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleCheckAlerts}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Activity className="w-3.5 h-3.5" />
              Verificar IA
            </button>

            <button
              onClick={() => setShowWOForm(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
              Nueva Orden
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Registrar Equipo
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Equipos</span>
              <Wrench className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {dash.total_equipos ?? equipos.length}
            </p>
            <p className="text-[11px] text-slate-400">Total en inventario</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operativos</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {dash.equipos_activos ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">En funcionamiento</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mant. Pendientes</span>
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {dash.mantenimientos_pendientes ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">Próximos a vencer</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Órdenes Abiertas</span>
              <ClipboardList className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {dash.ordenes_abiertas ?? workOrders.filter((w: any) => w.estado !== "completada").length}
            </p>
            <p className="text-[11px] text-slate-400">En curso técnico</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alertas Activas</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {dash.alertas_activas ?? alertas.length}
            </p>
            <p className="text-[11px] text-slate-400">Anomalías térmicas/uso</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Costo Mant. Mes</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-blue-300">
              ₲ {Number(dash.costo_mantenimiento_mes || 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">Inversión mensual</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Dashboard Predictivo", icon: Activity },
          { id: "equipos", label: `Inventario de Equipos`, count: equipos.length, icon: Wrench },
          { id: "ordenes", label: `Órdenes de Trabajo`, count: workOrders.length, icon: ClipboardList },
          { id: "alertas", label: `Alertas IA`, count: alertas.length, icon: AlertTriangle },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: DASHBOARD PREDICTIVO ══════════════════════ */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Equipos por Categoría</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" />Cargando...</div>
            ) : (dash.por_categoria || []).length > 0 ? (
              <div className="space-y-2">
                {(dash.por_categoria || []).map((c: any) => (
                  <div key={c.categoria} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-white">{c.categoria}</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{c.total} equipos</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin equipos registrados aún.</p>
                <p className="mt-1">Usá "Registrar Equipo" para comenzar.</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Próximos Mantenimientos</h3>
            {(dash.proximos_mantenimientos || []).length > 0 ? (
              <div className="space-y-2">
                {(dash.proximos_mantenimientos || []).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{m.nombre}</p>
                      <p className="text-slate-400">{m.area} · {m.marca}</p>
                    </div>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{m.fecha_proximo_mantenimiento}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-60 text-emerald-500" />
                <p className="text-emerald-500 font-bold">Sin mantenimientos urgentes pendientes.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: EQUIPOS ══════════════════════ */}
      {tab === "equipos" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs text-slate-400"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" />Cargando equipos...</div>
          ) : equipos.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin equipos registrados</p>
              <p className="mt-1 max-w-xs mx-auto">Registrá las cámaras frigoríficas, hornos, freidoras y balanzas para habilitar el mantenimiento.</p>
              <button onClick={() => setShowForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Registrar Primer Equipo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Equipo</th>
                    <th className="p-4 text-left">Área</th>
                    <th className="p-4 text-left">Categoría</th>
                    <th className="p-4 text-left">Último Mant.</th>
                    <th className="p-4 text-left">Próximo Mant.</th>
                    <th className="p-4 text-center">Prioridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {equipos.map((eq: any) => (
                    <tr key={eq.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <p className="font-extrabold text-slate-900 dark:text-white">{eq.nombre}</p>
                        <p className="text-[10px] text-slate-400">{eq.marca} {eq.modelo} · S/N: {eq.numero_serie || "—"}</p>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{eq.area}</td>
                      <td className="p-4 text-slate-400">{eq.categoria}</td>
                      <td className="p-4 font-mono text-slate-400">{eq.fecha_ultimo_mantenimiento || "—"}</td>
                      <td className="p-4 font-mono font-bold text-amber-500">{eq.fecha_proximo_mantenimiento || "—"}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${priorColor(eq.prioridad || "media")}`}>
                          {eq.prioridad || "media"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: ORDENES DE TRABAJO ══════════════════════ */}
      {tab === "ordenes" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {workOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin órdenes de trabajo</p>
              <p className="mt-1">Creá una orden de trabajo preventiva o correctiva para cualquier equipo.</p>
              <button onClick={() => setShowWOForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nueva Orden
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Descripción</th>
                    <th className="p-4 text-left">Tipo</th>
                    <th className="p-4 text-left">Estado</th>
                    <th className="p-4 text-left">Programada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {workOrders.map((wo: any) => (
                    <tr key={wo.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{wo.descripcion || "—"}</td>
                      <td className="p-4 text-slate-500 capitalize">{wo.tipo}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${wo.estado === "completada" ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-amber-600 bg-amber-500/10 border border-amber-500/20"}`}>{wo.estado}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-500">{wo.fecha_programada ? formatDate(wo.fecha_programada) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 4: ALERTAS IA ══════════════════════ */}
      {tab === "alertas" && (
        <div className="space-y-3">
          {alertas.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-500">Sin alertas activas</p>
              <p className="mt-1">Todos los equipos operan dentro de sus parámetros normales.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alertas.map((a: any) => (
                <div key={a.id} className="p-5 bg-white dark:bg-slate-900 border border-rose-500/30 rounded-3xl flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3 text-xs">
                    <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white text-sm">{a.tipo_alerta || a.tipo}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">{a.descripcion || a.mensaje}</p>
                    </div>
                  </div>
                  <button onClick={() => handleResolveAlert(a.id)} className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition whitespace-nowrap">
                    Resolver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL NUEVO EQUIPO ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-500" /> Registrar Nuevo Equipo
            </h2>
            <form onSubmit={handleSaveEquipo} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Nombre del Equipo *</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Cámara Frigorífica N°1" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Categoría</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Área / Sección</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                    {AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Marca</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} placeholder="Ej: Friogas" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Modelo</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Ej: FG-2400XL" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">N° de Serie</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none" value={form.numero_serie} onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Código Inventario</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none" value={form.codigo_inventario} onChange={e => setForm(f => ({ ...f, codigo_inventario: e.target.value }))} placeholder="EQ-001" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Fecha Instalación</label>
                  <input type="date" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={form.fecha_instalacion} onChange={e => setForm(f => ({ ...f, fecha_instalacion: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Prioridad</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Temp. Mín. (°C)</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={form.temp_min_operacion} onChange={e => setForm(f => ({ ...f, temp_min_operacion: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Temp. Máx. (°C)</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={form.temp_max_operacion} onChange={e => setForm(f => ({ ...f, temp_max_operacion: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Proveedor de Mantenimiento</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={form.proveedor_mantenimiento} onChange={e => setForm(f => ({ ...f, proveedor_mantenimiento: e.target.value }))} placeholder="Ej: Servicio Técnico Oficial Friogas" />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Notas Técnicas</label>
                  <textarea className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-14" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Guardar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA ORDEN ── */}
      {showWOForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-500" /> Nueva Orden de Trabajo
            </h2>
            <form onSubmit={handleSaveWO} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Equipo *</label>
                <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={woForm.equipo_id} onChange={e => setWoForm(f => ({ ...f, equipo_id: e.target.value }))}>
                  <option value="">Seleccioná un equipo...</option>
                  {equipos.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.nombre} — {eq.area}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipo</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={woForm.tipo} onChange={e => setWoForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="preventivo">Preventivo</option>
                    <option value="correctivo">Correctivo</option>
                    <option value="predictivo">Predictivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Prioridad</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={woForm.prioridad} onChange={e => setWoForm(f => ({ ...f, prioridad: e.target.value }))}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Fecha Programada</label>
                <input type="date" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={woForm.fecha_programada} onChange={e => setWoForm(f => ({ ...f, fecha_programada: e.target.value }))} />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Descripción del Trabajo *</label>
                <textarea required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-16" value={woForm.descripcion} onChange={e => setWoForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Limpieza de filtros y verificación de temperatura en cámara N°1" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowWOForm(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingWO} className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition">
                  {savingWO ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}Crear Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
