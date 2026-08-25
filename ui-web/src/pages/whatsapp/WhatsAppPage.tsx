import { useState, useEffect } from "react"
import { api, type WhatsAppTemplate } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Modal } from "../../components/Modal"
import {
  MessageCircle, Settings, FileText, Send, Plus, Edit, Trash2,
  Loader2, Check, ExternalLink, RefreshCw, Smartphone, ShieldCheck,
  Zap, Copy, ToggleLeft, ToggleRight, CheckCircle2, Globe, Radio
} from "lucide-react"

const DEFAULT_INTELLIZAPP_URL = "https://app.intellizapp.com"
const DEFAULT_API_KEY = "0e299365c34e6260e5287ee802d6bee00b1cda76260f62f5"

export default function WhatsAppPage() {
  const [tab, setTab] = useState<"iframe" | "templates" | "config">("iframe")
  const toast = useToast()

  // iFrame Integration State
  const [intellizappUrl, setIntellizappUrl] = useState<string>(() => {
    return localStorage.getItem("intellizapp_instance_url") || DEFAULT_INTELLIZAPP_URL
  })
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)

  // Templates State
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: "",
    tipo: "welcome",
    content: "",
    active: true,
  })
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Config State
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY)
  const [copiedKey, setCopiedKey] = useState(false)

  useEffect(() => {
    if (tab === "templates") {
      fetchTemplates()
    }
  }, [tab])

  const fetchTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const data = await api.whatsapp.listTemplates()
      setTemplates(data)
    } catch {
      // Fallback predeterminado
      setTemplates([
        { id: "1", tenant_id: "", name: "Bienvenida", content: "¡Hola! Bienvenido a InteliMarket. Gracias por contactarnos. ¿En qué podemos ayudarle?", tipo: "welcome", active: true, created_at: "2026-04-01" },
        { id: "2", tenant_id: "", name: "Aviso de Cobranza / Vencimiento", content: "Estimado cliente, le recordamos que su factura vence el {fecha}. Saldo: {monto}.", tipo: "reminder", active: true, created_at: "2026-05-01" },
        { id: "3", tenant_id: "", name: "Estado de Pedido / Entrega", content: "Su pedido #{pedido} ha salido para entrega. Seguimiento disponible.", tipo: "order_status", active: true, created_at: "2026-05-10" },
      ])
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleSaveInstanceUrl = (url: string) => {
    setIntellizappUrl(url)
    localStorage.setItem("intellizapp_instance_url", url)
    setIframeKey(k => k + 1)
    toast.success("URL de InteliZapp guardada", url)
  }

  const handleReloadIframe = () => {
    setIframeLoading(true)
    setIframeKey(k => k + 1)
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopiedKey(true)
    toast.success("Copiado", "API Key de InteliZapp copiada al portapapeles")
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      toast.error("Error", "Nombre y contenido son obligatorios")
      return
    }
    setSavingTemplate(true)
    try {
      if (editingTemplate) {
        await api.whatsapp.updateTemplate(editingTemplate.id, templateForm)
        toast.success("Plantilla actualizada")
      } else {
        await api.whatsapp.createTemplate(templateForm)
        toast.success("Plantilla creada")
      }
      setShowTemplateModal(false)
      fetchTemplates()
    } catch (e: any) {
      toast.error("Error al guardar", e?.message || "No se pudo guardar la plantilla")
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shadow-sm">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-slate-900 dark:text-white tracking-tight">
                  WhatsApp & InteliZapp Hub
                </h1>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conexión Activa
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Consola oficial de mensajería empresarial integrada con la plataforma InteliZapp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(intellizappUrl, "_blank")}
              className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
              title="Abrir en pestaña independiente"
            >
              <ExternalLink className="w-4 h-4 text-emerald-600" /> Abrir InteliZapp
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800">
          <button
            onClick={() => setTab("iframe")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "iframe"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Smartphone className="w-4 h-4" /> Consola Web InteliZapp
          </button>
          <button
            onClick={() => setTab("templates")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "templates"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <FileText className="w-4 h-4" /> Plantillas de Mensajes
          </button>
          <button
            onClick={() => setTab("config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "config"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Settings className="w-4 h-4" /> Configuración de Enlace
          </button>
        </div>
      </div>

      {/* TAB 1: iFRAME INTELLIZAPP */}
      {tab === "iframe" && (
        <div className="space-y-3">
          {/* Barra de control del iFrame */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Globe className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <input
                type="text"
                value={intellizappUrl}
                onChange={e => setIntellizappUrl(e.target.value)}
                onBlur={e => handleSaveInstanceUrl(e.target.value)}
                placeholder="https://app.intellizapp.com"
                className="input-field text-xs py-1.5 flex-1 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReloadIframe}
                className="btn-ghost py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-lg"
                title="Recargar panel"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${iframeLoading ? "animate-spin text-emerald-500" : ""}`} /> Recargar
              </button>
              <button
                onClick={() => window.open(intellizappUrl, "_blank")}
                className="btn-ghost py-1.5 px-2.5 text-xs flex items-center gap-1 rounded-lg text-emerald-600 dark:text-emerald-400 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Pantalla Completa
              </button>
            </div>
          </div>

          {/* Contenedor del iFrame */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden relative min-h-[680px]">
            {iframeLoading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cargando consola de InteliZapp...</p>
              </div>
            )}
            <iframe
              key={iframeKey}
              src={intellizappUrl}
              title="InteliZapp WhatsApp Web"
              className="w-full h-[720px] border-0 rounded-2xl"
              onLoad={() => setIframeLoading(false)}
              allow="microphone; camera; clipboard-read; clipboard-write;"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            />
          </div>
        </div>
      )}

      {/* TAB 2: PLANTILLAS */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Plantillas Predefinidas</h3>
              <p className="text-xs text-slate-500">Mensajes estándar para notificaciones y marketing</p>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null)
                setTemplateForm({ name: "", tipo: "welcome", content: "", active: true })
                setShowTemplateModal(true)
              }}
              className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nueva Plantilla
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templatesLoading ? (
              <div className="col-span-full py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              </div>
            ) : templates.map(t => (
              <div key={t.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{t.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-100 text-slate-500"
                    }`}>
                      {t.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 font-mono mt-2">
                    {t.content}
                  </p>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setEditingTemplate(t)
                      setTemplateForm({ name: t.name || "", tipo: t.tipo || "welcome", content: t.content || "", active: t.active ?? true })
                      setShowTemplateModal(true)
                    }}
                    className="btn-ghost p-1.5 rounded-lg text-slate-500 hover:text-slate-800"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CONFIGURACIÓN & API KEY */}
      {tab === "config" && (
        <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Credenciales & Webhook de InteliZapp
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Clave de autenticación para que el ERP dispare mensajes automáticos de ventas y cobranzas
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="input-label">URL del Servidor / Consola InteliZapp</label>
              <input
                type="text"
                value={intellizappUrl}
                onChange={e => handleSaveInstanceUrl(e.target.value)}
                className="input-field font-mono mt-1"
                placeholder="https://app.intellizapp.com"
              />
            </div>

            <div>
              <label className="input-label">API Key de InteliZapp (Servidor)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="password"
                  value={apiKey}
                  readOnly
                  className="input-field font-mono flex-1 bg-slate-50 dark:bg-slate-800/60"
                />
                <button
                  onClick={handleCopyKey}
                  className="btn-outline py-2 px-3 text-xs flex items-center gap-1"
                >
                  {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copiedKey ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Configurado en el backend bajo la variable de entorno <code className="text-emerald-600">INTELLIZAPP_API_KEY</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Plantilla */}
      {showTemplateModal && (
        <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}>
          <div className="space-y-4">
            <div>
              <label className="input-label label-required">Nombre de la Plantilla</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                className="input-field text-sm mt-1"
                placeholder="Ej. Recordatorio de Vencimiento"
              />
            </div>
            <div>
              <label className="input-label">Tipo de Notificación</label>
              <select
                value={templateForm.tipo}
                onChange={e => setTemplateForm({ ...templateForm, tipo: e.target.value })}
                className="input-field text-sm mt-1"
              >
                <option value="welcome">Bienvenida</option>
                <option value="reminder">Recordatorio de Cobro / Pago</option>
                <option value="order_status">Estado de Pedido / Delivery</option>
                <option value="promotion">Promoción Especial</option>
                <option value="stock_alert">Alerta de Stock</option>
              </select>
            </div>
            <div>
              <label className="input-label label-required">Contenido del Mensaje</label>
              <textarea
                value={templateForm.content}
                onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })}
                rows={4}
                className="input-field text-sm font-mono mt-1"
                placeholder="Hola {nombre}, su pedido #{pedido} ha sido confirmado."
              />
              <p className="text-[11px] text-slate-400 mt-1">Variables admitidas: {"{nombre}"}, {"{pedido}"}, {"{monto}"}, {"{fecha}"}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowTemplateModal(false)} className="btn-outline flex-1">
                Cancelar
              </button>
              <button onClick={handleSaveTemplate} disabled={savingTemplate} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
