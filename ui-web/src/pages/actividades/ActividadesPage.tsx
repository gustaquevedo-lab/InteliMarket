import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Tag, Gift, DollarSign, Download, CheckCircle2, AlertCircle,
  FileSpreadsheet, RefreshCw, Filter, Search, Calendar, Building2,
  ChevronRight, Layers, BarChart3, ArrowUpRight, Check, X, Loader2,
  TrendingUp, Clock, AlertTriangle, ShieldCheck, ChevronDown
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type ActiveTab = "actividades" | "rendicion"

interface ActividadItem {
  id: string
  nombre: string
  supplier_id: string
  supplier_nombre: string
  ciclo: string
  tipo: "escala" | "bonificacion"
  alcance: string
  presupuesto: number
  consumido: number
  saldo: number
  pacing_pct: number
  valoriza_bonificacion: string
  cuenta_contable?: string | null
  activa: boolean
  tramos: Array<{
    id: string
    desde_cantidad: number
    porcentaje?: number | null
    cada?: number | null
    bonifica?: number | null
    tope?: number | null
  }>
  created_at?: string
}

interface RendicionItem {
  id: string
  supplier_id: string
  supplier_nombre: string
  ciclo: string
  total_descuentos: number
  total_bonificaciones: number
  total_rendicion: number
  cobrado: number
  saldo_pendiente: number
  estado: "abierta" | "cerrada" | "conciliada"
  asiento_id?: string | null
  cerrada_at?: string | null
  created_at?: string
}

export default function ActividadesPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<ActiveTab>("actividades")
  const [loading, setLoading] = useState(true)

  // ── PESTAÑA 1: ACTIVIDADES ──
  const [actividades, setActividades] = useState<ActividadItem[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [filterSupplier, setFilterSupplier] = useState("all")
  const [filterTipo, setFilterTipo] = useState("all")
  const [filterCiclo, setFilterCiclo] = useState("")

  // ── PESTAÑA 2: RENDICIONES ──
  const [rendiciones, setRendiciones] = useState<RendicionItem[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState("")
  const [selectedCiclo, setSelectedCiclo] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [previaData, setPreviaData] = useState<any>(null)
  const [loadingPrevia, setLoadingPrevia] = useState(false)
  const [closingRendicion, setClosingRendicion] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Cargar datos iniciales
  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [actsRes, supsRes, rendsRes] = await Promise.all([
        api.actividades.list(),
        api.suppliers.list(),
        api.actividades.rendiciones.list(),
      ])
      setActividades((actsRes || []) as ActividadItem[])
      setSuppliers((supsRes || []) as any[])
      setRendiciones((rendsRes || []) as RendicionItem[])
    } catch (err: any) {
      toast.error("Error al cargar actividades", err?.message || "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Cargar previa de rendición cuando cambia proveedor o ciclo
  const loadPrevia = useCallback(async (supId: string, ciclo: string) => {
    if (!supId || !ciclo) {
      setPreviaData(null)
      return
    }
    setLoadingPrevia(true)
    try {
      const res = await api.actividades.rendiciones.previa(supId, ciclo)
      setPreviaData(res)
    } catch (err: any) {
      toast.error("Error al calcular previa", err?.message || "No se pudo obtener la previa.")
      setPreviaData(null)
    } finally {
      setLoadingPrevia(false)
    }
  }, [toast])

  useEffect(() => {
    if (activeTab === "rendicion" && selectedSupplier && selectedCiclo) {
      loadPrevia(selectedSupplier, selectedCiclo)
    }
  }, [activeTab, selectedSupplier, selectedCiclo, loadPrevia])

  // Cerrar formalmente la rendición
  const handleCerrarRendicion = async () => {
    if (!selectedSupplier || !selectedCiclo || !previaData) return
    if (!confirm(`¿Está seguro de cerrar la rendición para el ciclo ${selectedCiclo}?\nTotal a recuperar: ${formatPYG(previaData.total_rendicion)}\n\nEsta acción vinculará las ventas y generará el asiento contable.`)) {
      return
    }

    setClosingRendicion(true)
    try {
      const res = await api.actividades.rendiciones.cerrar(selectedSupplier, selectedCiclo)
      toast.success("Rendición cerrada", `Se generó el asiento ${res.asiento_numero} por ${formatPYG(res.total_rendicion)}`)
      // Recargar rendiciones y previa
      const rendsRes = await api.actividades.rendiciones.list()
      setRendiciones((rendsRes || []) as RendicionItem[])
      await loadPrevia(selectedSupplier, selectedCiclo)
    } catch (err: any) {
      toast.error("No se pudo cerrar la rendición", err?.message || "Ocurrió un error al procesar el cierre.")
    } finally {
      setClosingRendicion(false)
    }
  }

  // Descargar Excel
  const handleDownloadExcel = async (rendicionId: string, nombreArchivo?: string) => {
    setDownloadingId(rendicionId)
    try {
      await api.actividades.rendiciones.descargarExcel(rendicionId, nombreArchivo)
      toast.success("Descarga completada", "El archivo Excel se descargó correctamente.")
    } catch (err: any) {
      toast.error("Error de descarga", err?.message || "No se pudo descargar el archivo Excel.")
    } finally {
      setDownloadingId(null)
    }
  }

  // Actividades filtradas
  const filteredActividades = useMemo(() => {
    return actividades.filter((act) => {
      if (filterSupplier !== "all" && act.supplier_id !== filterSupplier) return false
      if (filterTipo !== "all" && act.tipo !== filterTipo) return false
      if (filterCiclo && !act.ciclo.includes(filterCiclo)) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          act.nombre.toLowerCase().includes(s) ||
          act.supplier_nombre.toLowerCase().includes(s) ||
          act.ciclo.includes(s)
        )
      }
      return true
    })
  }, [actividades, filterSupplier, filterTipo, filterCiclo, search])

  // Totales de métricas
  const kpis = useMemo(() => {
    const totalPresupuesto = actividades.reduce((acc, a) => acc + (a.presupuesto || 0), 0)
    const totalConsumido = actividades.reduce((acc, a) => acc + (a.consumido || 0), 0)
    const totalSaldo = totalPresupuesto - totalConsumido
    const rendicionesAbiertas = rendiciones.filter((r) => r.estado === "cerrada").length
    return { totalPresupuesto, totalConsumido, totalSaldo, rendicionesAbiertas }
  }, [actividades, rendiciones])

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── HEADER HERO ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-900/50 shadow-xl text-white">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold tracking-wider uppercase">
            <Tag className="w-4 h-4" /> Distribuidora Casa Gonzalito
          </div>
          <h1 className="text-2xl md:text-3xl font-black mt-1 tracking-tight">
            Acuerdos y Actividades de Proveedor
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Control de bonificaciones y descuentos en escala, consumo de presupuestos por ciclo comercial y liquidación mensual de recupero contable.
          </p>
        </div>

        <button
          onClick={loadInitialData}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Sincronizar
        </button>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-indigo-500" /> Presupuesto Ciclo
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatPYG(kpis.totalPresupuesto)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Asignado por proveedores</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Consumido Venta
          </div>
          <div className="text-xl md:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatPYG(kpis.totalConsumido)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {kpis.totalPresupuesto > 0 ? `${((kpis.totalConsumido / kpis.totalPresupuesto) * 100).toFixed(1)}% ejecutado` : "0%"}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Saldo a Rendir
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPYG(kpis.totalSaldo)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Disponible en ruta</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" /> Rendiciones Pend.
          </div>
          <div className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {kpis.rendicionesAbiertas}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Por conciliar con NC</div>
        </div>
      </div>

      {/* ── TABS NAVEGACIÓN ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("actividades")}
          className={`pb-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "actividades"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Layers className="w-4 h-4" /> Actividades Vigentes ({actividades.length})
        </button>
        <button
          onClick={() => setActiveTab("rendicion")}
          className={`pb-3 px-5 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === "rendicion"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Rendición y Liquidación a Proveedor
        </button>
      </div>

      {/* ── CONTENIDO TAB 1: ACTIVIDADES VIGENTES ── */}
      {activeTab === "actividades" && (
        <div className="space-y-4">
          {/* Barra de filtros */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por actividad o proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium"
            >
              <option value="all">Todos los Proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.razon_social || s.nombre}
                </option>
              ))}
            </select>

            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium"
            >
              <option value="all">Todos los Tipos</option>
              <option value="escala">Escala de Descuento</option>
              <option value="bonificacion">Bonificación en Producto</option>
            </select>

            <input
              type="text"
              placeholder="Ciclo (ej: 202610)"
              value={filterCiclo}
              onChange={(e) => setFilterCiclo(e.target.value)}
              className="w-36 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium"
            />
          </div>

          {/* Tabla de Actividades */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Actividad & Ciclo</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Tipo & Tramos</th>
                    <th className="py-3 px-4 text-right">Presupuesto</th>
                    <th className="py-3 px-4 text-right">Consumido</th>
                    <th className="py-3 px-4 text-center">Pacing</th>
                    <th className="py-3 px-4 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredActividades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No se encontraron actividades con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredActividades.map((act) => {
                      const pacing = act.pacing_pct || 0
                      const pacingColor =
                        pacing >= 100
                          ? "bg-rose-500"
                          : pacing >= 80
                          ? "bg-amber-500"
                          : "bg-emerald-500"

                      return (
                        <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {act.nombre}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                                {act.ciclo}
                              </span>
                              <span>• Alcance: {act.alcance}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 text-xs">
                            {act.supplier_nombre}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  act.tipo === "bonificacion"
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                }`}
                              >
                                {act.tipo === "bonificacion" ? "🎁 Bonificación" : "🏷 Escala"}
                              </span>
                            </div>
                            {act.tramos && act.tramos.length > 0 && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                                {act.tramos.map((t, i) => (
                                  <div key={i}>
                                    {act.tipo === "escala" ? (
                                      <span>Desde {t.desde_cantidad} un: <b className="text-slate-700 dark:text-slate-300">{t.porcentaje}%</b></span>
                                    ) : (
                                      <span>Cada {t.cada} un: <b className="text-slate-700 dark:text-slate-300">+{t.bonifica} gratis</b> {t.tope ? `(tope ${t.tope})` : ""}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                            {formatPYG(act.presupuesto)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {formatPYG(act.consumido)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="w-24 mx-auto">
                              <div className="flex justify-between text-[10px] font-mono mb-1 text-slate-400">
                                <span>{pacing}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full ${pacingColor} rounded-full transition-all`}
                                  style={{ width: `${Math.min(pacing, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatPYG(act.saldo)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTENIDO TAB 2: RENDICIONES Y LIQUIDACIONES ── */}
      {activeTab === "rendicion" && (
        <div className="space-y-6">
          {/* Selector de Generación de Rendición */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Generar Rendición Mensual al Proveedor
            </div>
            <p className="text-slate-500 text-xs max-w-3xl">
              Seleccione un proveedor y el ciclo comercial (AAAAMM). El sistema auditará todas las ventas confirmadas que aplicaron bonificaciones o escalas, calculará la liquidación a recuperar y permitirá generar el asiento contable formal y el informe en Excel.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  Proveedor
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium"
                >
                  <option value="">Seleccione un Proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razon_social || s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                  Ciclo Comercial
                </label>
                <input
                  type="text"
                  placeholder="AAAAMM (ej: 202610)"
                  value={selectedCiclo}
                  onChange={(e) => setSelectedCiclo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => loadPrevia(selectedSupplier, selectedCiclo)}
                  disabled={!selectedSupplier || !selectedCiclo || loadingPrevia}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {loadingPrevia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Calcular Previa
                </button>
              </div>
            </div>

            {/* Resultado de la previa */}
            {previaData && (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Descuentos Escala</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                      {formatPYG(previaData.total_descuentos)}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Valor Bonificado</span>
                    <span className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 block">
                      {formatPYG(previaData.total_bonificaciones)}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase block">Total Rendición</span>
                    <span className="text-2xl font-black text-indigo-900 dark:text-indigo-200 mt-1 block">
                      {formatPYG(previaData.total_rendicion)}
                    </span>
                    <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5 block">
                      {previaData.cantidad_aplicaciones} ítems liquidados
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Estado de Rendición</span>
                    {previaData.ya_rendida ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-center">
                        ✓ {previaData.rendicion_existente?.estado || "Cerrada"}
                      </span>
                    ) : previaData.puede_cerrar ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-center">
                        Pendiente de Cierre
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-center">
                        Sin aplicaciones
                      </span>
                    )}
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  {previaData.ya_rendida && previaData.rendicion_existente && (
                    <button
                      onClick={() =>
                        handleDownloadExcel(
                          previaData.rendicion_existente.id,
                          `Rendicion_${previaData.supplier_nombre}_${selectedCiclo}.xlsx`
                        )
                      }
                      disabled={downloadingId === previaData.rendicion_existente.id}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                    >
                      {downloadingId === previaData.rendicion_existente.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Descargar Informe Excel (XLSX)
                    </button>
                  )}

                  {previaData.puede_cerrar && (
                    <button
                      onClick={handleCerrarRendicion}
                      disabled={closingRendicion}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
                    >
                      {closingRendicion ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Cerrar Rendición Formal & Generar Asiento
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Historial de Rendiciones Cerradas */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                Historial de Rendiciones de Proveedores
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ciclo</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4 text-right">Descuentos</th>
                    <th className="py-3 px-4 text-right">Bonificaciones</th>
                    <th className="py-3 px-4 text-right">Total Rendición</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {rendiciones.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Aún no se han cerrado rendiciones comerciales.
                      </td>
                    </tr>
                  ) : (
                    rendiciones.map((rend) => (
                      <tr key={rend.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {rend.ciclo}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 text-xs">
                          {rend.supplier_nombre}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                          {formatPYG(rend.total_descuentos)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-purple-600 dark:text-purple-400">
                          {formatPYG(rend.total_bonificaciones)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs font-black text-slate-900 dark:text-white">
                          {formatPYG(rend.total_rendicion)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              rend.estado === "conciliada"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {rend.estado}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() =>
                              handleDownloadExcel(
                                rend.id,
                                `Rendicion_${rend.supplier_nombre}_${rend.ciclo}.xlsx`
                              )
                            }
                            disabled={downloadingId === rend.id}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                            title="Descargar Excel"
                          >
                            {downloadingId === rend.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
