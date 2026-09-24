import { copyToClipboard } from "../../utils/clipboard"
import { useState, useEffect, useRef, useMemo } from "react"
import {
  api,
  type WhatsAppTemplate,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type IntelliZappCampaign,
  type IntelliZappAutomationRule,
} from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { Modal } from "../../components/Modal"
import { LiveChatHub } from "./components/livechat/LiveChatHub"
import {
  MessageCircle, Settings, FileText, Send, Plus, Edit, Trash2,
  Loader2, Check, ExternalLink, RefreshCw, Smartphone, ShieldCheck,
  Zap, Copy, CheckCircle2, Globe, QrCode, PowerOff, AlertCircle,
  Search, Server, User, Clock, ArrowRight, MessageSquare, Terminal,
  Bot, Play, Sparkles, Filter, Radio, ChevronRight, CheckCircle,
  Building, HelpCircle, RotateCcw, Megaphone, BellRing, Users,
  CheckCheck, AlertTriangle, GitFork, Sliders, Power,
  Paperclip, Smile, Maximize2, Download, X, Image as ImageIcon,
  Cpu, ShoppingCart
} from "lucide-react"
import BotFlowBuilder, { type BotFlow } from "./BotFlowBuilder"

const DEFAULT_GATEWAY_URL = "http://100.72.38.119:8085"
const DEFAULT_MANAGER_URL = "http://100.72.38.119:8085/manager"
const INSTANCE_NAME = "extra_supermercado"

function isImageUrl(url: string) {
  const clean = url.toLowerCase().split("?")[0]
  return clean.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)$/.test(clean)
}

function isAudioUrl(url: string) {
  const clean = url.toLowerCase().split("?")[0]
  return clean.startsWith("data:audio/") || /\.(mp3|ogg|wav|m4a|aac)$/.test(clean)
}

function isVideoUrl(url: string) {
  const clean = url.toLowerCase().split("?")[0]
  return clean.startsWith("data:video/") || /\.(mp4|webm|mov|mkv)$/.test(clean)
}

const COMMON_EMOJIS = [
  // Atención & Saludos
  "👋", "😊", "👍", "❤️", "🙏", "🤝", "🎉", "👏", "🤩", "😁",
  // Supermercado & Frescos
  "🛒", "🏪", "🥩", "🥦", "🥖", "🥛", "🍞", "🍎", "🧀", "🍗",
  // Pagos & Finanzas
  "💰", "💵", "🏷️", "💳", "🧾", "📲", "🪙", "🏦",
  // Logística & Delivery
  "📦", "🛵", "🚚", "📍", "⏰", "⏱️", "🏠", "✅",
  // Consultas & Estados
  "📞", "❓", "❗", "⚠️", "❌", "📄", "📋", "⭐",
]

export const SYSTEM_TRIGGERS: Record<string, {
  module: string
  trigger: string
  badge: string
  sampleVars: Record<string, string>
}> = {
  "venta.creada": {
    module: "Ventas / POS",
    trigger: "Al confirmar venta en línea de caja / POS con teléfono del cliente registrado",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    sampleVars: {
      cliente: "María González",
      ticket: "001-002-0048291",
      monto: "185.000",
      puntos: "1.850",
      socio_numero: "EX-9482",
      fecha: "20/09/2026 18:30",
    },
  },
  "sorteo.optin": {
    module: "Sorteos & Cupones",
    trigger: "Al finalizar compra que genera cupones para invitar al cliente a recibir ofertas",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    sampleVars: {
      cupones_generados: "3",
      campana_sorteo: "Gran Sorteo Extra Supermercado",
      cupones_totales: "12",
      documento: "4.892.103",
    },
  },
  "cupon.sorteo": {
    module: "Sorteos & Cupones",
    trigger: "Al registrarse o emitirse tickets para el sorteo oficial Extra Supermercado",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    sampleVars: {
      cliente: "Carlos Benítez",
      ticket: "002-001-0039102",
      cantidad: "2 cupones",
      sorteo: "Gran Sorteo Extra Supermercado",
      empresa: "Extra Supermercado",
    },
  },
  "pago.recibido": {
    module: "Cuentas & Cobranzas",
    trigger: "Al registrarse un cobro o abono a cuenta corriente de cliente",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    sampleVars: {
      cliente: "Distribuidora San José",
      monto: "750.000",
      numero: "REC-001928",
      fecha: "20/09/2026",
    },
  },
  "optin.confirmado": {
    module: "Campañas & Marketing",
    trigger: "Cuando el cliente responde 'SÍ' para validar su suscripción a ofertas",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    sampleVars: {},
  },
  "extraclub.invitacion": {
    module: "ExtraClub & Fidelidad",
    trigger: "Envío o invitación a clientes que compran y aún no cuentan con membresía",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    sampleVars: {
      cliente: "Laura Duarte",
    },
  },
  "extraclub.saldo": {
    module: "ExtraClub & Fidelidad",
    trigger: "Consulta de puntos acumulados y valor de canje en Guaraníes",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    sampleVars: {
      cliente: "Roberto Acosta",
      socio_numero: "EX-5819",
      puntos: "3.400",
      valor_monetario: "340.000",
    },
  },
  "extraclub.premios": {
    module: "ExtraClub & Fidelidad",
    trigger: "Consulta o envío del catálogo de premios canjeables de fidelidad",
    badge: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800",
    sampleVars: {},
  },
  "cuota.recordatorio": {
    module: "Cuentas & Cobranzas",
    trigger: "Aviso de vencimiento de cuota de crédito o recordatorio preventivo",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    sampleVars: {
      cliente: "Comercial Guaraní",
      monto: "1.200.000",
      fecha: "25/09/2026",
    },
  },
  "promocion.flash": {
    module: "Campañas & Marketing",
    trigger: "Disparo de oferta relámpago o descuento especial del día",
    badge: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800",
    sampleVars: {
      oferta_titulo: "Tira de Costilla Premium",
      precio_oferta: "32.900",
      precio_regular: "45.000",
    },
  },
  "entrega.in_transit": {
    module: "Entregas & Delivery",
    trigger: "Cuando el delivery sale en camino hacia el domicilio del cliente",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    sampleVars: {
      numero: "DEL-8492",
      direccion: "Avda. Monday esq. Toledo",
      repartidor: "Juan Cardozo",
    },
  },
  "entrega.delivered": {
    module: "Entregas & Delivery",
    trigger: "Al marcarse el pedido como entregado en destino",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    sampleVars: {
      cliente: "Elena Vera",
      numero: "DEL-8492",
    },
  },
  "pedido.pendiente": {
    module: "Ventas / POS",
    trigger: "Al registrarse un nuevo pedido o presupuesto online",
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    sampleVars: {
      cliente: "Marcos Medina",
      numero: "PED-00481",
      total: "450.000",
    },
  },
  "pedido.listo": {
    module: "Ventas / POS",
    trigger: "Al marcarse el pedido listo para retiro en caja o mostrador",
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    sampleVars: {
      cliente: "Marcos Medina",
      numero: "PED-00481",
    },
  },
}

interface GatewayStatus {
  success: boolean
  instance?: string
  state?: string // 'open' | 'connecting' | 'close' | 'not_created' | 'offline'
  connected?: boolean
  gateway_url?: string
}

type TabType = "connection" | "conversations" | "chatbot" | "campaigns" | "automations" | "templates" | "gateway"

export default function WhatsAppPage() {
  const [tab, setTab] = useState<TabType>("connection")
  const toast = useToast()
  const { user } = useAuth()

  // ── 1. Gateway Connection State ──
  const [status, setStatus] = useState<GatewayStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState<boolean>(false)
  const [disconnecting, setDisconnecting] = useState<boolean>(false)

  // ── Test Message State ──
  const [testPhone, setTestPhone] = useState<string>("")
  const [testMessage, setTestMessage] = useState<string>(
    "¡Hola! Este es un mensaje de prueba oficial desde Extra Supermercado (InteliMarket). 🛒✨"
  )
  const [sendingTest, setSendingTest] = useState<boolean>(false)

  // ── 2. Conversations & Live Chat State ──
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState<boolean>(false)
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false)
  const [searchConv, setSearchConv] = useState<string>("")
  const [replyText, setReplyText] = useState<string>("")
  const [sendingReply, setSendingReply] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false)
  const [previewMediaModal, setPreviewMediaModal] = useState<{ url: string; title?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // ── 3. Chatbot Configuration & Simulator State ──
  const [chatbotConfig, setChatbotConfig] = useState<any>({
    bot_name: "ExtraBot",
    auto_reply: true,
    welcome_message: "¡Hola {cliente}! 👋 Bienvenido al canal oficial de atención de Extra Supermercado.",
    out_of_hours_message: "¡Hola! En este momento nuestras sucursales se encuentran cerradas. Nuestro horario de atención es de Lunes a Sábados de 07:00 a 21:00 hs y Domingos de 07:30 a 13:00 hs. Dejanos tu consulta y te responderemos ni bien abramos.",
    business_hours_start: "07:00",
    business_hours_end: "21:00",
    business_days: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
    modules_enabled: {
      catalog_search: true,
      extraclub_points: true,
      order_tracking: true,
      supermarket_info: true,
      human_handoff: true,
    },
    keywords: [],
    custom_menu_options: [],
  })
  const [loadingChatbotConfig, setLoadingChatbotConfig] = useState<boolean>(false)
  const [savingChatbotConfig, setSavingChatbotConfig] = useState<boolean>(false)

  // ── Bot Visual Flow & AI Agent State ──
  const [botSubTab, setBotSubTab] = useState<"ai_agent" | "flow" | "settings">("ai_agent")
  const [botFlow, setBotFlow] = useState<BotFlow | null>(null)
  const [loadingFlow, setLoadingFlow] = useState<boolean>(false)
  const [savingFlow, setSavingFlow] = useState<boolean>(false)
  const [togglingAutoReply, setTogglingAutoReply] = useState<boolean>(false)
  const [aiAgentStatus, setAiAgentStatus] = useState<{
    online: boolean
    host: string
    latency_ms?: number
    models?: string[]
    active_model?: string
    error?: string
  } | null>(null)
  const [loadingAiStatus, setLoadingAiStatus] = useState<boolean>(false)

  // Modales de Reglas de Palabras Clave y Menú Personalizado
  const [showKeywordModal, setShowKeywordModal] = useState<boolean>(false)
  const [editingKeyword, setEditingKeyword] = useState<any | null>(null)
  const [keywordForm, setKeywordForm] = useState<{ id?: string; name: string; keywords: string; response: string; active: boolean }>({
    name: "",
    keywords: "",
    response: "",
    active: true,
  })

  const [showMenuOptionModal, setShowMenuOptionModal] = useState<boolean>(false)
  const [editingMenuOption, setEditingMenuOption] = useState<any | null>(null)
  const [menuOptionForm, setMenuOptionForm] = useState<{ id?: string; number: string; title: string; response: string; active: boolean }>({
    number: "6",
    title: "",
    response: "",
    active: true,
  })

  // Chatbot Live Simulator
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; text: string; time: string; buttons?: any[] }>>([
    {
      sender: "bot",
      text: "🛒 *¡Hola!* 👋 Bienvenido al canal oficial de *Extra Supermercado*.\n\nEscribí *hola* o enviá un número:\n1️⃣ Catálogo & Precios\n2️⃣ Mis Puntos ExtraClub\n3️⃣ Rastreo de Compras\n4️⃣ Horarios & Sucursales\n5️⃣ Hablar con Agente",
      time: "Ahora",
      buttons: [
        { id: "1", title: "📦 Catálogo & Precios" },
        { id: "2", title: "⭐ Puntos ExtraClub" },
        { id: "3", title: "📋 Mis Compras" },
      ],
    },
  ])
  const [simInput, setSimInput] = useState<string>("")
  const [simLoading, setSimLoading] = useState<boolean>(false)
  const [simConvId, setSimConvId] = useState<string | undefined>(undefined)

  // ── 4. Campaigns State (IntelliZapp) ──
  const [campaigns, setCampaigns] = useState<IntelliZappCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState<boolean>(false)
  const [showCampModal, setShowCampModal] = useState<boolean>(false)
  const [campForm, setCampForm] = useState({
    name: "",
    description: "",
    tipo: "promotion",
    message_template: "🛒 ¡Hola {nombre}! Aprovechá las súper ofertas del fin de semana en Extra Supermercado. Sumás doble puntaje en ExtraClub en todos los cortes de carnicería. ¡Te esperamos!",
  })
  const [launchingCampId, setLaunchingCampId] = useState<string | null>(null)

  // ── 5. Automation Rules State ──
  const [rules, setRules] = useState<IntelliZappAutomationRule[]>([])
  const [rulesLoading, setRulesLoading] = useState<boolean>(false)
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false)
  const [ruleForm, setRuleForm] = useState({
    name: "",
    trigger_event: "sale.created",
    message_template: "🛒 *¡Gracias por tu compra en Extra Supermercado!*\n\n📄 Ticket Digital: *#{NUMERO}*\n💰 Total: *Gs. {TOTAL}*\n⭐ Sumaste *{PUNTOS} Puntos ExtraClub*.",
    delay_minutes: 0,
    active: true,
  })

  // ── 6. Templates State ──
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false)
  const [seedingTemplates, setSeedingTemplates] = useState<boolean>(false)
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false)
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: "",
    tipo: "sorteo.optin",
    content: "",
    active: true,
  })
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false)
  const [templateModuleFilter, setTemplateModuleFilter] = useState<string>("all")
  const [craftingAi, setCraftingAi] = useState<boolean>(false)
  const [aiInstruction, setAiInstruction] = useState<string>("")
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false)
  const [previewMode, setPreviewMode] = useState<"variables" | "simulated">("simulated")
  const [convFilter, setConvFilter] = useState<"all" | "optin" | "unread">("all")
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Polling ref for QR
  const pollingRef = useRef<any>(null)

  // Carga inicial de telemetría y datos para KPIs
  useEffect(() => {
    fetchGatewayStatus()
    fetchConversations()
    fetchCampaigns()
    fetchRules()
    fetchTemplates()
    fetchChatbotConfig()
  }, [])

  useEffect(() => {
    if (tab === "conversations") {
      fetchConversations()
    } else if (tab === "chatbot") {
      fetchChatbotConfig()
      fetchBotFlow()
    } else if (tab === "campaigns") {
      fetchCampaigns()
    } else if (tab === "automations") {
      fetchRules()
    } else if (tab === "templates") {
      fetchTemplates()
    }
  }, [tab])

  // Polling automático cuando el estado es 'connecting' (escaneo de QR)
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Llamadas de Backend ──

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
      toast.error("Error al generar QR", e?.message || "No se pudo conectar con el gateway")
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

  const handleResetSession = async () => {
    setLoadingQr(true)
    setQrCodeData(null)
    setPairingCode(null)
    try {
      await api.whatsapp.disconnect()
      toast.info("Sesión Purgada", "Generando código QR limpio y fresco...")
      setTimeout(async () => {
        await handleRequestQr()
      }, 1200)
    } catch {
      await handleRequestQr()
    }
  }

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone.trim()) {
      toast.error("Número requerido", "Ingresá un número con código de área (ej: 0981 123456)")
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
        fetchConversations()
      } else {
        toast.error("Fallo al enviar", "El gateway rechazó el envío")
      }
    } catch (e: any) {
      toast.error("Error de envío", e?.response?.data?.detail || e?.message || "Error enviando WhatsApp")
    } finally {
      setSendingTest(false)
    }
  }

  const handleDeleteConversation = async (convId: string) => {
    if (!window.confirm("¿Estás seguro de que deseás eliminar esta conversación y todo su historial?")) {
      return
    }
    try {
      await api.whatsapp.deleteConversation(convId)
      toast.success("Conversación eliminada", "El chat y sus mensajes fueron eliminados")
      if (selectedConv?.id === convId) {
        setSelectedConv(null)
        setMessages([])
      }
      fetchConversations()
    } catch (e: any) {
      toast.error("Error al eliminar", e?.response?.data?.detail || "No se pudo eliminar la conversación")
    }
  }

  const handleCleanupTests = async () => {
    if (!window.confirm("¿Deseás eliminar todas las conversaciones ficticias y de pruebas residuales?")) {
      return
    }
    try {
      const res = await api.whatsapp.cleanupTests()
      toast.success("Limpieza completa", `Se eliminaron ${res.deleted_count} conversaciones de prueba`)
      setSelectedConv(null)
      setMessages([])
      fetchConversations()
    } catch (e: any) {
      toast.error("Error al limpiar", e?.response?.data?.detail || "No se pudieron limpiar las pruebas")
    }
  }

  // ── Conversaciones ──
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
      // Sin conversaciones aún
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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!replyText.trim() && !selectedFile) || !selectedConv) return
    setSendingReply(true)
    const textToSend = replyText.trim()
    try {
      let mediaUrlToSend: string | undefined = undefined
      if (selectedFile) {
        const uploadRes = await api.whatsapp.uploadMedia(selectedFile)
        mediaUrlToSend = uploadRes.url
      }
      const newMsg = await api.whatsapp.sendMessage(selectedConv.id, {
        content: textToSend,
        media_url: mediaUrlToSend,
      })
      setMessages((prev) => [...prev, newMsg])
      setReplyText("")
      setSelectedFile(null)
      setFilePreview(null)
      setShowEmojiPicker(false)
      toast.success(
        "Mensaje Enviado",
        mediaUrlToSend ? "Multimedia despachado con éxito al cliente" : "Despachado al WhatsApp del cliente"
      )
      fetchConversations()
    } catch (e: any) {
      toast.error("Error al enviar", e?.message || "No se pudo entregar el mensaje o archivo")
    } finally {
      setSendingReply(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (evt) => setFilePreview(evt.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  const handleInsertEmoji = (emoji: string) => {
    setReplyText((prev) => prev + emoji)
    if (replyInputRef.current) {
      replyInputRef.current.focus()
    }
  }

  // ── Chatbot Config & Simulator ──
  const fetchAiAgentStatus = async () => {
    setLoadingAiStatus(true)
    try {
      const res = await api.whatsapp.getAiAgentStatus()
      setAiAgentStatus(res)
    } catch (e: any) {
      setAiAgentStatus({
        online: false,
        host: "http://100.72.38.119:11434",
        error: e?.message || "No se pudo conectar con el servidor LLM",
      })
    } finally {
      setLoadingAiStatus(false)
    }
  }

  const fetchChatbotConfig = async () => {
    setLoadingChatbotConfig(true)
    try {
      const cfg = await api.whatsapp.getChatbotConfig()
      if (cfg) setChatbotConfig(cfg)
      fetchAiAgentStatus()
    } catch {
      // Usar defaults
    } finally {
      setLoadingChatbotConfig(false)
    }
  }

  const handleSaveChatbotConfig = async (overrideCfg?: any) => {
    setSavingChatbotConfig(true)
    try {
      const isEvent = overrideCfg && (overrideCfg.nativeEvent || overrideCfg.preventDefault || overrideCfg.target || typeof overrideCfg?.stopPropagation === "function")
      const cfgToSave = (!isEvent && overrideCfg && typeof overrideCfg === "object") ? overrideCfg : chatbotConfig
      await api.whatsapp.saveChatbotConfig(cfgToSave)
      setChatbotConfig(cfgToSave)
      toast.success("Configuración Guardada", "Las opciones del Chatbot IA fueron actualizadas")
    } catch (e: any) {
      toast.error("Error al guardar", e?.response?.data?.detail || e?.message || "No se pudo guardar la configuración")
    } finally {
      setSavingChatbotConfig(false)
    }
  }

  // ── Flujo Visual del Chatbot (Evolution Interactive) ──
  const handleToggleAutoReply = async (newActive: boolean) => {
    setTogglingAutoReply(true)
    try {
      await api.whatsapp.toggleAutoReply(newActive)
      setChatbotConfig((prev: any) => ({ ...prev, auto_reply: newActive }))
      if (botFlow) {
        setBotFlow({ ...botFlow, active: newActive })
      }
      if (newActive) {
        toast.success("Agente IA Activado", "El Agente IA responderá automáticamente a las consultas de los clientes.")
      } else {
        toast.info("Agente IA en Pausa", "El Agente IA está en pausa. No responderá automáticamente.")
      }
    } catch (e: any) {
      toast.error("Error", e?.response?.data?.detail || e?.message || "No se pudo cambiar el estado del autorespondedor")
    } finally {
      setTogglingAutoReply(false)
    }
  }

  const fetchBotFlow = async () => {
    setLoadingFlow(true)
    try {
      const data = await api.whatsapp.getBotFlow()
      if (data?.flow) {
        setBotFlow(data.flow)
      }
    } catch (e) {
      console.error("Error fetching bot flow:", e)
    } finally {
      setLoadingFlow(false)
    }
  }

  const handleSaveBotFlow = async (updatedFlow: BotFlow) => {
    setSavingFlow(true)
    try {
      await api.whatsapp.saveBotFlow(updatedFlow)
      setBotFlow(updatedFlow)
      toast.success("Flujo Guardado", "El árbol visual y botones interactivos se guardaron correctamente.")
    } catch (e: any) {
      toast.error("Error al guardar flujo", e?.response?.data?.detail || e?.message || "No se pudo guardar el flujo")
    } finally {
      setSavingFlow(false)
    }
  }

  const handleResetBotFlow = async () => {
    if (!window.confirm("¿Seguro que querés restaurar el flujo oficial de Extra Supermercado? Se perderán las modificaciones no guardadas.")) return
    setSavingFlow(true)
    try {
      const res = await api.whatsapp.resetBotFlow()
      if (res?.flow) {
        setBotFlow(res.flow)
        toast.success("Flujo Restaurado", "Se restauró el flujo predeterminado con botones y listas interactivas.")
      }
    } catch (e: any) {
      toast.error("Error al reiniciar", e?.response?.data?.detail || e?.message || "No se pudo reiniciar el flujo")
    } finally {
      setSavingFlow(false)
    }
  }

  // ── Manejadores de Palabras Clave (Keywords & FAQ) ──
  const handleOpenKeywordModal = (kw?: any) => {
    if (kw) {
      setEditingKeyword(kw)
      setKeywordForm({
        id: kw.id,
        name: kw.name || "",
        keywords: Array.isArray(kw.keywords) ? kw.keywords.join(", ") : (kw.keywords || ""),
        response: kw.response || "",
        active: kw.active !== false,
      })
    } else {
      setEditingKeyword(null)
      setKeywordForm({
        name: "",
        keywords: "",
        response: "",
        active: true,
      })
    }
    setShowKeywordModal(true)
  }

  const handleSaveKeyword = async (e: React.FormEvent) => {
    e.preventDefault()
    const kwList = keywordForm.keywords
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)

    if (kwList.length === 0) {
      toast.error("Error", "Ingresá al menos una palabra clave")
      return
    }

    const currentKeywords = Array.isArray(chatbotConfig.keywords) ? [...chatbotConfig.keywords] : []
    let updated: any[]
    if (editingKeyword) {
      updated = currentKeywords.map((k) =>
        k.id === editingKeyword.id
          ? { ...k, name: keywordForm.name, keywords: kwList, response: keywordForm.response, active: keywordForm.active }
          : k
      )
    } else {
      const newRule = {
        id: `kw-${Date.now()}`,
        name: keywordForm.name || `Regla ${currentKeywords.length + 1}`,
        keywords: kwList,
        response: keywordForm.response,
        active: keywordForm.active,
      }
      updated = [...currentKeywords, newRule]
    }

    const newCfg = { ...chatbotConfig, keywords: updated }
    setChatbotConfig(newCfg)
    setShowKeywordModal(false)
    await handleSaveChatbotConfig(newCfg)
  }

  const handleToggleKeyword = async (id: string) => {
    const currentKeywords = Array.isArray(chatbotConfig.keywords) ? [...chatbotConfig.keywords] : []
    const updated = currentKeywords.map((k) => (k.id === id ? { ...k, active: !k.active } : k))
    const newCfg = { ...chatbotConfig, keywords: updated }
    setChatbotConfig(newCfg)
    await handleSaveChatbotConfig(newCfg)
  }

  const handleDeleteKeyword = async (id: string) => {
    const currentKeywords = Array.isArray(chatbotConfig.keywords) ? [...chatbotConfig.keywords] : []
    const updated = currentKeywords.filter((k) => k.id !== id)
    const newCfg = { ...chatbotConfig, keywords: updated }
    setChatbotConfig(newCfg)
    await handleSaveChatbotConfig(newCfg)
  }

  // ── Manejadores de Opciones Extras del Menú Principal ──
  const handleOpenMenuOptionModal = (opt?: any) => {
    if (opt) {
      setEditingMenuOption(opt)
      setMenuOptionForm({
        id: opt.id,
        number: opt.number || "6",
        title: opt.title || "",
        response: opt.response || "",
        active: opt.active !== false,
      })
    } else {
      setEditingMenuOption(null)
      const existing = Array.isArray(chatbotConfig.custom_menu_options) ? chatbotConfig.custom_menu_options : []
      const nextNum = existing.length > 0 ? String(existing.length + 6) : "6"
      setMenuOptionForm({
        number: nextNum,
        title: "",
        response: "",
        active: true,
      })
    }
    setShowMenuOptionModal(true)
  }

  const handleSaveMenuOption = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!menuOptionForm.title.trim() || !menuOptionForm.response.trim()) {
      toast.error("Error", "Completá el título y la respuesta de la opción")
      return
    }

    const currentOpts = Array.isArray(chatbotConfig.custom_menu_options) ? [...chatbotConfig.custom_menu_options] : []
    let updated: any[]
    if (editingMenuOption) {
      updated = currentOpts.map((o) =>
        o.id === editingMenuOption.id
          ? { ...o, number: menuOptionForm.number, title: menuOptionForm.title, response: menuOptionForm.response, active: menuOptionForm.active }
          : o
      )
    } else {
      const newOpt = {
        id: `opt-${Date.now()}`,
        number: menuOptionForm.number,
        title: menuOptionForm.title,
        response: menuOptionForm.response,
        active: menuOptionForm.active,
      }
      updated = [...currentOpts, newOpt]
    }

    const newCfg = { ...chatbotConfig, custom_menu_options: updated }
    setChatbotConfig(newCfg)
    setShowMenuOptionModal(false)
    await handleSaveChatbotConfig(newCfg)
  }

  const handleToggleMenuOption = async (id: string) => {
    const currentOpts = Array.isArray(chatbotConfig.custom_menu_options) ? [...chatbotConfig.custom_menu_options] : []
    const updated = currentOpts.map((o) => (o.id === id ? { ...o, active: !o.active } : o))
    const newCfg = { ...chatbotConfig, custom_menu_options: updated }
    setChatbotConfig(newCfg)
    await handleSaveChatbotConfig(newCfg)
  }

  const handleDeleteMenuOption = async (id: string) => {
    const currentOpts = Array.isArray(chatbotConfig.custom_menu_options) ? [...chatbotConfig.custom_menu_options] : []
    const updated = currentOpts.filter((o) => o.id !== id)
    const newCfg = { ...chatbotConfig, custom_menu_options: updated }
    setChatbotConfig(newCfg)
    await handleSaveChatbotConfig(newCfg)
  }

  const handleSimulateMessage = async (msgText: string) => {
    if (!msgText.trim()) return
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    setSimMessages((prev) => [...prev, { sender: "user", text: msgText, time: nowTime }])
    setSimInput("")
    setSimLoading(true)

    try {
      const res = await api.intellizapp.chatbotTest({
        message: msgText,
        conversation_id: simConvId,
      })
      if (res.conversation_id) setSimConvId(res.conversation_id)
      setSimMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.response_text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          buttons: res.buttons,
        },
      ])
    } catch {
      setSimMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "⚠️ Ocurrió un error al contactar al motor de chatbot. Verificá que la API esté activa.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    } finally {
      setSimLoading(false)
    }
  }

  const handleResetSimulator = async () => {
    setSimLoading(true)
    try {
      const res = await api.intellizapp.chatbotTest({
        message: "hola",
        conversation_id: simConvId,
        reset: true,
      })
      setSimConvId(res.conversation_id)
      setSimMessages([
        {
          sender: "bot",
          text: res.response_text || "Conversación reiniciada. ¿En qué puedo ayudarte?",
          time: "Ahora",
          buttons: res.buttons,
        },
      ])
      toast.info("Simulador Reiniciado", "Sesión de prueba en estado inicial")
    } catch {
      setSimMessages([
        {
          sender: "bot",
          text: "🛒 ¡Hola! Bienvenido a Extra Supermercado. Sesión de prueba reiniciada.",
          time: "Ahora",
        },
      ])
    } finally {
      setSimLoading(false)
    }
  }

  // ── Campañas Masivas ──
  const fetchCampaigns = async () => {
    setCampaignsLoading(true)
    try {
      const data = await api.intellizapp.listCampaigns()
      setCampaigns(data || [])
    } catch {
      setCampaigns([])
    } finally {
      setCampaignsLoading(false)
    }
  }

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campForm.name.trim()) return
    try {
      await api.intellizapp.createCampaign({
        name: campForm.name,
        description: campForm.description,
        tipo: campForm.tipo,
        message_template: campForm.message_template,
      })
      toast.success("Campaña Creada", "La campaña quedó registrada en borrador")
      setShowCampModal(false)
      setCampForm({
        name: "",
        description: "",
        tipo: "promotion",
        message_template: "",
      })
      fetchCampaigns()
    } catch (e: any) {
      toast.error("Error al crear campaña", e?.message || "No se pudo registrar")
    }
  }

  const handleLaunchCampaign = async (campId: string) => {
    if (!confirm("¿Deseas iniciar el despacho masivo de esta campaña a través de Evolution API?")) return
    setLaunchingCampId(campId)
    try {
      const resLaunch = await api.intellizapp.launchCampaign(campId)
      toast.info("Segmento Resuelto", `Se prepararon ${resLaunch.total_recipients || 0} destinatarios`)
      // Enviar primer lote
      const resBatch = await api.intellizapp.sendBatch(campId, 25)
      toast.success("Lote Despachado", `Enviados: ${resBatch.sent}. Restantes: ${resBatch.remaining}`)
      fetchCampaigns()
    } catch (e: any) {
      toast.error("Error al lanzar campaña", e?.message || "Fallo en el despacho")
    } finally {
      setLaunchingCampId(null)
    }
  }

  // ── Automatizaciones ──
  const fetchRules = async () => {
    setRulesLoading(true)
    try {
      const data = await api.intellizapp.listRules()
      setRules(data || [])
    } catch {
      setRules([])
    } finally {
      setRulesLoading(false)
    }
  }

  const handleToggleRule = async (rule: IntelliZappAutomationRule) => {
    try {
      await api.intellizapp.updateRule(rule.id, { active: !rule.active })
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
      )
      toast.success("Regla Actualizada", `Regla "${rule.name}" ${!rule.active ? "activada" : "pausada"}`)
    } catch {
      toast.error("Error", "No se pudo actualizar el estado de la regla")
    }
  }

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleForm.name.trim()) return
    try {
      await api.intellizapp.createRule(ruleForm as any)
      toast.success("Regla Creada", "La automatización se ejecutará ante el evento seleccionado")
      setShowRuleModal(false)
      setRuleForm({
        name: "",
        trigger_event: "sale.created",
        message_template: "",
        delay_minutes: 0,
        active: true,
      })
      fetchRules()
    } catch (e: any) {
      toast.error("Error al crear regla", e?.message || "No se pudo registrar la automatización")
    }
  }

  // ── Plantillas ──
  const fetchTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const data = await api.whatsapp.listTemplates()
      setTemplates(data || [])
    } catch (e: any) {
      toast.error("Error", e?.response?.data?.detail || "No se pudieron cargar las plantillas")
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleSeedTemplates = async () => {
    setSeedingTemplates(true)
    try {
      const data = await api.whatsapp.seedTemplates()
      setTemplates(data || [])
      toast.success("Plantillas Sincronizadas", "Se cargaron y actualizaron las plantillas oficiales de Extra Supermercado")
    } catch (e: any) {
      toast.error("Error al sincronizar", e?.response?.data?.detail || e?.message || "No se pudieron sincronizar las plantillas")
    } finally {
      setSeedingTemplates(false)
    }
  }

  const insertVariableIntoContent = (variableKey: string) => {
    const el = templateTextareaRef.current
    if (!el) {
      setTemplateForm((prev) => ({ ...prev, content: `${prev.content} {${variableKey}}` }))
      return
    }
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const text = templateForm.content
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)
    const newContent = `${before}{${variableKey}}${after}`
    setTemplateForm((prev) => ({ ...prev, content: newContent }))
    setTimeout(() => {
      el.focus()
      const newCursor = start + variableKey.length + 2
      el.setSelectionRange(newCursor, newCursor)
    }, 50)
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingTemplate(true)
    try {
      if (editingTemplate) {
        await api.whatsapp.updateTemplate(editingTemplate.id, templateForm)
        toast.success("Plantilla Actualizada", "Los cambios fueron guardados exitosamente")
      } else {
        await api.whatsapp.createTemplate(templateForm)
        toast.success("Plantilla Creada", "La plantilla fue registrada con éxito")
      }
      setShowTemplateModal(false)
      setEditingTemplate(null)
      fetchTemplates()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "No se pudo guardar la plantilla"
      toast.error("Error al guardar", detail)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleToggleTemplateActive = async (tmpl: WhatsAppTemplate) => {
    try {
      const nextActive = tmpl.active === false ? true : false
      await api.whatsapp.updateTemplate(tmpl.id, { active: nextActive })
      setTemplates((prev) => prev.map((t) => (t.id === tmpl.id ? { ...t, active: nextActive } : t)))
      toast.success(nextActive ? "Plantilla Activada" : "Plantilla Desactivada", tmpl.name)
    } catch (err: any) {
      toast.error("Error al cambiar estado", err?.message || "No se pudo actualizar")
    }
  }

  const handleCraftWithAi = async (instruction?: string) => {
    const promptToUse = instruction || aiInstruction
    setCraftingAi(true)
    try {
      const availableVars = [
        "cliente", "nombre", "ticket", "numero", "monto", "total",
        "puntos", "socio_numero", "cupones_generados", "campana_sorteo",
        "sorteo", "cupones_totales", "documento", "valor_monetario",
        "fecha", "direccion", "repartidor", "oferta_titulo", "precio_oferta",
        "precio_regular"
      ]
      const res = await api.whatsapp.craftTemplateWithAi({
        tipo: templateForm.tipo,
        current_content: templateForm.content,
        prompt_instruction: promptToUse,
        available_variables: availableVars,
      })
      if (res && res.crafted_content) {
        setTemplateForm((prev) => ({ ...prev, content: res.crafted_content }))
        toast.success("Mensaje redactado con IA", `Generado con éxito usando ${res.model_used || "Qwen 2.5"}`)
        setAiInstruction("")
      }
    } catch (err: any) {
      toast.error("Error al redactar con IA", err?.response?.data?.detail || err?.message || "Verificá la conexión con Ollama")
    } finally {
      setCraftingAi(false)
    }
  }

  const renderSimulatedContent = (content: string, tipo: string) => {
    if (!content) return ""
    const meta = SYSTEM_TRIGGERS[tipo]
    const sample: Record<string, string> = {
      cliente: "María González",
      nombre: "María González",
      ticket: "001-002-0048291",
      numero: "001-002-0048291",
      monto: "185.000",
      total: "185.000",
      puntos: "1.850",
      socio_numero: "EX-9482",
      documento: "4.892.103",
      valor_monetario: "185.000",
      cupones_generados: "3",
      cupones_totales: "12",
      campana_sorteo: "Gran Sorteo Extra Supermercado",
      sorteo: "Gran Sorteo Extra Supermercado",
      empresa: "Extra Supermercado",
      fecha: "20/09/2026 18:30",
      direccion: "Avda. Monday c/ Toledo",
      repartidor: "Juan Cardozo",
      oferta_titulo: "Tira de Costilla Premium",
      precio_oferta: "32.900",
      precio_regular: "45.000",
      ...(meta?.sampleVars || {}),
    }

    let res = content
    Object.entries(sample).forEach(([k, v]) => {
      const reg = new RegExp(`\\{{1,2}\\s*${k}\\s*\\}{1,2}`, "gi")
      res = res.replace(reg, v)
    })
    return res
  }

  const handleDeleteTemplate = async (tmplId: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return
    try {
      await api.whatsapp.deleteTemplate(tmplId)
      toast.success("Plantilla Eliminada", "Se removió de la base de datos")
      fetchTemplates()
    } catch (err: any) {
      toast.error("Error", err?.response?.data?.detail || "No se pudo eliminar la plantilla")
    }
  }

  const filteredConversations = useMemo(() => {
    let list = conversations
    if (convFilter === "optin") {
      list = list.filter((c: any) => c.session_data?.optin_promociones === true)
    } else if (convFilter === "unread") {
      list = list.filter((c: any) => (c.mensajes_no_leidos || 0) > 0)
    }
    if (!searchConv.trim()) return list
    const q = searchConv.toLowerCase()
    return list.filter(
      (c) =>
        c.contact_name?.toLowerCase().includes(q) ||
        c.contact_phone?.toLowerCase().includes(q) ||
        c.ultimo_mensaje?.toLowerCase().includes(q)
    )
  }, [conversations, searchConv, convFilter])

  // KPIs del Command Deck
  const analytics = useMemo(() => {
    const totalMsgs = conversations.reduce((acc, c) => acc + (Number((c as any).total_mensajes) || (c.ultimo_mensaje ? 2 : 1)), 0)
    const activeRules = rules.filter((r) => r.active).length
    return {
      conversationsCount: conversations.length,
      totalMessages: totalMsgs > 0 ? totalMsgs : (conversations.length ? conversations.length * 4 : 0),
      templatesCount: templates.length,
      rulesCount: rules.length,
      activeRulesCount: activeRules,
      campaignsCount: campaigns.length,
    }
  }, [conversations, rules, templates, campaigns])

  return (
    <div className="space-y-6 animate-fade-in-up pb-16 font-sans">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-7 border border-emerald-500/20 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 border border-emerald-400/30 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <MessageCircle className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    status?.connected ? "bg-emerald-400" : (status?.state === "connecting" ? "bg-amber-400" : "bg-rose-400")
                  }`} />
                  <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-slate-950 ${
                    status?.connected ? "bg-emerald-500" : (status?.state === "connecting" ? "bg-amber-500" : "bg-rose-500")
                  }`} />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    CRM & COMUNICACIÓN · PASARELA WHATSAPP & INTELLIZAPP BOT
                  </span>
                  {loadingStatus ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Verificando...
                    </span>
                  ) : status?.connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Conectado (Evolution API Online)
                    </span>
                  ) : status?.state === "connecting" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      Esperando Escaneo QR
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      Gateway Desconectado
                    </span>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  WhatsApp & IntelliZapp Hub
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Motor de mensajería empresarial Evolution API (:8085) integrado con Chatbot IA, fidelidad ExtraClub y automatizaciones
                </p>
              </div>
            </div>

            {/* Micro pills de telemetría */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                📱 Instancia: extra_supermercado
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-teal-300">
                🤖 {chatbotConfig?.auto_reply ? "ExtraBot IA Activo" : "Bot Pausado"}
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                ⚡ {analytics.activeRulesCount} Reglas Automáticas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => fetchGatewayStatus()}
              disabled={loadingStatus}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Refrescar Estado"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            <button
              onClick={() => setTab("chatbot")}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-teal-300 hover:text-white border border-teal-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Bot className="w-4 h-4 text-teal-400" />
              <span>Simulador Bot</span>
            </button>
            <button
              onClick={() => window.open(DEFAULT_MANAGER_URL, "_blank")}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Evolution Manager (:8085)</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE 6 KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {[
            {
              label: "Estado Pasarela",
              val: status?.connected ? "Conectado" : (status?.state === "connecting" ? "Esperando QR" : "Offline"),
              color: status?.connected ? "text-emerald-400" : (status?.state === "connecting" ? "text-amber-400" : "text-rose-400"),
              icon: Smartphone
            },
            {
              label: "Conversaciones",
              val: analytics.conversationsCount.toLocaleString("es-PY"),
              color: "text-blue-300",
              icon: MessageSquare
            },
            {
              label: "Volumen Mensajes",
              val: analytics.totalMessages.toLocaleString("es-PY"),
              color: "text-emerald-300",
              icon: MessageCircle
            },
            {
              label: "Plantillas Oficiales",
              val: analytics.templatesCount.toLocaleString("es-PY"),
              color: "text-purple-300",
              icon: FileText
            },
            {
              label: "Reglas de Disparo",
              val: `${analytics.activeRulesCount}/${analytics.rulesCount}`,
              color: "text-amber-300",
              icon: Zap
            },
            {
              label: "Campañas Masivas",
              val: analytics.campaignsCount.toLocaleString("es-PY"),
              color: "text-pink-300",
              icon: Megaphone
            },
          ].map((kpi) => (
            <div key={kpi.label} className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-base font-black font-mono tracking-tight ${kpi.color}`}>{kpi.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 📘 GUÍAS DIDÁCTICAS DUALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3 text-xs text-emerald-950 dark:text-emerald-300">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-950 dark:text-emerald-200 mb-0.5">
              Pasarela Evolution API & Mensajería Directa
            </p>
            <p className="text-emerald-800 dark:text-emerald-400 leading-relaxed">
              Conexión directa vía WebSocket en el puerto <code>:8085</code> con la instancia <code>extra_supermercado</code>. Permite despachar tickets térmicos digitales al cerrar ventas en caja, avisos de acreditación de pagos y promociones masivas sin costo por mensaje.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 flex items-start gap-3 text-xs text-teal-950 dark:text-teal-300">
          <Bot className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase text-[11px] tracking-wider text-teal-950 dark:text-teal-200 mb-0.5">
              ExtraBot IA & Fidelidad ExtraClub
            </p>
            <p className="text-teal-800 dark:text-teal-400 leading-relaxed">
              El motor conversacional responde automáticamente con precios vigentes en Guaraníes (<i>Gs.</i>), existencias en góndola (<i>StockLot</i>), horarios de atención y consulta de saldo de puntos para socios del programa <b>ExtraClub</b> en tiempo real.
            </p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "connection", label: "Conexión QR", icon: Smartphone, count: null },
          { key: "conversations", label: "Chat en Vivo", icon: MessageSquare, count: conversations.length },
          { key: "chatbot", label: "Agente IA (InteliZapp)", icon: Bot, count: null },
          { key: "campaigns", label: "Campañas Masivas", icon: Megaphone, count: campaigns.length },
          { key: "automations", label: "Automatizaciones", icon: Zap, count: rules.length },
          { key: "templates", label: "Plantillas Oficiales", icon: FileText, count: templates.length },
          { key: "gateway", label: "Servidor & Gateway", icon: Server, count: null },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== null && t.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  active
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: CONEXIÓN & DIAGNÓSTICO QR ── */}
      {tab === "connection" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Emparejamiento de WhatsApp</h2>
                    <p className="text-xs text-slate-500">Escaneá el código QR desde la app móvil en tu teléfono</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300">
                  Instancia: {INSTANCE_NAME}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/40 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/80 flex flex-col items-center justify-center min-h-[300px]">
                {loadingQr ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium animate-pulse">Generando código QR desde Evolution API...</p>
                  </div>
                ) : status?.connected ? (
                  <div className="flex flex-col items-center text-center gap-3 py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Línea Conectada y Operativa</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        La sesión con Extra Supermercado está activa. Los mensajes automáticos, cupones, chatbot y campañas masivas despachan por este canal.
                      </p>
                    </div>
                    <button onClick={handleDisconnect} disabled={disconnecting} className="mt-3 btn-danger text-xs py-2 px-4 flex items-center gap-1.5">
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
                      <p className="text-[11px] text-slate-400">El código expira en 30-40 segundos. Escanealo inmediatamente.</p>
                    </div>
                    {pairingCode && (
                      <div className="mt-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-2 rounded-xl flex items-center gap-2">
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Código numérico alternativo:</span>
                        <code className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">{pairingCode}</code>
                      </div>
                    )}
                    <button
                      onClick={handleResetSession}
                      disabled={loadingQr}
                      className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 mt-1 underline underline-offset-2 cursor-pointer"
                      title="Si el celular dice 'No pudo vincular', hacé clic aquí para resetear la sesión zombi"
                    >
                      <RotateCcw className="w-3 h-3" /> ¿Dio error al escanear? Limpiar sesión y regenerar QR
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center gap-3 py-10">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                      <QrCode className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Sin Código QR Activo</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">Hacé clic abajo para solicitar un código de vinculación en tiempo real.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tips si el celular dice 'No pudo vincular' */}
              {!status?.connected && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    ¿Tu celular dice &quot;No se pudo vincular el dispositivo&quot;?
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-amber-700 dark:text-amber-400">
                    <li>
                      <strong>Máximo 4 dispositivos:</strong> En tu WhatsApp, revisá <em>Dispositivos vinculados</em>. Si ya tenés 4 sesiones activas, cerrá sesión en una de ellas.
                    </li>
                    <li>
                      <strong>Escaneo inmediato:</strong> Escaneá el QR apenas aparezca en pantalla antes de que expire su rotación (25-30s).
                    </li>
                    <li>
                      <strong>Sesión residual:</strong> Hacé clic en <em>Limpiar sesión y regenerar QR</em> para purgar cualquier intento incompleto previo.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Cifrado punto a punto vía Evolution Engine
              </div>
              {!status?.connected && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetSession}
                    disabled={loadingQr}
                    className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-slate-600 dark:text-slate-300"
                    title="Cierra cualquier intento previo y genera un QR 100% fresco"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Resetear
                  </button>
                  <button
                    onClick={handleRequestQr}
                    disabled={loadingQr}
                    className="btn-primary py-2 px-4 text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    {loadingQr ? "Generando..." : "Generar Código QR"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Consola de Envío Inmediato</h2>
                  <p className="text-xs text-slate-500">Probá el despacho en tiempo real a tu celular</p>
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
                  <p className="text-[10px] text-slate-400 mt-1">Normalizado automáticamente a formato internacional E.164 (+595...).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Cuerpo del Mensaje</label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    rows={4}
                    className="input text-xs resize-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Soporta negrita con *asteriscos*, cursiva y emojis.</p>
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
                <p>Presencia de escritura (*composing*) y delay humanizado de 1.2 segundos para resguardar la línea.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CENTRO DE CONTACTO & CHAT EN VIVO OMNICANAL ── */}
      {tab === "conversations" && (
        <LiveChatHub
          currentUserId={user?.id}
          currentUserName={user?.nombre || "Operador"}
        />
      )}

      {/* ── TAB 3: CHATBOT IA & CONSTRUCTOR VISUAL DE FLUJOS ── */}
      {tab === "chatbot" && (
        <div className="space-y-6">
          {/* Sub-navegación Chatbot: Flujo Visual vs Ajustes Generales */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBotSubTab("ai_agent")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  botSubTab === "ai_agent"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/40"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <Bot className="w-4 h-4 text-emerald-300" />
                <span>Agente IA Conversacional (Qwen 2.5 7B)</span>
                <span className="bg-emerald-500/30 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                  IntelliZapp Local
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBotSubTab("settings")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  botSubTab === "settings"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Horarios de Atención & FAQ General</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Instancia: <code className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">extra_supermercado</code>
              </span>
              <button
                type="button"
                onClick={() => handleToggleAutoReply(!chatbotConfig.auto_reply)}
                disabled={togglingAutoReply}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer ${
                  chatbotConfig.auto_reply
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/40"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25 ring-2 ring-rose-400/40 animate-pulse"
                }`}
                title={chatbotConfig.auto_reply ? "Hacé clic para pausar el Agente IA" : "Hacé clic para activar el Agente IA"}
              >
                {togglingAutoReply ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                <span>{chatbotConfig.auto_reply ? "Agente IA: ACTIVO" : "Agente IA: EN PAUSA"}</span>
              </button>
            </div>
          </div>

          {botSubTab === "ai_agent" && (
            <div className="space-y-6">
              {/* 1. ESTADO DE SALUD DEL SERVIDOR OLLAMA / INTELLIZAPP */}
              <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl shadow-emerald-950/20 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-inner">
                      <Cpu className="w-6 h-6 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-black tracking-tight text-white">
                          Motor de IA Local Qwen 2.5 7B Instruct
                        </h3>
                        {aiAgentStatus?.online ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            ONLINE ({aiAgentStatus.latency_ms || 45} ms)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/25 text-rose-300 border border-rose-400/30">
                            <span className="w-2 h-2 rounded-full bg-rose-400" />
                            OFFLINE / RECONECTANDO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Alojado en servidor dedicado <code className="text-emerald-300 font-mono font-bold">intellihouse-dev (100.72.38.119:11434)</code> • Inferencia en CPU (16 vCPUs Xeon Gold / 21 GB RAM libres).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchAiAgentStatus}
                      disabled={loadingAiStatus}
                      className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-emerald-500/30 text-xs font-bold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingAiStatus ? "animate-spin" : ""}`} />
                      <span>Verificar Estado</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-emerald-500/20 text-xs">
                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-black tracking-wider">Modelo Activo</span>
                    <span className="font-mono font-black text-emerald-300 text-sm">qwen2.5:7b-instruct</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Bilingüe Español / Portugués nativo</span>
                  </div>
                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-black tracking-wider">Aislamiento de Carga</span>
                    <span className="font-bold text-white text-sm">0% Carga en Supermercado</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Cajas físicas POS y BD 100% blindadas</span>
                  </div>
                  <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-black tracking-wider">Herramientas Conectadas</span>
                    <span className="font-bold text-teal-300 text-sm">Cotizaciones, Catálogo, ExtraClub, PDF</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Consulta directa en PostgreSQL en tiempo real</span>
                  </div>
                </div>
              </div>

              {/* 2. CENTRO DE CONTROL DE DIRECTIVAS & REGLAS DE VENTA DEL AGENTE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  {/* Card: Directivas del Negocio */}
                  <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Directivas e Instrucciones Adicionales del Negocio
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">
                        Se inyecta en caliente al System Prompt de Qwen 2.5
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Pautas operativas actuales para el Agente (Prompts y Énfasis)
                      </label>
                      <textarea
                        rows={4}
                        value={chatbotConfig?.ai_agent?.custom_instructions || ""}
                        onChange={(e) => {
                          const updated = {
                            ...chatbotConfig,
                            ai_agent: {
                              ...(chatbotConfig?.ai_agent || {}),
                              custom_instructions: e.target.value,
                            },
                          }
                          setChatbotConfig(updated)
                        }}
                        placeholder="Ejemplo: 'Este fin de semana dar énfasis especial a los cortes de asado envasados al vacío. Recordar a los clientes brasileños que aceptamos PIX y Reales al cambio del día sin comisión extra. Si preguntan por horarios de feriado, abrimos de 07:30 a 20:00 hs.'"
                        className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                      />
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400">Plantillas rápidas:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = chatbotConfig?.ai_agent?.custom_instructions || ""
                            const added = current ? `${current}\n• Enfatizar cortes parrilleros y sugerir carbón y mandioca para el asado.` : "• Enfatizar cortes parrilleros y sugerir carbón y mandioca para el asado."
                            setChatbotConfig({
                              ...chatbotConfig,
                              ai_agent: { ...(chatbotConfig?.ai_agent || {}), custom_instructions: added }
                            })
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 border border-slate-200 dark:border-slate-700"
                        >
                          🥩 Impulsar Asado Fin de Semana
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const current = chatbotConfig?.ai_agent?.custom_instructions || ""
                            const added = current ? `${current}\n• Informar a los clientes en portugués que aceptamos PIX y reales en efectivo al cambio del día.` : "• Informar a los clientes en portugués que aceptamos PIX y reales en efectivo al cambio del día."
                            setChatbotConfig({
                              ...chatbotConfig,
                              ai_agent: { ...(chatbotConfig?.ai_agent || {}), custom_instructions: added }
                            })
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 border border-slate-200 dark:border-slate-700"
                        >
                          🇧🇷 Pagar en Reales / PIX
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Promociones u Ofertas a sugerir activamente hoy
                      </label>
                      <textarea
                        rows={3}
                        value={chatbotConfig?.ai_agent?.emphasis_promotions || ""}
                        onChange={(e) => {
                          const updated = {
                            ...chatbotConfig,
                            ai_agent: {
                              ...(chatbotConfig?.ai_agent || {}),
                              emphasis_promotions: e.target.value,
                            },
                          }
                          setChatbotConfig(updated)
                        }}
                        placeholder="Ejemplo: 'Tapa Cuadril a Gs. 55.000 el kilo. Fardo de cerveza Corona 6x330ml con 20% de descuento. 2x1 en galletitas dulces surtidas.'"
                        className="w-full text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Card: Funcionalidades Automáticas */}
                  <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Módulos Comerciales y Acciones del Agente
                    </h4>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <ShoppingCart className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-900 dark:text-white">Venta Cruzada Inteligente (Cross-Selling)</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">El agente sugiere carbón y bebidas si compran carne, salsas si compran fideos, etc.</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={chatbotConfig?.ai_agent?.cross_selling_active !== false}
                          onChange={(e) => {
                            setChatbotConfig({
                              ...chatbotConfig,
                              ai_agent: { ...(chatbotConfig?.ai_agent || {}), cross_selling_active: e.target.checked }
                            })
                          }}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-900 dark:text-white">Emisión de Presupuesto en PDF Premium (ReportLab)</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Genera y envía automáticamente el comprobante de pedido con totales en Gs y R$ al WhatsApp del cliente.</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={chatbotConfig?.ai_agent?.cart_pdf_active !== false}
                          onChange={(e) => {
                            setChatbotConfig({
                              ...chatbotConfig,
                              ai_agent: { ...(chatbotConfig?.ai_agent || {}), cart_pdf_active: e.target.checked }
                            })
                          }}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-900 dark:text-white">Derivación Automática a Asesor Humano</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Pausa el bot al cerrar un pedido o cuando el cliente solicita hablar con una persona, notificando al operador.</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={true}
                          className="w-4 h-4 text-emerald-600 rounded cursor-not-allowed opacity-80"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel Lateral: Información Corporativa & Guardar */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      Blindaje & Datos Corporativos
                    </h4>
                    <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-400">Razón Social:</span>
                        <span className="font-bold text-slate-900 dark:text-white">GRUPO SANTA TERESA E.A.S.</span>
                      </div>
                      <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-400">Nombre Fantasía:</span>
                        <span className="font-bold text-slate-900 dark:text-white">Extra Supermercado</span>
                      </div>
                      <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-400">RUC:</span>
                        <span className="font-bold text-slate-900 dark:text-white">80150377-9</span>
                      </div>
                      <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-400">Moneda Base:</span>
                        <span className="font-bold text-slate-900 dark:text-white">Guaraníes (PYG)</span>
                      </div>
                      <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                        <span className="text-slate-400">ExtraClub Regla:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">1 Punto = Gs. 100</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        🔒 <b>Guardrail Activo:</b> El agente tiene prohibido divulgar costos de compra, márgenes de ganancia, contraseñas o nombres de proveedores mayoristas.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveChatbotConfig()}
                      disabled={savingChatbotConfig}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {savingChatbotConfig ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Guardar Directivas del Agente IA</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {botSubTab === "settings" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel Izquierdo: Configuración, Palabras Clave y Menú Personalizado */}
          <div className="lg:col-span-6 space-y-6">
            {/* Card 1: Configuración Base */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Configuración del Chatbot IA</h2>
                    <p className="text-xs text-slate-500">Parámetros de atención automática de Extra Supermercado</p>
                  </div>
                </div>

                {/* Toggle Auto-responder Inmediato */}
                <button
                  type="button"
                  onClick={() => handleToggleAutoReply(!chatbotConfig.auto_reply)}
                  disabled={togglingAutoReply}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black transition cursor-pointer ${
                    chatbotConfig.auto_reply
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300"
                  }`}
                  title="Cambiar estado inmediato del autorespondedor"
                >
                  {togglingAutoReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Power className="w-4 h-4" />
                  )}
                  <span>{chatbotConfig.auto_reply ? "Auto-Responder: ACTIVO" : "Auto-Responder: APAGADO"}</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre del Asistente Virtual</label>
                  <input
                    type="text"
                    value={chatbotConfig.bot_name}
                    onChange={(e) => setChatbotConfig({ ...chatbotConfig, bot_name: e.target.value })}
                    className="input text-xs"
                    placeholder="Ej: ExtraBot"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Horario Apertura</label>
                    <input
                      type="time"
                      value={chatbotConfig.business_hours_start}
                      onChange={(e) => setChatbotConfig({ ...chatbotConfig, business_hours_start: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Horario Cierre</label>
                    <input
                      type="time"
                      value={chatbotConfig.business_hours_end}
                      onChange={(e) => setChatbotConfig({ ...chatbotConfig, business_hours_end: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mensaje de Saludo & Bienvenida</label>
                  <textarea
                    rows={3}
                    value={chatbotConfig.welcome_message}
                    onChange={(e) => setChatbotConfig({ ...chatbotConfig, welcome_message: e.target.value })}
                    className="input text-xs resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Usá &#123;cliente&#125; para personalizar con el nombre del contacto.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mensaje Fuera de Horario Comercial</label>
                  <textarea
                    rows={3}
                    value={chatbotConfig.out_of_hours_message}
                    onChange={(e) => setChatbotConfig({ ...chatbotConfig, out_of_hours_message: e.target.value })}
                    className="input text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Módulos Activos en el Menú:</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: "catalog_search", label: "📦 Catálogo & Precios en Gs." },
                      { key: "extraclub_points", label: "⭐ Puntos ExtraClub" },
                      { key: "order_tracking", label: "📋 Rastreo de Compras" },
                      { key: "supermarket_info", label: "ℹ️ Horarios & Sucursal" },
                      { key: "human_handoff", label: "👤 Derivación a Humano" },
                    ].map((m) => (
                      <label key={m.key} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={chatbotConfig.modules_enabled?.[m.key] !== false}
                          onChange={(e) =>
                            setChatbotConfig({
                              ...chatbotConfig,
                              modules_enabled: {
                                ...chatbotConfig.modules_enabled,
                                [m.key]: e.target.checked,
                              },
                            })
                          }
                          className="w-3.5 h-3.5 accent-emerald-600 rounded"
                        />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => handleSaveChatbotConfig()}
                    disabled={savingChatbotConfig}
                    className="btn-primary py-2.5 px-6 text-xs flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {savingChatbotConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar Configuración General
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Respuestas Rápidas por Palabras Clave (Keywords & FAQ) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Respuestas por Palabras Clave</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                        {Array.isArray(chatbotConfig.keywords) ? chatbotConfig.keywords.length : 0} reglas
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Si el mensaje del cliente contiene estas palabras clave, el bot responde de inmediato</p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenKeywordModal()}
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5" /> Nueva Regla
                </button>
              </div>

              {/* Lista de Palabras Clave */}
              {(!chatbotConfig.keywords || chatbotConfig.keywords.length === 0) ? (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No tenés reglas de palabras clave configuradas.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Creá una regla como "delivery" o "transferencia" para responder automáticamente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatbotConfig.keywords.map((kw: any) => (
                    <div
                      key={kw.id}
                      className={`p-4 rounded-2xl border transition ${
                        kw.active !== false
                          ? "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800"
                          : "bg-slate-100/40 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{kw.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${kw.active !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {kw.active !== false ? "Activo" : "Pausado"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleKeyword(kw.id)}
                            className="p-1 text-slate-400 hover:text-emerald-600"
                            title={kw.active !== false ? "Pausar regla" : "Activar regla"}
                          >
                            <CheckCircle2 className={`w-4 h-4 ${kw.active !== false ? "text-emerald-500" : "text-slate-300"}`} />
                          </button>
                          <button
                            onClick={() => handleOpenKeywordModal(kw)}
                            className="p-1 text-slate-400 hover:text-indigo-600"
                            title="Editar regla"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteKeyword(kw.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Eliminar regla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Chips de Palabras Clave */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(Array.isArray(kw.keywords) ? kw.keywords : (kw.keywords ? [kw.keywords] : [])).map((w: string, idx: number) => (
                          <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-mono">
                            #{w}
                          </span>
                        ))}
                      </div>

                      {/* Preview de la respuesta */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800 whitespace-pre-wrap line-clamp-2">
                        {kw.response}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 3: Opciones Extras del Menú Principal */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Opciones Extras de Menú</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
                        {Array.isArray(chatbotConfig.custom_menu_options) ? chatbotConfig.custom_menu_options.length : 0} opciones
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Agregá ítems (6, 7...) al menú principal con respuestas personalizadas</p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenMenuOptionModal()}
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5" /> Nueva Opción
                </button>
              </div>

              {/* Lista de Opciones Extras */}
              {(!chatbotConfig.custom_menu_options || chatbotConfig.custom_menu_options.length === 0) ? (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No hay opciones personalizadas añadidas al menú.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Podés agregar una opción 6 como "Ofertas de Carnicería" o "Atención Mayorista".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatbotConfig.custom_menu_options.map((opt: any) => (
                    <div
                      key={opt.id}
                      className={`p-4 rounded-2xl border transition ${
                        opt.active !== false
                          ? "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800"
                          : "bg-slate-100/40 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                            {opt.number}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{opt.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${opt.active !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {opt.active !== false ? "Activo" : "Pausado"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleMenuOption(opt.id)}
                            className="p-1 text-slate-400 hover:text-emerald-600"
                            title={opt.active !== false ? "Pausar opción" : "Activar opción"}
                          >
                            <CheckCircle2 className={`w-4 h-4 ${opt.active !== false ? "text-emerald-500" : "text-slate-300"}`} />
                          </button>
                          <button
                            onClick={() => handleOpenMenuOptionModal(opt)}
                            className="p-1 text-slate-400 hover:text-indigo-600"
                            title="Editar opción"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMenuOption(opt.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Eliminar opción"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Preview de la respuesta */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800 whitespace-pre-wrap line-clamp-2">
                        {opt.response}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Simulador Interactivo de Chatbot en Vivo */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Simulador en Vivo</h3>
                    <p className="text-[11px] text-slate-400">Probá cómo responderá el bot a tus clientes</p>
                  </div>
                </div>
                <button
                  onClick={handleResetSimulator}
                  disabled={simLoading}
                  className="btn-outline py-1.5 px-2.5 text-[11px] flex items-center gap-1 text-slate-500 hover:text-emerald-600"
                  title="Reiniciar conversación"
                >
                  <RotateCcw className="w-3 h-3" /> Reiniciar
                </button>
              </div>

              {/* Marco Superior Smartphone Mockup */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner flex flex-col">
                <div className="bg-slate-900 text-white px-4 py-1.5 flex items-center justify-between text-[10px] font-mono">
                  <span className="font-bold">09:41</span>
                  <div className="w-14 h-3 bg-black rounded-full" />
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-300">
                    <span>5G</span>
                    <span>100%</span>
                  </div>
                </div>
                {/* Header de WhatsApp en el Teléfono */}
                <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-3.5 py-2 flex items-center gap-2.5 shadow-sm">
                  <div className="w-7 h-7 rounded-full bg-emerald-800 border border-emerald-500/40 flex items-center justify-center font-bold text-xs">
                    🛒
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-xs truncate">Extra Supermercado</span>
                      <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
                    </div>
                    <span className="text-[10px] text-emerald-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      en línea (ExtraBot IA)
                    </span>
                  </div>
                </div>

                {/* Teléfono simulado */}
                <div className="bg-slate-100/80 dark:bg-slate-950/70 p-4 min-h-[350px] max-h-[400px] overflow-y-auto space-y-3 flex flex-col">
                {simMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-emerald-600 text-white rounded-tr-none"
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/50 dark:border-slate-700"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <span className={`block text-[9px] mt-1 text-right ${msg.sender === "user" ? "text-emerald-100" : "text-slate-400"}`}>
                        {msg.time}
                      </span>
                    </div>

                    {/* Botones de acción simulados */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.buttons.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => handleSimulateMessage(b.id)}
                            disabled={simLoading}
                            className="text-[11px] font-bold bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-xl hover:bg-emerald-50 transition shadow-xs"
                          >
                            {b.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {simLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span>{chatbotConfig.bot_name} está escribiendo...</span>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Input del simulador */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSimulateMessage(simInput)}
                placeholder="Escribí un mensaje o número (ej: 1, arroz, puntos)..."
                className="input text-xs flex-1"
                disabled={simLoading}
              />
              <button
                onClick={() => handleSimulateMessage(simInput)}
                disabled={simLoading || !simInput.trim()}
                className="btn-primary py-2 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Enviar
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* ── TAB 4: CAMPAÑAS MASIVAS (INTELLIZAPP) ── */}
      {tab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Campañas Masivas de Marketing</h2>
              <p className="text-xs text-slate-500">Envíos masivos segmentados a socios ExtraClub con delay anti-bloqueo</p>
            </div>
            <button
              onClick={() => setShowCampModal(true)}
              className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Nueva Campaña Masiva
            </button>
          </div>

          {/* Listado de Campañas */}
          {campaignsLoading ? (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> Cargando campañas...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay campañas registradas</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Creá tu primera campaña de ofertas de fin de semana o reactivación de socios para despachar por WhatsApp.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((camp) => (
                <div key={camp.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-xs">{camp.name}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          camp.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : camp.status === "sending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>
                    {camp.description && <p className="text-xs text-slate-500 mb-2">{camp.description}</p>}
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px]">
                      {camp.message_template || "Sin texto configurado"}
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400">Total</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{camp.total_recipients || 0}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Enviados</span>
                        <p className="text-xs font-bold text-emerald-600">{camp.sent_count || 0}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Entregados</span>
                        <p className="text-xs font-bold text-teal-600">{camp.delivered_count || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                    <button
                      onClick={() => handleLaunchCampaign(camp.id)}
                      disabled={launchingCampId === camp.id}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {launchingCampId === camp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      <span>Lanzar Despacho</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: AUTOMATIZACIONES & TRIGGERS ── */}
      {tab === "automations" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Automatizaciones & Triggers</h2>
              <p className="text-xs text-slate-500">Disparadores automáticos vinculados a ventas en POS, fidelidad y cobranzas</p>
            </div>
            <button
              onClick={() => setShowRuleModal(true)}
              className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Nueva Regla
            </button>
          </div>

          {rulesLoading ? (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> Cargando reglas automáticas...
            </div>
          ) : rules.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <Zap className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay reglas automáticas</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">Creá reglas para enviar tickets digitales al instante tras cada venta en caja.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => (
                <div key={rule.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className={`w-4 h-4 ${rule.active ? "text-amber-500" : "text-slate-300"}`} />
                        <h3 className="font-bold text-slate-900 dark:text-white text-xs">{rule.name}</h3>
                      </div>
                      <button
                        onClick={() => handleToggleRule(rule)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition ${
                          rule.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {rule.active ? "Activa" : "Pausada"}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 mb-2">
                      <span>Disparador: </span>
                      <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300">
                        {rule.trigger_event}
                      </code>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px]">
                      {rule.message_template || "Usa plantilla vinculada"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 6: PLANTILLAS OFICIALES & DISPARADORES ── */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Plantillas Oficiales y Disparadores del Sistema</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Central de mensajes automáticos. Todo texto editado aquí es exactamente lo que el cliente recibe en su WhatsApp.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSeedTemplates}
                disabled={seedingTemplates}
                className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                title="Sincroniza y asegura las plantillas oficiales para todos los eventos del sistema"
              >
                {seedingTemplates ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                )}
                Sincronizar Oficiales
              </button>
              <button
                onClick={fetchTemplates}
                disabled={templatesLoading}
                className="btn-outline p-2 text-slate-600 dark:text-slate-300"
                title="Recargar plantillas"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${templatesLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  setTemplateForm({ name: "", tipo: "sorteo.optin", content: "", active: true })
                  setShowTemplateModal(true)
                }}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Nueva Plantilla
              </button>
            </div>
          </div>

          {/* Filtros por Módulo de Negocio */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50/80 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">Filtrar Módulo:</span>
            {[
              { id: "all", label: "Todas las Plantillas", icon: "🌐" },
              { id: "Ventas / POS", label: "Ventas / POS", icon: "🛒" },
              { id: "Sorteos & Cupones", label: "Sorteos & Cupones", icon: "🎟️" },
              { id: "ExtraClub & Fidelidad", label: "ExtraClub & Fidelidad", icon: "⭐" },
              { id: "Cuentas & Cobranzas", label: "Cuentas & Cobranzas", icon: "💳" },
              { id: "Entregas & Delivery", label: "Entregas & Delivery", icon: "🛵" },
              { id: "Campañas & Marketing", label: "Campañas & Marketing", icon: "📢" },
            ].map((mod) => {
              const isSelected = templateModuleFilter === mod.id
              const count = templates.filter((t) => {
                if (mod.id === "all") return true
                return (t.tipo && SYSTEM_TRIGGERS[t.tipo]?.module === mod.id)
              }).length
              return (
                <button
                  key={mod.id}
                  onClick={() => setTemplateModuleFilter(mod.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-xs font-bold"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                  }`}
                >
                  <span>{mod.icon}</span>
                  <span>{mod.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-emerald-700 text-emerald-100" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
                    {count}
                  </span>
                </button>
              )
            })}
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
                Podés inicializar rápidamente las plantillas recomendadas para Extra Supermercado haciendo clic en el botón inferior.
              </p>
              <button
                onClick={handleSeedTemplates}
                disabled={seedingTemplates}
                className="btn-primary py-2 px-4 text-xs inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 mt-2"
              >
                <Sparkles className="w-4 h-4" /> Cargar Plantillas Oficiales de Supermercado
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates
                .filter((tmpl) => {
                  if (templateModuleFilter === "all") return true
                  return (tmpl.tipo && SYSTEM_TRIGGERS[tmpl.tipo]?.module === templateModuleFilter)
                })
                .map((tmpl) => {
                  const meta = tmpl.tipo ? SYSTEM_TRIGGERS[tmpl.tipo] : undefined
                  const badgeColor =
                    meta?.badge ||
                    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"

                  return (
                    <div
                      key={tmpl.id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all flex flex-col justify-between hover:shadow-md ${
                        tmpl.active !== false
                          ? "border-slate-200/80 dark:border-slate-800 shadow-sm"
                          : "border-slate-200/40 dark:border-slate-800/40 opacity-70 bg-slate-50/50 dark:bg-slate-900/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {meta?.module || "Sistema"}
                            </span>
                            <h3 className="font-bold text-slate-900 dark:text-white text-xs leading-tight mt-0.5">
                              {tmpl.name}
                            </h3>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeColor}`}
                          >
                            {tmpl.tipo}
                          </span>
                        </div>

                        {/* Disparador del sistema */}
                        {meta?.trigger && (
                          <div className="mb-3 px-2.5 py-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-start gap-1.5 text-[10.5px]">
                            <span className="text-amber-500 font-bold shrink-0">⚡ Disparador:</span>
                            <span className="text-slate-600 dark:text-slate-400 leading-tight">
                              {meta.trigger}
                            </span>
                          </div>
                        )}

                        {/* Vista previa mensaje */}
                        <div className="relative group">
                          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                            {tmpl.content}
                          </p>
                          <button
                            onClick={() => {
                              void copyToClipboard(tmpl.content || "")
                              toast.success("Copiado", "Texto copiado al portapapeles")
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-emerald-600"
                            title="Copiar texto"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Footer de la tarjeta con Toggle y Acciones */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={tmpl.active !== false}
                            onChange={() => handleToggleTemplateActive(tmpl)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          <span
                            className={`text-[11px] font-semibold ${
                              tmpl.active !== false
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {tmpl.active !== false ? "Activa" : "Desactivada"}
                          </span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingTemplate(tmpl)
                              setTemplateForm({
                                name: tmpl.name || "",
                                tipo: tmpl.tipo || "custom",
                                content: tmpl.content || "",
                                active: tmpl.active !== false,
                              })
                              setShowTemplateModal(true)
                            }}
                            className="btn-outline py-1.5 px-3 text-xs flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-semibold"
                          >
                            <Edit className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tmpl.id)}
                            className="btn-outline py-1.5 px-2 text-xs text-rose-600 hover:border-rose-300"
                            title="Eliminar plantilla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 7: SERVIDOR & GATEWAY ── */}
      {tab === "gateway" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Telemetría de la Pasarela Evolution API</h2>
              <p className="text-xs text-slate-500">Detalles técnicos del nodo de mensajería y webhooks</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Dirección del Gateway</span>
              <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{DEFAULT_GATEWAY_URL}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Nombre de Instancia</span>
              <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{INSTANCE_NAME}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Endpoint de Webhook</span>
              <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">/api/v1/whatsapp/webhook/evolution</p>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA CAMPAÑA ── */}
      {showCampModal && (
        <Modal open={showCampModal} onClose={() => setShowCampModal(false)} title="Nueva Campaña Masiva">
          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre de la Campaña</label>
              <input
                type="text"
                value={campForm.name}
                onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
                className="input text-xs"
                placeholder="Ej: Ofertas del Fin de Semana"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Descripción / Segmento</label>
              <input
                type="text"
                value={campForm.description}
                onChange={(e) => setCampForm({ ...campForm, description: e.target.value })}
                className="input text-xs"
                placeholder="Ej: Todos los socios activos de ExtraClub"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mensaje de Campaña</label>
              <textarea
                rows={4}
                value={campForm.message_template}
                onChange={(e) => setCampForm({ ...campForm, message_template: e.target.value })}
                className="input text-xs resize-none"
                placeholder="Escribí el texto con {nombre} o {puntos}..."
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setShowCampModal(false)} className="btn-outline py-2 px-4 text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-700">
                Guardar Campaña
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: NUEVA REGLA ── */}
      {showRuleModal && (
        <Modal open={showRuleModal} onClose={() => setShowRuleModal(false)} title="Nueva Regla de Automatización">
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre de la Regla</label>
              <input
                type="text"
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                className="input text-xs"
                placeholder="Ej: Ticket Digital POS"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Evento Disparador</label>
              <select
                value={ruleForm.trigger_event}
                onChange={(e) => setRuleForm({ ...ruleForm, trigger_event: e.target.value })}
                className="input text-xs"
              >
                <option value="sale.created">Venta Completada en POS (Ticket Digital)</option>
                <option value="payment.received">Cobro / Pago Recibido en Caja</option>
                <option value="payment.overdue">Cuota de Crédito por Vencer</option>
                <option value="customer.inactive_30d">Reactivación Socio Inactivo</option>
                <option value="stock.below_minimum">Alerta Interna Stock Mínimo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Plantilla de Mensaje</label>
              <textarea
                rows={4}
                value={ruleForm.message_template}
                onChange={(e) => setRuleForm({ ...ruleForm, message_template: e.target.value })}
                className="input text-xs resize-none"
                placeholder="Cuerpo del mensaje automático..."
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setShowRuleModal(false)} className="btn-outline py-2 px-4 text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-700">
                Guardar Regla
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: PLANTILLA CON ASISTENTE IA & PREVIEW REALISTA ── */}
      {showTemplateModal && (
        <Modal
          open={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          title={editingTemplate ? "Editar Plantilla de WhatsApp" : "Nueva Plantilla de WhatsApp"}
        >
          <form onSubmit={handleSaveTemplate} className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre de la Plantilla</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                className="input text-xs"
                placeholder="Ej: Agradecimiento Compra + Cupones Sorteo + Opt-In"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo / Propósito Oficial
                </label>
                <select
                  value={templateForm.tipo}
                  onChange={(e) => setTemplateForm({ ...templateForm, tipo: e.target.value })}
                  className="input text-xs"
                >
                  <option value="venta.creada">🛒 Ticket Digital POS + Puntos ExtraClub</option>
                  <option value="sorteo.optin">🎟️ Sorteo + Cupones + Opt-In (Recomendada)</option>
                  <option value="cupon.sorteo">🎫 Cupón Oficial Individual de Sorteo</option>
                  <option value="pago.recibido">💳 Cobro / Pago Recibido en Caja</option>
                  <option value="optin.confirmado">🎉 Confirmación Opt-In Validado</option>
                  <option value="extraclub.invitacion">👋 Invitación ExtraClub (No Socio)</option>
                  <option value="extraclub.saldo">⭐ Consulta Saldo ExtraClub</option>
                  <option value="extraclub.premios">🎁 Catálogo Premios Temporada</option>
                  <option value="cuota.recordatorio">🔔 Recordatorio Cuota Crédito</option>
                  <option value="promocion.flash">🔥 Promoción Flash / Oferta del Día</option>
                  <option value="entrega.in_transit">🛵 Entrega en Camino (Delivery)</option>
                  <option value="entrega.delivered">📦 Pedido Entregado en Destino</option>
                  <option value="pedido.pendiente">⏳ Notificación Pedido Pendiente</option>
                  <option value="pedido.listo">✅ Notificación Pedido Listo para Retiro</option>
                  <option value="custom">✏️ Personalizada / Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Clave Técnica Identificadora
                </label>
                <input
                  type="text"
                  value={templateForm.tipo}
                  onChange={(e) => setTemplateForm({ ...templateForm, tipo: e.target.value })}
                  className="input text-xs font-mono"
                  placeholder="ej: venta.creada"
                  required
                />
              </div>
            </div>

            {/* Banner Disparador Vinculado */}
            {SYSTEM_TRIGGERS[templateForm.tipo]?.trigger && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                <Zap className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    Disparador Vinculado ({SYSTEM_TRIGGERS[templateForm.tipo]?.module}):
                  </span>{" "}
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {SYSTEM_TRIGGERS[templateForm.tipo]?.trigger}
                  </span>
                </div>
              </div>
            )}

            {/* ASISTENTE IA PARA REDACTAR EL MENSAJE IDEAL */}
            <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-50 via-indigo-50/40 to-emerald-50 dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-emerald-950/30 border border-purple-200/80 dark:border-purple-800/60 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Asistente IA Copilot (Qwen 2.5)
                    </h4>
                    <p className="text-[10.5px] text-purple-700/80 dark:text-purple-300/70">
                      Crea o pule el texto manteniendo intactas las variables dinámicas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiAssistant(!showAiAssistant)}
                  className="text-xs font-semibold text-purple-700 dark:text-purple-300 hover:underline"
                >
                  {showAiAssistant ? "Ocultar" : "Mostrar Opciones"}
                </button>
              </div>

              {showAiAssistant && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Más cálido y persuasivo",
                      "Breve y conciso",
                      "Destacar sorteo de cupones",
                      "Enfocar en valor de puntos ExtraClub",
                      "Traducir / Adaptar al Portugués",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleCraftWithAi(chip)}
                        disabled={craftingAi}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-medium bg-white/90 dark:bg-slate-900/90 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors shadow-2xs"
                      >
                        ⚡ {chip}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      placeholder="Instrucción a la IA (ej: 'Agrégale un tono festivo y destaca que no tire el ticket')..."
                      className="input text-xs flex-1 bg-white dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleCraftWithAi()}
                      disabled={craftingAi || (!aiInstruction.trim() && !templateForm.content.trim())}
                      className="btn-primary py-2 px-3.5 text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shrink-0"
                    >
                      {craftingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {craftingAi ? "Redactando..." : "Redactar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Inserción asistida de variables */}
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Insertar Variables Dinámicas:
                </span>
                <span className="text-[10px] text-slate-400">Clic para insertar en el cursor</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { key: "cliente", label: "Cliente" },
                  { key: "ticket", label: "Ticket #" },
                  { key: "monto", label: "Monto Gs." },
                  { key: "puntos", label: "Puntos ExtraClub" },
                  { key: "socio_numero", label: "N° Socio" },
                  { key: "valor_monetario", label: "Equiv. Gs." },
                  { key: "cupones_generados", label: "Cupones Nuevos" },
                  { key: "campana_sorteo", label: "Campaña Sorteo" },
                  { key: "cupones_totales", label: "Cupones Totales" },
                  { key: "documento", label: "C.I. / RUC" },
                  { key: "fecha", label: "Fecha" },
                  { key: "cupon_numero", label: "N° Cupón" },
                  { key: "sorteo", label: "Sorteo" },
                  { key: "empresa", label: "Empresa" },
                  { key: "oferta_titulo", label: "Oferta Título" },
                  { key: "precio_oferta", label: "Precio Oferta" },
                  { key: "precio_regular", label: "Precio Regular" },
                ].map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariableIntoContent(v.key)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors shadow-2xs"
                  >
                    +{`{${v.key}}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cuerpo del Mensaje (Formato WhatsApp)
              </label>
              <textarea
                ref={templateTextareaRef}
                rows={6}
                value={templateForm.content}
                onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                className="input text-xs resize-none font-mono"
                placeholder="Escribí aquí el texto. Podés usar *negrita*, _cursiva_ y {variables}."
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Tip: Usá *asteriscos* para negrita, _guiones bajos_ para cursiva y emojis para dar vida al mensaje.
              </p>
            </div>

            {/* Vista Previa Interactiva: Variables vs Simulación WhatsApp */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  📱 Vista Previa en Vivo:
                </span>
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("simulated")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      previewMode === "simulated"
                        ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Simulación con Datos Reales
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("variables")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      previewMode === "variables"
                        ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Variables Crudas
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#EFEAE2] dark:bg-[#0b141a] border border-slate-200 dark:border-slate-800 flex justify-start">
                <div className="max-w-[90%] bg-white dark:bg-[#202c33] text-slate-900 dark:text-[#e9edef] rounded-2xl rounded-tl-none p-3.5 shadow-xs text-xs space-y-1.5 relative">
                  <div className="whitespace-pre-wrap leading-relaxed text-[11.5px] font-sans">
                    {previewMode === "simulated"
                      ? renderSimulatedContent(templateForm.content, templateForm.tipo) || "El mensaje simulado aparecerá aquí..."
                      : templateForm.content || "El mensaje con variables aparecerá aquí..."}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                    <span>18:30</span>
                    <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="template_active"
                checked={templateForm.active}
                onChange={(e) => setTemplateForm({ ...templateForm, active: e.target.checked })}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="template_active" className="text-xs text-slate-700 dark:text-slate-300">
                Plantilla activa y lista para envíos
              </label>
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
                type="submit"
                disabled={savingTemplate}
                className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5"
              >
                {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {savingTemplate ? "Guardando..." : "Guardar Plantilla"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: PALABRA CLAVE / RESPUESTA RÁPIDA ── */}
      {showKeywordModal && (
        <Modal
          open={showKeywordModal}
          onClose={() => setShowKeywordModal(false)}
          title={editingKeyword ? "Editar Respuesta Rápida" : "Nueva Respuesta Rápida (Palabra Clave)"}
        >
          <form onSubmit={handleSaveKeyword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Descriptivo</label>
              <input
                type="text"
                value={keywordForm.name}
                onChange={(e) => setKeywordForm({ ...keywordForm, name: e.target.value })}
                className="input text-xs"
                placeholder="Ej: Envíos y Delivery a Domicilio"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Palabras Clave Disparadoras (separadas por comas)
              </label>
              <input
                type="text"
                value={keywordForm.keywords}
                onChange={(e) => setKeywordForm({ ...keywordForm, keywords: e.target.value })}
                className="input text-xs"
                placeholder="Ej: delivery, envio, envios, flete, moto, domicilio"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">Si el cliente incluye cualquiera de estas palabras en su mensaje, se enviará esta respuesta.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Texto de Respuesta Automática</label>
              <textarea
                rows={5}
                value={keywordForm.response}
                onChange={(e) => setKeywordForm({ ...keywordForm, response: e.target.value })}
                className="input text-xs resize-none font-mono text-[11px]"
                placeholder="Escribí la información detallada que enviará el bot..."
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">Podés usar formato de WhatsApp: *negrita*, _cursiva_, etc.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={keywordForm.active}
                onChange={(e) => setKeywordForm({ ...keywordForm, active: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Regla Activa</span>
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setShowKeywordModal(false)} className="btn-outline py-2 px-4 text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-700">
                Guardar Regla
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: OPCIÓN EXTRA DEL MENÚ PRINCIPAL ── */}
      {showMenuOptionModal && (
        <Modal
          open={showMenuOptionModal}
          onClose={() => setShowMenuOptionModal(false)}
          title={editingMenuOption ? "Editar Opción del Menú" : "Nueva Opción del Menú Principal"}
        >
          <form onSubmit={handleSaveMenuOption} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">N° de Opción</label>
                <input
                  type="text"
                  value={menuOptionForm.number}
                  onChange={(e) => setMenuOptionForm({ ...menuOptionForm, number: e.target.value })}
                  className="input text-xs text-center font-bold"
                  placeholder="6"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Título Visible en el Menú</label>
                <input
                  type="text"
                  value={menuOptionForm.title}
                  onChange={(e) => setMenuOptionForm({ ...menuOptionForm, title: e.target.value })}
                  className="input text-xs"
                  placeholder="Ej: Envíos & Delivery a Domicilio"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Texto de Respuesta del Bot</label>
              <textarea
                rows={5}
                value={menuOptionForm.response}
                onChange={(e) => setMenuOptionForm({ ...menuOptionForm, response: e.target.value })}
                className="input text-xs resize-none font-mono text-[11px]"
                placeholder="Texto que recibirá el cliente cuando seleccione este número..."
                required
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={menuOptionForm.active}
                onChange={(e) => setMenuOptionForm({ ...menuOptionForm, active: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Opción Activa en Menú</span>
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setShowMenuOptionModal(false)} className="btn-outline py-2 px-4 text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary py-2 px-5 text-xs bg-emerald-600 hover:bg-emerald-700">
                Guardar Opción
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL: PREVISUALIZADOR DE IMÁGENES / MULTIMEDIA ── */}
      {previewMediaModal && (
        <Modal
          open={Boolean(previewMediaModal)}
          onClose={() => setPreviewMediaModal(null)}
          title={previewMediaModal.title || "Visualizador de Imagen WhatsApp"}
          size="lg"
        >
          <div className="flex flex-col items-center justify-center p-2">
            <img
              src={previewMediaModal.url}
              alt="WhatsApp Preview"
              className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-md"
            />
            <div className="mt-4 flex items-center justify-between w-full pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 truncate max-w-md">{previewMediaModal.title || "Imagen recibida por WhatsApp"}</span>
              <a
                href={previewMediaModal.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Imagen</span>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
