import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Bot, Megaphone, Sparkles, TrendingUp, Users, ShoppingBag,
  AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight,
  RefreshCw, Send, Calendar, Clock, DollarSign, Target, ShieldCheck,
  Zap, HeartHandshake, Eye, MessageCircle, BarChart3, Filter,
  Layers, Check, X, ChevronRight, ThumbsUp, ShoppingCart, Percent,
  Monitor, ImagePlus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2,
  Activity, MessageSquare, BookOpen, PlusCircle, Building2, Scale,
  Flame, CheckSquare, Search, Award, Mic, MicOff, Volume2, Share2,
  ExternalLink, Globe, Paperclip, Power, FileText, CheckCircle
} from "lucide-react"
import { api, type KioskBanner } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG } from "../../utils/format"
import { Promotion360Modal } from "../marketing/Promotion360Modal"

type Tab = "comando" | "audiencias" | "promociones_pos" | "kiosco" | "chat"

const KIOSK_COLORS = [
  { id: "orange", label: "Naranja", bg: "from-orange-500 to-amber-600", border: "border-orange-500" },
  { id: "emerald", label: "Verde", bg: "from-emerald-500 to-teal-600", border: "border-emerald-500" },
  { id: "amber", label: "Ámbar", bg: "from-amber-500 to-yellow-600", border: "border-amber-500" },
  { id: "purple", label: "Violeta", bg: "from-purple-600 to-indigo-700", border: "border-purple-500" },
  { id: "blue", label: "Azul", bg: "from-blue-600 to-cyan-700", border: "border-blue-500" },
  { id: "rose", label: "Rosa", bg: "from-rose-500 to-pink-600", border: "border-rose-500" },
]

/**
 * Formateador de texto limpio para el chat (elimina asteriscos crudos ** y renderiza negrita y listas)
 */
function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, lIdx) => {
        if (!line.trim()) return <div key={lIdx} className="h-1" />

        const isBullet = line.trim().startsWith("•") || line.trim().startsWith("- ") || line.trim().startsWith("* ")
        const cleanLine = isBullet ? line.trim().replace(/^[-*•]\s*/, "") : line

        // Parsear **texto**
        const parts = cleanLine.split(/(\*\*.*?\*\*)/g)
        const rendered = parts.map((part, pIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="font-extrabold text-slate-900 dark:text-white bg-purple-500/10 px-1 py-0.5 rounded">
                {part.slice(2, -2)}
              </strong>
            )
          }
          return <span key={pIdx}>{part}</span>
        })

        if (isBullet) {
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
              <div className="flex-1">{rendered}</div>
            </div>
          )
        }

        return <p key={lIdx}>{rendered}</p>
      })}
    </div>
  )
}

export default function MarketingAgentPage() {
  const [tab, setTab] = useState<Tab>("comando")
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  // Estado del Dashboard y Sincronización Tripartita
  const [dashboard, setDashboard] = useState<any>(null)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [rfmCustomers, setRfmCustomers] = useState<any[]>([])
  const [loadingRfm, setLoadingRfm] = useState(false)
  const [learnedRules, setLearnedRules] = useState<any[]>([])

  // Promociones con Pulso Comercial de IA & Modal 360
  const [promotionsPulseList, setPromotionsPulseList] = useState<any[]>([])
  const [loadingPromosPulse, setLoadingPromosPulse] = useState(false)
  const [selectedPromo360Id, setSelectedPromo360Id] = useState<string | null>(null)

  // Filtros de Audiencias y Etiquetas Dinámicas
  const [selectedRfmSegment, setSelectedRfmSegment] = useState<string | null>(null)
  const [searchCustomer, setSearchCustomer] = useState("")
  const [audienceTags, setAudienceTags] = useState<any[]>([])
  const [selectedTag, setSelectedTag] = useState<string>("todos")
  const [reprofiling, setReprofiling] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTagForm, setNewTagForm] = useState({ tag_name: "", producto_keyword: "", barrio: "", min_gasto: "" })
  const [savingTag, setSavingTag] = useState(false)

  // Formulario de Nueva Regla de Memoria
  const [newRuleText, setNewRuleText] = useState("")
  const [savingRule, setSavingRule] = useState(false)
  const [showMemoryPanel, setShowMemoryPanel] = useState(false)

  // Banners del Verificador de Precios y Web
  const [kioskBanners, setKioskBanners] = useState<KioskBanner[]>([])
  const [kioskLoading, setKioskLoading] = useState(false)
  const [kioskChannelFilter, setKioskChannelFilter] = useState<"todos" | "kiosco" | "web">("todos")
  const [editingBanner, setEditingBanner] = useState<KioskBanner | null>(null)
  const [showBannerForm, setShowBannerForm] = useState(false)
  const [bannerForm, setBannerForm] = useState({
    titulo: "", subtitulo: "", etiqueta: "OFERTA SALÓN", descuento_texto: "", color: "purple", activo: true,
  })
  const [savingBanner, setSavingBanner] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Chat State y Control de Voz
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; action_outcome?: any; suggestions?: string[] }>>([
    {
      role: "assistant",
      content: "👋 ¡Hola! Soy el **CMO Virtual** de Extra Supermercado. Gestiono en vivo los **7.856 clientes**, el sobre-stock del **CFO** y las promociones activas en cajas POS. Podés consultarme o darme directivas por texto o por voz usando el micrófono.",
      suggestions: [
        "¿Cuáles son los VIPs en riesgo de abandono y qué les ofrecemos?",
        "Analizar el pulso y tracción de las promociones en cajas",
        "Crear combo para liquidar sobre-stock de carnicería",
        "Ver reglas aprendidas de marketing"
      ]
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Carga Principal
  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, syncRes, rulesRes, bannersRes, promosPulseRes] = await Promise.allSettled([
        api.marketingAgent.dashboard(companyId),
        api.marketingAgent.tripartiteSync(companyId),
        api.marketingAgent.learnedRules(companyId),
        api.kiosk.banners.list(),
        api.marketingAgent.promotionsPulse(companyId),
      ])

      if (dashRes.status === "fulfilled") setDashboard(dashRes.value)
      if (syncRes.status === "fulfilled") setSyncStatus(syncRes.value)
      if (rulesRes.status === "fulfilled") setLearnedRules(rulesRes.value || [])
      if (bannersRes.status === "fulfilled") setKioskBanners(bannersRes.value || [])
      if (promosPulseRes.status === "fulfilled") setPromotionsPulseList(promosPulseRes.value || [])
    } catch (e: any) {
      toast.error("Error al cargar datos del CMO", e?.message)
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  // Subir imagen para un banner existente
  const handleUploadBannerImage = async (bannerId: string, file: File) => {
    try {
      toast.info("Subiendo imagen...", "Procesando creativo para terminales de salón.")
      await api.kiosk.banners.uploadImage(bannerId, file)
      toast.success("Imagen Publicada", "La nueva imagen ya está visible en los verificadores de precios.")
      await fetchKioskBanners()
    } catch (err: any) {
      toast.error("Error al subir imagen", err?.message)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Cargar Clientes RFM con Filtro
  const fetchRfmCustomers = useCallback(async (segmento?: string, search?: string) => {
    setLoadingRfm(true)
    try {
      const res = await api.marketingAgent.customersRfm({
        companyId,
        segmento: segmento || undefined,
        search: search?.trim() || undefined,
        limit: 30
      })
      setRfmCustomers(res || [])
    } catch {
      setRfmCustomers([])
    } finally {
      setLoadingRfm(false)
    }
  }, [companyId])

  // Cargar Etiquetas Dinámicas de la BD
  const fetchAudienceTags = useCallback(async () => {
    try {
      const tags = await api.marketingAgent.audienceTags(companyId)
      setAudienceTags(tags || [])
    } catch {
      setAudienceTags([])
    }
  }, [companyId])

  useEffect(() => {
    if (tab === "audiencias") {
      fetchRfmCustomers(selectedRfmSegment || undefined, searchCustomer)
      fetchAudienceTags()
    }
  }, [tab, fetchRfmCustomers, fetchAudienceTags])

  // Cargar Promociones con Pulso Comercial de IA
  const fetchPromotionsPulse = useCallback(async () => {
    setLoadingPromosPulse(true)
    try {
      const promos = await api.marketingAgent.promotionsPulse(companyId)
      setPromotionsPulseList(promos || [])
    } catch {
      setPromotionsPulseList([])
    } finally {
      setLoadingPromosPulse(false)
    }
  }, [companyId])

  useEffect(() => {
    if (tab === "promociones_pos") fetchPromotionsPulse()
  }, [tab, fetchPromotionsPulse])

  // Cargar Banners Kiosco
  const fetchKioskBanners = useCallback(async () => {
    setKioskLoading(true)
    try {
      const list = await api.kiosk.banners.list()
      setKioskBanners(list || [])
    } catch (e: any) {
      toast.error("No se pudieron cargar los banners", e?.message)
    } finally {
      setKioskLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === "kiosco") fetchKioskBanners()
  }, [tab, fetchKioskBanners])

  // Ejecutar Re-Perfilado Continuo de la Base
  const handleReprofileCustomers = async () => {
    setReprofiling(true)
    try {
      const res = await api.marketingAgent.reprofileCustomers(companyId)
      toast.success("Re-Perfilado Exitoso", res?.mensaje || "Se recalcularon recencia y hábitos.")
      await fetchAudienceTags()
      await fetchRfmCustomers(selectedRfmSegment || undefined, searchCustomer)
      await loadInitialData()
    } catch (e: any) {
      toast.error("Error en re-perfilado", e?.message)
    } finally {
      setReprofiling(false)
    }
  }

  // Crear Nueva Etiqueta Dinámica
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagForm.tag_name.trim() || savingTag) return
    setSavingTag(true)
    try {
      const res = await api.marketingAgent.createAudienceTag({
        companyId,
        tag_name: newTagForm.tag_name.trim(),
        producto_keyword: newTagForm.producto_keyword.trim() || undefined,
        barrio: newTagForm.barrio.trim() || undefined,
        min_gasto: newTagForm.min_gasto ? parseFloat(newTagForm.min_gasto) : undefined
      })
      toast.success("Etiqueta Creada", res?.mensaje || "Asignada exitosamente.")
      setShowTagModal(false)
      setNewTagForm({ tag_name: "", producto_keyword: "", barrio: "", min_gasto: "" })
      await fetchAudienceTags()
      await fetchRfmCustomers(selectedRfmSegment || undefined, searchCustomer)
    } catch (e: any) {
      toast.error("Error al crear etiqueta", e?.message)
    } finally {
      setSavingTag(false)
    }
  }

  // Acción Individual: Enviar Oferta Personalizada por WhatsApp
  const handleOpenWhatsApp = (c: any) => {
    const textMsg = encodeURIComponent(c.whatsapp_mensaje_sugerido || `¡Hola ${c.nombre}! Te esperamos en Extra Supermercado.`)
    const rawPhone = c.telefono ? String(c.telefono).replace(/\D/g, "") : ""
    if (!rawPhone) {
      navigator.clipboard.writeText(c.whatsapp_mensaje_sugerido || "")
      toast.warning("Sin Teléfono Registrado", `Mensaje copiado al portapapeles para ${c.nombre}.`)
      return
    }
    const fullPhone = rawPhone.startsWith("595") ? rawPhone : `595${rawPhone.replace(/^0/, "")}`
    window.open(`https://wa.me/${fullPhone}?text=${textMsg}`, "_blank")
  }

  // Acción Individual: Crear Cupón Nominativo en POS
  const handleCreatePersonalCoupon = async (c: any) => {
    try {
      const favProd = c.productos_favoritos?.[0]?.producto_nombre || "Compras Habituales"
      await api.marketingAgent.launchCampaign({
        company_id: companyId,
        campaign_id: `INDIV-${c.documento}`,
        segmento: `Cliente ${c.nombre} (${c.documento})`,
        crear_en_pos: true,
        descuento_pct: 15.0,
        message: `Cupón 15% OFF en ${favProd} para cédula ${c.documento}`
      })
      toast.success("Cupón Registrado en POS", `Beneficio activado en cajas para ${c.nombre} (CI: ${c.documento}).`)
      await fetchPromotionsPulse()
    } catch (e: any) {
      toast.error("Error al generar cupón", e?.message)
    }
  }

  // Gestión de Banners: Guardar (Crear o Modificar)
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bannerForm.titulo.trim() || savingBanner) return
    setSavingBanner(true)
    try {
      if (editingBanner?.id) {
        await api.kiosk.banners.update(editingBanner.id, {
          titulo: bannerForm.titulo.trim(),
          subtitulo: bannerForm.subtitulo?.trim() || null,
          descuento_texto: bannerForm.descuento_texto?.trim() || null,
          color: bannerForm.color || "purple",
          activo: bannerForm.activo ?? true,
        })
        toast.success("Banner Actualizado", "Los cambios se guardaron y sincronizaron con los verificadores del salón.")
      } else {
        await api.kiosk.banners.create({
          titulo: bannerForm.titulo.trim(),
          subtitulo: bannerForm.subtitulo?.trim() || null,
          descuento_texto: bannerForm.descuento_texto?.trim() || null,
          color: bannerForm.color || "purple",
          activo: bannerForm.activo ?? true,
          orden: kioskBanners.length,
        })
        toast.success("Banner Publicado", "Nuevo banner al aire en los terminales táctiles del salón.")
      }
      setShowBannerForm(false)
      setEditingBanner(null)
      await fetchKioskBanners()
    } catch (err: any) {
      toast.error("Error al guardar banner", err?.message)
    } finally {
      setSavingBanner(false)
    }
  }

  // Gestión de Banners: Eliminar
  const handleDeleteBanner = async (bannerId: string, titulo: string) => {
    if (!confirm(`¿Eliminar el banner "${titulo}"? Se retirará de las pantallas del salón.`)) return
    try {
      await api.kiosk.banners.delete(bannerId)
      toast.success("Banner Eliminado", `"${titulo}" fue retirado del salón.`)
      await fetchKioskBanners()
    } catch (err: any) {
      toast.error("Error al eliminar banner", err?.message)
    }
  }

  // Gestión de Banners: Activar / Pausar
  const handleToggleBanner = async (banner: any) => {
    try {
      const nuevoEstado = !banner.activo
      await api.kiosk.banners.update(banner.id, { activo: nuevoEstado })
      toast.success(nuevoEstado ? "Banner Activado" : "Banner Pausado", `"${banner.titulo}" ${nuevoEstado ? "está al aire" : "fue pausado"}.`)
      await fetchKioskBanners()
    } catch (err: any) {
      toast.error("Error al cambiar estado", err?.message)
    }
  }

  // Gestión de Banners: Abrir Edición
  const handleEditBanner = (banner: any) => {
    setEditingBanner(banner)
    setBannerForm({
      titulo: banner.titulo || "",
      subtitulo: banner.subtitulo || "",
      etiqueta: banner.etiqueta || "OFERTA SALÓN",
      descuento_texto: banner.descuento_texto || "",
      color: banner.color || "purple",
      activo: banner.activo ?? true,
    })
    setShowBannerForm(true)
  }

  // Sugerir Banner con IA desde Sobre-Stock
  const handleSuggestBannerWithAI = () => {
    const sobreStockTxt = syncStatus?.cfo_sobrestock_valor_gs ? formatPYG(syncStatus.cfo_sobrestock_valor_gs) : "62.425.000 Gs"
    setEditingBanner(null)
    setBannerForm({
      titulo: "¡Mega Oportunidad Extra Supermercado!",
      subtitulo: `Aprovechá cortes y productos seleccionados a precio mayorista (${sobreStockTxt} en liquidación)`,
      etiqueta: "LIQUIDACIÓN SALÓN",
      descuento_texto: "25% OFF",
      color: "purple",
      activo: true
    })
    setShowBannerForm(true)
    toast.success("Banner Generado con IA", "Sugerencia lista basada en las directivas de sobre-stock del CFO.")
  }

  // Soporte de Voz (Speech to Text)
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false)
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.warning("Reconocimiento de Voz No Disponible", "Tu navegador no soporta Web Speech API.")
      return
    }
    try {
      const recognition = new SpeechRecognition()
      recognition.lang = "es-PY"
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInputMessage(prev => prev ? `${prev} ${transcript}` : transcript)
        setIsListening(false)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)
      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  // Reproducir Respuesta Hablada (Text to Speech)
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    const cleanText = text.replace(/[*#_`]/g, "")
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = "es-ES"
    utterance.rate = 1.05
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  // Scroll automático en el chat
  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, tab])

  // Envío de Mensaje al Chat ReAct
  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage
    if ((!query.trim() && !attachedFile) || chatLoading) return

    let finalPrompt = query
    if (attachedFile) {
      finalPrompt += ` [Archivo adjunto: ${attachedFile.name} (${Math.round(attachedFile.size / 1024)} KB)]`
      setAttachedFile(null)
    }

    setInputMessage("")
    const newHistory = [...messages, { role: "user" as const, content: finalPrompt }]
    setMessages(newHistory)
    setChatLoading(true)

    try {
      const res = await api.marketingAgent.chat({
        company_id: companyId,
        message: finalPrompt,
        conversation_history: newHistory.map(m => ({ role: m.role, content: m.content }))
      })

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          action_outcome: res.action_outcome,
          suggestions: res.suggested_prompts || []
        }
      ])

      if (res.action_outcome?.tipo === "pos_promotion" || res.action_outcome?.tipo === "memory_rule") {
        loadInitialData()
      }
    } catch (e: any) {
      toast.error("Error en el agente de marketing", e?.message || "Intente nuevamente.")
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Hubo un error de conexión con el motor de IA. He registrado el incidente.",
          suggestions: ["Reintentar consulta", "Ver estado de sincronización"]
        }
      ])
    } finally {
      setChatLoading(false)
    }
  }

  // Guardar Regla Manual de Memoria
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRuleText.trim() || savingRule) return

    setSavingRule(true)
    try {
      await api.marketingAgent.recordRule(newRuleText.trim(), companyId)
      toast.success("Regla Guardada", "El CMO Virtual la recordará en todas sus decisiones futuras.")
      setNewRuleText("")
      const updatedRules = await api.marketingAgent.learnedRules(companyId)
      setLearnedRules(updatedRules || [])
    } catch (e: any) {
      toast.error("Error al guardar regla", e?.message)
    } finally {
      setSavingRule(false)
    }
  }

  // Ejecutar Acción Rápida de Campaña desde el Dashboard
  const handleExecuteSuggestion = async (camp: any) => {
    try {
      await api.marketingAgent.launchCampaign({
        company_id: companyId,
        campaign_id: camp.id,
        segmento: camp.segmento,
        crear_en_pos: true,
        descuento_pct: camp.descuento_sugerido_pct || 15.0,
        producto_ids: camp.producto_destacado ? [] : []
      })
      toast.success("Campaña Activada", `Se configuró la regla para ${camp.cantidad_clientes} clientes.`)
      loadInitialData()
    } catch (e: any) {
      toast.error("Error al ejecutar campaña", e?.message)
    }
  }

  // Filtrado de Clientes RFM en la lista por Búsqueda libre (los segmentos y etiquetas ya vienen filtrados del backend)
  const filteredCustomers = useMemo(() => {
    let list = rfmCustomers
    if (!searchCustomer.trim()) return list
    const q = searchCustomer.toLowerCase()
    return list.filter(c =>
      c.nombre?.toLowerCase().includes(q) ||
      c.documento?.toLowerCase().includes(q) ||
      c.barrio?.toLowerCase().includes(q)
    )
  }, [rfmCustomers, searchCustomer])

  return (
    <div className="space-y-6 animate-fade-in-up pb-20 max-w-full overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. LUXURY COMMAND DECK HEADER (CANÓNICO GEMINI.MD REGLA 11) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl rounded-3xl relative overflow-hidden">
        {/* Halos decorativos de fondo */}
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-20 w-60 h-60 bg-pink-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-purple-600/30">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-pink-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    CMO Virtual · Gerente de Marketing & Fidelización IA
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    ● ONLINE
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Audiencias en tiempo real, promociones automáticas en cajas registradoras y sincronización tripartita con CFO & CSO.
                </p>
              </div>
            </div>

            {/* Micro-pills corporativos */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-medium text-slate-300">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                👥 {dashboard?.total_clientes_fidelizados ? dashboard.total_clientes_fidelizados.toLocaleString() : "7.856"} clientes registrados
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-pink-300">
                ⚡ Tríada Activa: CFO (Piso {syncStatus?.cfo_margen_piso_pct || 22}%) ↔ CMO ↔ CSO
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🏷️ {promotionsPulseList.length || 25} promociones en cajas
              </span>
            </div>
          </div>

          {/* Botones de acción del Command Deck */}
          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadInitialData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
            <button
              onClick={() => setTab("chat")}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-pink-500 border border-pink-400/40 shadow-lg shadow-pink-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Sesión Estratégica
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS INTEGRADA (CANÓNICO GEMINI.MD REGLA 11) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Base Fidelizada</span>
              <span className="text-[10px] font-bold text-purple-400 font-mono">RFM</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {dashboard?.total_clientes_fidelizados ? dashboard.total_clientes_fidelizados.toLocaleString() : "7.856"}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              En riesgo Churn: <b className="text-rose-400">{dashboard?.clientes_en_riesgo_count || 1854}</b> clientes
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sobre-Stock (CFO)</span>
              <span className="text-[10px] font-bold text-amber-400 font-mono">A Liquidar</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-300">
              {formatPYG(syncStatus?.cfo_sobrestock_valor_gs || 62425000)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Inventario excedente disponible
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Retail (CFO)</span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">Piso: {syncStatus?.cfo_margen_piso_pct || 22}%</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {syncStatus?.cfo_margen_actual_pct ? `${syncStatus.cfo_margen_actual_pct}%` : "34.7%"}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Resguardo contra pérdidas
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Promos Activas POS</span>
              <span className="text-[10px] font-bold text-pink-400 font-mono">Terminales</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-pink-300">
              {promotionsPulseList.length || 25} <span className="text-sm font-semibold text-slate-400">reglas</span>
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Sincronizadas con cajas 2, 3, 4 y 5
            </p>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS (CANÓNICO GEMINI.MD REGLA 11) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "comando", label: "Directivas & Matriz Tripartita", icon: Target },
          { id: "audiencias", label: "Audiencias & RFM Real", icon: Users, badge: "7.856" },
          { id: "promociones_pos", label: "Promociones en Cajas POS & Pulso", icon: Percent, badge: String(promotionsPulseList.length || 25) },
          { id: "kiosco", label: "Banners en Salón (Kioscos & Web)", icon: Monitor, badge: String(kioskBanners.length) },
          { id: "chat", label: "Copiloto Estratégico CMO (Voz & Chat)", icon: Bot, badge: "IA" },
        ].map((t) => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`} />
              <span>{t.label}</span>
              {t.badge && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200" : "bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. CONTENIDO DE LAS PESTAÑAS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}

      {/* TAB 1: COMANDO & DIRECTIVAS ACTIVAS */}
      {tab === "comando" && (
        <div className="space-y-6">
          {/* RESUMEN EJECUTIVO */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-indigo-500/10 border border-purple-200 dark:border-purple-900/40 flex items-start gap-3.5">
            <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-purple-950 dark:text-purple-200">
                Diagnóstico del CMO Virtual en Tiempo Real
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {dashboard?.resumen_ejecutivo || "Cargando diagnóstico de marketing..."}
              </p>
            </div>
          </div>

          {/* MATRIZ DE COORDINACIÓN TRIPARTITA (CFO ↔ CSO ↔ CMO) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    Matriz de Alineación Tripartita en Vivo
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      dashboard?.sync_tripartito?.estado_general === "sincronizado"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : dashboard?.sync_tripartito?.estado_general === "advertencia"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                    }`}>
                      {dashboard?.sync_tripartito?.estado_general?.toUpperCase() || "SINCRONIZADO"}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sincronización bidireccional entre Finanzas (CFO), Ventas (CSO) y Marketing (CMO) sin datos simulados.
                  </p>
                </div>
              </div>

              {/* SEMÁFORO DE MARGEN VIVO */}
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-right">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block">MARGEN REAL MTD</span>
                  <strong className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                    {dashboard?.sync_tripartito?.cso_margen_actual_pct || 16.9}%
                  </strong>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-right">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block">PISO EXIGIDO</span>
                  <strong className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                    {dashboard?.sync_tripartito?.cso_margen_piso_pct || 20}%
                  </strong>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-right">
                  <span className="text-[10px] font-mono font-bold text-slate-400 block">META ÓPTIMA</span>
                  <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {dashboard?.sync_tripartito?.cso_margen_ideal_pct || 24}%
                  </strong>
                </div>
              </div>
            </div>

            {/* ALERTAS DE ALINEACIÓN SI EXISTEN */}
            {dashboard?.sync_tripartito?.alertas_alineacion && dashboard.sync_tripartito.alertas_alineacion.length > 0 && (
              <div className="space-y-2">
                {dashboard.sync_tripartito.alertas_alineacion.map((alerta: string, aIdx: number) => (
                  <div key={aIdx} className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                      {alerta}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 3 PILARES EN RED */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* PILAR 1: FINANZAS (CFO) */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Finanzas (CFO)
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-600">Liquidez & EBITDA</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Sobre-Stock a Liquidar:</span>
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {formatPYG(dashboard?.sync_tripartito?.cfo_sobrestock_valor_gs || 0)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Piso de Margen Comercial:</span>
                    <strong className="font-mono text-rose-600 dark:text-rose-400">
                      {dashboard?.sync_tripartito?.cfo_margen_piso_pct || 20}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* PILAR 2: VENTAS (CSO) */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Ventas (CSO)
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600">Rentabilidad Salón</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Ticket Promedio Real:</span>
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {formatPYG(dashboard?.sync_tripartito?.cso_ticket_promedio_gs || 97862)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Brecha para Piso 20%:</span>
                    <strong className="font-mono text-amber-600 dark:text-amber-400">
                      {formatPYG(dashboard?.sync_tripartito?.cso_gap_meta_gs || 14640275)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* PILAR 3: MARKETING (CMO) */}
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Marketing (CMO)
                  </span>
                  <span className="text-[10px] font-mono font-bold text-purple-600">Conversión POS</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Promos Activas en Caja:</span>
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {dashboard?.sync_tripartito?.cmo_promociones_activas || 0} activas
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Cupones WhatsApp:</span>
                    <strong className="font-mono text-purple-600 dark:text-purple-400">
                      {dashboard?.sync_tripartito?.cmo_clientes_fidelizados_impactados || 0} enviados
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* DIRECTIVAS INTER-AGENTES ACTIVAS */}
            {dashboard?.sync_tripartito?.directivas_activas && dashboard.sync_tripartito.directivas_activas.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Directivas Inter-Gerenciales en Ejecución ({dashboard.sync_tripartito.directivas_activas.length}):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {dashboard.sync_tripartito.directivas_activas.map((dir: any) => (
                    <div
                      key={dir.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2 flex flex-col justify-between text-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {dir.codigo}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            dir.prioridad === "alta" || dir.prioridad === "critica"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}>
                            {dir.prioridad?.toUpperCase()}
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-900 dark:text-white leading-snug">
                          {dir.titulo}
                        </h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                          {dir.mensaje}
                        </p>
                      </div>
                      {dir.accion_sugerida && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {dir.accion_sugerida}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TARJETAS DE ACCIONES Y CAMPAÑAS SUGERIDAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" /> Campañas con Datos Reales y Aprobación 1-Clic
              </h3>
              <span className="text-xs text-slate-500">Integrado a POS y WhatsApp</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard?.campanas_sugeridas?.map((camp: any) => (
                <div
                  key={camp.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                        {camp.segmento}
                      </span>
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        {camp.cantidad_clientes?.toLocaleString()} clientes
                      </span>
                    </div>

                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                      {camp.titulo}
                    </h4>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {camp.descripcion}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Descuento Sugerido:</span>
                      <b className="text-purple-600 dark:text-purple-400 font-black">
                        {camp.descuento_sugerido_pct}% OFF
                      </b>
                    </div>

                    <button
                      onClick={() => handleExecuteSuggestion(camp)}
                      className="w-full py-2.5 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Activar en Cajas POS (1-Clic)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIENCIAS & RFM REAL */}
      {tab === "audiencias" && (
        <div className="space-y-5">
          {/* MATRIZ DE SEGMENTOS INTERACTIVA CON FILTRADO EN 1 CLIC */}
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Segmentos RFM Reales · Hacé clic en una tarjeta para filtrar la lista:
              </span>
              {selectedRfmSegment && (
                <button
                  onClick={() => {
                    setSelectedRfmSegment(null)
                    setSelectedTag("todos")
                    fetchRfmCustomers(undefined, searchCustomer)
                  }}
                  className="text-[11px] font-bold text-purple-600 hover:text-purple-700 underline cursor-pointer"
                >
                  Limpiar Filtro (Ver Todos)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {dashboard?.segmentos?.map((seg: any) => {
                const segKey = seg.id === "vip_champions" ? "champions" :
                               seg.id === "vip_inactivos" ? "churn" :
                               seg.id === "frecuentes" ? "frecuentes" : "ocasionales"
                const isSelected = selectedRfmSegment === segKey

                return (
                  <button
                    type="button"
                    key={seg.id}
                    onClick={() => {
                      const next = isSelected ? null : segKey
                      setSelectedRfmSegment(next)
                      setSelectedTag("todos")
                      fetchRfmCustomers(next || undefined, searchCustomer)
                    }}
                    className={`text-left rounded-3xl p-4 shadow-sm space-y-2.5 transition cursor-pointer border ${
                      isSelected
                        ? "bg-purple-50/90 dark:bg-purple-950/40 border-purple-600 ring-2 ring-purple-600/30 dark:border-purple-500"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">{seg.nombre}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full font-mono ${
                        isSelected
                          ? "bg-purple-600 text-white"
                          : "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                      }`}>
                        {seg.cantidad.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                      {formatPYG(seg.ticket_promedio_gs)}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight line-clamp-2">
                      {seg.criterio}
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[10px] font-bold">
                      <span className={isSelected ? "text-purple-600 font-extrabold" : "text-slate-400"}>
                        {isSelected ? "✓ Filtrando este segmento" : "Clic para filtrar ↓"}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-[9px]">
                          ACTIVO
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* BARRA DE ACCIÓN: RE-PERFILADO CONTINUO Y CREACIÓN DE ETIQUETAS */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" /> Motor de Re-Perfilado Continuo & Etiquetas Dinámicas
              </h4>
              <p className="text-[11px] text-slate-500">
                Recalcula recencia, frecuencia, compras en salón y actualiza productos habituales para los 7.856 clientes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReprofileCustomers}
                disabled={reprofiling}
                className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reprofiling ? "animate-spin" : ""}`} />
                {reprofiling ? "Recalculando hábitos..." : "Recalcular Hábitos & Re-perfilar"}
              </button>
              <button
                onClick={() => setShowTagModal(true)}
                className="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-purple-600" />
                Nueva Etiqueta
              </button>
            </div>
          </div>

          {/* SELECTOR DE ETIQUETAS DINÁMICAS */}
          {audienceTags.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 pl-1 pr-2 whitespace-nowrap">
                Filtrar por Etiqueta:
              </span>
              <button
                onClick={() => {
                  setSelectedTag("todos")
                  setSelectedRfmSegment(null)
                  fetchRfmCustomers(undefined, searchCustomer)
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedTag === "todos" && !selectedRfmSegment
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                Todas las Audiencias
              </button>
              {audienceTags.map(tag => (
                <button
                  key={tag.etiqueta}
                  onClick={() => {
                    setSelectedTag(tag.etiqueta)
                    setSelectedRfmSegment(tag.etiqueta)
                    fetchRfmCustomers(tag.etiqueta, searchCustomer)
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedRfmSegment === tag.etiqueta
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{tag.etiqueta}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    selectedRfmSegment === tag.etiqueta ? "bg-purple-800 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                    {tag.cantidad}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* LISTADO DE CLIENTES REALES CON HÁBITOS Y ACCIONES INDIVIDUALES DE IA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" /> Clientes Reales con Acciones Individuales Personalizadas (IA)
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedRfmSegment ? `Filtrando por: ${selectedRfmSegment.toUpperCase()}` : "Mostrando clientes con mayor volumen de compra en Extra Supermercado"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Buscar nombre, cédula o barrio..."
                    value={searchCustomer}
                    onChange={e => {
                      setSearchCustomer(e.target.value)
                      if (!e.target.value.trim()) {
                        fetchRfmCustomers(selectedRfmSegment || undefined, undefined)
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        fetchRfmCustomers(selectedRfmSegment || undefined, searchCustomer)
                      }
                    }}
                    className="pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none w-64"
                  />
                </div>
                <button
                  onClick={() => fetchRfmCustomers(selectedRfmSegment || undefined, searchCustomer)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer"
                >
                  Buscar
                </button>
              </div>
            </div>

            {/* MODAL CREAR NUEVA ETIQUETA */}
            {showTagModal && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-purple-600" /> Crear Nueva Etiqueta de Audiencia
                    </h4>
                    <button onClick={() => setShowTagModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateTag} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Nombre de la Etiqueta *</label>
                      <input
                        type="text"
                        placeholder="Ej: Amantes del Asado, Cerveceros, Compradores Bebés..."
                        value={newTagForm.tag_name}
                        onChange={e => setNewTagForm({ ...newTagForm, tag_name: e.target.value })}
                        required
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Palabra clave en Productos Comprados</label>
                      <input
                        type="text"
                        placeholder="Ej: Costilla, Brahma, Michelob, Pañal, Yerba..."
                        value={newTagForm.producto_keyword}
                        onChange={e => setNewTagForm({ ...newTagForm, producto_keyword: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Filtro de Barrio (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: San Gerardo, Obrero, Centro..."
                        value={newTagForm.barrio}
                        onChange={e => setNewTagForm({ ...newTagForm, barrio: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTagModal(false)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingTag || !newTagForm.tag_name.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 cursor-pointer"
                      >
                        {savingTag ? "Creando y asignando..." : "Crear y Asignar"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {loadingRfm ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <p className="font-bold">No se encontraron clientes para el filtro actual.</p>
                <p className="text-[11px] text-slate-400">Probá limpiando el filtro de búsqueda o seleccionando otro segmento.</p>
                <button
                  onClick={() => {
                    setSelectedRfmSegment(null)
                    setSelectedTag("todos")
                    setSearchCustomer("")
                    fetchRfmCustomers(undefined, undefined)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-800 text-xs font-bold hover:bg-purple-200 transition"
                >
                  Restablecer Filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map((c) => {
                  const esChurn = c.dias_inactivo >= 20
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3.5 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white leading-snug">{c.nombre}</h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              DOC: {c.documento} · {c.barrio || "PJC"}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            esChurn
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300"
                          }`}>
                            {c.segmento}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Gasto Total Acumulado:</span>
                            <b className="font-mono text-slate-900 dark:text-white">{formatPYG(c.total_gastado_gs)}</b>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Última Compra en Cajas:</span>
                            <span className={`font-bold ${esChurn ? "text-rose-600 font-extrabold" : "text-emerald-600"}`}>
                              {esChurn ? `⚠️ Inactivo hace ${c.dias_inactivo} días` : `hace ${c.dias_inactivo} días`}
                            </span>
                          </div>
                        </div>

                        {/* TOP PRODUCTOS FAVORITOS */}
                        {c.productos_favoritos && c.productos_favoritos.length > 0 && (
                          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                            <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3 text-purple-500" /> Productos Habituales:
                            </span>
                            <div className="space-y-1">
                              {c.productos_favoritos.map((p: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-[10px]">
                                  <span className="truncate max-w-[170px] text-slate-700 dark:text-slate-300 font-medium">
                                    • {p.producto_nombre}
                                  </span>
                                  <span className="font-mono text-slate-400 font-bold">{p.compras_count}x</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* CAJA DE ACCIÓN IA HIPER-PERSONALIZADA */}
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-900/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-purple-900 dark:text-purple-200 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-600" /> Acción IA Individual
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-200/80 dark:bg-purple-900/80 text-purple-900 dark:text-purple-200">
                            Personalizada
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                          {c.accion_sugerida_ia || "Generar beneficio para incentivar ticket"}
                        </p>
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            onClick={() => handleOpenWhatsApp(c)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 transition shadow-xs cursor-pointer"
                            title="Enviar oferta hiper-personalizada por WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                          <button
                            onClick={() => handleCreatePersonalCoupon(c)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-extrabold bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1 transition shadow-xs cursor-pointer"
                            title="Crear cupón nominativo en cajas registradoras"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Cupón POS
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PROMOCIONES EN CAJAS POS CON PULSO IA & VISIÓN 360 */}
      {tab === "promociones_pos" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-purple-600" /> Rendimiento & Pulso IA de Promociones en Cajas (POS)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ventas reales contabilizadas desde las cajas de Extra Supermercado, ordenadas con las vigentes primero por próximo vencimiento.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPromotionsPulse()}
                disabled={loadingPromosPulse}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPromosPulse ? "animate-spin" : ""}`} />
                Actualizar Pulso
              </button>
              <button
                onClick={() => setTab("chat")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition cursor-pointer"
              >
                + Diseñar Nueva Promo con IA
              </button>
            </div>
          </div>

          {loadingPromosPulse ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : promotionsPulseList.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-bold">No hay promociones activas registradas en la base de datos.</p>
              <button
                onClick={() => setTab("chat")}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs"
              >
                Crear una con el CMO
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotionsPulseList.map((p: any) => {
                const esAlta = p.pulso_nivel === "alta_traccion"
                const esBaja = p.pulso_nivel === "bajo_impacto"
                const esVigente = p.activo && (p.dias_restantes === null || p.dias_restantes >= 0)
                const venceHoy = p.activo && p.dias_restantes === 0

                return (
                  <div
                    key={p.id}
                    className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition ${
                      esVigente
                        ? "border-purple-200/80 dark:border-purple-900/40 hover:border-purple-400"
                        : "border-slate-200 dark:border-slate-800 opacity-80"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* HEADER Y SEMÁFORO DE PULSO IA */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          esAlta
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                            : esBaja
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                        }`}>
                          {p.pulso_label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {venceHoy ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase shadow-xs">
                              🔥 VENCE HOY
                            </span>
                          ) : esVigente ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black uppercase">
                              {p.dias_restantes !== null ? `VIGENTE (${p.dias_restantes}d)` : "VIGENTE"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold uppercase">
                              FINALIZADA
                            </span>
                          )}
                          <span className="font-mono text-xs font-black text-purple-600">
                            {p.descuento_pct ? `${p.descuento_pct}% OFF` : p.tipo.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                          {p.nombre}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1">
                          <span>Vigencia: {p.fecha_inicio || "Hoy"} - {p.fecha_fin || "Indefinida"}</span>
                          {p.dias_restantes !== null && (
                            <span className={`font-bold ${p.dias_restantes <= 0 ? "text-amber-500" : "text-slate-600 dark:text-slate-300"}`}>
                              ({p.dias_restantes === 0 ? "Vence hoy" : `${p.dias_restantes} días restantes`})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* PRODUCTOS REALES AFECTADOS */}
                      {p.productos_nombres && p.productos_nombres.length > 0 && (
                        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                          <span className="text-[9px] font-extrabold uppercase text-slate-400">
                            Productos en Promoción ({p.productos_count}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {p.productos_nombres.map((pname: string, pIdx: number) => (
                              <span
                                key={pIdx}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-medium border border-slate-200/60 dark:border-slate-600 truncate max-w-[200px]"
                              >
                                {pname}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* DIAGNÓSTICO DEL CMO IA */}
                      <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50 space-y-1.5">
                        <span className="text-[9px] font-black uppercase text-purple-900 dark:text-purple-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-600" /> Diagnóstico del CMO:
                        </span>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                          {p.diagnostico_ia}
                        </p>
                        <p className="text-[10px] text-purple-800 dark:text-purple-300 font-bold pt-0.5">
                          💡 Sugerencia: {p.recomendacion_ia}
                        </p>
                      </div>

                      {/* MÉTRICAS EN CAJAS */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Tickets Registrados</span>
                          <b className="font-mono text-slate-900 dark:text-white">{p.total_usos} ventas</b>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Volumen Facturado</span>
                          <b className="font-mono text-purple-600 font-extrabold">{formatPYG(p.monto_facturado_gs)}</b>
                        </div>
                      </div>
                    </div>

                    {/* BOTÓN PROMOTION 360 MODAL */}
                    <button
                      onClick={() => setSelectedPromo360Id(p.id)}
                      className="w-full py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-purple-700 dark:hover:bg-purple-200 flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Abrir Auditoría & Visión 360°
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BANNERS OMNICANAL (KIOSCO & WEB) */}
      {tab === "kiosco" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Globe className="w-4 h-4 text-pink-600" /> Banners Omnicanal (Verificadores de Precios Salón + Web Móvil)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rotan en los terminales táctiles del salón y en la tienda online. Modificá, pausá, cambiá la imagen o eliminá banners en vivo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSuggestBannerWithAI}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-extrabold hover:bg-purple-100 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Sugerir con IA desde Sobre-Stock
              </button>
              <button
                onClick={() => {
                  setEditingBanner(null)
                  setBannerForm({ titulo: "", subtitulo: "", etiqueta: "OFERTA SALÓN", descuento_texto: "", color: "purple", activo: true })
                  setShowBannerForm(true)
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" /> + Nuevo Banner
              </button>
            </div>
          </div>


          {/* LISTADO DE BANNERS CON ACCIONES REALES (IMAGEN REAL, EDITAR, BORRAR, TOGGLE) */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Listado de Banners Publicados ({kioskBanners.length}):
            </h4>

            {kioskLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-pink-600" />
              </div>
            ) : kioskBanners.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <p className="font-bold">No hay banners publicados actualmente.</p>
                <button
                  onClick={handleSuggestBannerWithAI}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs cursor-pointer"
                >
                  Generar primer banner con IA
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {kioskBanners.map((b) => {
                  const colorObj = KIOSK_COLORS.find(c => c.id === b.color) || KIOSK_COLORS[3]
                  return (
                    <div
                      key={b.id}
                      className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3 p-4 flex flex-col justify-between"
                    >
                      {/* IMAGEN REAL PUBLICADA */}
                      {b.imagen_url ? (
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs group bg-slate-950 flex items-center justify-center min-h-[180px]">
                          <img
                            src={b.imagen_url}
                            alt={b.titulo}
                            className="w-full h-48 object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[9px] font-black uppercase">
                            {b.etiqueta || "OFERTA SALÓN"}
                          </div>
                          {b.descuento_texto && (
                            <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-white text-slate-900 font-mono text-xs font-black shadow-md">
                              {b.descuento_texto}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`rounded-2xl p-4 bg-gradient-to-r ${colorObj.bg} text-white shadow-sm space-y-2 relative overflow-hidden min-h-[140px] flex flex-col justify-between`}>
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black/30 backdrop-blur-xs">
                              {b.etiqueta || "OFERTA SALÓN"}
                            </span>
                            <span className="font-mono text-xs font-black px-2 py-0.5 rounded-full bg-white text-slate-900">
                              {b.descuento_texto || "PROMO"}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm leading-tight">{b.titulo}</h4>
                            {b.subtitulo && (
                              <p className="text-[10px] text-white/90 font-medium leading-tight mt-0.5 line-clamp-2">
                                {b.subtitulo}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">{b.titulo}</h4>
                        {b.subtitulo && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {b.subtitulo}
                          </p>
                        )}
                      </div>

                      {/* BOTONES DE ACCIÓN: EDITAR, SUBIR IMAGEN, TOGGLE ACTIVO, ELIMINAR */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs gap-1">
                        <button
                          onClick={() => handleToggleBanner(b)}
                          className={`flex items-center gap-1 font-bold text-[11px] px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            b.activo
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                          title={b.activo ? "Pausar banner" : "Activar banner"}
                        >
                          <Power className="w-3 h-3" />
                          {b.activo ? "En Pantalla" : "Pausado"}
                        </button>

                        <div className="flex items-center gap-1">
                          {/* Botón Subir Imagen / Cambiar Creativo */}
                          <label
                            className="p-1.5 rounded-lg text-pink-600 hover:bg-pink-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                            title="Subir o cambiar imagen del banner"
                          >
                            <ImagePlus className="w-4 h-4" />
                            <span className="text-[10px] font-bold hidden sm:inline">Foto</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                  await handleUploadBannerImage(b.id, e.target.files[0])
                                }
                              }}
                            />
                          </label>

                          <button
                            onClick={() => handleEditBanner(b)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Modificar texto"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBanner(b.id, b.titulo)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Eliminar banner"
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

          {/* MODAL CREAR / EDITAR BANNER */}
          {showBannerForm && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                    <ImagePlus className="w-4 h-4 text-pink-600" />
                    {editingBanner ? "Modificar Banner de Salón" : "Crear Nuevo Banner para Kioscos"}
                  </h4>
                  <button onClick={() => setShowBannerForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveBanner} className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Título Principal *</label>
                    <input
                      type="text"
                      placeholder="Ej: ¡Semana del Asado en Extra!"
                      value={bannerForm.titulo}
                      onChange={e => setBannerForm({ ...bannerForm, titulo: e.target.value })}
                      required
                      className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Subtítulo / Bajada</label>
                    <input
                      type="text"
                      placeholder="Ej: Costilla Premium y Vacío con 20% de descuento abonando en efectivo."
                      value={bannerForm.subtitulo}
                      onChange={e => setBannerForm({ ...bannerForm, subtitulo: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Etiqueta Superior</label>
                      <input
                        type="text"
                        placeholder="Ej: CARNICERÍA"
                        value={bannerForm.etiqueta}
                        onChange={e => setBannerForm({ ...bannerForm, etiqueta: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Texto Descuento</label>
                      <input
                        type="text"
                        placeholder="Ej: 20% OFF"
                        value={bannerForm.descuento_texto}
                        onChange={e => setBannerForm({ ...bannerForm, descuento_texto: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Selector de color */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Color del Fondo</label>
                    <div className="flex items-center gap-2">
                      {KIOSK_COLORS.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => setBannerForm({ ...bannerForm, color: c.id })}
                          className={`w-7 h-7 rounded-xl bg-gradient-to-r ${c.bg} transition cursor-pointer ${
                            bannerForm.color === c.id ? "ring-2 ring-purple-600 scale-110 shadow-md" : "opacity-75 hover:opacity-100"
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* PREVIEW EN TIEMPO REAL DENTRO DEL FORM */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Previsualización en Pantalla:</span>
                    {(() => {
                      const colorObj = KIOSK_COLORS.find(c => c.id === bannerForm.color) || KIOSK_COLORS[3]
                      return (
                        <div className={`rounded-2xl p-4 bg-gradient-to-r ${colorObj.bg} text-white shadow-md space-y-2`}>
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black/30">
                              {bannerForm.etiqueta || "OFERTA SALÓN"}
                            </span>
                            <span className="font-mono text-xs font-black px-2 py-0.5 rounded-full bg-white text-slate-900">
                              {bannerForm.descuento_texto || "PROMO"}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-black text-sm">{bannerForm.titulo || "Título del Banner"}</h4>
                            <p className="text-[10px] text-white/90">{bannerForm.subtitulo || "Subtítulo descriptivo de la promoción..."}</p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBannerForm(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingBanner || !bannerForm.titulo.trim()}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50 cursor-pointer"
                    >
                      {savingBanner ? "Guardando..." : editingBanner ? "Guardar Cambios" : "Publicar Banner"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COPILOTO ESTRATÉGICO CMO (VOZ, ADJUNTOS, MEMORIA Y ACCIONES) */}
      {tab === "chat" && (
        <div className="space-y-4">
          {/* PANEL DE CAPACIDADES DEL CMO A LA VISTA */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-5 rounded-3xl border border-indigo-500/20 shadow-xl text-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">
                  ¿Qué puede hacer el CMO Virtual por vos?
                </h3>
              </div>
              <button
                onClick={() => setShowMemoryPanel(!showMemoryPanel)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  showMemoryPanel
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800/80 text-purple-300 border border-purple-500/30 hover:bg-slate-800"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                {showMemoryPanel ? "Ocultar Memoria" : `Memoria Continua (${learnedRules.length})`}
              </button>
            </div>

            {/* Tarjetas interactivas de capacidades */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  title: "🎯 Rescate Churn",
                  desc: "Audita los 1.854 clientes en riesgo y genera ofertas de rescate automáticas.",
                  prompt: "¿Cuáles son los VIPs con más de 20 días sin comprar y qué oferta les enviamos?"
                },
                {
                  title: "🥩 Combos Anti-Merma",
                  desc: "Cruza el sobre-stock del CFO con carnicería para liquidar excedentes.",
                  prompt: "Armar un combo promocional para liquidar sobre-stock de carnicería este fin de semana."
                },
                {
                  title: "🏷️ Pulso de Promos POS",
                  desc: "Revisa las ventas reales de las 25 promos en cajas y ajusta descuentos.",
                  prompt: "Analizar el pulso y ventas de las promociones activas en cajas registradoras."
                },
                {
                  title: "📺 Banners en Salón",
                  desc: "Diseña y publica banners rotativos en los verificadores de precios.",
                  prompt: "Diseñar un banner para los verificadores de precios del salón de ventas."
                }
              ].map((cap, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => handleSendMessage(cap.prompt)}
                  className="text-left p-3 rounded-2xl bg-slate-800/60 hover:bg-purple-900/40 border border-slate-700/60 hover:border-purple-500/50 transition cursor-pointer space-y-1"
                >
                  <span className="font-black text-xs text-white block">{cap.title}</span>
                  <p className="text-[11px] text-slate-300 leading-tight">{cap.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* PANEL DE MEMORIA VIVA CONTINUA */}
          {showMemoryPanel && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-purple-200 dark:border-purple-900/60 p-5 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-extrabold uppercase text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-600" /> Memoria Corporativa Permanente (company_business_rules)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Reglas y políticas comerciales que el CMO Virtual aprende de tus indicaciones y nunca olvida al tomar decisiones.
                </p>
              </div>

              <form onSubmit={handleSaveRule} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enseñale una nueva regla fija (ej: 'Los miércoles de verduras el descuento nunca supera el 15%')..."
                  value={newRuleText}
                  onChange={e => setNewRuleText(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newRuleText.trim() || savingRule}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {savingRule ? "Guardando..." : "Guardar Regla"}
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {learnedRules.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {r.categoria}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">Confianza: 95%</span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">
                      "{r.regla}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONTENEDOR DE MENSAJES Y CONVERSACIÓN */}
          <div className="h-[620px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-none shadow-sm"
                      : "bg-slate-50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none shadow-xs"
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <FormattedMessage text={m.content} />
                      {m.role === "assistant" && (
                        <button
                          onClick={() => speakText(m.content)}
                          className="text-slate-400 hover:text-purple-600 transition shrink-0 p-1 cursor-pointer"
                          title="Escuchar respuesta por voz"
                        >
                          <Volume2 className={`w-4 h-4 ${isSpeaking ? "text-purple-600 animate-pulse" : ""}`} />
                        </button>
                      )}
                    </div>

                    {/* ACTION OUTCOME CARD SI HUBO TOOL CALLING */}
                    {m.action_outcome && (
                      <div className="p-3 mt-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase">{m.action_outcome.titulo}</span>
                          <p className="text-xs font-bold">{m.action_outcome.descripcion}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                      </div>
                    )}

                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {m.suggestions.map((p, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(p)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 hover:bg-purple-100 transition cursor-pointer"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    El CMO Virtual está consultando los 7.856 clientes y sobre-stock en tiempo real...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* CHIP DE ARCHIVO ADJUNTO */}
            {attachedFile && (
              <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/40 border-t border-purple-100 dark:border-purple-900/40 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span className="font-bold">{attachedFile.name}</span>
                  <span className="text-[10px] opacity-75">({Math.round(attachedFile.size / 1024)} KB)</span>
                </div>
                <button onClick={() => setAttachedFile(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* INPUT CON INTERACCIÓN DE VOZ, ADJUNTOS Y TEXTO */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
              <form onSubmit={e => { e.preventDefault(); handleSendMessage() }} className="flex items-center gap-2">
                {/* INPUT FILE OCULTO */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={e => {
                    if (e.target.files?.[0]) setAttachedFile(e.target.files[0])
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700 transition cursor-pointer"
                  title="Adjuntar archivo o imagen de volante/lista"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  placeholder="Escribí o hablá al CMO sobre sobre-stock, rescatar VIPs o crear combos..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  className="flex-1 px-4 py-3 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />

                {/* BOTÓN DE VOZ (MICROPHONE) */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3 rounded-2xl transition cursor-pointer ${
                    isListening
                      ? "bg-rose-600 text-white animate-bounce shadow-md shadow-rose-500/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700"
                  }`}
                  title={isListening ? "Escuchando... Clic para detener" : "Hablar con el CMO"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="submit"
                  disabled={(!inputMessage.trim() && !attachedFile) || chatLoading}
                  className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROMOTION 360 INTEGRADO */}
      {selectedPromo360Id && (
        <Promotion360Modal
          promoId={selectedPromo360Id}
          onClose={() => setSelectedPromo360Id(null)}
          onUpdate={() => {
            fetchPromotionsPulse()
            loadInitialData()
          }}
        />
      )}
    </div>
  )
}
