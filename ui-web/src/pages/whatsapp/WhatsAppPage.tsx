import { useState, useEffect } from "react"
import { api, type WhatsAppConfig, type WhatsAppConversation, type WhatsAppMessage, type WhatsAppTemplate, type WhatsAppStats } from "../../api"
import { useToast } from "../../context/ToastContext"
import { Modal } from "../../components/Modal"
import { MessageCircle, Settings, FileText, BarChart3, Send, Archive, Search, Plus, Edit, Trash2, X, Loader2, Check, XCircle, Clock, Phone, MessageSquare, User, ToggleLeft, ToggleRight } from "lucide-react"

const demoConversations: WhatsAppConversation[] = [
  { id: "1", tenant_id: "", contact_id: "c1", contact_name: "Juan Pérez", contact_phone: "+595981123456", last_message_at: "2026-05-10T14:30:00", status: "active", created_at: "2026-05-01T10:00:00", last_message_preview: "Gracias por la información" },
  { id: "2", tenant_id: "", contact_id: "c2", contact_name: "María González", contact_phone: "+595982234567", last_message_at: "2026-05-10T12:15:00", status: "active", created_at: "2026-04-28T09:00:00", last_message_preview: "Cuándo podemos entregarnos?" },
  { id: "3", tenant_id: "", contact_id: "c3", contact_name: "Carlos Rodríguez", contact_phone: "+595983345678", last_message_at: "2026-05-09T18:45:00", status: "active", created_at: "2026-05-05T14:00:00", last_message_preview: "Tengo una consulta sobre el producto" },
  { id: "4", tenant_id: "", contact_id: "c4", contact_name: "Ana López", contact_phone: "+595984456789", last_message_at: "2026-05-08T10:20:00", status: "archived", created_at: "2026-04-20T08:00:00", last_message_preview: "Perfecto, gracias!" },
  { id: "5", tenant_id: "", contact_id: "c5", contact_name: "Pedro Martínez", contact_phone: "+595985567890", last_message_at: "2026-05-10T15:00:00", status: "active", created_at: "2026-05-07T11:30:00", last_message_preview: "Necesito más unidades" },
]

const demoMessages: Record<string, WhatsAppMessage[]> = {
  "1": [
    { id: "m1", tenant_id: "", conversation_id: "1", direction: "inbound", content: "Hola, tengo una consulta sobre los precios", message_id: "wamid.1", status: "read", created_at: "2026-05-10T14:00:00" },
    { id: "m2", tenant_id: "", conversation_id: "1", direction: "outbound", content: "Claro, con gusto le ayudo. ¿Qué producto le interesa?", message_id: "wamid.2", status: "delivered", created_at: "2026-05-10T14:10:00" },
    { id: "m3", tenant_id: "", conversation_id: "1", direction: "inbound", content: "El producto ABC, necesito 50 unidades", message_id: "wamid.3", status: "read", created_at: "2026-05-10T14:20:00" },
    { id: "m4", tenant_id: "", conversation_id: "1", direction: "outbound", content: "Para 50 unidades podemos ofrecerle Gs. 150.000 c/u. ¿Le interesa?", message_id: "wamid.4", status: "delivered", created_at: "2026-05-10T14:25:00" },
    { id: "m5", tenant_id: "", conversation_id: "1", direction: "inbound", content: "Gracias por la información", message_id: "wamid.5", status: "read", created_at: "2026-05-10T14:30:00" },
  ],
  "2": [
    { id: "m6", tenant_id: "", conversation_id: "2", direction: "inbound", content: "Buenas, cuándo podemos entregarnos?", message_id: "wamid.6", status: "read", created_at: "2026-05-10T12:15:00" },
  ],
  "3": [
    { id: "m7", tenant_id: "", conversation_id: "3", direction: "inbound", content: "Tengo una consulta sobre el producto", message_id: "wamid.7", status: "read", created_at: "2026-05-09T18:45:00" },
  ],
  "5": [
    { id: "m8", tenant_id: "", conversation_id: "5", direction: "inbound", content: "Necesito más unidades", message_id: "wamid.8", status: "read", created_at: "2026-05-10T15:00:00" },
  ],
}

const demoTemplates: WhatsAppTemplate[] = [
  { id: "1", tenant_id: "", name: "Bienvenida", content: "¡Hola! Bienvenido a nuestra empresa. Gracias por contactarnos. ¿En qué podemos ayudarle?", tipo: "welcome", active: true, created_at: "2026-04-01" },
  { id: "2", tenant_id: "", name: "Estado de pedido", content: "Su pedido #{order_id} está siendo procesado. Le notificaremos cuando esté listo para entrega.", tipo: "order_status", active: true, created_at: "2026-04-15" },
  { id: "3", tenant_id: "", name: "Alerta stock bajo", content: "Recordatorio: El producto {producto} tiene stock bajo ({stock} unidades). Considere reordenar.", tipo: "stock_alert", active: false, created_at: "2026-04-20" },
  { id: "4", tenant_id: "", name: "Promoción especial", content: "¡Oferta especial! Obtenga un 20% de descuento en {producto} válido hasta {fecha}. Use código: PROM20", tipo: "promotion", active: true, created_at: "2026-05-01" },
  { id: "5", tenant_id: "", name: "Recordatorio pago", content: "Le recordamos que tiene un saldo pendiente de {monto}. Fecha límite: {fecha}.", tipo: "reminder", active: true, created_at: "2026-05-05" },
]

const demoStats: WhatsAppStats = {
  total_conversations: 156,
  active_today: 23,
  messages_today: 87,
  avg_response_time: 4.2,
}

export default function WhatsAppPage() {
  const [tab, setTab] = useState<"conversations" | "config" | "templates" | "stats" | "chatbot">("conversations")
  const toast = useToast()

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [convSearch, setConvSearch] = useState("")

  const fetchConversations = async () => {
    setConversationsLoading(true)
    try {
      const data = await api.whatsapp.listConversations()
      setConversations(data)
    } catch {
      setConversations(demoConversations)
    } finally {
      setConversationsLoading(false)
    }
  }

  useEffect(() => { fetchConversations() }, [])

  const filteredConversations = conversations.filter(c =>
    !convSearch || (c.contact_name ?? "").toLowerCase().includes(convSearch.toLowerCase()) ||
    (c.contact_phone ?? "").includes(convSearch)
  )

  const handleSelectConversation = async (conv: WhatsAppConversation) => {
    setSelectedConv(conv)
    setMessagesLoading(true)
    try {
      const data = await api.whatsapp.getMessages(conv.id)
      setMessages(data)
    } catch {
      setMessages(demoMessages[conv.id] || [])
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return
    setSendingMessage(true)
    try {
      const msg = await api.whatsapp.sendMessage(selectedConv.id, { content: newMessage })
      setMessages([...messages, msg])
      setNewMessage("")
    } catch {
      const newMsg: WhatsAppMessage = {
        id: `local-${Date.now()}`,
        tenant_id: "",
        conversation_id: selectedConv.id,
        direction: "outbound",
        content: newMessage,
        message_id: `local-${Date.now()}`,
        status: "sent",
        created_at: new Date().toISOString(),
      }
      setMessages([...messages, newMsg])
      setNewMessage("")
    } finally {
      setSendingMessage(false)
    }
  }

  const handleArchiveConversation = async (conv: WhatsAppConversation) => {
    try {
      await api.whatsapp.archiveConversation(conv.id)
      toast.success("Conversación archivada", conv.contact_name)
      fetchConversations()
    } catch {
      setConversations(conversations.map(c => c.id === conv.id ? { ...c, status: "archived" } : c))
      toast.info("Demo", "Archivado localmente")
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "queued": return <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">En cola</span>
      case "sent": return <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Enviado</span>
      case "delivered": return <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">Entregado</span>
      case "read": return <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Leído</span>
      case "failed": return <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Fallido</span>
      default: return null
    }
  }

  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configForm, setConfigForm] = useState({
    account_sid: "", auth_token: "", phone_number: "", webhook_url: "", enabled: false, auto_reply: false,
  })
  const [savingConfig, setSavingConfig] = useState(false)
  const [testPhone, setTestPhone] = useState("")
  const [testMessage, setTestMessage] = useState("")
  const [testingConnection, setTestingConnection] = useState(false)

  const fetchConfig = async () => {
    setConfigLoading(true)
    try {
      const data = await api.whatsapp.getConfig()
      setConfig(data)
      setConfigForm({
        account_sid: data.account_sid ?? "",
        auth_token: "",
        phone_number: data.phone_number ?? "",
        webhook_url: data.webhook_url ?? "",
        enabled: data.enabled ?? false,
        auto_reply: data.auto_reply ?? false,
      })
    } catch {
      setConfigForm({
        account_sid: "ACxxxxxxxxxxxxxxxxxx",
        auth_token: "",
        phone_number: "+595970000000",
        webhook_url: "https://midominio.com/api/v1/whatsapp/webhook",
        enabled: true,
        auto_reply: true,
      })
    } finally {
      setConfigLoading(false)
    }
  }

  useEffect(() => { if (tab === "config") fetchConfig() }, [tab])

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      await api.whatsapp.saveConfig({
        account_sid: configForm.account_sid,
        phone_number: configForm.phone_number,
        webhook_url: configForm.webhook_url,
        enabled: configForm.enabled,
        auto_reply: configForm.auto_reply,
      })
      toast.success("Configuración guardada", "WhatsApp configurado correctamente")
    } catch {
      toast.info("Demo", "Configuración guardada localmente")
    } finally {
      setSavingConfig(false)
    }
  }

  const handleTestConnection = async () => {
    if (!testPhone.trim() || !testMessage.trim()) {
      toast.error("Error", "Ingrese teléfono y mensaje de prueba")
      return
    }
    setTestingConnection(true)
    try {
      await api.whatsapp.testMessage({ to: testPhone, message: testMessage })
      toast.success("Mensaje enviado", `Prueba enviada a ${testPhone}`)
    } catch {
      toast.info("Demo", "Mensaje de prueba enviado (simulado)")
    } finally {
      setTestingConnection(false)
    }
  }

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: "", content: "", tipo: "custom", active: true })
  const [savingTemplate, setSavingTemplate] = useState(false)

  const fetchTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const data = await api.whatsapp.listTemplates()
      setTemplates(data)
    } catch {
      setTemplates(demoTemplates)
    } finally {
      setTemplatesLoading(false)
    }
  }

  useEffect(() => { if (tab === "templates") fetchTemplates() }, [tab])

  const handleOpenTemplateModal = (tpl?: WhatsAppTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl)
      setTemplateForm({ name: tpl.name ?? "", content: tpl.content ?? "", tipo: tpl.tipo ?? "custom", active: tpl.active ?? false })
    } else {
      setEditingTemplate(null)
      setTemplateForm({ name: "", content: "", tipo: "custom", active: true })
    }
    setShowTemplateModal(true)
  }

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      toast.error("Error", "Nombre y contenido son requeridos")
      return
    }
    setSavingTemplate(true)
    try {
      if (editingTemplate) {
        await api.whatsapp.updateTemplate(editingTemplate.id, templateForm)
        toast.success("Plantilla actualizada", templateForm.name)
      } else {
        await api.whatsapp.createTemplate(templateForm)
        toast.success("Plantilla creada", templateForm.name)
      }
      setShowTemplateModal(false)
      fetchTemplates()
    } catch {
      const newTpl: WhatsAppTemplate = {
        id: `local-${Date.now()}`,
        tenant_id: "",
        ...templateForm,
        created_at: new Date().toISOString().split("T")[0],
      }
      if (editingTemplate) {
        setTemplates(templates.map(t => t.id === editingTemplate.id ? newTpl : t))
      } else {
        setTemplates([...templates, newTpl])
      }
      toast.info("Demo", "Guardado localmente")
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (tpl: WhatsAppTemplate) => {
    if (!confirm(`¿Eliminar plantilla "${tpl.name}"?`)) return
    try {
      await api.whatsapp.deleteTemplate(tpl.id)
      toast.success("Plantilla eliminada", tpl.name)
      fetchTemplates()
    } catch {
      setTemplates(templates.filter(t => t.id !== tpl.id))
      toast.info("Demo", "Eliminado localmente")
    }
  }

  const handleToggleTemplate = async (tpl: WhatsAppTemplate) => {
    try {
      await api.whatsapp.updateTemplate(tpl.id, { active: !tpl.active })
      setTemplates(templates.map(t => t.id === tpl.id ? { ...t, active: !t.active } : t))
    } catch {
      setTemplates(templates.map(t => t.id === tpl.id ? { ...t, active: !t.active } : t))
    }
  }

  const [stats, setStats] = useState<WhatsAppStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const data = await api.whatsapp.getStats()
      setStats(data)
    } catch {
      setStats(demoStats)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => { if (tab === "stats") fetchStats() }, [tab])

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

  const templateTipos = [
    { value: "welcome", label: "Bienvenida" },
    { value: "pedido.pendiente", label: "🧾 Pedido: Pendiente" },
    { value: "pedido.en_preparacion", label: "🧾 Pedido: En preparación" },
    { value: "pedido.listo", label: "🧾 Pedido: Listo" },
    { value: "pedido.aprobado", label: "🧾 Pedido: Aprobado" },
    { value: "pedido.rechazado", label: "🧾 Pedido: Rechazado" },
    { value: "pedido.cancelado", label: "🧾 Pedido: Cancelado" },
    { value: "pedido.facturado", label: "🧾 Pedido: Facturado" },
    { value: "entrega.assigned", label: "🛵 Entrega: Asignada" },
    { value: "entrega.picked_up", label: "🛵 Entrega: Recogida" },
    { value: "entrega.in_transit", label: "🛵 Entrega: En tránsito" },
    { value: "entrega.delivered", label: "🛵 Entrega: Entregada" },
    { value: "entrega.failed", label: "🛵 Entrega: Fallida" },
    { value: "venta.creada", label: "🧾 Venta: Creada" },
    { value: "venta.cancelada", label: "🧾 Venta: Cancelada" },
    { value: "pago.recibido", label: "💵 Pago: Recibido" },
    { value: "order_status", label: "Estado de pedido (genérico)" },
    { value: "stock_alert", label: "Alerta stock" },
    { value: "promotion", label: "Promoción" },
    { value: "reminder", label: "Recordatorio" },
    { value: "custom", label: "Personalizado" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApp</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gestión de conversaciones y templates</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab("conversations")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "conversations" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <MessageCircle className="w-4 h-4 inline mr-2" />Conversaciones
        </button>
        <button onClick={() => setTab("config")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "config" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <Settings className="w-4 h-4 inline mr-2" />Configuración
        </button>
        <button onClick={() => setTab("templates")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "templates" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <FileText className="w-4 h-4 inline mr-2" />Plantillas
        </button>
        <button onClick={() => setTab("stats")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "stats" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <BarChart3 className="w-4 h-4 inline mr-2" />Estadísticas
        </button>
        <button onClick={() => setTab("chatbot")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "chatbot" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          <MessageSquare className="w-4 h-4 inline mr-2" />Chatbot
        </button>
      </div>

      {tab === "conversations" && (
        <div className="flex gap-6 h-[calc(100vh-220px)]">
          <div className="w-1/3 flex flex-col">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Buscar conversaciones..." value={convSearch} onChange={e => setConvSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : filteredConversations.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay conversaciones</p>
                ) : (
                  filteredConversations.map(conv => (
                    <button key={conv.id} onClick={() => handleSelectConversation(conv)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${selectedConv?.id === conv.id ? "bg-primary/10 border border-primary" : "hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent"}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-sm">
                          {getInitials(conv.contact_name ?? "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-white truncate">{conv.contact_name}</span>
                            <span className="text-xs text-gray-400">{formatTime(conv.last_message_at ?? "")}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{conv.contact_phone}</p>
                          <p className="text-xs text-gray-400 truncate mt-1">{conv.last_message_preview}</p>
                        </div>
                        {conv.status === "archived" && <Archive className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedConv ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col h-full">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold">
                      {getInitials(selectedConv.contact_name ?? "")}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{selectedConv.contact_name}</h3>
                      <p className="text-xs text-gray-500">{selectedConv.contact_phone}</p>
                    </div>
                  </div>
                  <button onClick={() => handleArchiveConversation(selectedConv)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                    <Archive className="w-4 h-4" />Archivar
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] p-3 rounded-2xl ${msg.direction === "outbound" ? "bg-primary text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white"}`}>
                        <p className="text-sm">{msg.content}</p>
                        <div className={`flex items-center gap-2 mt-1 text-xs ${msg.direction === "outbound" ? "text-white/70" : "text-gray-400"}`}>
                          <span>{formatTime(msg.created_at ?? "")}</span>
                          {msg.direction === "outbound" && getStatusBadge(msg.status ?? "")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                      placeholder="Escribe un mensaje..." className="flex-1 px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                    <button onClick={handleSendMessage} disabled={!newMessage.trim() || sendingMessage}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                      {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Selecciona una conversación</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Configuración de WhatsApp</h3>
            {configLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account SID</label>
                  <input type="text" value={configForm.account_sid} onChange={e => setConfigForm({ ...configForm, account_sid: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auth Token</label>
                  <input type="password" value={configForm.auth_token} onChange={e => setConfigForm({ ...configForm, auth_token: e.target.value })}
                    placeholder={config ? "••••••••••••" : ""}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número de teléfono</label>
                  <input type="text" value={configForm.phone_number} onChange={e => setConfigForm({ ...configForm, phone_number: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                  <input type="text" value={configForm.webhook_url} onChange={e => setConfigForm({ ...configForm, webhook_url: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Habilitado</span>
                    <p className="text-xs text-gray-500">Activar integración WhatsApp</p>
                  </div>
                  <button onClick={() => setConfigForm({ ...configForm, enabled: !configForm.enabled })}>
                    {configForm.enabled ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Auto-respuesta</span>
                    <p className="text-xs text-gray-500">Responder automáticamente mensajes entrantes</p>
                  </div>
                  <button onClick={() => setConfigForm({ ...configForm, auto_reply: !configForm.auto_reply })}>
                    {configForm.auto_reply ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                  </button>
                </div>

                <div className="flex gap-2 pt-4">
                  <button onClick={handleSaveConfig} disabled={savingConfig}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Guardar
                  </button>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Probar conexión</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono destino</label>
                      <input type="text" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                        placeholder="+595981234567"
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje</label>
                      <input type="text" value={testMessage} onChange={e => setTestMessage(e.target.value)}
                        placeholder="Hola, esto es una prueba"
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <button onClick={handleTestConnection} disabled={testingConnection}
                    className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                    {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Enviar mensaje de prueba
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Plantillas de mensaje</h3>
            <button onClick={() => handleOpenTemplateModal()} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2">
              <Plus className="w-4 h-4" />Nueva Plantilla
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contenido</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Activa</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {templatesLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : templates.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hay plantillas</td></tr>
                ) : (
                  templates.map(tpl => (
                    <tr key={tpl.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{tpl.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{templateTipos.find(t => t.value === tpl.tipo)?.label || tpl.tipo}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{tpl.content}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggleTemplate(tpl)} className={tpl.active ? "text-green-600" : "text-gray-400"}>
                          {tpl.active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleOpenTemplateModal(tpl)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteTemplate(tpl)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded ml-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Conversaciones</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsLoading ? "..." : stats?.total_conversations}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Activas Hoy</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsLoading ? "..." : stats?.active_today}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Mensajes Hoy</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsLoading ? "..." : stats?.messages_today}</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tiempo Respuesta</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsLoading ? "..." : `${stats?.avg_response_time} min`}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tendencias</h3>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Gráfico de tendencias</p>
                <p className="text-xs">Próximamente</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "chatbot" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Chatbot Interactivo</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              El chatbot responde automáticamente a mensajes entrantes con menús interactivos.
              Los clientes pueden navegar por productos, pedidos y soporte usando opciones numeradas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Estados del Chatbot</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">idle</span>
                    <span className="text-xs text-gray-500">Esperando mensaje</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">menu_main</span>
                    <span className="text-xs text-gray-500">Menú principal</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">menu_products</span>
                    <span className="text-xs text-gray-500">Catálogo de productos</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">menu_orders</span>
                    <span className="text-xs text-gray-500">Gestión de pedidos</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">menu_support</span>
                    <span className="text-xs text-gray-500">Soporte al cliente</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Comandos Disponibles</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <code className="text-sm text-primary">/ayuda</code>
                    <span className="text-xs text-gray-500">Ver menú de comandos</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <code className="text-sm text-primary">/stock [producto]</code>
                    <span className="text-xs text-gray-500">Consultar stock</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <code className="text-sm text-primary">/pedido [número]</code>
                    <span className="text-xs text-gray-500">Estado de pedido</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <code className="text-sm text-primary">/estado [número]</code>
                    <span className="text-xs text-gray-500">Estado de pago</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <code className="text-sm text-primary">/ventas</code>
                    <span className="text-xs text-gray-500">Resumen del día</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversaciones Activas</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Conversaciones actualmente en proceso con el chatbot:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Contacto</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Estado</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Último Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.filter(c => c.session_state && c.session_state !== "idle").length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        No hay conversaciones activas con el chatbot
                      </td>
                    </tr>
                  ) : (
                    conversations.filter(c => c.session_state && c.session_state !== "idle").map(conv => (
                      <tr key={conv.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{conv.contact_name || "Sin nombre"}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{conv.contact_phone}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {conv.session_state}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString("es-PY") : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl border border-primary/20 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Próximamente</h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Editor visual de flujos de conversación</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Integración con IA para respuestas inteligentes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Analíticas detalladas de conversaciones</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Transferencia automática a agente humano</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
            <input type="text" value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
            <select value={templateForm.tipo} onChange={e => setTemplateForm({ ...templateForm, tipo: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white">
              {templateTipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contenido</label>
            <textarea value={templateForm.content} onChange={e => setTemplateForm({ ...templateForm, content: e.target.value })} rows={4}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white" />
            <p className="text-xs text-gray-500 mt-1">Usa {"{variable}"} para datos dinámicos</p>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Activa</span>
            <button onClick={() => setTemplateForm({ ...templateForm, active: !templateForm.active })}>
              {templateForm.active ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowTemplateModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Cancelar
            </button>
            <button onClick={handleSaveTemplate} disabled={savingTemplate} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}