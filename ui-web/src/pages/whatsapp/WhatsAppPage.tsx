import { useState, useEffect, useRef } from "react"
import { api, type WhatsAppTemplate } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Modal } from "../../components/Modal"
import {
  MessageCircle, Settings, FileText, Send, Plus, Edit, Trash2,
  Loader2, Check, ExternalLink, RefreshCw, Smartphone, ShieldCheck,
  Zap, Copy, CheckCircle2, Globe, QrCode, PowerOff, AlertCircle
} from "lucide-react"

const DEFAULT_INTELLIZAPP_URL = "https://intellizapp-production.up.railway.app"
const DEFAULT_GATEWAY_URL = "http://100.72.38.119:8085"

interface GatewayStatus {
  success: boolean
  instance?: string
  state?: string // 'open' | 'connecting' | 'close' | 'not_created' | 'offline'
  connected?: boolean
  gateway_url?: string
}

export default function WhatsAppPage() {
  const [tab, setTab] = useState<"connection" | "templates" | "console">("connection")
  const toast = useToast()

  // Gateway Connection State
  const [status, setStatus] = useState<GatewayStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState<boolean>(false)
  const [disconnecting, setDisconnecting] = useState<boolean>(false)

  // Test Message State
  const [testPhone, setTestPhone] = useState<string>("")
  const [testMessage, setTestMessage] = useState<string>("¡Hola! Este es un mensaje de prueba oficial desde Extra Supermercado (InteliMarket). 🛒✨")
  const [sendingTest, setSendingTest] = useState<boolean>(false)

  // Templates State
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false)
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false)
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: "",
    tipo: "welcome",
    content: "",
    active: true,
  })
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false)

  // Polling interval ref for QR connection
  const pollingRef = useRef<any>(null)

  useEffect(() => {
    fetchGatewayStatus()
  }, [])

  useEffect(() => {
    if (tab === "templates") {
      fetchTemplates()
    }
  }, [tab])

  // Polling automático cuando el estado es 'connecting' (esperando escaneo de QR)
  useEffect(() => {
    if (status?.state === "connecting" && !status?.connected) {
      pollingRef.current = setInterval(() => {
        fetchGatewayStatus(false)
      }, 4000)
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [status?.state, status?.connected])

  const fetchGatewayStatus = async (showLoading = true) => {
    if (showLoading) setLoadingStatus(true)
    try {
      const data = await api.whatsapp.getStatus()
      setStatus(data)
      if (data.connected) {
        setQrCodeData(null)
      }
    } catch {
      setStatus({
        success: false,
        state: "offline",
        connected: false,
        gateway_url: DEFAULT_GATEWAY_URL,
      })
    } finally {
      if (showLoading) setLoadingStatus(false)
    }
  }

  const handleRequestQr = async () => {
    setLoadingQr(true)
    setQrCodeData(null)
    setPairingCode(null)
    try {
      const res = await api.whatsapp.connect()
      if (res.connected) {
        toast.success("Conectado", "La instancia ya se encuentra conectada a WhatsApp")
        fetchGatewayStatus(false)
        return
      }
      if (res.qrcode) {
        setQrCodeData(res.qrcode)
        toast.info("Código QR Generado", "Escaneá el código desde WhatsApp en tu celular")
      }
      if (res.pairing_code) {
        setPairingCode(res.pairing_code)
      }
      fetchGatewayStatus(false)
    } catch (e: any) {
      toast.error("Error al generar QR", e?.message || "No se pudo conectar con el dev-server")
    } finally {
      setLoadingQr(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm("¿Estás seguro de desconectar la sesión de WhatsApp de Extra Supermercado?")) {
      return
    }
    setDisconnecting(true)
    try {
      await api.whatsapp.disconnect()
      toast.success("Desconectado", "Se cerró la sesión en el gateway")
      setQrCodeData(null)
      fetchGatewayStatus()
    } catch (e: any) {
      toast.error("Error al desconectar", e?.message || "Error al solicitar logout")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone.trim()) {
      toast.error("Número requerido", "Ingresá un número de teléfono con código de área")
      return
    }
    setSendingTest(true)
    try {
      const res = await api.whatsapp.sendTestMessage({
        phone: testPhone.trim(),
        message: testMessage.trim(),
      })
      if (res.success) {
        toast.success("¡Mensaje Enviado!", `Despachado exitosamente (ID: ${res.message_id || "OK"})`)
      } else {
        toast.error("Fallo al enviar", "El gateway rechazó el envío")
      }
    } catch (e: any) {
      toast.error("Error de envío", e?.response?.data?.detail || e?.message || "Error enviando WhatsApp")
    } finally {
      setSendingTest(false)
    }
  }

  const fetchTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const data = await api.whatsapp.listTemplates()
      setTemplates(data)
    } catch {
      setTemplates([
        { id: "1", tenant_id: "", name: "Confirmación de Cupones Sorteo", content: "¡Hola *{{nombre}}*! 👋 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* con Ticket *#{{ticket}}* en *Extra Supermercado*.", tipo: "promotion", active: true, created_at: "2026-05-01" },
        { id: "2", tenant_id: "", name: "Aviso de Vencimiento Mayorista", content: "Estimado cliente, le recordamos que su factura de Extra Supermercado vence el {fecha}. Saldo pendiente: {monto}.", tipo: "reminder", active: true, created_at: "2026-05-01" },
      ])
    } finally {
      setTemplatesLoading(false)
    }
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
    <div className="space-y-6 animate-fade-in-up pb-12 max-w-7xl mx-auto">
      {/* Header Principal */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shadow-sm">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg xl:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  WhatsApp & InteliZapp Hub
                </h1>
                {/* Badge de Estado */}
                {loadingStatus ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                  </span>
                ) : status?.connected ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Conectado (Extra Supermercado)
                  </span>
                ) : status?.state === "connecting" ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Esperando Escaneo QR
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Desconectado
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Pasarela de mensajería empresarial integrada con Evolution API en dev-server (:8085)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchGatewayStatus()}
              disabled={loadingStatus}
              className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
              title="Refrescar estado"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin text-emerald-500" : ""}`} /> Refrescar Estado
            </button>
            <button
              onClick={() => window.open(DEFAULT_INTELLIZAPP_URL, "_blank")}
              className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
              title="Abrir consola externa de IntelliZapp"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" /> Abrir CRM InteliZapp
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800">
          <button
            onClick={() => setTab("connection")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "connection"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Smartphone className="w-4 h-4" /> Conexión & Diagnóstico
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
            onClick={() => setTab("console")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "console"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Globe className="w-4 h-4" /> Consola InteliZapp Web
          </button>
        </div>
      </div>

      {/* TAB 1: CONEXIÓN & DIAGNÓSTICO */}
      {tab === "connection" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Tarjeta de Estado y Código QR */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-500" /> Vinculación de Dispositivo WhatsApp
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instancia: <code className="font-mono text-emerald-600 font-bold">{status?.instance || "extra_supermercado"}</code> · Servidor: <code className="font-mono text-slate-500">{status?.gateway_url || DEFAULT_GATEWAY_URL}</code>
                  </p>
                </div>
              </div>

              {/* Contenido según estado de conexión */}
              {status?.connected ? (
                <div className="p-6 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                      WhatsApp Vinculado y Activo
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 max-w-md mx-auto">
                      El número de Extra Supermercado está listo para despachar confirmaciones de sorteos, facturación y recordatorios.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-rose-600 border border-rose-200 dark:border-rose-900 hover:bg-rose-50 transition-colors shadow-xs flex items-center gap-2 mx-auto"
                    >
                      {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                      Desconectar Sesión de WhatsApp
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Pasos para conectar:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
                      <li>Hacé clic en <strong>"Generar Código QR"</strong>.</li>
                      <li>Abrí WhatsApp en el teléfono móvil del supermercado.</li>
                      <li>Tocá Menú (Android) o Configuración (iPhone) → <strong>Dispositivos vinculados</strong>.</li>
                      <li>Tocá <strong>Vincular un dispositivo</strong> y apuntá tu cámara al código QR en pantalla.</li>
                    </ol>
                  </div>

                  {/* Visualización del QR */}
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 min-h-[260px]">
                    {loadingQr ? (
                      <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                        <span>Generando código QR desde dev-server...</span>
                      </div>
                    ) : qrCodeData ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                          <img
                            src={qrCodeData.startsWith("data:") ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                            alt="Código QR WhatsApp"
                            className="w-56 h-56 object-contain"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                          <span className="text-[11px] text-slate-500 font-medium">Esperando escaneo en el teléfono...</span>
                        </div>
                        {pairingCode && (
                          <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs">
                            <span className="text-slate-500 text-[10px]">Código de vinculación alternativo:</span>
                            <p className="font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-wider text-sm">{pairingCode}</p>
                          </div>
                        )}
                        <button
                          onClick={handleRequestQr}
                          className="btn-ghost py-1.5 px-3 text-xs text-emerald-600 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Renovar Código QR
                        </button>
                      </div>
                    ) : (
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center">
                          <QrCode className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-500">Ningún código QR generado actualmente</p>
                        <button
                          onClick={handleRequestQr}
                          className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 mx-auto shadow-sm"
                        >
                          <Zap className="w-4 h-4" /> Generar Código QR Ahora
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Panel de Envío de Prueba Inmediato */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <Send className="w-5 h-5 text-emerald-500" /> Mensaje de Prueba en Vivo
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Probá el despacho directo a un número celular para certificar que la pasarela entregue los mensajes.
              </p>

              <form onSubmit={handleSendTestMessage} className="space-y-4">
                <div>
                  <label className="input-label label-required text-xs">Teléfono Destinatario (Paraguay / Brasil)</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ej: 0985 123456 o 67 99999-9999"
                    className="input-field text-xs mt-1 font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se normaliza automáticamente a formato internacional (5959... / 55...).
                  </p>
                </div>

                <div>
                  <label className="input-label text-xs">Texto del Mensaje</label>
                  <textarea
                    rows={4}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="input-field text-xs mt-1"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingTest || !status?.connected}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    status?.connected
                      ? "btn-primary shadow-sm"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Enviando mensaje...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Enviar Mensaje de Prueba
                    </>
                  )}
                </button>

                {!status?.connected && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 justify-center mt-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Vinculá primero el WhatsApp del supermercado para habilitar envíos.
                  </p>
                )}
              </form>
            </div>

            {/* Tarjeta Informativa de Integraciones */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2.5">
              <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Módulos Conectados con esta Pasarela:
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-500">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> <strong>Captura de Cupones:</strong> Disparo automático al registrar ticket.
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> <strong>Campañas de Marketing:</strong> Despacho masivo segmentado con anti-spam.
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> <strong>Chatbot Asistente:</strong> Auto-respuesta de consultas y catálogo.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANTILLAS DE MENSAJES */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Plantillas Predefinidas</h2>
              <p className="text-xs text-slate-500">Mensajes estandarizados para notificaciones y campañas</p>
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

          {templatesLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-xs">{tmpl.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">
                        {tmpl.tipo}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      {tmpl.content}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      onClick={() => {
                        setEditingTemplate(tmpl)
                        setTemplateForm({
                          name: tmpl.name || "",
                          tipo: tmpl.tipo || "welcome",
                          content: tmpl.content || "",
                          active: tmpl.active !== false,
                        })
                        setShowTemplateModal(true)
                      }}
                      className="btn-ghost py-1 px-2.5 text-xs text-slate-600 flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONSOLA WEB INTELLIZAPP */}
      {tab === "console" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>Consola Web IntelliZapp:</span>
              <code className="font-mono text-emerald-600">{DEFAULT_INTELLIZAPP_URL}</code>
            </div>
            <button
              onClick={() => window.open(DEFAULT_INTELLIZAPP_URL, "_blank")}
              className="btn-outline py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" /> Abrir en Pantalla Completa
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden min-h-[680px]">
            <iframe
              src={DEFAULT_INTELLIZAPP_URL}
              title="InteliZapp Web"
              className="w-full h-[720px] border-0"
              allow="microphone; camera; clipboard-read; clipboard-write;"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            />
          </div>
        </div>
      )}

      {/* Modal de Plantilla */}
      {showTemplateModal && (
        <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}>
          <div className="space-y-4">
            <div>
              <label className="input-label label-required text-xs">Nombre de la Plantilla</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                className="input-field text-xs mt-1"
                placeholder="Ej. Confirmación de Cupones"
              />
            </div>
            <div>
              <label className="input-label text-xs">Tipo de Notificación</label>
              <select
                value={templateForm.tipo}
                onChange={e => setTemplateForm({ ...templateForm, tipo: e.target.value })}
                className="input-field text-xs mt-1"
              >
                <option value="welcome">Bienvenida</option>
                <option value="reminder">Recordatorio de Cobro / Pago</option>
                <option value="order_status">Estado de Pedido / Delivery</option>
                <option value="promotion">Promoción / Sorteo</option>
                <option value="stock_alert">Alerta de Stock</option>
              </select>
            </div>
            <div>
              <label className="input-label label-required text-xs">Contenido del Mensaje</label>
              <textarea
                rows={5}
                value={templateForm.content}
                onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })}
                className="input-field text-xs mt-1 font-mono"
                placeholder="Variables disponibles: {{nombre}}, {{ticket}}, {{cantidad}}, {{sorteo}}..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="btn-outline py-2 px-4 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
              >
                {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar Plantilla
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
