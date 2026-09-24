import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Truck, ClipboardList, PackageOpen, XCircle, Plus, Search, Loader2,
  CheckCircle2, AlertTriangle, Calendar, Clock, Thermometer, ShieldCheck,
  RefreshCw, Info, Building2, User, Phone, FileText, ArrowRight, ShieldAlert,
  ChevronRight, Sparkles, Check, X, Layers
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatDate, formatDateTime, formatTime, formatPYG } from "../../utils/format"

type DsdTab = "dashboard" | "programacion" | "recepciones" | "items" | "rechazos"

const MUELLES = ["Muelle 1 (Frescos & Lácteos)", "Muelle 2 (Secos & Granel)", "Muelle 3 (Congelados)", "Muelle 4 (Bebidas & Carga Pesada)"]
const TIPOS_CARGA = ["Refrigerada (0°C a 4°C)", "Congelada (-18°C)", "Seca / Almacén", "Frutas & Verduras", "Lácteos & Embutidos", "Carnes en Gancho / Canal"]
const MOTIVOS_RECHAZO = [
  "Ruptura de Cadena de Frío (Temperatura fuera de rango)",
  "Fecha de Vencimiento Próxima (< 60% vida útil)",
  "Mercadería Vencida",
  "Embalaje / Bulto Roto o Deteriorado",
  "Diferencia de Cantidad vs Remito / OC",
  "Sin Orden de Compra Aprobada",
  "No cumple especificaciones de calidad / Senave / INTN",
  "Vehículo de transporte en malas condiciones higiénicas"
]

export default function DsdPage() {
  const toast = useToast()
  const [tab, setTab] = useState<DsdTab>("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [dashboard, setDashboard] = useState<any>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [receivings, setReceivings] = useState<any[]>([])
  const [selectedReceiving, setSelectedReceiving] = useState<any>(null)
  const [receivingItems, setReceivingItems] = useState<any[]>([])
  const [rejections, setRejections] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // Modal Programar Arribo
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    proveedor_id: "", numero_oc: "", fecha_programada: new Date().toISOString().split("T")[0],
    muelle: "Muelle 1 (Frescos & Lácteos)", tipo_carga: "Refrigerada (0°C a 4°C)",
    transportista: "", patente: "", conductor: "", conductor_telefono: "",
    total_bultos_estimado: "", total_peso_estimado_kg: "", notas: ""
  })

  // Modal Nueva Recepción en Muelle
  const [showReceivingModal, setShowReceivingModal] = useState(false)
  const [savingReceiving, setSavingReceiving] = useState(false)
  const [receivingForm, setReceivingForm] = useState({
    schedule_id: "", proveedor_id: "", numero_oc: "", numero_remito: "",
    total_bultos_recibidos: "", total_bultos_rechazados: "0",
    temp_ambiente_descarga: "18", temp_check_method: "Pistola Láser Infrarroja",
    observaciones: ""
  })

  // Modal Registrar Item en Descarga
  const [showItemModal, setShowItemModal] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [itemForm, setItemForm] = useState({
    producto_id: "", cantidad_solicitada: "", cantidad_recibida: "",
    cantidad_aceptada: "", temperatura_producto: "4.0", temp_conforme: true,
    lote: "", fecha_vencimiento: "", condicion_visual: "optima", inspeccion_conforme: true
  })

  // Modal Registrar Rechazo
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [savingRejection, setSavingRejection] = useState(false)
  const [rejectionForm, setRejectionForm] = useState({
    producto_id: "", cantidad_rechazada: "", motivo: MOTIVOS_RECHAZO[0],
    detalle: "", genera_nota_credito: true, nota_credito_numero: ""
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, sch, rec, supp] = await Promise.allSettled([
        api.dsd.dashboard ? api.dsd.dashboard() : Promise.resolve(null),
        api.dsd.schedules.list(),
        api.dsd.receivings.list(),
        api.purchases.listSuppliers().catch(() => []),
      ])

      if (dash.status === "fulfilled" && dash.value) setDashboard(dash.value)
      if (sch.status === "fulfilled" && Array.isArray(sch.value)) setSchedules(sch.value)
      if (rec.status === "fulfilled" && Array.isArray(rec.value)) setReceivings(rec.value)
      if (supp.status === "fulfilled" && Array.isArray(supp.value)) setSuppliers(supp.value)
    } catch (e: any) {
      toast.error("Error al cargar datos de DSD", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const loadReceivingDetails = async (rec: any) => {
    setSelectedReceiving(rec)
    try {
      const [items, rejs] = await Promise.allSettled([
        api.dsd.receivings.items.list(rec.id),
        api.dsd.receivings.rejections.list(rec.id),
      ])
      if (items.status === "fulfilled" && Array.isArray(items.value)) setReceivingItems(items.value)
      if (rejs.status === "fulfilled" && Array.isArray(rejs.value)) setRejections(rejs.value)
    } catch {
      setReceivingItems([])
      setRejections([])
    }
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSchedule(true)
    try {
      await api.dsd.schedules.create({
        ...scheduleForm,
        proveedor_id: scheduleForm.proveedor_id || undefined,
        total_bultos_estimado: scheduleForm.total_bultos_estimado ? parseInt(scheduleForm.total_bultos_estimado) : undefined,
        total_peso_estimado_kg: scheduleForm.total_peso_estimado_kg ? parseFloat(scheduleForm.total_peso_estimado_kg) : undefined,
        estado: "programada"
      })
      toast.success("Arribo Programado", "El camión y muelle quedaron agendados.")
      setShowScheduleModal(false)
      setScheduleForm({ proveedor_id: "", numero_oc: "", fecha_programada: new Date().toISOString().split("T")[0], muelle: "Muelle 1 (Frescos & Lácteos)", tipo_carga: "Refrigerada (0°C a 4°C)", transportista: "", patente: "", conductor: "", conductor_telefono: "", total_bultos_estimado: "", total_peso_estimado_kg: "", notas: "" })
      loadData()
    } catch (err: any) {
      toast.error("Error al programar arribo", err.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleSaveReceiving = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingReceiving(true)
    try {
      const payload: any = {
        ...receivingForm,
        proveedor_id: receivingForm.proveedor_id || undefined,
        schedule_id: receivingForm.schedule_id || undefined,
        total_bultos_recibidos: parseInt(receivingForm.total_bultos_recibidos) || 0,
        total_bultos_rechazados: parseInt(receivingForm.total_bultos_rechazados) || 0,
        temp_ambiente_descarga: parseFloat(receivingForm.temp_ambiente_descarga) || 0,
        fecha_recepcion: new Date().toISOString(),
        hora_inicio: new Date().toISOString(),
        estado: "en_proceso"
      }
      const res = await api.dsd.receivings.create(payload)
      toast.success("Descarga Iniciada", "Se abrió el registro de recepción en andén.")
      setShowReceivingModal(false)
      loadData()
      if (res?.id) {
        loadReceivingDetails(res)
        setTab("items")
      }
    } catch (err: any) {
      toast.error("Error al iniciar recepción", err.message)
    } finally {
      setSavingReceiving(false)
    }
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReceiving?.id) { toast.error("Seleccioná una recepción activa", ""); return }
    setSavingItem(true)
    try {
      await api.dsd.receivings.items.create(selectedReceiving.id, {
        ...itemForm,
        cantidad_solicitada: parseFloat(itemForm.cantidad_solicitada) || 0,
        cantidad_recibida: parseFloat(itemForm.cantidad_recibida) || 0,
        cantidad_aceptada: parseFloat(itemForm.cantidad_aceptada) || 0,
        temperatura_producto: parseFloat(itemForm.temperatura_producto) || 0,
      })
      toast.success("Item Inspeccionado", "Se registró el control del producto.")
      setShowItemModal(false)
      loadReceivingDetails(selectedReceiving)
    } catch (err: any) {
      toast.error("Error al registrar item", err.message)
    } finally {
      setSavingItem(false)
    }
  }

  const handleSaveRejection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReceiving?.id) { toast.error("Seleccioná una recepción activa", ""); return }
    setSavingRejection(true)
    try {
      await api.dsd.receivings.rejections.create(selectedReceiving.id, {
        ...rejectionForm,
        producto_id: rejectionForm.producto_id || undefined,
        cantidad_rechazada: parseFloat(rejectionForm.cantidad_rechazada) || 1,
      })
      toast.success("Rechazo Registrado", "Se generó el acta de rechazo para el transportista.")
      setShowRejectionModal(false)
      loadReceivingDetails(selectedReceiving)
    } catch (err: any) {
      toast.error("Error al registrar rechazo", err.message)
    } finally {
      setSavingRejection(false)
    }
  }

  const dash = dashboard || {}
  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {}
    suppliers.forEach((s: any) => { map[s.id] = s.razon_social || s.nombre || s.ruc })
    return map
  }, [suppliers])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/90 text-white p-7 border border-blue-500/20 shadow-2xl shadow-blue-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Truck className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    RECEPCIÓN DIRECTA EN TIENDA · DIRECT STORE DELIVERY (DSD)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    4 Andenes de Descarga
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Recepción Directa en Tienda (DSD)
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Inspección sanitaria, control de cadena de frío en descarga, cotejo ciego de bultos y actas de rechazo con NC
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                🚚 {schedules.length} camiones agendados
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                📦 {receivings.reduce((acc, r) => acc + (r.total_bultos_recibidos || 0), 0)} bultos recibidos hoy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Programar Arribo
            </button>

            <button
              onClick={() => setShowReceivingModal(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 transition shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Recepción
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Programadas Hoy</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {dash.hoy_programadas ?? schedules.filter(s => s.fecha_programada === new Date().toISOString().split("T")[0]).length}
            </p>
            <p className="text-[11px] text-slate-400">Camiones esperados</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Descarga</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {dash.en_curso ?? receivings.filter(r => r.estado === "en_proceso").length}
            </p>
            <p className="text-[11px] text-slate-400">En andén ahora</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completadas Hoy</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {dash.completadas_hoy ?? receivings.filter(r => r.estado === "completada").length}
            </p>
            <p className="text-[11px] text-slate-400">Descargas cerradas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bultos Recibidos</span>
              <PackageOpen className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {dash.bultos_recibidos_hoy ?? receivings.reduce((acc, r) => acc + (r.total_bultos_recibidos || 0), 0)}
            </p>
            <p className="text-[11px] text-slate-400">Cajas y unidades</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bultos Rechazados</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {dash.bultos_rechazados_hoy ?? receivings.reduce((acc, r) => acc + (r.total_bultos_rechazados || 0), 0)}
            </p>
            <p className="text-[11px] text-slate-400">Por inconformidad</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rechazos Temp.</span>
              <Thermometer className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-cyan-300">
              {dash.rechazos_temp ?? rejections.length}
            </p>
            <p className="text-[11px] text-slate-400">Ruptura cadena frío</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Dashboard & Muelles", icon: Truck },
          { id: "programacion", label: `Programación Camiones`, count: schedules.length, icon: Calendar },
          { id: "recepciones", label: `Recepciones en Andén`, count: receivings.length, icon: PackageOpen },
          { id: "items", label: `Inspección de Items`, count: receivingItems.length, icon: ClipboardList },
          { id: "rechazos", label: `Actas de Rechazo`, count: rejections.length, icon: XCircle },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as DsdTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: DASHBOARD & MUELLES ══════════════════════ */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" /> Estado de Andenes de Descarga
            </h3>
            <div className="space-y-3">
              {MUELLES.map((muelle, idx) => {
                const enCurso = receivings.find(r => r.estado === "en_proceso")
                const ocupado = idx === 0 && enCurso
                return (
                  <div key={muelle} className={`p-4 rounded-2xl border flex items-center justify-between text-xs transition ${ocupado ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"}`}>
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{muelle}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {ocupado ? `Descargando Remito #${enCurso?.numero_remito || "S/N"} · Temp: ${enCurso?.temp_ambiente_descarga}°C` : "Disponible para descarga"}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${ocupado ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"}`}>
                      {ocupado ? "En Operación" : "Libre"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" /> Próximos Arribos Agendados
              </h3>
              <button onClick={() => setShowScheduleModal(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agendar
              </button>
            </div>
            {schedules.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin camiones programados para hoy.</p>
                <p className="mt-1">Agendá las ventanas de descarga de tus proveedores.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {schedules.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{supplierMap[s.proveedor_id] || "Proveedor Asignado"}</p>
                      <p className="text-[10px] text-slate-400">OC: #{s.numero_oc || "S/N"} · {s.muelle}</p>
                      <p className="text-[10px] text-slate-500">Chofer: {s.conductor || "—"} ({s.patente || "Sin chapa"})</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-blue-500 bg-blue-500/10 border border-blue-500/20">{s.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: PROGRAMACION CAMIONES ══════════════════════ */}
      {tab === "programacion" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {schedules.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin arribos programados</p>
              <p className="mt-1">Agendá la llegada de camiones con muelle y ventana de descarga.</p>
              <button onClick={() => setShowScheduleModal(true)} className="px-4 py-2 mt-4 rounded-2xl bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Programar Arribo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[750px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Proveedor / Chofer</th>
                    <th className="p-4">Muelle & Carga</th>
                    <th className="p-4 text-center">Bultos / Peso</th>
                    <th className="p-4 text-center">Fecha Programada</th>
                    <th className="p-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {schedules.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <p className="font-extrabold text-slate-900 dark:text-white">{supplierMap[s.proveedor_id] || "Proveedor Asignado"}</p>
                        <p className="text-[10px] text-slate-400">{s.conductor || "Sin chofer"} · Chapa: {s.patente || "—"}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-700 dark:text-slate-300">{s.muelle}</p>
                        <p className="text-[10px] text-slate-400">{s.tipo_carga}</p>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {s.total_bultos_estimado || "—"} bultos · {s.total_peso_estimado_kg ? `${s.total_peso_estimado_kg} kg` : "—"}
                      </td>
                      <td className="p-4 text-center font-mono text-slate-500">{formatDate(s.fecha_programada)}</td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-blue-500 bg-blue-500/10 border border-blue-500/20">{s.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 3: RECEPCIONES EN ANDEN ══════════════════════ */}
      {tab === "recepciones" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          {receivings.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <PackageOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Sin recepciones registradas</p>
              <p className="mt-1">Iniciá la descarga de un camión con control de temperatura.</p>
              <button onClick={() => setShowReceivingModal(true)} className="px-4 py-2 mt-4 rounded-2xl bg-blue-600 text-white font-bold text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nueva Recepción
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[750px] text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Remito / Proveedor</th>
                    <th className="p-4 text-center">Temp. Andén</th>
                    <th className="p-4 text-center">Bultos Recibidos</th>
                    <th className="p-4 text-center">Bultos Rechazados</th>
                    <th className="p-4 text-center">Estado</th>
                    <th className="p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {receivings.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-4">
                        <p className="font-extrabold text-slate-900 dark:text-white">Remito #{r.numero_remito || "S/N"}</p>
                        <p className="text-[10px] text-slate-400">{supplierMap[r.proveedor_id] || "Proveedor Directo"}</p>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-amber-500">{r.temp_ambiente_descarga ? `${r.temp_ambiente_descarga}°C` : "—"}</td>
                      <td className="p-4 text-center font-mono font-bold text-emerald-500">{r.total_bultos_recibidos || 0}</td>
                      <td className="p-4 text-center font-mono font-bold text-rose-500">{r.total_bultos_rechazados || 0}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${r.estado === "completada" ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" : "text-amber-500 bg-amber-500/10 border border-amber-500/20"}`}>{r.estado}</span>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => { loadReceivingDetails(r); setTab("items") }} className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition">
                          Inspeccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 4: INSPECCION DE ITEMS ══════════════════════ */}
      {tab === "items" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase">Inspección Térmica de Productos</h3>
              <p className="text-[11px] text-slate-400">{selectedReceiving ? `Remito #${selectedReceiving.numero_remito}` : "Seleccioná una recepción para auditar productos"}</p>
            </div>
            {selectedReceiving && (
              <div className="flex gap-2">
                <button onClick={() => setShowRejectionModal(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Registrar Rechazo
                </button>
                <button onClick={() => setShowItemModal(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Inspeccionar Item
                </button>
              </div>
            )}
          </div>
          {receivingItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Sin items inspeccionados en esta descarga.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {receivingItems.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">{item.producto_id || "Producto"}</p>
                    <p className="text-slate-400">Lote: {item.lote || "S/N"} · Vto: {item.fecha_vencimiento || "—"}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">Recibido: {item.cantidad_recibida} u · Aceptado: {item.cantidad_aceptada} u</p>
                    <p className="font-mono text-amber-500 font-bold">Temp: {item.temperatura_producto}°C ({item.temp_conforme ? "Conforme" : "Inconforme"})</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ TAB 5: ACTAS DE RECHAZO ══════════════════════ */}
      {tab === "rechazos" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500" /> Actas de Rechazo & Devolución en Andén
          </h3>
          {rejections.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-60 text-emerald-500" />
              <p className="text-emerald-500 font-bold">Sin actas de rechazo pendientes.</p>
              <p className="mt-1">Toda la mercadería recibida cumplió con las especificaciones de calidad y temperatura.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rejections.map(rej => (
                <div key={rej.id} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-extrabold text-rose-600 dark:text-rose-400">{rej.motivo}</p>
                    <p className="text-slate-400 mt-0.5">{rej.detalle || "Sin observaciones adicionales"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-rose-600">{rej.cantidad_rechazada} u rechazadas</p>
                    {rej.genera_nota_credito && <span className="text-[10px] font-black text-amber-500 uppercase">Genera NC</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL PROGRAMAR ARRIBO ── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" /> Programar Arribo de Camión
            </h2>
            <form onSubmit={handleSaveSchedule} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Proveedor *</label>
                <select required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={scheduleForm.proveedor_id} onChange={e => setScheduleForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                  <option value="">Seleccioná un proveedor...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social || s.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">N° Orden de Compra</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={scheduleForm.numero_oc} onChange={e => setScheduleForm(f => ({ ...f, numero_oc: e.target.value }))} placeholder="OC-2026-001" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Fecha Programada</label>
                  <input type="date" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={scheduleForm.fecha_programada} onChange={e => setScheduleForm(f => ({ ...f, fecha_programada: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Muelle Asignado</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={scheduleForm.muelle} onChange={e => setScheduleForm(f => ({ ...f, muelle: e.target.value }))}>
                    {MUELLES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipo de Carga</label>
                  <select className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={scheduleForm.tipo_carga} onChange={e => setScheduleForm(f => ({ ...f, tipo_carga: e.target.value }))}>
                    {TIPOS_CARGA.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Chofer / Conductor</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none" value={scheduleForm.conductor} onChange={e => setScheduleForm(f => ({ ...f, conductor: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Chapa / Patente</label>
                  <input className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white outline-none" value={scheduleForm.patente} onChange={e => setScheduleForm(f => ({ ...f, patente: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingSchedule} className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition">
                  {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}Agendar Arribo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA RECEPCIÓN ── */}
      {showReceivingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" /> Iniciar Recepción en Andén
            </h2>
            <form onSubmit={handleSaveReceiving} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Proveedor *</label>
                <select required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none" value={receivingForm.proveedor_id} onChange={e => setReceivingForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                  <option value="">Seleccioná un proveedor...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social || s.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">N° Remito *</label>
                  <input required className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={receivingForm.numero_remito} onChange={e => setReceivingForm(f => ({ ...f, numero_remito: e.target.value }))} placeholder="001-001-0001234" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Temp. Andén (°C)</label>
                  <input type="number" step="0.1" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={receivingForm.temp_ambiente_descarga} onChange={e => setReceivingForm(f => ({ ...f, temp_ambiente_descarga: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Total Bultos Recibidos</label>
                  <input type="number" className="w-full p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-slate-900 dark:text-white outline-none" value={receivingForm.total_bultos_recibidos} onChange={e => setReceivingForm(f => ({ ...f, total_bultos_recibidos: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowReceivingModal(false)} className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancelar</button>
                <button type="submit" disabled={savingReceiving} className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition">
                  {savingReceiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}Iniciar Descarga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
