import { useState, useEffect } from "react"
import { FileText, RefreshCw, Search, X, Loader2, CheckCircle, XCircle, AlertTriangle, Clock, QrCode, ExternalLink, Plus } from "lucide-react"
import { api, type SifenResponse, type SifenTimbrado, type Sale } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Tab = "responses" | "timbrados" | "cdc"

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  aceptado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
  enviado: "bg-blue-100 text-blue-700",
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
        toast.success("SIFEN", "Reenviado correctamente")
      } else {
        toast.error("SIFEN", result.error || "Error al reenviar")
      }
      loadResponses()
    } catch { toast.error("Error", "No se pudo reenviar") }
    finally { setRetrying(null) }
  }

  const stats = {
    total: responses.length,
    pendientes: responses.filter((r) => r.estado === "pendiente" || r.estado === "enviado").length,
    aceptados: responses.filter((r) => r.estado === "aceptado").length,
    rechazados: responses.filter((r) => r.estado === "rechazado" || r.estado === "error").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SIFEN — Facturación Electrónica</h1>
          <p className="text-sm text-gray-500">SET Paraguay — E-Kuatia</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("timbrados")} className={`px-3 py-1.5 rounded text-sm ${tab === "timbrados" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700"}`}>Timbrados</button>
          <button onClick={() => setTab("cdc")} className={`px-3 py-1.5 rounded text-sm ${tab === "cdc" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700"}`}>Consultar CDC</button>
          <button onClick={() => setTab("responses")} className={`px-3 py-1.5 rounded text-sm ${tab === "responses" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700"}`}>Respuestas</button>
        </div>
      </div>

      {tab === "responses" && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.pendientes}</p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.aceptados}</p>
              <p className="text-xs text-gray-500">Aceptados</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rechazados}</p>
              <p className="text-xs text-gray-500">Rechazados</p>
            </div>
          </div>

          <div className="flex gap-3">
            <select className="input-field w-44" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aceptado">Aceptado</option>
              <option value="rechazado">Rechazado</option>
              <option value="error">Error</option>
            </select>
            <button onClick={loadResponses} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : responses.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm">Sin respuestas SIFEN</p>
              </div>
            ) : responses.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColors[r.estado || ""] || "bg-gray-100"}`}>
                      {r.estado || "desconocido"}
                    </span>
                    <div>
                      <p className="text-sm font-mono text-gray-900 dark:text-white">
                        {r.cdc ? r.cdc.slice(0, 20) + "..." : "Sin CDC"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.fecha_envio ? new Date(r.fecha_envio).toLocaleString("es-PY") : ""}
                        {r.sale_id && <span className="ml-2">Sale: {r.sale_id.slice(0, 8)}...</span>}
                      </p>
                      {r.mensaje_error && <p className="text-xs text-red-500 mt-1">{r.mensaje_error}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelected(r)} className="btn-ghost p-2" title="Ver detalle">
                      <Search className="w-4 h-4" />
                    </button>
                    {r.estado === "rechazado" || r.estado === "error" ? (
                      <button onClick={() => handleRetry(r)} disabled={retrying === r.sale_id}
                        className="btn-ghost p-2 text-amber-600 hover:text-amber-800" title="Reintentar">
                        {retrying === r.sale_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    ) : null}
                    {r.cdc && (
                      <button onClick={() => window.open(`/api/v1/sifen/qr/${r.cdc}`, "_blank")}
                        className="btn-ghost p-2" title="Ver QR">
                        <QrCode className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Modal */}
          {selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Detalle SIFEN</h3>
                  <button onClick={() => setSelected(null)} className="btn-ghost"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs">{selected.id}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Sale ID</span><span className="font-mono text-xs">{selected.sale_id}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">CDC</span><span className="font-mono text-xs">{selected.cdc || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Estado</span><span>{selected.estado}</span></div>
                  {selected.fecha_envio && <div className="flex justify-between"><span className="text-gray-500">Envío</span><span>{new Date(selected.fecha_envio).toLocaleString("es-PY")}</span></div>}
                  {selected.fecha_respuesta && <div className="flex justify-between"><span className="text-gray-500">Respuesta</span><span>{new Date(selected.fecha_respuesta).toLocaleString("es-PY")}</span></div>}
                  {selected.codigo_error && <div className="flex justify-between"><span className="text-gray-500">Código error</span><span className="text-red-500">{selected.codigo_error}</span></div>}
                  {selected.mensaje_error && <div><span className="text-gray-500">Mensaje</span><p className="text-red-500 mt-1">{selected.mensaje_error}</p></div>}
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setSelected(null)} className="btn-outline flex-1">Cerrar</button>
                  {(selected.estado === "rechazado" || selected.estado === "error") && selected.sale_id && (
                    <button onClick={() => { handleRetry(selected); setSelected(null) }} className="btn-primary flex-1">
                      Reintentar envío
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "timbrados" && <TimbradosTab />}
      {tab === "cdc" && <CdcTab />}
    </div>
  )
}

function TimbradosTab() {
  const [timbrados, setTimbrados] = useState<SifenTimbrado[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.sifen.timbrados.list().then(setTimbrados).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{timbrados.length} timbrados registrados</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" />Nuevo Timbrado
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : timbrados.length === 0 ? (
        <div className="text-center py-8 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-2" /><p className="text-sm">Sin timbrados</p></div>
      ) : (
        <div className="space-y-2">
          {timbrados.map((t) => (
            <div key={t.id} className="card p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">Timbrado N° {t.numero}</p>
                  <p className="text-xs text-gray-500">
                    {t.fecha_inicio && new Date(t.fecha_inicio).toLocaleDateString()} → {t.fecha_fin && new Date(t.fecha_fin).toLocaleDateString()}
                    {t.rango_desde && t.rango_hasta && ` | N° ${t.rango_desde} - ${t.rango_hasta}`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${t.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {t.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTimbradoModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); api.sifen.timbrados.list().then(setTimbrados) }} />
      )}
    </div>
  )
}

function CreateTimbradoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    numero: "", fecha_inicio: "", fecha_fin: "", rango_desde: 1, rango_hasta: 1000, tipo_comprobante: "ticket",
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit() {
    if (!form.numero || !form.fecha_inicio || !form.fecha_fin) { toast.error("Error", "Completá todos los campos"); return }
    setSaving(true)
    try {
      await api.sifen.timbrados.create({
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
          <h3 className="text-lg font-bold">Nuevo Timbrado</h3>
          <button onClick={onClose} className="btn-ghost"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <input className="input-field w-full" placeholder="Número de timbrado" value={form.numero}
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
            <option value="ticket">Ticket</option>
            <option value="factura">Factura</option>
            <option value="nota_credito">Nota de crédito</option>
            <option value="nota_debito">Nota de débito</option>
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSearch() {
    if (!cdc || cdc.length < 44) { setError("El CDC debe tener 44 caracteres"); return }
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const data = await api.sifen.check(cdc)
      setResult(data)
    } catch (e: any) { setError(e.message || "Error al consultar CDC") }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="card p-6">
        <h3 className="font-bold mb-2">Consultar CDC</h3>
        <p className="text-xs text-gray-500 mb-4">Ingresá el Código de Control de 44 caracteres</p>
        <div className="flex gap-3">
          <input className="input-field flex-1 font-mono" placeholder="CDC de 44 caracteres" maxLength={44}
            value={cdc} onChange={(e) => setCdc(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      {result && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            {result.valido ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="font-bold">{result.valido ? "CDC Válido" : "CDC Inválido"}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Estado</span><span>{result.estado || "—"}</span></div>
            {result.ruc_emisor && <div className="flex justify-between"><span className="text-gray-500">RUC Emisor</span><span>{result.ruc_emisor}</span></div>}
            {result.total && <div className="flex justify-between"><span className="text-gray-500">Total</span><span>{formatPYG(parseFloat(result.total))}</span></div>}
            {result.fecha_emision && <div className="flex justify-between"><span className="text-gray-500">Emisión</span><span>{new Date(result.fecha_emision).toLocaleString("es-PY")}</span></div>}
          </div>
          {result.valido && (
            <div className="mt-4 flex gap-2">
              <button onClick={() => window.open(`/api/v1/sifen/qr/${cdc}`, "_blank")}
                className="btn-outline text-sm flex items-center gap-1">
                <QrCode className="w-4 h-4" />Ver QR
              </button>
              <button onClick={() => window.open(`https://ekuatia.set.gov.py/consulta?cdc=${cdc}`, "_blank")}
                className="btn-outline text-sm flex items-center gap-1">
                <ExternalLink className="w-4 h-4" />SET
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}