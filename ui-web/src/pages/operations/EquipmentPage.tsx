import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Wrench, AlertTriangle, CheckCircle2, Plus, RefreshCw, Loader2,
  Thermometer, Zap, Clock, Calendar, Settings, Info, ShieldAlert,
  ChevronDown, ClipboardList, Activity, Layers, ArrowRight, Play,
  Check, DollarSign, FileText, UserCheck, Sparkles, X, ChevronRight
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatDate, formatPYG, cleanOptionalPayload } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"

const CATEGORIAS = [
  "Refrigeración", "Producción", "Cocción", "Lavado & Limpieza",
  "Pesaje", "Elevación & Transporte", "HVAC", "Eléctrico", "Informática & Cajas"
]

const AREAS = [
  "Carnicería", "Verdulería", "Panadería", "Rotisería",
  "Cámara Frigorífica", "Salón de Ventas", "Línea de Cajas", "Depósito / Almacén", "Administración"
]

const MEDIOS_PAGO = [
  { id: "efectivo", label: "Efectivo (Gaveta / Caja Chica)" },
  { id: "transferencia", label: "Transferencia Bancaria" },
  { id: "fondo_fijo", label: "Fondo Fijo de Administración" },
  { id: "cheque", label: "Cheque" },
]

export default function EquipmentPage() {
  const toast = useToast()
  const [tab, setTab] = useState<"dashboard" | "equipos" | "ordenes" | "alertas">("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos del backend
  const [dashboard, setDashboard] = useState<any>(null)
  const [equipos, setEquipos] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])

  // Modal 1: Registrar Equipo
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: "",
    categoria: "Refrigeración",
    marca: "",
    modelo: "",
    area: "Carnicería",
    numero_serie: "",
    codigo_inventario: "",
    fecha_instalacion: "",
    fecha_ultimo_mantenimiento: "",
    fecha_proximo_mantenimiento: "",
    prioridad: "media",
    temp_min_operacion: "",
    temp_max_operacion: "",
    proveedor_mantenimiento: "",
    notas: ""
  })

  // Modal 2: Crear Orden de Trabajo
  const [showWOForm, setShowWOForm] = useState(false)
  const [savingWO, setSavingWO] = useState(false)
  const [woForm, setWoForm] = useState({
    equipo_id: "",
    tipo: "preventivo",
    descripcion: "",
    prioridad: "media",
    fecha_programada: new Date().toISOString().slice(0, 10),
    asignado_a: ""
  })

  // Modal 3: Completar / Finalizar Orden de Trabajo
  const [completeTargetWO, setCompleteTargetWO] = useState<any | null>(null)
  const [savingComplete, setSavingComplete] = useState(false)
  const [completeForm, setCompleteForm] = useState({
    acciones_realizadas: "",
    costo_mano_obra: 0,
    costo_repuestos: 0,
    tecnico_nombre: "",
    notas: "",
    fecha_proximo_mantenimiento: "",
    crear_gasto: false,
    proveedor: "",
    numero_factura: "",
    timbrado: "",
    tipo_pago: "efectivo"
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

  useEffect(() => {
    loadData()
  }, [loadData])

  // Helper para sumar días a una fecha
  const addDaysToDate = (days: number): string => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  // --- Handlers Equipo ---
  const handleSaveEquipo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error("Nombre requerido", "Ingresá el nombre descriptivo del equipo.")
      return
    }
    setSaving(true)
    try {
      await api.equipment.create({
        ...cleanOptionalPayload(form),
        activo: true,
        alerta_habilitada: true
      })
      toast.success("Equipo registrado", `${form.nombre} agregado al inventario de mantenimiento.`)
      setShowForm(false)
      setForm({
        nombre: "",
        categoria: "Refrigeración",
        marca: "",
        modelo: "",
        area: "Carnicería",
        numero_serie: "",
        codigo_inventario: "",
        fecha_instalacion: "",
        fecha_ultimo_mantenimiento: "",
        fecha_proximo_mantenimiento: "",
        prioridad: "media",
        temp_min_operacion: "",
        temp_max_operacion: "",
        proveedor_mantenimiento: "",
        notas: ""
      })
      loadData()
    } catch (err: any) {
      toast.error("Error al guardar equipo", err.message)
    } finally {
      setSaving(false)
    }
  }

  // --- Handlers Orden de Trabajo ---
  const handleSaveWO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!woForm.equipo_id) {
      toast.error("Equipo requerido", "Seleccioná la maquinaria sobre la cual se ejecutará el trabajo.")
      return
    }
    if (!woForm.descripcion.trim()) {
      toast.error("Descripción requerida", "Detallá la tarea preventiva o falla técnica a atender.")
      return
    }
    setSavingWO(true)
    try {
      await api.equipment.workOrders.create(cleanOptionalPayload(woForm))
      toast.success("Orden de trabajo creada", "La orden fue programada con su número correlativo.")
      setShowWOForm(false)
      setWoForm({
        equipo_id: "",
        tipo: "preventivo",
        descripcion: "",
        prioridad: "media",
        fecha_programada: new Date().toISOString().slice(0, 10),
        asignado_a: ""
      })
      loadData()
    } catch (err: any) {
      toast.error("Error al crear orden", err.message)
    } finally {
      setSavingWO(false)
    }
  }

  const handleStartWO = async (woId: string) => {
    try {
      await api.equipment.workOrders.start(woId)
      toast.success("Orden en proceso", "Se inició la ejecución técnica del mantenimiento.")
      loadData()
    } catch (err: any) {
      toast.error("Error al iniciar orden", err.message)
    }
  }

  const handleOpenCompleteModal = (wo: any) => {
    const eq = equipos.find(e => e.id === wo.equipo_id)
    setCompleteTargetWO(wo)
    setCompleteForm({
      acciones_realizadas: "",
      costo_mano_obra: 0,
      costo_repuestos: 0,
      tecnico_nombre: wo.asignado_a || "",
      notas: "",
      fecha_proximo_mantenimiento: addDaysToDate(90), // Default trimestral sugerido
      crear_gasto: false,
      proveedor: eq?.proveedor_mantenimiento || "",
      numero_factura: "",
      timbrado: "",
      tipo_pago: "efectivo"
    })
  }

  const handleSaveCompleteWO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completeTargetWO) return
    if (!completeForm.acciones_realizadas.trim()) {
      toast.error("Acciones requeridas", "Detallá el trabajo técnico y repuestos cambiados.")
      return
    }
    setSavingComplete(true)
    try {
      const payload: any = {
        acciones_realizadas: completeForm.acciones_realizadas.trim(),
        costo_mano_obra: completeForm.costo_mano_obra || 0,
        costo_repuestos: completeForm.costo_repuestos || 0,
        tecnico_nombre: completeForm.tecnico_nombre || null,
        notas: completeForm.notas || null,
        fecha_proximo_mantenimiento: completeForm.fecha_proximo_mantenimiento || null,
        crear_gasto: completeForm.crear_gasto,
      }

      if (completeForm.crear_gasto) {
        payload.tipo_pago = completeForm.tipo_pago
        payload.numero_factura = completeForm.numero_factura || null
        payload.timbrado = completeForm.timbrado || null
        payload.proveedor = completeForm.proveedor || null
      }

      await api.equipment.workOrders.complete(completeTargetWO.id, payload)
      toast.success(
        "Orden completada",
        completeForm.crear_gasto
          ? "Mantenimiento cerrado y gasto financiero registrado exitosamente."
          : "Mantenimiento registrado y fecha de próximo servicio reprogramada."
      )
      setCompleteTargetWO(null)
      loadData()
    } catch (err: any) {
      toast.error("Error al completar orden", err.message)
    } finally {
      setSavingComplete(false)
    }
  }

  // --- Handlers Alertas ---
  const handleCheckAlerts = async () => {
    try {
      const r = await api.equipment.checkAlerts()
      toast.success("Auditoría preventiva ejecutada", `Se auditaron los equipos y se sincronizaron las alertas.`)
      loadData()
    } catch (e: any) {
      toast.error("Error en auditoría", e.message)
    }
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.equipment.alerts.resolve(alertId)
      toast.success("Alerta resuelta", "El evento fue atendido.")
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

  const costoTotalCompletar = useMemo(() => {
    return Number(completeForm.costo_mano_obra || 0) + Number(completeForm.costo_repuestos || 0)
  }, [completeForm.costo_mano_obra, completeForm.costo_repuestos])

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
                    OPERACIONES DE SALÓN · MANTENIMIENTO PREDICTIVO & MAQUINARIA
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
                  Cámaras frigoríficas, hornos, balanzas e infraestructura crítica con alertas preventivas e imputación de gastos
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
                🔧 {dash.equipos_activos ?? equipos.filter(e => e.activo).length} operativos
              </span>
              {alertas.length > 0 && (
                <span className="bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-lg border border-rose-500/30 font-mono font-bold animate-pulse">
                  ⚠️ {alertas.length} alertas activas
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleCheckAlerts}
              title="Audita fechas de próximo mantenimiento y parámetros térmicos para generar alertas"
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Activity className="w-3.5 h-3.5" />
              Auditar Alertas
            </button>

            <button
              onClick={() => setShowWOForm(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
              Nueva Orden de Trabajo
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Registrar Maquinaria
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
              {dash.equipos_activos ?? equipos.filter(e => e.activo).length}
            </p>
            <p className="text-[11px] text-slate-400">En funcionamiento</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mant. Vencidos</span>
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {dash.mantenimientos_pendientes ?? 0}
            </p>
            <p className="text-[11px] text-slate-400">Requieren servicio</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Órdenes Abiertas</span>
              <ClipboardList className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {dash.ordenes_abiertas ?? workOrders.filter((w: any) => w.estado !== "completada" && w.estado !== "cancelada").length}
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
            <p className="text-[11px] text-slate-400">Pendientes de atención</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Costo Mant. Mes</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-lg font-black font-mono tracking-tight text-blue-300">
              {formatPYG(dash.costo_mantenimiento_mes || 0)}
            </p>
            <p className="text-[11px] text-slate-400">Gastos imputados</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Dashboard Predictivo", icon: Activity },
          { id: "equipos", label: `Inventario de Equipos`, count: equipos.length, icon: Wrench },
          { id: "ordenes", label: `Órdenes de Trabajo`, count: workOrders.length, icon: ClipboardList },
          { id: "alertas", label: `Alertas de Servicio`, count: alertas.length, icon: AlertTriangle },
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Equipos por Categoría Operativa
                </h3>
                <p className="text-xs text-slate-400">Distribución de activos en salón y cámaras</p>
              </div>
              <Layers className="w-5 h-5 text-indigo-500" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Cargando categorías...
              </div>
            ) : (dash.por_categoria || []).length > 0 ? (
              <div className="space-y-2">
                {(dash.por_categoria || []).map((c: any) => (
                  <div key={c.categoria} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span className="font-extrabold text-slate-900 dark:text-white">{c.categoria}</span>
                    </div>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40">
                      {c.total} equipos
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin maquinarias registradas aún.</p>
                <button onClick={() => setShowForm(true)} className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Registrar Primer Equipo
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Próximos Mantenimientos Programados
                </h3>
                <p className="text-xs text-slate-400">Calendario de inspección y cambios de filtros/aceite</p>
              </div>
              <Calendar className="w-5 h-5 text-amber-500" />
            </div>

            {(dash.proximos_mantenimientos || []).length > 0 ? (
              <div className="space-y-2.5">
                {(dash.proximos_mantenimientos || []).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{m.nombre}</p>
                      <p className="text-slate-400 text-[11px]">{m.area} · {m.marca || "Sin marca"}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 block">
                        {formatDate(m.fecha_proximo_mantenimiento)}
                      </span>
                      <button
                        onClick={() => {
                          setWoForm(wf => ({ ...wf, equipo_id: m.id, tipo: "preventivo", descripcion: `Mantenimiento preventivo programado para ${m.nombre}` }))
                          setShowWOForm(true)
                        }}
                        className="text-[10px] text-indigo-500 hover:text-indigo-600 font-bold underline inline-flex items-center gap-1 mt-0.5"
                      >
                        Crear Orden <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-60 text-emerald-500" />
                <p className="text-emerald-500 font-bold">Sin mantenimientos vencidos.</p>
                <p className="text-[11px] text-slate-400 mt-1">Todos los equipos cuentan con fecha futura programada.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: EQUIPOS ══════════════════════ */}
      {tab === "equipos" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Catálogo e Inventario de Maquinarias
              </h3>
              <p className="text-xs text-slate-400">Control de números de serie, historial preventivo y proveedores asignados</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Equipo
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              Cargando catálogo de equipos...
            </div>
          ) : equipos.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin equipos registrados</p>
              <p className="mt-1 max-w-xs mx-auto">Registrá las cámaras frigoríficas, hornos, freidoras y balanzas para habilitar el mantenimiento predictivo.</p>
              <button onClick={() => setShowForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Registrar Primer Equipo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[800px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Equipo / Código</th>
                    <th className="p-4 text-left">Área & Categoría</th>
                    <th className="p-4 text-left">Último Servicio</th>
                    <th className="p-4 text-left">Próximo Mantenimiento</th>
                    <th className="p-4 text-left">Proveedor Técnico</th>
                    <th className="p-4 text-center">Prioridad</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {equipos.map((eq: any) => {
                    const isVencido = eq.fecha_proximo_mantenimiento && new Date(eq.fecha_proximo_mantenimiento) <= new Date()
                    return (
                      <tr key={eq.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-900 dark:text-white text-sm">{eq.nombre}</p>
                          <p className="text-[10px] text-slate-400">
                            {eq.marca || "S/M"} {eq.modelo ? `· Mod: ${eq.modelo}` : ""} · S/N: {eq.numero_serie || "—"}
                            {eq.codigo_inventario ? ` [${eq.codigo_inventario}]` : ""}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-slate-800 dark:text-slate-200 font-bold">{eq.area}</p>
                          <p className="text-[11px] text-slate-400">{eq.categoria}</p>
                        </td>
                        <td className="p-4 font-mono text-slate-500">
                          {eq.fecha_ultimo_mantenimiento ? formatDate(eq.fecha_ultimo_mantenimiento) : "—"}
                        </td>
                        <td className="p-4 font-mono">
                          {eq.fecha_proximo_mantenimiento ? (
                            <span className={`px-2 py-0.5 rounded-lg font-bold ${
                              isVencido
                                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            }`}>
                              {formatDate(eq.fecha_proximo_mantenimiento)} {isVencido ? "⚠️" : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No programado</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          {eq.proveedor_mantenimiento || "—"}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${priorColor(eq.prioridad || "media")}`}>
                            {eq.prioridad || "media"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setWoForm(wf => ({ ...wf, equipo_id: eq.id, tipo: "preventivo", descripcion: `Mantenimiento de ${eq.nombre}` }))
                              setShowWOForm(true)
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition border border-indigo-200 dark:border-indigo-800/50"
                          >
                            + Orden OT
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: ORDENES DE TRABAJO ══════════════════════ */}
      {tab === "ordenes" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Órdenes de Trabajo & Servicios Técnicos
              </h3>
              <p className="text-xs text-slate-400">Ejecución, registro de costos y vinculación con gastos contables</p>
            </div>
            <button
              onClick={() => setShowWOForm(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Orden
            </button>
          </div>

          {workOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin órdenes de trabajo registradas</p>
              <p className="mt-1">Creá una orden de trabajo preventiva o correctiva para registrar servicios técnicos.</p>
              <button onClick={() => setShowWOForm(true)} className="px-4 py-2 mt-4 rounded-2xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nueva Orden
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[850px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">OT # / Equipo</th>
                    <th className="p-4 text-left">Descripción Técnica</th>
                    <th className="p-4 text-left">Tipo</th>
                    <th className="p-4 text-left">Estado</th>
                    <th className="p-4 text-left">Fecha Programada</th>
                    <th className="p-4 text-right">Costo Total</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {workOrders.map((wo: any) => {
                    const eq = equipos.find(e => e.id === wo.equipo_id)
                    const costoTotal = Number(wo.costo_total || (Number(wo.costo_mano_obra || 0) + Number(wo.costo_repuestos || 0)))

                    return (
                      <tr key={wo.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="p-4">
                          <p className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                            {wo.numero_ot || `OT-${wo.id.slice(0, 8)}`}
                          </p>
                          <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                            {eq?.nombre || wo.equipo_nombre || "Equipo"}
                          </p>
                          <p className="text-[10px] text-slate-400">{eq?.area || ""}</p>
                        </td>
                        <td className="p-4 max-w-xs">
                          <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                            {wo.descripcion || wo.descripcion_falla || "—"}
                          </p>
                          {wo.acciones_realizadas && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 line-clamp-1">
                              ✓ {wo.acciones_realizadas}
                            </p>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300 capitalize">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
                            {wo.tipo}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            wo.estado === "completada"
                              ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20"
                              : wo.estado === "en_proceso"
                              ? "text-blue-600 bg-blue-500/10 border border-blue-500/20"
                              : "text-amber-600 bg-amber-500/10 border border-amber-500/20"
                          }`}>
                            {wo.estado === "en_proceso" ? "En Proceso" : wo.estado}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-500">
                          {wo.fecha_programada ? formatDate(wo.fecha_programada) : "—"}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {costoTotal > 0 ? formatPYG(costoTotal) : "—"}
                        </td>
                        <td className="p-4 text-center">
                          {wo.estado === "pendiente" && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleStartWO(wo.id)}
                                title="Iniciar trabajo técnico"
                                className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-[11px] inline-flex items-center gap-1 border border-blue-200 dark:border-blue-900/40 transition"
                              >
                                <Play className="w-3 h-3" /> Iniciar
                              </button>
                              <button
                                onClick={() => handleOpenCompleteModal(wo)}
                                title="Finalizar orden y asentar costos/gastos"
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 transition shadow-sm"
                              >
                                <Check className="w-3 h-3" /> Completar
                              </button>
                            </div>
                          )}

                          {wo.estado === "en_proceso" && (
                            <button
                              onClick={() => handleOpenCompleteModal(wo)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 transition shadow-sm"
                            >
                              <Check className="w-3 h-3" /> Finalizar OT
                            </button>
                          )}

                          {wo.estado === "completada" && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Cerrada
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 4: ALERTAS ══════════════════════ */}
      {tab === "alertas" && (
        <div className="space-y-4">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40 p-4 rounded-3xl flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950 dark:text-indigo-200">
              <p className="font-extrabold text-sm mb-0.5">¿Cómo se originan las alertas de mantenimiento?</p>
              <p className="text-slate-600 dark:text-indigo-300">
                El motor analiza diariamente los equipos activos cuya <strong>Fecha de Próximo Mantenimiento</strong> esté cumplida o vencida,
                así como fluctuaciones de temperatura registradas fuera de rango operativo (por ejemplo en cámaras frigoríficas).
                Al resolverlas o crear una OT, el estado vuelve a quedar en regla.
              </p>
            </div>
          </div>

          {alertas.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-500">Sin alertas de mantenimiento activas</p>
              <p className="mt-1">Todas las maquinarias operan dentro de los tiempos de servicio programados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alertas.map((a: any) => (
                <div key={a.id} className="p-5 bg-white dark:bg-slate-900 border border-rose-500/30 rounded-3xl flex items-center justify-between gap-4 shadow-sm hover:border-rose-500/50 transition">
                  <div className="flex items-center gap-3 text-xs">
                    <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                        {a.severidad || "ALERTA"}
                      </span>
                      <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-1">
                        {a.tipo_alerta || a.tipo || "Mantenimiento Preventivo"}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                        {a.descripcion || a.mensaje}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolveAlert(a.id)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition whitespace-nowrap"
                  >
                    Resolver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 1: REGISTRAR EQUIPO (REGLA 14 CANÓNICA) ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-up">
            {/* Cabecera shrink-0 */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Registrar Maquinaria / Equipo
                  </h2>
                  <p className="text-xs text-slate-400">Incorporación de activo al programa preventivo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo flex-1 overflow-y-auto */}
            <form id="form-nuevo-equipo" onSubmit={handleSaveEquipo} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-slate-500 font-bold mb-1">Nombre Descriptivo de la Maquinaria *</label>
                  <input
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej: Cámara Frigorífica Carnicería N°1 / Horno Convector Panadería"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Categoría Operativa</label>
                  <select
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none"
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  >
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Área / Sección de Salón</label>
                  <select
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none"
                    value={form.area}
                    onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                  >
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Marca</label>
                  <input
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    value={form.marca}
                    onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                    placeholder="Ej: Friogas / Bizerba / Gelopar"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Modelo</label>
                  <input
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    value={form.modelo}
                    onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                    placeholder="Ej: FG-2400XL"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Número de Serie</label>
                  <input
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none"
                    value={form.numero_serie}
                    onChange={e => setForm(f => ({ ...f, numero_serie: e.target.value }))}
                    placeholder="SN-2024-998811"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Código de Inventario</label>
                  <input
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none"
                    value={form.codigo_inventario}
                    onChange={e => setForm(f => ({ ...f, codigo_inventario: e.target.value }))}
                    placeholder="EQ-001"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Prioridad Operativa</label>
                  <select
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none"
                    value={form.prioridad}
                    onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media (Normal)</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica (Interrumpe Operación)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold mb-1">Último Mantenimiento Realizado</label>
                  <input
                    type="date"
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    value={form.fecha_ultimo_mantenimiento}
                    onChange={e => setForm(f => ({ ...f, fecha_ultimo_mantenimiento: e.target.value }))}
                  />
                </div>

                {/* 🎯 FECHA PRÓXIMO MANTENIMIENTO CON ATAJOS */}
                <div className="md:col-span-2 p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-amber-700 dark:text-amber-400 font-black">
                      Fecha de Próximo Mantenimiento (Disparador de Alertas) *
                    </label>
                    <span className="text-[10px] text-amber-600 dark:text-amber-300 font-medium">
                      Atajos rápidos:
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      className="flex-1 min-w-[180px] p-2.5 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold outline-none"
                      value={form.fecha_proximo_mantenimiento}
                      onChange={e => setForm(f => ({ ...f, fecha_proximo_mantenimiento: e.target.value }))}
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: "+30d (Mensual)", days: 30 },
                        { label: "+60d (Bimestral)", days: 60 },
                        { label: "+90d (Trimestral)", days: 90 },
                        { label: "+180d (Semestral)", days: 180 },
                        { label: "+1 año", days: 365 },
                      ].map(a => (
                        <button
                          key={a.days}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, fecha_proximo_mantenimiento: addDaysToDate(a.days) }))}
                          className="px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                    Al llegar o vencer esta fecha, el sistema emitirá alertas automáticas en el dashboard y en la pestaña de Alertas.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-500 font-bold mb-1">Proveedor / Técnico de Mantenimiento Habitual</label>
                  <input
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                    value={form.proveedor_mantenimiento}
                    onChange={e => setForm(f => ({ ...f, proveedor_mantenimiento: e.target.value }))}
                    placeholder="Ej: Servicio Técnico Oficial Friogas S.A. / Ing. Carlos Mendoza"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-500 font-bold mb-1">Notas Técnicas / Observaciones</label>
                  <textarea
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-16"
                    value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    placeholder="Capacidad del compresor, tipo de gas refrigerante R404A, especificaciones de voltaje..."
                  />
                </div>
              </div>
            </form>

            {/* Pie de Acciones shrink-0 */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-nuevo-equipo"
                disabled={saving}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Guardar Maquinaria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 2: NUEVA ORDEN DE TRABAJO (REGLA 14 CANÓNICA) ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showWOForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-up">
            {/* Cabecera shrink-0 */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Nueva Orden de Trabajo (OT)
                  </h2>
                  <p className="text-xs text-slate-400">Programación de servicio preventivo o correctivo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWOForm(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo flex-1 overflow-y-auto */}
            <form id="form-nueva-ot" onSubmit={handleSaveWO} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Maquinaria / Activo Destino *</label>
                <select
                  required
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={woForm.equipo_id}
                  onChange={e => {
                    const eqId = e.target.value
                    const eq = equipos.find(item => item.id === eqId)
                    setWoForm(f => ({
                      ...f,
                      equipo_id: eqId,
                      asignado_a: eq?.proveedor_mantenimiento || f.asignado_a
                    }))
                  }}
                >
                  <option value="">Seleccioná el equipo...</option>
                  {equipos.map((eq: any) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nombre} — {eq.area} ({eq.categoria})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Tipo de Orden</label>
                  <select
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none"
                    value={woForm.tipo}
                    onChange={e => setWoForm(f => ({ ...f, tipo: e.target.value }))}
                  >
                    <option value="preventivo">Preventivo (Programado)</option>
                    <option value="correctivo">Correctivo (Reparación)</option>
                    <option value="predictivo">Predictivo (Inspección IA)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Prioridad</label>
                  <select
                    className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none"
                    value={woForm.prioridad}
                    onChange={e => setWoForm(f => ({ ...f, prioridad: e.target.value }))}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media (Normal)</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica (Urgente)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-500 font-bold">Fecha Programada</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWoForm(f => ({ ...f, fecha_programada: new Date().toISOString().slice(0, 10) }))}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Hoy
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setWoForm(f => ({ ...f, fecha_programada: addDaysToDate(1) }))}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Mañana
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setWoForm(f => ({ ...f, fecha_programada: addDaysToDate(7) }))}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      En 7 días
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  value={woForm.fecha_programada}
                  onChange={e => setWoForm(f => ({ ...f, fecha_programada: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Técnico / Empresa Asignada</label>
                <input
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  value={woForm.asignado_a}
                  onChange={e => setWoForm(f => ({ ...f, asignado_a: e.target.value }))}
                  placeholder="Ej: Ing. Carlos Mendoza / Friogas S.A."
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Descripción del Trabajo / Diagnóstico Inicial *</label>
                <textarea
                  required
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-20 focus:ring-2 focus:ring-blue-500/20"
                  value={woForm.descripcion}
                  onChange={e => setWoForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Limpieza de condensadores, verificación de presión de gas y calibración de termostato digital..."
                />
              </div>
            </form>

            {/* Pie de Acciones shrink-0 */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowWOForm(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-nueva-ot"
                disabled={savingWO}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition"
              >
                {savingWO ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                Crear Orden de Trabajo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 3: FINALIZAR ORDEN, GASTO Y PRÓXIMO MANTENIMIENTO ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {completeTargetWO && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-up">
            {/* Cabecera shrink-0 */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Finalizar Orden de Trabajo {completeTargetWO.numero_ot || ""}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Asentamiento técnico, costos, reprogramación de mantenimiento e imputación contable
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompleteTargetWO(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo flex-1 overflow-y-auto */}
            <form id="form-complete-ot" onSubmit={handleSaveCompleteWO} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Card Resumen de la Orden */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                    {completeTargetWO.numero_ot || "OT"}
                  </span>
                  <span className="text-slate-400">Tipo: <strong className="capitalize text-slate-700 dark:text-slate-200">{completeTargetWO.tipo}</strong></span>
                </div>
                <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                  {completeTargetWO.descripcion || completeTargetWO.descripcion_falla}
                </p>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Informe Técnico / Acciones Realizadas *</label>
                <textarea
                  required
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none h-20 focus:ring-2 focus:ring-emerald-500/20"
                  value={completeForm.acciones_realizadas}
                  onChange={e => setCompleteForm(f => ({ ...f, acciones_realizadas: e.target.value }))}
                  placeholder="Detallá los trabajos hechos: cambio de gas, limpieza de serpentín, cambio de correa, prueba de temperatura..."
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Técnico o Empresa que Ejecutó</label>
                <input
                  className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                  value={completeForm.tecnico_nombre}
                  onChange={e => setCompleteForm(f => ({ ...f, tecnico_nombre: e.target.value }))}
                  placeholder="Ej: Carlos Mendoza (Técnico Friogas)"
                />
              </div>

              {/* SECCIÓN COSTOS CON CURRENCYINPUT CANÓNICO */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 uppercase">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Costos de Mantenimiento
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">Moneda: Guaraníes</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Mano de Obra</label>
                    <CurrencyInput
                      currency="PYG"
                      value={completeForm.costo_mano_obra}
                      onChangeValue={(val) => setCompleteForm(f => ({ ...f, costo_mano_obra: val }))}
                      placeholder="0"
                      className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Repuestos / Insumos</label>
                    <CurrencyInput
                      currency="PYG"
                      value={completeForm.costo_repuestos}
                      onChangeValue={(val) => setCompleteForm(f => ({ ...f, costo_repuestos: val }))}
                      placeholder="0"
                      className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-extrabold text-slate-700 dark:text-slate-300">Costo Total del Servicio:</span>
                  <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {formatPYG(costoTotalCompletar)}
                  </span>
                </div>
              </div>

              {/* 🎯 REPROGRAMACIÓN DE FECHA PRÓXIMO MANTENIMIENTO */}
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-indigo-900 dark:text-indigo-200 font-black">
                    Reprogramar Próximo Mantenimiento del Equipo
                  </label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                    Ciclo preventivo
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    className="flex-1 min-w-[180px] p-2.5 rounded-2xl border border-indigo-300 dark:border-indigo-700/60 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold outline-none"
                    value={completeForm.fecha_proximo_mantenimiento}
                    onChange={e => setCompleteForm(f => ({ ...f, fecha_proximo_mantenimiento: e.target.value }))}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: "+30d", days: 30 },
                      { label: "+60d", days: 60 },
                      { label: "+90d", days: 90 },
                      { label: "+180d", days: 180 },
                      { label: "+1 año", days: 365 },
                    ].map(a => (
                      <button
                        key={a.days}
                        type="button"
                        onClick={() => setCompleteForm(f => ({ ...f, fecha_proximo_mantenimiento: addDaysToDate(a.days) }))}
                        className="px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/60 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                  Al cerrar la orden, la maquinaria quedará con fecha de último mantenimiento en <strong>Hoy</strong> y su próxima fecha actualizada.
                </p>
              </div>

              {/* 📑 TOGGLE DE IMPUTACIÓN DE FACTURA / GASTO CONTABLE */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-500" />
                      ¿Asignar factura / egreso contable por este mantenimiento?
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Crea automáticamente un registro de egreso en el módulo contable para no cargar dos veces
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={completeForm.crear_gasto}
                    onChange={e => setCompleteForm(f => ({ ...f, crear_gasto: e.target.checked }))}
                  />
                </label>

                {completeForm.crear_gasto && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Proveedor / Razón Social</label>
                      <input
                        className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none"
                        value={completeForm.proveedor}
                        onChange={e => setCompleteForm(f => ({ ...f, proveedor: e.target.value }))}
                        placeholder="Ej: Friogas Paraguay S.A."
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Medio de Pago</label>
                      <select
                        className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none"
                        value={completeForm.tipo_pago}
                        onChange={e => setCompleteForm(f => ({ ...f, tipo_pago: e.target.value }))}
                      >
                        {MEDIOS_PAGO.map(m => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">N° de Factura del Servicio</label>
                      <input
                        className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none"
                        value={completeForm.numero_factura}
                        onChange={e => setCompleteForm(f => ({ ...f, numero_factura: e.target.value }))}
                        placeholder="001-002-0001234"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Timbrado (Opcional)</label>
                      <input
                        className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none"
                        value={completeForm.timbrado}
                        onChange={e => setCompleteForm(f => ({ ...f, timbrado: e.target.value }))}
                        placeholder="18545636"
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Pie de Acciones shrink-0 */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setCompleteTargetWO(null)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-complete-ot"
                disabled={savingComplete}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition"
              >
                {savingComplete ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirmar y Cerrar OT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
