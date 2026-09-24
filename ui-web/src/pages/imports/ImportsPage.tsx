import { useState, useRef } from "react"
import { Upload, FileSpreadsheet, Download, Eye, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react"
import { useToast } from "../../context/ToastContext"

const TIPOS = [
  { key: "products", label: "Productos" },
  { key: "customers", label: "Clientes" },
]

function apiUrl(path: string) {
  return `${(import.meta as any).env.VITE_API_URL || "/api"}${path}`
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
}

export default function ImportsPage() {
  const toast = useToast()
  const [tipo, setTipo] = useState("products")
  const [file, setFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState(";")
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ total_rows: number; success: number; errors: number; warnings: number; details: any[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setPreview(null); setUploadResult(null) }
  }

  const downloadTemplate = async () => {
    try {
      const res = await fetch(apiUrl(`/v1/imports/template/${tipo}`))
      const csv = await res.text()
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `plantilla_${tipo}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Error", "No se pudo descargar la plantilla")
    }
  }

  const loadPreview = async () => {
    if (!file) return
    setPreviewLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("delimiter", delimiter)
      const res = await fetch(apiUrl("/v1/imports/preview"), { method: "POST", headers: authHeaders(), body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al previsualizar")
      setPreview(data)
    } catch (e: any) {
      toast.error("Error al previsualizar", e.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const doUpload = async () => {
    if (!file) return
    setUploadLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("delimiter", delimiter)
      const res = await fetch(apiUrl(`/v1/imports/${tipo}`), { method: "POST", headers: authHeaders(), body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al importar")
      setUploadResult(data)
      if (data.errors === 0) toast.success("Importación completada", `${data.success} de ${data.total_rows} registros importados`)
      else toast.error("Importación con errores", `${data.success} exitosos, ${data.errors} con error`)
    } catch (e: any) {
      toast.error("Error al importar", e.message)
    } finally {
      setUploadLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          Importación de datos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Subí un CSV real de productos o clientes.</p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-max">
          {TIPOS.map(t => (
            <button key={t.key} onClick={() => { setTipo(t.key); setFile(null); setPreview(null); setUploadResult(null) }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tipo === t.key ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <button onClick={downloadTemplate} className="btn-outline text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Descargar plantilla de {TIPOS.find(t => t.key === tipo)?.label.toLowerCase()}</button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="input-label">Archivo CSV</label>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="input-field" />
          </div>
          <div>
            <label className="input-label">Delimitador</label>
            <select value={delimiter} onChange={e => setDelimiter(e.target.value)} className="input-field">
              <option value=";">Punto y coma (;)</option>
              <option value=",">Coma (,)</option>
              <option value="|">Pipe (|)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={loadPreview} disabled={!file || previewLoading} className="btn-outline flex items-center gap-1.5 disabled:opacity-50">
            {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Previsualizar
          </button>
          <button onClick={doUpload} disabled={!file || uploadLoading} className="btn-primary flex items-center gap-1.5 disabled:opacity-50">
            {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importar
          </button>
        </div>
      </div>

      {preview && (
        <div className="card p-5 overflow-x-auto">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Vista previa</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                {preview.headers.map((h, i) => <th key={i} className="table-cell">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, ri) => (
                <tr key={ri} className="table-row">
                  {preview.headers.map((h, ci) => <td key={ci} className="table-td">{row[h]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadResult && (
        <div className={`card p-5 border ${uploadResult.errors === 0 ? "border-green-200" : "border-amber-300"}`}>
          <div className="flex items-center gap-2 mb-2">
            {uploadResult.errors === 0 ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
            <span className="text-sm font-bold">{uploadResult.success} de {uploadResult.total_rows} registros importados</span>
          </div>
          {uploadResult.errors > 0 && (
            <div className="space-y-1 mt-3 max-h-[200px] overflow-y-auto">
              {uploadResult.details.filter((d: any) => d.status === "error" || d.estado === "error").map((d: any, i: number) => (
                <div key={i} className="text-xs text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> Fila {d.row ?? d.fila}: {d.message ?? d.mensaje}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
