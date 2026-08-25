import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Truck, ClipboardList, PackageOpen, XCircle, Plus, Search, Loader2,
  CheckCircle2, AlertTriangle, Calendar, Clock, Thermometer, ShieldCheck,
  RefreshCw, Info, Building2, User, Phone, FileText, ArrowRight, ShieldAlert,
  ChevronRight, Sparkles, Check, X
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
  }, [])

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
      const created = await api.dsd.receivings.create(payload)
      toast.success("Recepción Iniciada", "Muelle habilitado para descarga y termometría.")
      setShowReceivingModal(false)
      loadData()
      if (created?.id) loadReceivingDetails(created)
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
        producto_id: itemForm.producto_id || undefined,
        cantidad_solicitada: parseFloat(itemForm.cantidad_solicitada) || 0,
        cantidad_recibida: parseFloat(itemForm.cantidad_recibida) || 0,
        cantidad_aceptada: parseFloat(itemForm.cantidad_aceptada || itemForm.cantidad_recibida) || 0,
        temperatura_producto: parseFloat(itemForm.temperatura_producto) || 0,
      })
      toast.success("Item Verificado", "Control térmico y de calidad registrado.")
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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">
              Recepción Directa en Tienda (DSD)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 uppercase">
              Muelle & Cadena de Frío
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Control integral de entregas directas de proveedores en andén: inspección sanitaria, verificación de temperatura en descarga, cotejo ciego de bultos vs remito/OC y emisión de actas de rechazo con nota de crédito automática.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={loadData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /><span>Actualizar</span>
          </button>
          <button onClick={() => setShowScheduleModal(true)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /><span>Programar Arribo</span>
          </button>
          <button onClick={() => setShowReceivingModal(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /><span>Nueva Recepción en Muelle</span>
          </button>
        </div>
      </div>

      {/* BANNER EXPLICATIVO */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-300">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-blue-950 dark:text-blue-200 mb-0.5">
            Flujo de Recepción DSD (Direct Store Delivery)
          </p>
          <p className="text-blue-800 dark:text-blue-400 leading-relaxed">
            1) <b>Programación:</b> Agendá la ventana horaria del camión y asignale muelle. 2) <b>Descarga:</b> Verificá temperatura ambiente del andén e iniciá la recepción con el N° de Remito. 3) <b>Control Térmico & Calidad:</b> Medí la temperatura interna de cada producto (lácteos 0-4°C, congelados -18°C). 4) <b>Rechazos:</b> Si un lote no cumple, registrá el rechazo y generá la constancia para la Nota de Crédito.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Programadas Hoy", val: dash.hoy_programadas ?? schedules.filter(s => s.fecha_programada === new Date().toISOString().split("T")[0]).length, color: "text-blue-600", icon: Calendar },
          { label: "Descargas en Curso", val: dash.en_curso ?? receivings.filter(r => r.estado === "en_proceso").length, color: "text-amber-600", icon: Clock },
          { label: "Completadas Hoy", val: dash.completadas_hoy ?? receivings.filter(r => r.estado === "completada").length, color: "text-emerald-600", icon: CheckCircle2 },
          { label: "Bultos Recibidos", val: dash.bultos_recibidos_hoy ?? receivings.reduce((acc, r) => acc + (r.total_bultos_recibidos || 0), 0), color: "text-purple-600", icon: PackageOpen },
          { label: "Bultos Rechazados", val: dash.bultos_rechazados_hoy ?? receivings.reduce((acc, r) => acc + (r.total_bultos_rechazados || 0), 0), color: "text-red-600", icon: XCircle },
          { label: "Rechazos Temp.", val: dash.rechazos_temp ?? rejections.length, color: "text-rose-600", icon: Thermometer },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-lg font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "Dashboard & Muelles" },
            { id: "programacion", label: `Programación Camiones (${schedules.length})` },
            { id: "recepciones", label: `Recepciones en Andén (${receivings.length})` },
            { id: "items", label: `Inspección de Items (${receivingItems.length})` },
            { id: "rechazos", label: `Actas de Rechazo (${rejections.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as DsdTab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB DASHBOARD */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Estado de Muelles */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" /> Estado de Andenes de Descarga
            </h3>
            <div className="space-y-3">
              {MUELLES.map((muelle, idx) => {
                const enCurso = receivings.find(r => r.estado === "en_proceso")
                const ocupado = idx === 0 && enCurso
                return (
                  <div key={muelle} className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition ${ocupado ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/50" : "bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700/60"}`}>
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-white">{muelle}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {ocupado ? `Descargando Remito #${enCurso?.numero_remito || "S/N"} · Temp: ${enCurso?.temp_ambiente_descarga}°C` : "Disponible para descarga"}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${ocupado ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"}`}>
                      {ocupado ? "En Operación" : "Libre"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Próximas Entregas Programadas */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" /> Próximos Arribos
              </h3>
              <button onClick={() => setShowScheduleModal(true)} className="btn-secondary text-[10px] px-2.5 py-1 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agendar
              </button>
            </div>
            {schedules.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Sin camiones programados para hoy.</p>
                <p className="mt-1">Agendá las ventanas de descarga de tus proveedores.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {schedules.slice(0, 5).map((s: any) => (
                  <div key={s.id} className="p-3 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-white">{supplierMap[s.proveedor_id] || "Proveedor Asignado"}</p>
                      <p className="text-[10px] text-gray-400">OC: #{s.numero_oc || "S/N"} · {s.muelle} · {s.tipo_carga}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Chofer: {s.conductor || "—"} ({s.patente || "Sin chapa"})</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{s.fecha_programada}</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.total_bultos_estimado ? `${s.total_bultos_estimado} bultos` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB PROGRAMACIÓN */}
      {tab === "programacion" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {schedules.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin programación de camiones</p>
              <p className="mt-1 max-w-xs mx-auto">Programá la llegada de camiones con su proveedor, orden de compra, muelle asignado y datos del transportista.</p>
              <button onClick={() => setShowScheduleModal(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Programar Primer Arribo
              </button>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Proveedor / OC</th>
                  <th className="p-3.5 text-left">Fecha & Muelle</th>
                  <th className="p-3.5 text-left">Tipo de Carga</th>
                  <th className="p-3.5 text-left">Transportista / Chofer</th>
                  <th className="p-3.5 text-right">Bultos / Peso</th>
                  <th className="p-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {schedules.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <p className="font-extrabold text-gray-900 dark:text-white">{supplierMap[s.proveedor_id] || "Proveedor Registrado"}</p>
                      <p className="text-[10px] text-gray-400 font-mono">OC: #{s.numero_oc || "S/N"}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-gray-800 dark:text-gray-200">{s.fecha_programada}</p>
                      <p className="text-[10px] text-gray-400">{s.muelle}</p>
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-300 font-medium">{s.tipo_carga}</td>
                    <td className="p-3.5">
                      <p className="text-gray-800 dark:text-gray-200 font-bold">{s.transportista || s.conductor || "—"}</p>
                      <p className="text-[10px] text-gray-400">Patente: {s.patente || "—"} · Tel: {s.conductor_telefono || "—"}</p>
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      <p className="font-bold">{s.total_bultos_estimado || "—"} bultos</p>
                      <p className="text-[10px] text-gray-400">{s.total_peso_estimado_kg ? `${s.total_peso_estimado_kg} kg` : ""}</p>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${s.estado === "completada" ? "text-emerald-600 bg-emerald-50" : s.estado === "en_proceso" ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50"}`}>
                        {s.estado || "programada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB RECEPCIONES */}
      {tab === "recepciones" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {receivings.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin recepciones registradas</p>
              <p className="mt-1 max-w-xs mx-auto">Iniciá la recepción física en muelle con el Remito del transportista y control de temperatura de andén.</p>
              <button onClick={() => setShowReceivingModal(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Iniciar Recepción
              </button>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Remito / Proveedor</th>
                  <th className="p-3.5 text-left">Fecha & Hora</th>
                  <th className="p-3.5 text-center">Temp. Andén</th>
                  <th className="p-3.5 text-right">Bultos Recibidos</th>
                  <th className="p-3.5 text-right">Bultos Rechazados</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {receivings.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3.5">
                      <p className="font-extrabold text-gray-900 dark:text-white">Remito #{r.numero_remito || "S/N"}</p>
                      <p className="text-[10px] text-gray-400">{supplierMap[r.proveedor_id] || "Proveedor"} · OC: #{r.numero_oc || "S/N"}</p>
                    </td>
                    <td className="p-3.5 font-mono text-gray-500">
                      {r.fecha_recepcion ? formatDate(r.fecha_recepcion) : "—"}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-blue-600">
                      {r.temp_ambiente_descarga ? `${r.temp_ambiente_descarga}°C` : "—"}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {r.total_bultos_recibidos || 0}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-red-600">
                      {r.total_bultos_rechazados || 0}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.estado === "completada" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>
                        {r.estado || "en_proceso"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button onClick={() => { loadReceivingDetails(r); setTab("items") }} className="btn-secondary text-[10px] px-2.5 py-1 inline-flex items-center gap-1">
                        Inspeccionar <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB ITEMS DE RECEPCIÓN */}
      {tab === "items" && (
        <div className="space-y-4">
          <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Recepción Seleccionada</p>
              <p className="font-extrabold text-sm text-gray-900 dark:text-white">
                {selectedReceiving ? `Remito #${selectedReceiving.numero_remito} · ${supplierMap[selectedReceiving.proveedor_id] || "Proveedor"}` : "Seleccioná una recepción para auditar items"}
              </p>
            </div>
            {selectedReceiving && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowRejectionModal(true)} className="btn-secondary text-xs px-3 py-1.5 text-red-600 border-red-200 dark:border-red-900/50 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Registrar Rechazo
                </button>
                <button onClick={() => setShowItemModal(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Auditar Item
                </button>
              </div>
            )}
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {receivingItems.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-xs">
                <PackageOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-bold text-sm text-gray-600 dark:text-gray-300">Sin items auditados en esta entrega</p>
                <p className="mt-1">Registrá la inspección térmica y visual de cada producto del remito.</p>
                {selectedReceiving && (
                  <button onClick={() => setShowItemModal(true)} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />Auditar Primer Item
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 text-left">Producto / Lote</th>
                    <th className="p-3.5 text-center">Temp. Medida</th>
                    <th className="p-3.5 text-center">Conformidad Térmica</th>
                    <th className="p-3.5 text-right">Cant. Recibida</th>
                    <th className="p-3.5 text-right">Cant. Aceptada</th>
                    <th className="p-3.5 text-left">Vencimiento</th>
                    <th className="p-3.5 text-center">Inspección Visual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {receivingItems.map((it: any) => (
                    <tr key={it.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5">
                        <p className="font-extrabold text-gray-900 dark:text-white">{it.producto_id?.slice(0, 8) || "Item"}</p>
                        <p className="text-[10px] text-gray-400 font-mono">Lote: {it.lote || "—"}</p>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-blue-600">
                        {it.temperatura_producto ? `${it.temperatura_producto}°C` : "—"}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${it.temp_conforme !== false ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                          {it.temp_conforme !== false ? "Conforme ✓" : "Fuera de Rango ✗"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold">{it.cantidad_recibida}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600">{it.cantidad_aceptada}</td>
                      <td className="p-3.5 text-gray-500 font-mono">{it.fecha_vencimiento || "—"}</td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${it.inspeccion_conforme !== false ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>
                          {it.condicion_visual || "Óptima"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB RECHAZOS */}
      {tab === "rechazos" && (
        <div className="space-y-3">
          {rejections.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-xs card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-emerald-500" />
              <p className="font-bold text-sm text-emerald-600">Sin actas de rechazo registradas</p>
              <p className="mt-1">Todas las entregas cumplen los estándares térmicos y sanitarios del supermercado.</p>
            </div>
          ) : (
            rejections.map((rej: any) => (
              <div key={rej.id} className="card p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-extrabold text-red-900 dark:text-red-200">{rej.motivo}</p>
                  <p className="text-red-700 dark:text-red-400 mt-0.5">Cant. Rechazada: {rej.cantidad_rechazada} · {rej.detalle || "Sin detalle"}</p>
                  {rej.genera_nota_credito && (
                    <span className="inline-block mt-1 text-[10px] font-black text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-full uppercase">
                      Genera Nota de Crédito {rej.nota_credito_numero ? `#${rej.nota_credito_numero}` : ""}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono text-[10px] text-gray-400">{formatDate(rej.created_at)}</span>
                  <p className="text-[10px] font-bold text-red-600 mt-1">Acta Registrada</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL PROGRAMAR ARRIBO */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Programar Arribo de Camión</h2>
            <form onSubmit={handleSaveSchedule} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-sm">Proveedor *</label>
                  <select className="input text-xs" value={scheduleForm.proveedor_id} onChange={e => setScheduleForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                    <option value="">Seleccioná un proveedor...</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre} ({s.ruc})</option>)}
                  </select>
                </div>
                <div><label className="label-sm">Número de OC</label><input className="input text-xs" value={scheduleForm.numero_oc} onChange={e => setScheduleForm(f => ({ ...f, numero_oc: e.target.value }))} placeholder="OC-4453" /></div>
                <div><label className="label-sm">Fecha Programada *</label><input type="date" required className="input text-xs" value={scheduleForm.fecha_programada} onChange={e => setScheduleForm(f => ({ ...f, fecha_programada: e.target.value }))} /></div>
                <div><label className="label-sm">Muelle Asignado</label>
                  <select className="input text-xs" value={scheduleForm.muelle} onChange={e => setScheduleForm(f => ({ ...f, muelle: e.target.value }))}>
                    {MUELLES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label-sm">Tipo de Carga</label>
                  <select className="input text-xs" value={scheduleForm.tipo_carga} onChange={e => setScheduleForm(f => ({ ...f, tipo_carga: e.target.value }))}>
                    {TIPOS_CARGA.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label-sm">Transportista</label><input className="input text-xs" value={scheduleForm.transportista} onChange={e => setScheduleForm(f => ({ ...f, transportista: e.target.value }))} placeholder="Ej: Transportes del Este" /></div>
                <div><label className="label-sm">Patente / Chapa</label><input className="input text-xs" value={scheduleForm.patente} onChange={e => setScheduleForm(f => ({ ...f, patente: e.target.value }))} placeholder="Ej: ABC 123" /></div>
                <div><label className="label-sm">Chofer</label><input className="input text-xs" value={scheduleForm.conductor} onChange={e => setScheduleForm(f => ({ ...f, conductor: e.target.value }))} placeholder="Nombre completo" /></div>
                <div><label className="label-sm">Teléfono Chofer</label><input className="input text-xs" value={scheduleForm.conductor_telefono} onChange={e => setScheduleForm(f => ({ ...f, conductor_telefono: e.target.value }))} placeholder="0981..." /></div>
                <div><label className="label-sm">Bultos Estimados</label><input type="number" className="input text-xs" value={scheduleForm.total_bultos_estimado} onChange={e => setScheduleForm(f => ({ ...f, total_bultos_estimado: e.target.value }))} /></div>
                <div><label className="label-sm">Peso Est. (kg)</label><input type="number" step="0.1" className="input text-xs" value={scheduleForm.total_peso_estimado_kg} onChange={e => setScheduleForm(f => ({ ...f, total_peso_estimado_kg: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label-sm">Notas</label><textarea className="input text-xs h-14" value={scheduleForm.notas} onChange={e => setScheduleForm(f => ({ ...f, notas: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingSchedule} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />} Programar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA RECEPCIÓN EN MUELLE */}
      {showReceivingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Iniciar Descarga en Muelle</h2>
            <form onSubmit={handleSaveReceiving} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Proveedor *</label>
                <select required className="input text-xs" value={receivingForm.proveedor_id} onChange={e => setReceivingForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                  <option value="">Seleccioná un proveedor...</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre} ({s.ruc})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-sm">N° Remito / Factura *</label><input required className="input text-xs" value={receivingForm.numero_remito} onChange={e => setReceivingForm(f => ({ ...f, numero_remito: e.target.value }))} placeholder="R-001-002-0034" /></div>
                <div><label className="label-sm">N° de OC</label><input className="input text-xs" value={receivingForm.numero_oc} onChange={e => setReceivingForm(f => ({ ...f, numero_oc: e.target.value }))} placeholder="OC-4453" /></div>
                <div><label className="label-sm">Total Bultos</label><input type="number" className="input text-xs" value={receivingForm.total_bultos_recibidos} onChange={e => setReceivingForm(f => ({ ...f, total_bultos_recibidos: e.target.value }))} placeholder="Ej: 120" /></div>
                <div><label className="label-sm">Temp. Andén (°C)</label><input type="number" step="0.5" className="input text-xs" value={receivingForm.temp_ambiente_descarga} onChange={e => setReceivingForm(f => ({ ...f, temp_ambiente_descarga: e.target.value }))} placeholder="18" /></div>
              </div>
              <div><label className="label-sm">Observaciones</label><textarea className="input text-xs h-14" value={receivingForm.observaciones} onChange={e => setReceivingForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Condiciones del camión, precintos de seguridad, etc." /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowReceivingModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingReceiving} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingReceiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />} Iniciar Descarga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDITAR ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Control Térmico & Calidad de Item</h2>
            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div><label className="label-sm">ID Producto / SKU *</label><input required className="input text-xs" value={itemForm.producto_id} onChange={e => setItemForm(f => ({ ...f, producto_id: e.target.value }))} placeholder="UUID o SKU del producto" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-sm">Cant. Recibida *</label><input required type="number" step="0.1" className="input text-xs" value={itemForm.cantidad_recibida} onChange={e => setItemForm(f => ({ ...f, cantidad_recibida: e.target.value }))} /></div>
                <div><label className="label-sm">Cant. Aceptada</label><input type="number" step="0.1" className="input text-xs" value={itemForm.cantidad_aceptada} onChange={e => setItemForm(f => ({ ...f, cantidad_aceptada: e.target.value }))} /></div>
                <div><label className="label-sm">Temp. Producto (°C)</label><input type="number" step="0.1" className="input text-xs" value={itemForm.temperatura_producto} onChange={e => setItemForm(f => ({ ...f, temperatura_producto: e.target.value }))} /></div>
                <div><label className="label-sm">Lote</label><input className="input text-xs" value={itemForm.lote} onChange={e => setItemForm(f => ({ ...f, lote: e.target.value }))} placeholder="L-20260817" /></div>
                <div><label className="label-sm">Vencimiento</label><input type="date" className="input text-xs" value={itemForm.fecha_vencimiento} onChange={e => setItemForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} /></div>
                <div><label className="label-sm">Condición Visual</label>
                  <select className="input text-xs" value={itemForm.condicion_visual} onChange={e => setItemForm(f => ({ ...f, condicion_visual: e.target.value }))}>
                    <option value="optima">Óptima</option><option value="aceptable">Aceptable</option><option value="deteriorada">Deteriorada</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="temp_conf" checked={itemForm.temp_conforme} onChange={e => setItemForm(f => ({ ...f, temp_conforme: e.target.checked }))} />
                <label htmlFor="temp_conf" className="font-bold text-gray-700 dark:text-gray-300">Temperatura Conforme a Norma Sanitaria</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowItemModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingItem} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {savingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR RECHAZO */}
      {showRejectionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-red-600 dark:text-red-400 uppercase">Registrar Acta de Rechazo en Muelle</h2>
            <form onSubmit={handleSaveRejection} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Motivo del Rechazo *</label>
                <select className="input text-xs" value={rejectionForm.motivo} onChange={e => setRejectionForm(f => ({ ...f, motivo: e.target.value }))}>
                  {MOTIVOS_RECHAZO.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-sm">ID Producto</label><input className="input text-xs" value={rejectionForm.producto_id} onChange={e => setRejectionForm(f => ({ ...f, producto_id: e.target.value }))} placeholder="UUID del item" /></div>
                <div><label className="label-sm">Cantidad Rechazada *</label><input required type="number" step="0.1" className="input text-xs" value={rejectionForm.cantidad_rechazada} onChange={e => setRejectionForm(f => ({ ...f, cantidad_rechazada: e.target.value }))} /></div>
              </div>
              <div><label className="label-sm">Detalle / Justificación Técnica</label><textarea className="input text-xs h-16" value={rejectionForm.detalle} onChange={e => setRejectionForm(f => ({ ...f, detalle: e.target.value }))} placeholder="Ej: Producto llegó a 12°C cuando el máximo permitido es 4°C." /></div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="nc" checked={rejectionForm.genera_nota_credito} onChange={e => setRejectionForm(f => ({ ...f, genera_nota_credito: e.target.checked }))} />
                <label htmlFor="nc" className="font-bold text-gray-700 dark:text-gray-300">Generar Acta para Nota de Crédito</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRejectionModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={savingRejection} className="btn-primary text-xs px-4 py-2 bg-red-600 hover:bg-red-700 flex items-center gap-1.5">
                  {savingRejection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Emitir Rechazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
