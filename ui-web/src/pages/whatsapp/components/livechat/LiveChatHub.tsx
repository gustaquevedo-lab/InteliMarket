import React, { useState, useEffect, useRef, useMemo } from "react"
import {
  Search,
  RefreshCw,
  RotateCcw,
  User,
  Users,
  Bot,
  Clock,
  CheckCheck,
  Paperclip,
  Send,
  Sparkles,
  MessageCircle,
  Loader2,
  X,
  Smile,
  ShieldAlert,
  ArrowRightLeft,
  CheckCircle2,
  Building2,
  Lock,
  ChevronDown,
  Phone,
  Calendar,
} from "lucide-react"
import { api, WhatsAppConversation, WhatsAppMessage } from "../../../../api"
import { ChatMediaMessage } from "./ChatMediaMessage"
import { MediaLightboxModal } from "./MediaLightboxModal"
import { TransferChatModal } from "./TransferChatModal"

interface LiveChatHubProps {
  initialConversations?: WhatsAppConversation[]
  onRefreshConversations?: () => void
  currentUserId?: string
  currentUserName?: string
}

type InboxTab = "pending" | "mine" | "bot" | "all" | "resolved"

const COMMON_EMOJIS = [
  "👋", "😊", "👍", "❤️", "🙏", "🤝", "🎉", "👏", "🤩", "😁",
  "🛒", "🏪", "🥩", "🥦", "🥖", "🥛", "🍞", "🍎", "🧀", "🍗",
  "💰", "💵", "🏷️", "💳", "🧾", "📲", "🪙", "🏦",
  "📦", "🛵", "🚚", "📍", "⏰", "⏱️", "🏠", "✅",
]

const QUICK_RESPONSES = [
  { label: "🕒 Horarios", text: "¡Hola! Nuestro horario de atención en sucursal es de Lunes a Sábados de 07:00 a 21:00 hs y Domingos de 07:30 a 13:00 hs. 🏪" },
  { label: "🛵 Envíos", text: "🚚 Realizamos envíos a domicilio en toda la zona. En compras superiores a Gs. 300.000 el flete es GRATIS. ¿Te gustaría armar tu pedido por acá?" },
  { label: "🥩 Carnicería", text: "Nuestra carnicería mayorista y minorista cuenta con cortes frescos envasados al vacío y faena diaria certificada. ¿Buscás algún corte en particular?" },
  { label: "💳 Pagos", text: "Aceptamos Efectivo en Gs., Reales, Dólares, Tarjetas de Débito/Crédito, QR Bancard, Dinelco y PIX brasileño al cambio oficial del día. 📲" },
]

export const LiveChatHub: React.FC<LiveChatHubProps> = ({
  currentUserId,
  currentUserName = "Operador",
}) => {
  // ── Estados Principales ──
  const [inboxTab, setInboxTab] = useState<InboxTab>("pending")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [selectedConv, setSelectedConv] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loadingList, setLoadingList] = useState<boolean>(true)
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false)

  // ── Input de Envío y Notas ──
  const [replyText, setReplyText] = useState<string>("")
  const [isInternalNote, setIsInternalNote] = useState<boolean>(false)
  const [sendingReply, setSendingReply] = useState<boolean>(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false)
  const [showQuickResponses, setShowQuickResponses] = useState<boolean>(false)

  // ── Modales ──
  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false)
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string
    title?: string
    filename?: string
    sizeBytes?: number
  } | null>(null)

  const chatBottomRef = useRef<HTMLDivElement | null>(null)
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Cargar Lista de Conversaciones ──
  const fetchConversations = async (silent = false) => {
    if (!silent) setLoadingList(true)
    try {
      const data = await api.whatsapp.listConversations({
        inbox: inboxTab === "all" ? undefined : inboxTab,
        department: departmentFilter === "all" ? undefined : departmentFilter,
        search: searchQuery.trim() || undefined,
      })
      const convList = data || []
      setConversations(convList)

      // Actualizar conversación activa si cambió
      if (selectedConv) {
        const updated = convList.find((c) => c.id === selectedConv.id)
        if (updated) setSelectedConv(updated)
      } else if (convList.length > 0 && !selectedConv) {
        setSelectedConv(convList[0])
        fetchMessages(convList[0].id)
      }
    } catch (err) {
      console.error("Error al cargar conversaciones:", err)
    } finally {
      if (!silent) setLoadingList(false)
    }
  }

  // ── Cargar Mensajes ──
  const fetchMessages = async (convId: string, silent = false) => {
    if (!silent) setLoadingMessages(true)
    try {
      const msgs = await api.whatsapp.getMessages(convId)
      setMessages(msgs || [])
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80)
    } catch (err) {
      console.error("Error al cargar mensajes:", err)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }

  // Recargar al cambiar pestaña o filtros
  useEffect(() => {
    fetchConversations()
  }, [inboxTab, departmentFilter])

  // Polling sutil cada 4 segundos para chats activos
  useEffect(() => {
    const timer = setInterval(() => {
      fetchConversations(true)
      if (selectedConv) {
        fetchMessages(selectedConv.id, true)
      }
    }, 4000)
    return () => clearInterval(timer)
  }, [selectedConv?.id, inboxTab, departmentFilter])

  // ── Conteo de Bandejas ──
  const counts = useMemo(() => {
    return {
      pending: conversations.filter((c) => c.handling_mode === "human_pending" || (c.session_data as any)?.human_takeover && !c.assigned_user_id).length,
      mine: currentUserId ? conversations.filter((c) => c.assigned_user_id === currentUserId).length : 0,
      bot: conversations.filter((c) => c.handling_mode === "ai_bot" || !c.handling_mode).length,
      all: conversations.length,
    }
  }, [conversations, currentUserId])

  // ── Enviar Mensaje (WhatsApp o Nota Interna) ──
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if ((!replyText.trim() && !selectedFile) || !selectedConv) return

    setSendingReply(true)
    const text = replyText.trim()

    try {
      if (isInternalNote) {
        // Enviar como Nota Interna privada
        const noteMsg = await api.whatsapp.addInternalNote(selectedConv.id, text)
        setMessages((prev) => [...prev, noteMsg])
        setReplyText("")
      } else {
        // Enviar a WhatsApp
        let mediaUrl: string | undefined
        if (selectedFile) {
          const uploadRes = await api.whatsapp.uploadMedia(selectedFile)
          mediaUrl = uploadRes.url
        }

        const newMsg = await api.whatsapp.sendMessage(selectedConv.id, {
          content: text,
          media_url: mediaUrl,
        })
        setMessages((prev) => [...prev, newMsg])
        setReplyText("")
        setSelectedFile(null)
        setFilePreview(null)
      }

      setShowEmojiPicker(false)
      setShowQuickResponses(false)
      fetchConversations(true)
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60)
    } catch (err: any) {
      alert("Error al enviar: " + (err?.response?.data?.detail || err?.message || "No se pudo entregar"))
    } finally {
      setSendingReply(false)
    }
  }

  // ── Acciones Rápidas de Handoff ──
  const handleTakeConversation = async () => {
    if (!selectedConv) return
    try {
      await api.whatsapp.takeConversation(selectedConv.id)
      fetchConversations(true)
      fetchMessages(selectedConv.id, true)
    } catch (err) {
      console.error(err)
    }
  }

  const handleReleaseToBot = async () => {
    if (!selectedConv) return
    try {
      await api.whatsapp.releaseToBot(selectedConv.id)
      fetchConversations(true)
      fetchMessages(selectedConv.id, true)
    } catch (err) {
      console.error(err)
    }
  }

  const handleResolve = async () => {
    if (!selectedConv) return
    try {
      await api.whatsapp.resolveConversation(selectedConv.id)
      fetchConversations(true)
      fetchMessages(selectedConv.id, true)
    } catch (err) {
      console.error(err)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Formato de hora en America/Asuncion
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return ""
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString("es-PY", {
        timeZone: "America/Asuncion",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return ""
    }
  }

  // Tiempo relativo para esperas en cola
  const getWaitingTime = (since?: string | null) => {
    if (!since) return null
    const diffMs = Date.now() - new Date(since).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "hace instantes"
    if (diffMin < 60) return `hace ${diffMin}m`
    return `hace ${Math.floor(diffMin / 60)}h`
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[720px]">
      {/* ══════════════════════════════════════════════════════════ */}
      {/* COLUMNA 1: BANDEJAS (INBOXES) & LISTA DE CONVERSACIONES     */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-4 border-r border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/40 dark:bg-slate-950/20">
        {/* Cabecera de Bandejas */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> Centro de Contacto
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchConversations()}
                disabled={loadingList}
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all"
                title="Actualizar chats"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin text-emerald-500" : ""}`} />
              </button>
              <button
                onClick={async () => {
                  if (confirm("¿Limpiar conversaciones de prueba?")) {
                    await api.whatsapp.cleanupTests()
                    fetchConversations()
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all"
                title="Limpiar pruebas residuales"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Selector de Bandejas (Inboxes Tabs) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-2xl text-[11px] font-bold">
            <button
              onClick={() => setInboxTab("pending")}
              className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 relative ${
                inboxTab === "pending"
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50"
              }`}
              title="Clientes esperando atención humana"
            >
              <Clock className="w-3 h-3" />
              <span>Por Atender</span>
              {counts.pending > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center animate-pulse">
                  {counts.pending}
                </span>
              )}
            </button>

            <button
              onClick={() => setInboxTab("mine")}
              className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                inboxTab === "mine"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50"
              }`}
              title="Chats asignados a mi usuario"
            >
              <User className="w-3 h-3" />
              <span>Mis Chats</span>
              {counts.mine > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-800 text-white text-[9px] flex items-center justify-center">
                  {counts.mine}
                </span>
              )}
            </button>

            <button
              onClick={() => setInboxTab("bot")}
              className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
                inboxTab === "bot"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50"
              }`}
              title="Atendidos autónomamente por Agente IA"
            >
              <Bot className="w-3 h-3" />
              <span>Bot IA</span>
              {counts.bot > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-800 text-white text-[9px] flex items-center justify-center">
                  {counts.bot}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 text-[11px]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setInboxTab("all")}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  inboxTab === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                }`}
              >
                Todos ({counts.all})
              </button>
              <button
                onClick={() => setInboxTab("resolved")}
                className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                  inboxTab === "resolved"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                }`}
              >
                Resueltos
              </button>
            </div>

            {/* Filtro Departamento */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-[11px] py-0.5 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">🏢 Todos los deptos</option>
              <option value="ventas">🥩 Ventas / Carnicería</option>
              <option value="envios">🛵 Envíos / Delivery</option>
              <option value="cajas">💵 Cajas / Pagos</option>
              <option value="atencion">🤝 Atención al Cliente</option>
            </select>
          </div>

          {/* Buscador Rápido */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchConversations()}
              placeholder="Buscar por cliente o teléfono..."
              className="w-full text-xs pl-8 pr-7 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); fetchConversations(); }}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de Conversaciones */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {loadingList ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> Cargando conversaciones...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <MessageCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600 dark:text-slate-300">Sin conversaciones en esta bandeja</p>
              <p className="text-[11px] text-slate-400">
                {inboxTab === "pending"
                  ? "¡Excelente! No hay clientes esperando atención humana en este momento."
                  : inboxTab === "mine"
                  ? "No tienes conversaciones asignadas actualmente."
                  : "Los mensajes entrantes aparecerán aquí en tiempo real."}
              </p>
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = selectedConv?.id === c.id
              const isPending = c.handling_mode === "human_pending" || (c.session_data as any)?.human_takeover && !c.assigned_user_id
              const isMine = currentUserId && c.assigned_user_id === currentUserId
              const isBot = c.handling_mode === "ai_bot" || !c.handling_mode
              const waitingText = getWaitingTime(c.waiting_since)

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedConv(c)
                    fetchMessages(c.id)
                  }}
                  className={`w-full text-left p-3 transition-all flex items-start gap-3 relative ${
                    isSelected
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-l-4 border-emerald-500 shadow-sm"
                      : "hover:bg-slate-100/70 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {/* Avatar con distintivo de estado */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
                        isPending
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-2 border-amber-400 animate-pulse"
                          : isMine
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300"
                          : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800"
                      }`}
                    >
                      {c.contact_name ? c.contact_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                    </div>
                    {/* Iconito inferior de tipo de atención */}
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white shadow-sm ${
                        isPending ? "bg-amber-500" : isMine ? "bg-emerald-500" : "bg-indigo-500"
                      }`}
                    >
                      {isPending ? "⏳" : isMine ? "👨‍💼" : "🤖"}
                    </span>
                  </div>

                  {/* Detalle del chat */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {c.contact_name || c.contact_phone}
                      </h4>
                      {c.last_message_at && (
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {formatTime(c.last_message_at)}
                        </span>
                      )}
                    </div>

                    {/* Estado & Etiquetas */}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {isPending && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5">
                          ⚠️ Espera asesor ({waitingText})
                        </span>
                      )}
                      {c.assigned_user_name && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                          👨‍💼 {c.assigned_user_name}
                        </span>
                      )}
                      {isBot && !isPending && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          🤖 Bot Qwen 2.5
                        </span>
                      )}
                      {c.department && c.department !== "general" && (
                        <span className="text-[9px] px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                          {c.department}
                        </span>
                      )}
                    </div>

                    {/* Último mensaje */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                      {c.is_ai_typing ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 animate-pulse">
                          <Bot className="w-3 h-3" /> Bot redactando respuesta...
                        </span>
                      ) : (
                        c.last_message_preview || c.ultimo_mensaje || "Sin mensajes recientes"
                      )}
                    </p>
                  </div>

                  {/* Contador de no leídos */}
                  {(c.unread_agent_count || 0) > 0 && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 self-center shadow-sm">
                      {c.unread_agent_count}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* COLUMNA 2: ÁREA DE CHAT EN VIVO & PANEL DE ATENCIÓN         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-8 flex flex-col bg-slate-50/50 dark:bg-slate-950/30">
        {selectedConv ? (
          <>
            {/* Header del Chat Activo */}
            <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0">
                  {selectedConv.contact_name ? selectedConv.contact_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedConv.contact_name || selectedConv.contact_phone}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {selectedConv.contact_phone}
                    </span>
                  </div>
                  {/* Estado de Handoff */}
                  <div className="flex items-center gap-2 mt-0.5 text-xs">
                    {selectedConv.handling_mode === "human_pending" ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 animate-spin text-amber-500" /> Esperando Atención Humana
                      </span>
                    ) : selectedConv.handling_mode === "human_active" ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                        <User className="w-3 h-3" /> Atendido por: {selectedConv.assigned_user_name || "Operador"}
                      </span>
                    ) : (
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 text-[11px]">
                        <Bot className="w-3 h-3" /> Modo Autónomo: Bot IA (Qwen 2.5)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de Control de Flujo (Handoff) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Botón Tomar Chat */}
                {selectedConv.handling_mode !== "human_active" && (
                  <button
                    onClick={handleTakeConversation}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    title="Tomar conversación y silenciar la IA"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Tomar Chat</span>
                  </button>
                )}

                {/* Botón Derivar / Transferir */}
                <button
                  onClick={() => setTransferModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center gap-1 transition-all"
                  title="Transferir a otro agente o departamento"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                  <span className="hidden sm:inline">Transferir</span>
                </button>

                {/* Botón Devolver a IA */}
                {selectedConv.handling_mode === "human_active" && (
                  <button
                    onClick={handleReleaseToBot}
                    className="px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium text-xs flex items-center gap-1 transition-all"
                    title="Reactivar Asistente Virtual IA"
                  >
                    <Bot className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="hidden sm:inline">Devolver a IA</span>
                  </button>
                )}

                {/* Botón Resolver */}
                <button
                  onClick={handleResolve}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 hover:text-emerald-700 font-medium text-xs flex items-center gap-1 transition-all"
                  title="Marcar como resuelto"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Resolver</span>
                </button>

                <button
                  onClick={() => fetchMessages(selectedConv.id)}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                  title="Refrescar mensajes"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Timeline de Mensajes */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
              {loadingMessages ? (
                <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> Cargando historial seguro...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-24 text-center text-xs text-slate-400 space-y-2">
                  <Bot className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">No hay mensajes registrados</p>
                  <p className="text-[11px]">Escribí un mensaje o nota interna abajo para iniciar la conversación.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isOutbound = m.direction === "outbound"
                  const isNote = m.sender_type === "internal_note"
                  const isSystem = m.sender_type === "system"
                  const isBotMsg = m.sender_type === "bot" || (isOutbound && !m.sender_user_id && !isNote && !isSystem)

                  // 1. Mensaje de Sistema / Auditoría
                  if (isSystem) {
                    return (
                      <div key={m.id} className="flex justify-center my-2">
                        <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-300/50 dark:border-slate-700 flex items-center gap-1.5">
                          {m.content}
                          <span className="text-[9px] opacity-60 font-mono">({formatTime(m.created_at)})</span>
                        </span>
                      </div>
                    )
                  }

                  // 2. Nota Interna (Whisper)
                  if (isNote) {
                    return (
                      <div key={m.id} className="flex justify-center my-2 max-w-lg mx-auto">
                        <div className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-3 shadow-sm text-xs text-amber-950 dark:text-amber-200">
                          <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 dark:text-amber-400 mb-1 border-b border-amber-200 dark:border-amber-900/60 pb-1">
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> NOTA INTERNA PRIVADA ({m.sender_name || "Equipo"})
                            </span>
                            <span className="font-mono">{formatTime(m.created_at)}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    )
                  }

                  // 3. Mensaje Ordinario (Cliente vs Bot vs Agente Humano)
                  return (
                    <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-sm sm:max-w-md rounded-2xl p-3 shadow-sm text-xs relative ${
                          isOutbound
                            ? isBotMsg
                              ? "bg-indigo-600 text-white rounded-tr-none"
                              : "bg-emerald-600 text-white rounded-tr-none"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-tl-none"
                        }`}
                      >
                        {/* Cabecera del mensaje si es bot o agente */}
                        {isOutbound && (
                          <div className="flex items-center justify-between text-[10px] font-bold mb-1 opacity-90 border-b border-white/20 pb-0.5">
                            {isBotMsg ? (
                              <span className="flex items-center gap-1 text-indigo-200">
                                <Bot className="w-3 h-3" /> ExtraBot IA (Qwen 2.5)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-emerald-200">
                                <User className="w-3 h-3" /> {m.sender_name || "Operador"}
                              </span>
                            )}
                            <span className="text-[9px] opacity-75 font-mono">{formatTime(m.created_at)}</span>
                          </div>
                        )}

                        {/* Renderizado Multimedia Profesional */}
                        {m.media_url && (
                          <ChatMediaMessage
                            mediaUrl={m.media_url}
                            content={m.content}
                            mediaType={m.media_type}
                            mediaFilename={m.media_filename}
                            mediaSizeBytes={m.media_size_bytes}
                            isOutbound={isOutbound}
                            onOpenLightbox={(media) => setLightboxMedia(media)}
                          />
                        )}

                        {/* Texto del mensaje */}
                        {(!m.media_url || (m.content && !m.content.startsWith("📄 Presupuesto") && m.content !== "📷 Imagen")) && (
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        )}

                        {/* Footer con hora y checks */}
                        <div
                          className={`mt-1.5 text-[9px] flex items-center justify-end gap-1 ${
                            isOutbound ? "text-white/80" : "text-slate-400"
                          }`}
                        >
                          {!isOutbound && <span>{formatTime(m.created_at)}</span>}
                          {isOutbound && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Indicador animado si la IA está generando respuesta */}
              {selectedConv.is_ai_typing && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 rounded-2xl rounded-tl-none p-3 text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-2 shadow-sm">
                    <Bot className="w-4 h-4 animate-bounce text-indigo-600" />
                    <span className="font-semibold">ExtraBot IA está redactando la respuesta...</span>
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse delay-75" />
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse delay-150" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Previsualización de Adjunto Seleccionado */}
            {selectedFile && (
              <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-9 h-9 rounded-xl object-cover border border-emerald-300" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100 flex items-center justify-center font-bold">
                      <Paperclip className="w-4 h-4" />
                    </div>
                  )}
                  <div className="truncate">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Barra de Respuestas Rápidas (Popover) */}
            {showQuickResponses && (
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1.5 overflow-x-auto text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 shrink-0">Plantillas:</span>
                {QUICK_RESPONSES.map((qr, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setReplyText((prev) => (prev ? prev + " " + qr.text : qr.text))
                      setShowQuickResponses(false)
                      replyInputRef.current?.focus()
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-700 hover:bg-emerald-50 text-slate-700 dark:text-slate-200 text-xs font-semibold shrink-0 border border-slate-200 dark:border-slate-600 transition-colors"
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

            {/* Selector de Emojis */}
            {showEmojiPicker && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-10 gap-1 text-base max-h-36 overflow-y-auto">
                {COMMON_EMOJIS.map((em, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setReplyText((prev) => prev + em)
                      replyInputRef.current?.focus()
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-transform hover:scale-125"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {/* Formulario Inferior de Envío */}
            <div className={`p-3 border-t transition-colors ${
              isInternalNote
                ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
                : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
            }`}>
              {/* Toggle de Modo: WhatsApp vs Nota Interna */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(false)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      !isInternalNote
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>💬 Respuesta a WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(true)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      isInternalNote
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/50"
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Nota Interna (Solo equipo)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowQuickResponses(!showQuickResponses)}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 text-[11px] font-bold"
                  >
                    <Sparkles className="w-3 h-3" /> Respuestas Rápidas
                  </button>
                </div>
              </div>

              {/* Input y Botones */}
              <div className="flex items-end gap-2">
                {!isInternalNote && (
                  <>
                    {/* Botón Emojis */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Emojis"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {/* Botón Adjuntar */}
                    <label className="p-2 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,audio/*,video/*,application/pdf"
                      />
                    </label>
                  </>
                )}

                {/* Textarea */}
                <textarea
                  ref={replyInputRef}
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isInternalNote
                      ? "🔒 Escribí una nota privada que solo verá el equipo (no va a WhatsApp)..."
                      : "Escribí tu mensaje para el cliente (Enter para enviar)..."
                  }
                  className={`flex-1 text-xs p-2.5 rounded-2xl border resize-none focus:outline-none focus:ring-2 ${
                    isInternalNote
                      ? "border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-amber-400"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-emerald-500"
                  }`}
                />

                {/* Botón de Envío */}
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={sendingReply || (!replyText.trim() && !selectedFile)}
                  className={`p-3 rounded-2xl text-white font-bold transition-all disabled:opacity-40 shadow-md ${
                    isInternalNote
                      ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  }`}
                  title={isInternalNote ? "Guardar Nota Interna" : "Despachar a WhatsApp"}
                >
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
            <MessageCircle className="w-16 h-16 text-slate-300 dark:text-slate-700 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Seleccioná una conversación</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Elegí un cliente de las bandejas de la izquierda para responder en vivo, ver notas internas o transferir el caso.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modales de Apoyo ── */}
      {transferModalOpen && selectedConv && (
        <TransferChatModal
          convId={selectedConv.id}
          contactName={selectedConv.contact_name || selectedConv.contact_phone || "Contacto"}
          currentDepartment={selectedConv.department}
          currentAgentId={selectedConv.assigned_user_id}
          onClose={() => setTransferModalOpen(false)}
          onSuccess={() => {
            fetchConversations(true)
            fetchMessages(selectedConv.id, true)
          }}
        />
      )}

      {lightboxMedia && (
        <MediaLightboxModal
          media={lightboxMedia}
          onClose={() => setLightboxMedia(null)}
        />
      )}
    </div>
  )
}
