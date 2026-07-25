import { useState, useEffect, useCallback } from "react"
import { Search, Pill, Thermometer, AlertTriangle, FileText, ArrowRightLeft, Beaker, FileSpreadsheet, Calendar } from "lucide-react"
import { pharmaApi } from "../../api/pharma"
import { useToast } from "../../context/ToastContext"
import type { PharmaActiveIngredient, PharmaMedication } from "../../api/pharma"

function DinalfaReportTab() {
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { error: showError } = useToast()

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pharmaApi.controlledLogs.dinalfaReport(mes, anio)
      setData(res)
    } catch {
      showError("Error al generar reporte DINALFA")
    } finally { setLoading(false) }
  }, [mes, anio, showError])

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"]

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select className="input-field" value={mes} onChange={e => setMes(Number(e.target.value))}>
              {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))}
            className="input-field w-24" min={2020} max={2030} />
          <button onClick={fetchReport} disabled={loading}
            className="btn-primary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {loading ? "Generando..." : "Generar Reporte"}
          </button>
        </div>
      </div>

      {data.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Reporte DINALFA — {meses[mes - 1]} {anio} ({data.length} registros)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Medicamento</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Concentración</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Categoría</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Movimiento</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Cantidad</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Paciente</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">CI</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Receta</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Médico</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-3 font-medium">{r.marca_comercial}</td>
                    <td className="py-2 px-3 text-gray-500">{r.concentracion}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.categoria_controlado === "lista_1" ? "bg-red-100 text-red-700" : r.categoria_controlado === "lista_2" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>
                        {r.categoria_controlado}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.tipo_movimiento === "salida" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                        {r.tipo_movimiento}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{r.cantidad}</td>
                    <td className="py-2 px-3">{r.patient_nombre || "—"}</td>
                    <td className="py-2 px-3 font-mono text-xs">{r.patient_ci || "—"}</td>
                    <td className="py-2 px-3 font-mono text-xs">{r.receta_numero || "—"}</td>
                    <td className="py-2 px-3 text-xs">{r.receta_medico_nombre || "—"}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.length === 0 && !loading && (
        <div className="card p-8 text-center text-gray-400">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Seleccioná un mes/año y generá el reporte</p>
        </div>
      )}
    </div>
  )
}

export default function PharmaPage() {
  const [tab, setTab] = useState<"search" | "dinalfa">("search")
  const [search, setSearch] = useState("")
  const [activeIngredient, setActiveIngredient] = useState<PharmaActiveIngredient | null>(null)
  const [medications, setMedications] = useState<PharmaMedication[]>([])
  const [selectedMed, setSelectedMed] = useState<PharmaMedication | null>(null)
  const [equivalents, setEquivalents] = useState<PharmaMedication[]>([])
  const [loading, setLoading] = useState(false)
  const [ingredients, setIngredients] = useState<PharmaActiveIngredient[]>([])
  const { error: showError, warning: showWarning } = useToast()

  const fetchIngredients = useCallback(async () => {
    try {
      const data = await pharmaApi.activeIngredients.list()
      setIngredients(data)
    } catch {
      showError("Error al cargar principios activos")
    }
  }, [showError])

  useEffect(() => {
    fetchIngredients()
  }, [fetchIngredients])

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    try {
      const found = ingredients.find((i) =>
        i.nombre.toLowerCase().includes(search.toLowerCase()) ||
        i.nombre_comun?.toLowerCase().includes(search.toLowerCase())
      )
      if (found) {
        setActiveIngredient(found)
        const meds = await pharmaApi.medications.byActiveIngredient(found.id)
        setMedications(meds)
        setSelectedMed(null)
        setEquivalents([])
      } else {
        showWarning("Principio activo no encontrado")
        setActiveIngredient(null)
        setMedications([])
      }
    } catch {
      showError("Error en la búsqueda")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMed = async (med: PharmaMedication) => {
    setSelectedMed(med)
    try {
      const eqs = await pharmaApi.medications.equivalents(med.id)
      setEquivalents(eqs)
    } catch {
      setEquivalents([])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Farmacia</h1>
          <p className="text-sm text-gray-500">Búsqueda por principio activo y reportes DINALFA</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-1">
        <button onClick={() => setTab("search")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === "search" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}>
          <Search className="w-4 h-4" />Búsqueda
        </button>
        <button onClick={() => setTab("dinalfa")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === "dinalfa" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-gray-500 hover:text-gray-700"}`}>
          <FileText className="w-4 h-4" />Reportes DINALFA
        </button>
      </div>

      {tab === "search" ? (
        <>
          <div className="card p-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Buscar por principio activo (ej: Paracetamol, Ibuprofeno...)"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>

          {activeIngredient && (
            <div className="card p-5">
              <div className="flex items-start gap-3 mb-4">
                <Beaker className="w-6 h-6 text-primary" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{activeIngredient.nombre}</h3>
                  {activeIngredient.nombre_comun && (
                    <p className="text-sm text-gray-500">DCI: {activeIngredient.nombre_comun}</p>
                  )}
                  {activeIngredient.categoria && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{activeIngredient.categoria}</span>
                  )}
                </div>
              </div>
              {activeIngredient.requiere_receta && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg text-sm mb-4">
                  <FileText className="w-4 h-4" />
                  <span>Requiere receta médica</span>
                </div>
              )}
              {activeIngredient.embarazo_categoria && (
                <div className="text-xs text-gray-500 mb-4">
                  Categoría embarazo: <span className="font-medium">{activeIngredient.embarazo_categoria}</span>
                </div>
              )}
            </div>
          )}

          {medications.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                Medicamentos ({medications.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {medications.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => handleSelectMed(med)}
                    className={`card p-4 text-left transition-all hover:shadow-md ${selectedMed?.id === med.id ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{med.marca_comercial || "Genérico"}</h4>
                      {med.es_generico && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Genérico</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{med.concentracion} - {med.forma_farmaceutica}</p>
                    <div className="flex flex-wrap gap-1">
                      {med.es_controlado && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Controlado</span>
                      )}
                      {med.requiere_cadena_frio && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Thermometer className="w-3 h-3" /> Frío
                        </span>
                      )}
                      {med.necesita_autorizacion_obra_social && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Pre-autorización</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedMed && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Sustitutos / Equivalentes
              </h3>
              {equivalents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {equivalents.map((eq) => (
                    <div key={eq.id} className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{eq.marca_comercial || "Genérico"}</span>
                        {eq.es_generico && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Genérico</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{eq.concentracion} - {eq.laboratorio}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay equivalentes registrados para este medicamento.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <DinalfaReportTab />
      )}
    </div>
  )
}
