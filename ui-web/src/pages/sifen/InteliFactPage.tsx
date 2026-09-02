import { useState, useEffect, useCallback } from "react"
import { FileSignature, Loader2, Save, AlertTriangle, RefreshCcw, Radio } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

const EMPTY = {
  enabled: false,
  ruc: "", dv: "", razon_social: "", nombre_fantasia: "", actividad_economica: "",
  direccion: "", ciudad: "", departamento: "", email: "", telefono: "",
  timbrado: "", timbrado_inicio: "", codigo_establecimiento: "", codigo_punto_expedicion: "",
  cert_p12_base64: "", cert_password: "", ambiente: "test", service_base_url: "",
}

export default function InteliFactPage() {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [certCargado, setCertCargado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [telemetry, setTelemetry] = useState<{ disponible: boolean; detalle?: any; error?: string } | null>(null)
  const [checkingTelemetry, setCheckingTelemetry] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await api.intelifact.getConfig()
      if (cfg) {
        setForm({ ...EMPTY, ...cfg, cert_p12_base64: "", cert_password: "" })
        setCertCargado(!!cfg.cert_cargado)
      }
    } catch (e: any) {
      toast.error("Error", "No se pudo cargar la configuración de InteliFact.")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const checkTelemetry = async () => {
    setCheckingTelemetry(true)
    try {
      const res = await api.intelifact.telemetryStatus()
      setTelemetry(res)
    } finally {
      setCheckingTelemetry(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.intelifact.updateConfig(form)
      toast.success("Guardado", "Configuración de InteliFact actualizada.")
      load()
    } catch (e: any) {
      toast.error("Error", "No se pudo guardar la configuración.")
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof EMPTY, label: string, placeholder = "") => (
    <div>
      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">{label}</label>
      <input
        type="text"
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-xs outline-none focus:border-indigo-500"
      />
    </div>
  )

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
          <FileSignature className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-gray-900 dark:text-white">Facturación Electrónica (InteliFact)</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">Próximamente</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Config lista para el día que se migre de Autoimpresor a facturación electrónica real -- todavía no activa</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Hoy el negocio factura como <b>Autoimpresor</b> (ver pestaña "Timbrados & Puntos de Emisión") -- esta pantalla queda lista para cuando corresponda migrar a facturación electrónica, sin afectar las ventas reales mientras tanto.</span>
      </div>

      <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">Datos del Emisor</h2>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4" />
            Habilitado
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {field("ruc", "RUC", "80150377")}
          {field("dv", "DV", "9")}
          {field("razon_social", "Razón Social")}
          {field("nombre_fantasia", "Nombre Fantasía")}
          {field("actividad_economica", "Actividad Económica")}
          {field("direccion", "Dirección")}
          {field("ciudad", "Ciudad")}
          {field("departamento", "Departamento")}
          {field("email", "Email de Facturación")}
          {field("telefono", "Teléfono")}
        </div>

        <h3 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase pt-2 border-t border-gray-100 dark:border-slate-800">Timbrado Electrónico</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {field("timbrado", "N.º Timbrado")}
          {field("timbrado_inicio", "Inicio Vigencia", "YYYY-MM-DD")}
          {field("codigo_establecimiento", "Cód. Establecimiento", "001")}
          {field("codigo_punto_expedicion", "Cód. Punto Expedición", "001")}
        </div>

        <h3 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase pt-2 border-t border-gray-100 dark:border-slate-800">Certificado & Ambiente</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Certificado .p12 (base64)</label>
            <input
              type="text"
              value={form.cert_p12_base64}
              onChange={(e) => setForm((f) => ({ ...f, cert_p12_base64: e.target.value }))}
              placeholder={certCargado ? "•••••• (ya cargado)" : "Pegar contenido base64"}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-xs font-mono outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Contraseña del certificado</label>
            <input
              type="password"
              value={form.cert_password}
              onChange={(e) => setForm((f) => ({ ...f, cert_password: e.target.value }))}
              placeholder={certCargado ? "•••••• (ya cargada)" : ""}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-xs outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Ambiente</label>
            <select
              value={form.ambiente}
              onChange={(e) => setForm((f) => ({ ...f, ambiente: e.target.value }))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 text-xs outline-none"
            >
              <option value="test">Test / Homologación</option>
              <option value="production">Producción</option>
            </select>
          </div>
        </div>
        {field("service_base_url", "URL del motor InteliFact", "http://localhost:3000 (default si se deja vacío)")}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Configuración
        </button>
      </div>

      <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2"><Radio className="w-4 h-4" /> Estado del Motor</h2>
          <button
            onClick={checkTelemetry}
            disabled={checkingTelemetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 disabled:opacity-50 cursor-pointer"
          >
            {checkingTelemetry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            Verificar conexión
          </button>
        </div>
        {telemetry && (
          telemetry.disponible ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-700 dark:text-emerald-300">
              ✓ Motor InteliFact alcanzable -- {telemetry.detalle?.telemetry?.pendingEvents ?? 0} eventos pendientes de envío.
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-600 dark:text-gray-400">
              {telemetry.error || "No disponible"} -- esperado mientras el motor no esté instalado/corriendo.
            </div>
          )
        )}
      </div>
    </div>
  )
}
