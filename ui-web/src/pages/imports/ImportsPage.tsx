import { useState, useEffect, useRef } from "react"
import {
  BarChart3, Upload, FileSpreadsheet, History, Loader2, Download, CheckCircle, XCircle,
  RefreshCcw, Eye, Play, FileText,
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

export default function ImportsPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importación de Datos</h1>
          <p className="text-sm text-gray-500 mt-1">Subí archivos CSV para importar productos, clientes y más</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",   label: "Dashboard",       icon: BarChart3 },
            { key: "importar",    label: "Importar CSV",    icon: Upload },
            { key: "plantillas",  label: "Plantillas",       icon: FileSpreadsheet },
            { key: "historial",   label: "Historial",        icon: History },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"  && <DashboardTab />}
      {tab === "importar"   && <ImportarTab />}
      {tab === "plantillas" && <PlantillasTab />}
      {tab === "historial"  && <HistorialTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600", indigo: "bg-indigo-50 text-indigo-600",
    orange: "bg-orange-50 text-orange-600",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    success: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700",
    processing: "bg-yellow-100 text-yellow-700", pending: "bg-gray-100 text-gray-700",
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || colors.pending}`}>{s}</span>
}

function DashboardTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.imports.templates().then(() => {
      api.imports.templates().then((templates) => {
        setStats({ total_plantillas: templates.length || 0 })
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard icon={FileSpreadsheet} label="Plantillas" value={stats?.total_plantillas ?? 0} color="blue" />
      <KpiCard icon={Upload} label="Importaciones" value={0} sub="Hoy" color="green" />
      <KpiCard icon={CheckCircle} label="Exitosas" value={0} color="green" />
      <KpiCard icon={XCircle} label="Fallidas" value={0} color="red" />
    </div>
  )
}

function ImportarTab() {
  const { success, error: showError } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState(",")
  const [preview, setPreview] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setPreview(null); setUploadResult(null) }
  }

  const loadPreview = async () => {
    if (!file) return
    setPreviewLoading(true)
    try {
      const text = await file.text()
      const lines = text.split("\n").filter(Boolean)
      const headers = lines[0].split(delimiter)
      const rows = lines.slice(1, 6).map((l) => l.split(delimiter))
      setPreview({ headers, rows, total: lines.length - 1 })
    } catch (e: any) { showError("Error al previsualizar", e.message) }
    setPreviewLoading(false)
  }

  const doUpload = async () => {
    if (!file) return
    setUploadLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("delimiter", delimiter)
      const result = await api.imports.upload(formData)
      setUploadResult(result)
      success("Importación iniciada", `Registros: ${result.total_registros}`)
    } catch (e: any) { showError("Error al importar", e.message) }
    setUploadLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Archivo CSV</label>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Delimitador</label>
            <select value={delimiter} onChange={e => setDelimiter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700">
              <option value=",">Coma (,)</option>
              <option value=";">Punto y coma (;)</option>
              <option value="	">Tabulación</option>
              <option value="|">Pipe (|)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={loadPreview} disabled={!file || previewLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {previewLoading ? <Spinner /> : <Eye className="w-4 h-4" />} Previsualizar
          </button>
          <button onClick={doUpload} disabled={!file || uploadLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {uploadLoading ? <Spinner /> : <Upload className="w-4 h-4" />} Importar
          </button>
        </div>
      </div>

      {preview && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Vista Previa ({preview.total} filas totales)</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                {preview.headers.map((h: string, i: number) => (
                  <th key={i} className="px-3 py-2 text-left font-medium text-gray-500">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row: string[], ri: number) => (
                <tr key={ri} className="border-b last:border-0">
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} className="px-3 py-2 text-gray-700">{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadResult && (
        <div className={`rounded-xl border p-4 ${uploadResult.errores ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2">
            {uploadResult.errores ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
            <span className="text-sm font-medium">{uploadResult.errores ? "Importación completada" : "Importación con errores"}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {uploadResult.exitosos ?? 0} exitosos, {uploadResult.errores ?? 0} errores
          </p>
        </div>
      )}
    </div>
  )
}

function PlantillasTab() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { error: showError } = useToast()

  useEffect(() => {
    api.imports.templates().then(setTemplates).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const download = (t: any) => {
    try {
      const cols = t.columnas || ["nombre", "sku", "precio", "stock"]
      const csv = cols.join(",") + "\n"
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `${t.tipo || t.nombre || "plantilla"}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { showError("Error al descargar", e.message) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">
      {templates.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin plantillas disponibles</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((t: any) => (
              <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t.nombre || t.tipo}</p>
                  <p className="text-xs text-gray-500">{t.columnas?.length || 0} columnas</p>
                </div>
                <button onClick={() => download(t)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  <Download className="w-4 h-4" /> CSV
                </button>
              </div>
            ))}
          </div>
      }

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Plantillas Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { nombre: "Productos", columnas: ["sku", "nombre", "categoria", "precio_venta", "costo_promedio", "stock_minimo", "unidad_medida", "iva_tasa"] },
            { nombre: "Clientes", columnas: ["nombre", "email", "telefono", "ruc", "razon_social", "direccion", "ciudad", "tipo_persona"] },
            { nombre: "Stock", columnas: ["sku", "warehouse_codigo", "cantidad", "lote", "fecha_vencimiento", "costo_unitario"] },
          ].map((t) => (
            <button key={t.nombre} onClick={() => download(t)}
              className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl text-sm hover:bg-gray-100">
              <span className="font-medium text-gray-700">{t.nombre}</span>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function HistorialTab() {
  const [imports, setImports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { error: showError } = useToast()

  const load = () => {
    setLoading(true)
    api.imports.templates().then(() => setImports([])).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const processImport = async (id: string) => {
    try {
      await api.imports.process(id)
      load()
    } catch (e: any) { showError("Error al procesar", e.message) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div>
      {imports.length === 0
        ? <p className="text-center text-gray-500 py-8">Sin importaciones registradas</p>
        : <div className="space-y-2">
            {imports.map((imp: any) => (
              <div key={imp.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Importación #{imp.id?.slice(0, 8)}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <StatusBadge s={imp.estado || "pending"} />
                        <span>{imp.total_registros || 0} registros</span>
                        {imp.created_at && <span>{new Date(imp.created_at).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {imp.exitosos != null && <span className="text-xs text-green-600">{imp.exitosos} ok</span>}
                    {imp.errores != null && <span className="text-xs text-red-600">{imp.errores} err</span>}
                    {imp.estado === "pending" && (
                      <button onClick={() => processImport(imp.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                        <Play className="w-3 h-3" /> Procesar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
