import { useState, useEffect, useRef, useMemo } from "react"
import { api, type WhatsAppTemplate, type WhatsAppConversation, type WhatsAppMessage } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Modal } from "../../components/Modal"
import {
  MessageCircle, Settings, FileText, Send, Plus, Edit, Trash2,
  Loader2, Check, ExternalLink, RefreshCw, Smartphone, ShieldCheck,
  Zap, Copy, CheckCircle2, Globe, QrCode, PowerOff, AlertCircle,
  Search, Server, User, Clock, ArrowRight, MessageSquare, Terminal
} from "lucide-react"

const DEFAULT_GATEWAY_URL = "http://100.72.38.119:8085"
const DEFAULT_MANAGER_URL = "http://100.72.38.119:8085/manager"
const INSTANCE_NAME = "extra_supermercado"

interface GatewayStatus {
  success: boolean
  instance?: string
  state?: string // 'open' | 'connecting' | 'close' | 'not_created' | 'offline'
  connected?: boolean
  gateway_url?: string
}

export default function WhatsAppPage() {
  const [tab, setTab] = useState<"connection" | "conversations" | "templates" | "gateway">("connection")
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

  // Conversations State
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState<boolean>(false)
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false)
  const [searchConv, setSearchConv] = useState<string>("")

  // Polling interval ref for QR connection
  const pollingRef = useRef<any>(null)

  useEffect(() => {
    fetchGatewayStatus()
  }, [])

  useEffect(() => {
    if (tab === "templates") {
      fetchTemplates()
    } else if (tab === "conversations") {
      fetchConversations()
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
        toast.info("Código QR Generado", "Escaneá el código desde WhatsApp con tu celular")
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
      setTemplates(data || [])
    } catch {
      toast.error("Error", "No se pudieron cargar las plantillas")
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTemplate(true)
    try {
      if (editingTemplate) {
        await api.whatsapp.updateTemplate(editingTemplate.id, templateForm)
        toast.success("Plantilla Actualizada", "Los cambios fueron guardados")
      } else {
        await api.whatsapp.createTemplate(templateForm)
        toast.success("Plantilla Creada", "La plantilla fue registrada con éxito")
      }
      setShowTemplateModal(false)
      setEditingTemplate(null)
      fetchTemplates()
    } catch {
      toast.error("Error", "No se pudo guardar la plantilla")
    } finally {
      setSavingTemplate(false)
    }
  }

  const fetchConversations = async () => {
    setConversationsLoading(true)
    try {
      const data = await api.whatsapp.listConversations()
      setConversations(data || [])
      if (data && data.length > 0 && !selectedConv) {
        setSelectedConv(data[0])
        fetchMessages(data[0].id)
      }
    } catch {
      // Ignorar fallo si la tabla está vacía
    } finally {
      setConversationsLoading(false)
    }
  }

  const fetchMessages = async (convId: string) => {
    setMessagesLoading(true)
    try {
      const msgs = await api.whatsapp.getMessages(convId)
      setMessages(msgs || [])
    } catch {
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }

  const filteredConversations = useMemo(() => {
    if (!searchConv.trim()) return conversations
    const q = searchConv.toLowerCase()
    return conversations.filter((c) =>
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_phone?.toLowerCase().includes(q) ||
      c.ultimo_mensaje?.toLowerCase().includes(q)
    )
  }, [conversations, searchConv])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header Ejecutivo */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  WhatsApp Hub & Evolution API
                </h1>
                {loadingStatus ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                  </span>
                ) : status?.connected ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Conectado (Online)
                  </span>
                ) : status?.state === "connecting" ? (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" /> Esperando Escaneo QR
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
              onClick={() => window.open(DEFAULT_MANAGER_URL, "_blank")}
              className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:text-emerald-600 hover:border-emerald-500"
              title="Abrir Evolution API Manager oficial en dev-server"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" /> Evolution Manager (:8085)
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800 overflow-x-auto">
          <button
            onClick={() => setTab("connection")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              tab === "connection"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Smartphone className="w-4 h-4" /> Conexión & Diagnóstico QR
          </button>
          <button
            onClick={() => setTab("conversations")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              tab === "conversations"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Historial & Mensajes
          </button>
          <button
            onClick={() => setTab("templates")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              tab === "templates"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <FileText className="w-4 h-4" /> Plantillas de Mensajes
          </button>
          <button
            onClick={() => setTab("gateway")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              tab === "gateway"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          >
            <Server className="w-4 h-4" /> Servidor & Gateway
          </button>
        </div>
      </div>

      {/* TAB 1: CONEXIÓN & DIAGNÓSTICO */}
      {tab === "connection" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tarjeta de Código QR & Conexión */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Emparejamiento de WhatsApp
                    </h2>
                    <p className="text-xs text-slate-500">
                      Escaneá el código QR desde la app móvil en tu teléfono
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                  Instancia: {INSTANCE_NAME}
                </span>
              </div>

              {/* Área del QR */}
              <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/80 flex flex-col items-center justify-center min-h-[300px]">
                {loadingQr ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium animate-pulse">
                      Generando código QR desde Evolution API...
                    </p>
                  </div>
                ) : status?.connected ? (
                  <div className="flex flex-col items-center text-center gap-3 py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Línea Conectada y Operativa
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        La sesión con Extra Supermercado está activa. Los mensajes automáticos, cupones y campañas de marketing se despacharán por este canal.
                      </p>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="mt-3 btn-danger text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      {disconnecting ? "Desconectando..." : "Desconectar Sesión de WhatsApp"}
                    </button>
                  </div>
                ) : qrCodeData ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200/80">
                      <img
                        src={qrCodeData.startsWith("data:") ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                        alt="Código QR de WhatsApp"
                        className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Abrí WhatsApp &gt; Ajustes &gt; Dispositivos vinculados &gt; Vincular un dispositivo
                      </p>
                      <p className="text-[11px] text-slate-400">
                        El código expira en 40 segundos. El sistema verificará automáticamente una vez escaneado.
                      </p>
                    </div>
                    {pairingCode && (
                      <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-2 rounded-xl flex items-center gap-2">
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Código de emparejamiento numérico:</span>
                        <code className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">{pairingCode}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-3 py-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                      <QrCode className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Sin Código QR Activo
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Hacé clic en el botón inferior para solicitar un nuevo código de vinculación en tiempo real.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Cifrado punto a punto vía Evolution Engine
              </div>
              {!status?.connected && (
                <button
                  onClick={handleRequestQr}
                  disabled={loadingQr}
                  className="btn-primary py-2 px-5 text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                >
                  <QrCode className="w-4 h-4" />
                  {loadingQr ? "Generando..." : "Generar Código QR"}
                </button>
              )}
            </div>
          </div>

          {/* Tarjeta de Envío de Pruebas */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Consola de Envío Inmediato
                  </h2>
                  <p className="text-xs text-slate-500">
                    Probá el despacho en tiempo real a tu celular
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendTestMessage} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Número de Destinatario (Paraguay o Brasil)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="Ej: 0981 123456 o 595981123456"
                      className="input pl-9 text-xs font-mono"
                      required
                    />
                    <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se normaliza automáticamente a formato internacional E.164 (+595...).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Cuerpo del Mensaje
                  </label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={4}
                    className="input text-xs resize-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Soporta negrita con *asteriscos*, cursiva y emojis.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={sendingTest || !status?.connected}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                    status?.connected
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Despachando mensaje...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Enviar Mensaje de Prueba
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Protección Anti-Bloqueo
                </div>
                <p>
                  Los envíos incluyen presencia de escritura (*composing*) y delay humanizado de 1.2 segundos para resguardar la línea.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORIAL DE CONVERSACIONES & MENSAJES */}
      {tab === "conversations" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[650px]">
          {/* Lista de Conversaciones */}
          <div className="md:col-span-4 lg:col-span-4 border-r border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <input
                  type="text"
                  value={searchConv}
                  onChange={(e) => setSearchConv(e.target.value)}
                  placeholder="Buscar por cliente o teléfono..."
                  className="input pl-9 text-xs"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {conversationsLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> Cargando conversaciones...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <MessageCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">Sin conversaciones registradas</p>
                  <p className="text-[11px]">Los mensajes transaccionales y respuestas de clientes aparecerán aquí automáticamente.</p>
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected = selectedConv?.id === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedConv(c)
                        fetchMessages(c.id)
                      }}
                      className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                        isSelected
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-emerald-500"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {c.contact_name ? c.contact_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {c.contact_name || c.contact_phone || "Cliente"}
                          </h4>
                          {c.last_message_at && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 truncate">{c.contact_phone}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {c.ultimo_mensaje || c.last_message_preview || "Sin mensajes recientes"}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Panel de Chat Activo */}
          <div className="md:col-span-8 lg:col-span-8 flex flex-col bg-slate-50/50 dark:bg-slate-950/20">
            {selectedConv ? (
              <>
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center font-bold text-sm">
                      {selectedConv.contact_name ? selectedConv.contact_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedConv.contact_name || "Contacto WhatsApp"}
                      </h3>
                      <p className="text-xs font-mono text-slate-500">{selectedConv.contact_phone}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 capitalize">
                    {selectedConv.status || "Activo"}
                  </span>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messagesLoading ? (
                    <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> Cargando mensajes...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-20 text-center text-xs text-slate-400">
                      No hay mensajes registrados en esta conversación.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isOutbound = m.direction === "outbound"
                      return (
                        <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-md rounded-2xl p-3.5 shadow-sm text-xs ${
                              isOutbound
                                ? "bg-emerald-600 text-white rounded-tr-none"
                                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            <div className={`mt-1 text-[10px] flex items-center justify-end gap-1 ${isOutbound ? "text-emerald-100" : "text-slate-400"}`}>
                              <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                              {isOutbound && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Seleccioná una conversación</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">Elegí un cliente de la lista de la izquierda para visualizar el historial completo de chats.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PLANTILLAS DE MENSAJES */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Plantillas Oficiales de Notificación</h2>
              <p className="text-xs text-slate-500">Configurá las plantillas para sorteos, avisos de saldo, cupones y cobranzas</p>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null)
                setTemplateForm({ name: "", tipo: "welcome", content: "", active: true })
                setShowTemplateModal(true)
              }}
              className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Nueva Plantilla
            </button>
          </div>

          {templatesLoading ? (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> Cargando plantillas...
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay plantillas registradas</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Creá plantillas reutilizables para que las campañas del Gerente de Marketing IA y los cupones de sorteos utilicen el formato aprobado.
              </p>
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

      {/* TAB 4: SERVIDOR & GATEWAY */}
      {tab === "gateway" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Servidor Gateway</h3>
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white font-mono">{DEFAULT_GATEWAY_URL}</p>
              <span className="text-[11px] text-emerald-600 font-medium">dev-server (Tailscale LAN)</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Instancia Activa</h3>
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white font-mono">{INSTANCE_NAME}</p>
              <span className="text-[11px] text-slate-400">Motor WHATSAPP-BAILEYS</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                  <Terminal className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Consola de Gestión</h3>
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">Evolution Manager</p>
              <button
                onClick={() => window.open(DEFAULT_MANAGER_URL, "_blank")}
                className="mt-1 text-[11px] text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1"
              >
                Abrir Manager oficial <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Parámetros de Integración
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase">Webhook Entrante</span>
                <span className="text-slate-800 dark:text-slate-200">/api/v1/whatsapp/webhook/evolution</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase">Contenedor Docker</span>
                <span className="text-slate-800 dark:text-slate-200">intelizapp-evo:8085</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Plantilla */}
      {showTemplateModal && (
        <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}>
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre de la Plantilla</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="Ej: Confirmación Cupón Sorteo"
                className="input text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Notificación</label>
              <select
                value={templateForm.tipo}
                onChange={(e) => setTemplateForm({ ...templateForm, tipo: e.target.value })}
                className="input text-xs"
              >
                <option value="welcome">Bienvenida Socio</option>
                <option value="cupon">Cupón de Sorteo</option>
                <option value="promo">Promoción Especial</option>
                <option value="dunning">Aviso de Cuota / Mora</option>
                <option value="receipt">Recibo de Compra</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contenido del Mensaje
              </label>
              <textarea
                value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                rows={5}
                className="input text-xs font-mono resize-none"
                placeholder="¡Hola {{nombre}}! Registramos {{cantidad}} para el sorteo..."
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Variables disponibles: <code>&#123;&#123;nombre&#125;&#125;</code>, <code>&#123;&#123;cantidad&#125;&#125;</code>, <code>&#123;&#123;sorteo&#125;&#125;</code>, <code>&#123;&#123;ticket&#125;&#125;</code>.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="btn-ghost py-2 px-4 text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingTemplate}
                className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
              >
                {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar Plantilla
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
