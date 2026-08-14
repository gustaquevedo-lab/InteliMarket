import { useState, useEffect } from "react"
import {
  FileText, RefreshCw, Search, X, Loader2, CheckCircle, XCircle, AlertTriangle, Clock,
  QrCode, ExternalLink, Plus, Shield, Copy, Key, Upload, FileCheck, Check
} from "lucide-react"
import { api, type SifenResponse, type SifenTimbrado } from "../api"
import { useToast } from "../context/ToastContext"
import { formatPYG } from "../utils/format"

type Tab = "responses" | "timbrados" | "config" | "cdc"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  aprobado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  authorized_sandbox: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  aceptado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  enviado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
}

export default function SifenPage() {
  const [tab, setTab] = useState<Tab>("responses")
  const [responses, setResponses] = useState<SifenResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFilter, setEstadoFilter] = useState("")
  const [selected, setSelected] = useState<SifenResponse | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const toast = useToast()

  async function loadResponses() {
    setLoading(true)
    try {
      const data = await api.sifen.responses.list({ estado: estadoFilter || undefined })
      setResponses(data || [])
    } catch { setResponses([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadResponses() }, [estadoFilter])

  async function handleRetry(response: SifenResponse) {
    if (!response.sale_id) { toast.error("Error", "No hay venta asociada"); return }
    setRetrying(response.sale_id)
    try {
      const result = await api.sifen.retry(response.sale_id)
      if (result.success) {
        toast.success("SIFEN InteliFact", "Comprobante procesado correctamente")
      } else {
        toast.error("SIFEN", result.error || "Error al procesar comprobante")
      }
      loadResponses()
    } catch { toast.error("Error", "No se pudo procesar el comprobante") }
    finally { setRetrying(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-blue-900/90 to-indigo-900 text-white p-6 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black">Facturación Electrónica (SIFEN / e-Kuatia)</h1>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> InteliFact Engine
            </span>
          </div>
          <p className="text-blue-200 text-sm">
            Gestión de timbrados, certificados .p12, firmas digitales y envíos oficiales a la SET
          </p>
        </div>
        <button onClick={loadResponses} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2">
        <button
          onClick={() => setTab("responses")}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
            tab === "responses" ? "border-primary text-primary font-bold" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileText className="w-4 h-4" /> Comprobantes y Envíos
        </button>
        <button
          onClick={() => setTab("timbrados")}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
            tab === "timbrados" ? "border-primary text-primary font-bold" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Shield className="w-4 h-4" /> Timbrados SET
        </button>
        <button
          onClick={() => setTab("config")}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
            tab === "config" ? "border-primary text-primary font-bold" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Key className="w-4 h-4" /> Certificado P12 & Config
        </button>
        <button
          onClick={() => setTab("cdc")}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
            tab === "cdc" ? "border-primary text-primary font-bold" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <QrCode className="w-4 h-4" /> Consultar CDC / QR
        </button>
      </div>

      {tab === "responses" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="input-field max-w-xs text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="aprobado">Aprobado / Sandbox</option>
              <option value="pendiente">Pendiente</option>
              <option value="rechazado">Rechazado</option>
              <option value="error">Error</option>
            </select>
            <span className="text-xs text-gray-500">{responses.length} comprobantes procesados</span>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800 border-b text-xs font-semibold text-gray-500">
                  <th className="p-3">CDC</th>
                  <th className="p-3">Estado SIFEN</th>
                  <th className="p-3">Fecha Envío</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando comprobantes...
                    </td>
                  </tr>
                ) : responses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400">
                      No hay registros de comprobantes electrónicos en SIFEN.
                    </td>
                  </tr>
                ) : (
                  responses.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {r.cdc || "N/A"}
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${estadoColors[r.estado || "pendiente"] || "bg-gray-100 text-gray-600"}`}>
                          {r.estado === "authorized_sandbox" ? "Aprobado (Sandbox InteliFact)" : r.estado}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-500">
                        {r.fecha_envio ? new Date(r.fecha_envio).toLocaleString("es-PY") : "-"}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setSelected(r)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-xs font-medium"
                        >
                          Ver XML / Detalle
                        </button>
                        {r.sale_id && (
                          <button
                            onClick={() => handleRetry(r)}
                            disabled={retrying === r.sale_id}
                            className="px-2.5 py-1 bg-primary text-white rounded text-xs font-medium hover:bg-primary-dark disabled:opacity-50"
                          >
                            {retrying === r.sale_id ? "Enviando..." : "Firmar / Reenviar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "timbrados" && <TimbradosTab />}
      {tab === "config" && <ConfigTab />}
      {tab === "cdc" && <CdcTab />}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-3xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg">Detalle Comprobante SIFEN</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400">CDC</label>
              <p className="font-mono text-sm break-all bg-gray-100 dark:bg-slate-900 p-2 rounded-lg">{selected.cdc}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400">XML Enviado por InteliFact</label>
              <pre className="font-mono text-xs bg-slate-950 text-green-400 p-4 rounded-xl max-h-60 overflow-y-auto whitespace-pre-wrap">
                {selected.xml_sent || selected.xml_enviado || "No disponible"}
              </pre>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400">Respuesta de la SET / e-Kuatia</label>
              <pre className="font-mono text-xs bg-slate-900 text-blue-300 p-4 rounded-xl max-h-40 overflow-y-auto whitespace-pre-wrap">
                {selected.xml_respuesta || "No disponible"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TimbradosTab() {
  const [timbrados, setTimbrados] = useState<SifenTimbrado[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function loadTimbrados() {
    setLoading(true)
    try {
      const data = await api.fiscal.timbrados.list(COMPANY_ID)
      setTimbrados(data || [])
    } catch { setTimbrados([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTimbrados() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Timbrados Activos de la SET</h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo Timbrado
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando timbrados...
        </div>
      ) : timbrados.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No hay timbrados registrados.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {timbrados.map((t: any) => (
            <div key={t.id} className="card p-5 border-l-4 border-l-primary space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold uppercase text-primary tracking-wider">{t.tipo_comprobante || "factura"}</span>
                  <h4 className="text-xl font-black font-mono">N° {t.numero}</h4>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${t.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {t.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Vigencia: {t.fecha_inicio} al {t.fecha_fin}</p>
                <p>Rango autorizado: {t.rango_desde} - {t.rango_hasta}</p>
              </div>
              {t.disponibles !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Disponibles: {t.disponibles}</span>
                    <span>Usados: {t.usados}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${Math.min(100, (t.usados / (t.rango_hasta - t.rango_desde + 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTimbradoModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadTimbrados() }} />
      )}
    </div>
  )
}

function ConfigTab() {
  const [certBase64, setCertBase64] = useState("")
  const [certPassword, setCertPassword] = useState("")
  const [sifenEnv, setSifenEnv] = useState("test")
  const [modoEmision, setModoEmision] = useState("sifen")
  const [puntoEmision, setPuntoEmision] = useState("001")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [certFileName, setCertFileName] = useState("")
  const toast = useToast()

  useEffect(() => {
    async function loadConfig() {
      setLoading(true)
      try {
        const config = await api.fiscal.config.get(COMPANY_ID)
        if (config) {
          setModoEmision(config.modo_emision || "sifen")
          setPuntoEmision(config.punto_emision || "001")
          setSifenEnv((config as any).sifen_env || "test")
          if ((config as any).cert_p12_base64) {
            setCertBase64((config as any).cert_p12_base64)
            setCertFileName("certificado_cargado.p12")
          }
          if ((config as any).cert_password) {
            setCertPassword((config as any).cert_password)
          }
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1] || result
      setCertBase64(base64)
      toast.success("Certificado Seleccionado", file.name)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.fiscal.config.upsert(COMPANY_ID, {
        company_id: COMPANY_ID,
        modo_emision: modoEmision,
        punto_emision: puntoEmision,
        cert_p12_base64: certBase64 || null,
        cert_password: certPassword || null,
        sifen_env: sifenEnv,
      })
      toast.success("Configuración Guardada", "Firma digital y ambiente SIFEN actualizados")
    } catch {
      toast.error("Error", "No se pudo guardar la configuración fiscal")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Carga de configuración...</div>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card p-6 space-y-6">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2"><Key className="w-5 h-5 text-primary" /> Certificado Digital .P12 (Firma Electrónica)</h3>
          <p className="text-xs text-gray-500 mt-1">Cargá tu firma digital PKCS12 (.p12) emitida por una entidad certificadora autorizada de Paraguay (CODE10, E-Sign, etc.)</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Archivo Certificado .p12</label>
            <div className="flex items-center gap-3">
              <label className="btn-outline cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" /> Seleccionar Archivo .p12
                <input type="file" accept=".p12,.pfx" onChange={handleFileChange} className="hidden" />
              </label>
              {certFileName && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <FileCheck className="w-4 h-4" /> {certFileName}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Contraseña del Certificado .p12</label>
            <input
              type="password"
              className="input-field w-full max-w-md font-mono text-sm"
              placeholder="••••••••••••"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
            />
          </div>
        </div>

        <hr />

        <div>
          <h3 className="font-bold text-lg mb-4">Ambiente y Punto de Emisión SIFEN</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Ambiente SET e-Kuatia</label>
              <select className="input-field w-full" value={sifenEnv} onChange={(e) => setSifenEnv(e.target.value)}>
                <option value="test">Test / Sandbox (Homologación SET)</option>
                <option value="production">Producción Oficial SET</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Punto de Emisión</label>
              <input className="input-field w-full font-mono" value={puntoEmision} onChange={(e) => setPuntoEmision(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar Configuración Fiscal
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateTimbradoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    numero: "", fecha_inicio: "", fecha_fin: "", rango_desde: 1, rango_hasta: 1000, tipo_comprobante: "factura",
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.numero || !form.fecha_inicio || !form.fecha_fin) { toast.error("Error", "Completá todos los campos"); return }
    setSaving(true)
    try {
      await api.fiscal.timbrados.create({
        company_id: COMPANY_ID,
        numero: form.numero,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        rango_desde: form.rango_desde,
        rango_hasta: form.rango_hasta,
        tipo_comprobante: form.tipo_comprobante,
      })
      toast.success("Timbrado registrado", "Se agregó correctamente")
      onCreated()
    } catch { toast.error("Error", "No se pudo crear el timbrado") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Nuevo Timbrado SET</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <input className="input-field w-full font-mono" placeholder="Número de timbrado" value={form.numero}
            onChange={(e) => setForm({ ...form, numero: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Fecha inicio</label>
              <input className="input-field w-full" type="date" value={form.fecha_inicio}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha fin</label>
              <input className="input-field w-full" type="date" value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">N° desde</label>
              <input className="input-field w-full" type="number" value={form.rango_desde}
                onChange={(e) => setForm({ ...form, rango_desde: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">N° hasta</label>
              <input className="input-field w-full" type="number" value={form.rango_hasta}
                onChange={(e) => setForm({ ...form, rango_hasta: parseInt(e.target.value) || 1000 })} />
            </div>
          </div>
          <select className="input-field w-full" value={form.tipo_comprobante}
            onChange={(e) => setForm({ ...form, tipo_comprobante: e.target.value })}>
            <option value="factura">Factura</option>
            <option value="nota_credito">Nota de crédito</option>
            <option value="nota_debito">Nota de débito</option>
            <option value="ticket">Ticket</option>
          </select>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? "Guardando..." : "Registrar Timbrado"}
          </button>
        </div>
      </div>
    </div>
  )
}

function CdcTab() {
  const [cdc, setCdc] = useState("")
  const [result, setResult] = useState<any>(null)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const toast = useToast()

  async function handleSearch() {
    if (!cdc || cdc.length < 44) { setError("El CDC debe tener 44 caracteres"); return }
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const qrResp = await api.sifen.qr(cdc)
      setQrDataUrl(qrResp.qr_data_url ?? "")
      const data = await api.sifen.check(cdc)
      setResult(data)
    } catch (e: any) { setError(e.message || "Error al consultar CDC") }
    finally { setLoading(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 card p-6">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Search className="w-4 h-4 text-primary" />Consultar CDC SIFEN</h3>
        <div className="flex gap-3">
          <input className="input-field flex-1 font-mono text-sm" placeholder="CDC de 44 caracteres"
            value={cdc} maxLength={44}
            onChange={(e) => setCdc(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
          <button onClick={() => { navigator.clipboard.writeText(cdc); toast.success("Copiado", "CDC copiado") }} className="btn-outline" title="Copiar"><Copy className="w-4 h-4" /></button>
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Consultar"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {result && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Estado:</span><span className="ml-2 font-bold text-green-700">{result.estado}</span></div>
              {result.ruc_emisor && <div><span className="text-gray-500">RUC:</span><span className="ml-2 font-mono">{result.ruc_emisor}</span></div>}
              {result.total && <div><span className="text-gray-500">Total:</span><span className="ml-2 font-mono">{formatPYG(parseFloat(result.total))}</span></div>}
              {result.fecha_emision && <div><span className="text-gray-500">Emisión:</span><span className="ml-2">{new Date(result.fecha_emision).toLocaleString("es-PY")}</span></div>}
            </div>
          </div>
        )}
      </div>
      <div className="card p-6 flex flex-col items-center justify-center">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" />QR e-Kuatia</h3>
        {qrDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img src={qrDataUrl} alt="QR" className="w-48 h-48 rounded-xl border" />
            <p className="text-xs text-gray-400 font-mono truncate max-w-48">{cdc}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <QrCode className="w-12 h-12 opacity-30" />
            <p className="text-xs">Ingresá un CDC para generar el QR</p>
          </div>
        )}
      </div>
    </div>
  )
}
