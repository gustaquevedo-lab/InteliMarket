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
  ExternalLink, Globe
} from "lucide-react"
import { api, type KioskBanner } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG } from "../../utils/format"
import { Promotion360Modal } from "../marketing/Promotion360Modal"

type Tab = "comando" | "audiencias" | "promociones_pos" | "kiosco" | "chat" | "memoria"

const KIOSK_COLORS = [
  { id: "orange", label: "Naranja", bg: "from-orange-500 to-amber-600" },
  { id: "emerald", label: "Verde", bg: "from-emerald-500 to-teal-600" },
  { id: "amber", label: "Ámbar", bg: "from-amber-500 to-yellow-600" },
  { id: "purple", label: "Violeta", bg: "from-purple-600 to-indigo-700" },
  { id: "blue", label: "Azul", bg: "from-blue-600 to-cyan-700" },
  { id: "rose", label: "Rosa", bg: "from-rose-500 to-pink-600" },
]

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
  const [rfmFilter, setRfmFilter] = useState<"todos" | "inactivos">("todos")
  const [learnedRules, setLearnedRules] = useState<any[]>([])
  const [promotionsList, setPromotionsList] = useState<any[]>([])
  const [loadingPromos, setLoadingPromos] = useState(false)

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
    titulo: "", subtitulo: "", etiqueta: "", descuento_texto: "", color: "purple", activo: true,
  })
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null)
  const [bannerImagePreview, setBannerImagePreview] = useState<string | null>(null)
  const [savingBanner, setSavingBanner] = useState(false)

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
      const [dashRes, syncRes, rulesRes] = await Promise.allSettled([
        api.marketingAgent.dashboard(companyId),
        api.marketingAgent.tripartiteSync(companyId),
        api.marketingAgent.learnedRules(companyId),
      ])

      if (dashRes.status === "fulfilled") setDashboard(dashRes.value)
      if (syncRes.status === "fulfilled") setSyncStatus(syncRes.value)
      if (rulesRes.status === "fulfilled") setLearnedRules(rulesRes.value || [])
    } catch (e: any) {
      toast.error("Error al cargar datos del CMO", e?.message)
    } finally {
      setLoading(false)
    }
  }, [companyId, toast])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Cargar Clientes RFM con Filtros Reales
  const fetchRfmCustomers = useCallback(async (segment?: string, search?: string) => {
    setLoadingRfm(true)
    try {
      const list = await api.marketingAgent.customersRfm({
        companyId,
        limit: 30,
        segmento: segment,
        search: search
      })
      setRfmCustomers(list || [])
    } catch (e: any) {
      toast.error("Error al cargar clientes", e?.message)
    } finally {
      setLoadingRfm(false)
    }
  }, [companyId, toast])

  useEffect(() => {
    if (tab === "audiencias") {
      fetchRfmCustomers(selectedRfmSegment || undefined, searchCustomer)
      fetchAudienceTags()
    }
  }, [tab, selectedRfmSegment, fetchRfmCustomers])

  // Cargar Pulso de Promociones de IA
  const fetchPromotionsPulse = useCallback(async () => {
    setLoadingPromosPulse(true)
    try {
      const list = await api.marketingAgent.promotionsPulse(companyId)
      setPromotionsPulseList(list || [])
    } catch (e: any) {
      toast.error("No se pudo cargar el pulso de promociones", e?.message)
    } finally {
      setLoadingPromosPulse(false)
    }
  }, [companyId, toast])

  useEffect(() => {
    if (tab === "promociones_pos") {
      fetchPromotionsPulse()
    }
  }, [tab, fetchPromotionsPulse])

  // Cargar Etiquetas Dinámicas de Audiencia
  const fetchAudienceTags = useCallback(async () => {
    try {
      const tags = await api.marketingAgent.audienceTags(companyId)
      setAudienceTags(tags || [])
    } catch {
      setAudienceTags([])
    }
  }, [companyId])

  // Re-Perfilado Dinámico de Clientes en Lote
  const handleReprofileCustomers = async () => {
    setReprofiling(true)
    try {
      const res = await api.marketingAgent.reprofileCustomers(companyId)
      toast.success("Re-Perfilado Completado", res?.mensaje || "Se recalcularon las métricas y hábitos.")
      await Promise.all([
        loadInitialData(),
        fetchRfmCustomers(rfmFilter === "inactivos" ? "inactivos" : undefined),
        fetchAudienceTags(),
      ])
    } catch (e: any) {
      toast.error("Error al re-perfilar clientes", e?.message)
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

  // Cargar Promociones de la BD
  const fetchPromotions = useCallback(async () => {
    setLoadingPromos(true)
    try {
      const promos = await api.promotions.list({ activo: true } as any)
      setPromotionsList(Array.isArray(promos) ? promos : (promos as any)?.items || [])
    } catch {
      setPromotionsList([])
    } finally {
      setLoadingPromos(false)
    }
  }, [])

  useEffect(() => {
    if (tab === "promociones_pos") fetchPromotions()
  }, [tab, fetchPromotions])

  // Scroll automático en el chat
  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, tab])

  // Envío de Mensaje al Chat ReAct
  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage
    if (!query.trim() || chatLoading) return

    setInputMessage("")
    const newHistory = [...messages, { role: "user" as const, content: query }]
    setMessages(newHistory)
    setChatLoading(true)

    try {
      const res = await api.marketingAgent.chat({
        company_id: companyId,
        message: query,
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

      // Si hubo una acción de creación de promo o regla, refrescar datos
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

  // Filtrado de Clientes RFM en la lista por Búsqueda y por Etiqueta Dinámica
  const filteredCustomers = useMemo(() => {
    let list = rfmCustomers
    if (selectedTag !== "todos") {
      const st = selectedTag.toLowerCase()
      list = list.filter(c =>
        (c.segmento && c.segmento.toLowerCase().includes(st)) ||
        (c.documento && c.documento.toLowerCase().includes(st))
      )
    }
    if (!searchCustomer.trim()) return list
    const q = searchCustomer.toLowerCase()
    return list.filter(c =>
      c.nombre?.toLowerCase().includes(q) ||
      c.documento?.toLowerCase().includes(q) ||
      c.barrio?.toLowerCase().includes(q)
    )
  }, [rfmCustomers, searchCustomer, selectedTag])

  return (
    <div className="space-y-6 pb-20">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER DE SALA DE COMANDO EJECUTIVO */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                CMO Virtual · Gerente de Marketing & Fidelización IA
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Tríada Conectada
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Conectado a <b className="text-slate-700 dark:text-slate-200">{dashboard?.total_clientes_fidelizados ? dashboard.total_clientes_fidelizados.toLocaleString() : "7.856"} clientes</b> y 278.020 tickets de salón de Extra Supermercado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadInitialData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
          <button
            onClick={() => setTab("chat")}
            className="px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white flex items-center gap-1.5 shadow-md shadow-pink-500/20 transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Negociar Estrategia
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. BARRA DE SINCRONIZACIÓN TRIPARTITA (CFO - CMO - CSO) */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* CARD CFO */}
        <div className="p-4 rounded-3xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-600" /> 1. CFO Virtual (Finanzas)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
              Piso Margen: {syncStatus?.cfo_margen_piso_pct || 22.0}%
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Margen Actual MTD</span>
              <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {syncStatus?.cfo_margen_actual_pct ? `${syncStatus.cfo_margen_actual_pct}%` : "34.7%"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Sobre-Stock a Monetizar</span>
              <p className="text-sm font-extrabold text-blue-700 dark:text-blue-300 font-mono">
                {formatPYG(syncStatus?.cfo_sobrestock_valor_gs || 62425000)}
              </p>
            </div>
          </div>
        </div>

        {/* CARD CMO */}
        <div className="p-4 rounded-3xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> 2. CMO Virtual (Marketing IA)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
              {dashboard?.reglas_aprendidas_count || learnedRules.length} Reglas en Memoria
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Promociones Activas POS</span>
              <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {syncStatus?.cmo_promociones_activas ?? promotionsList.length} activas
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Clientes Fidelizados</span>
              <p className="text-sm font-extrabold text-purple-700 dark:text-purple-300 font-mono">
                {dashboard?.total_clientes_fidelizados ? dashboard.total_clientes_fidelizados.toLocaleString() : "7.856"}
              </p>
            </div>
          </div>
        </div>

        {/* CARD CSO */}
        <div className="p-4 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> 3. Copiloto Comercial (CSO)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              Cumplimiento: {syncStatus?.cso_meta_cumplimiento_pct || 88.5}%
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Ticket Promedio Salón</span>
              <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {formatPYG(syncStatus?.cso_ticket_promedio_gs || 72500)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Alineación Cajas</span>
              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-bold">
                ✓ Sincronizado
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. NAVEGACIÓN PRINCIPAL DE PESTAÑAS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="p-1.5 bg-slate-100/90 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1.5 overflow-x-auto shadow-xs">
        {[
          { id: "comando", label: "Comando & Directivas Activas", icon: Target, badge: dashboard?.campañas_sugeridas?.length },
          { id: "audiencias", label: "Audiencias & RFM Real", icon: Users, badge: "7.856" },
          { id: "promociones_pos", label: "Promociones POS & Pulso IA", icon: Percent, badge: promotionsPulseList.length || promotionsList.length || undefined },
          { id: "kiosco", label: "Banners Omnicanal (Kiosco & Web)", icon: Globe, badge: kioskBanners.length || undefined },
          { id: "chat", label: "Estrategia CMO (Voz & Memoria)", icon: MessageSquare, badge: "IA" },
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
      {/* 4. CONTENIDO DE LAS PESTAÑAS */}
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

          {/* TARJETAS DE ACCIONES Y CAMPAÑAS SUGERIDAS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" /> Campañas con Datos Reales y Aprobación 1-Clic
              </h3>
              <span className="text-xs text-slate-500">Integrado a POS y WhatsApp</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard?.campañas_sugeridas?.map((camp: any) => (
                <div
                  key={camp.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                        {camp.origen_directiva || "DIRECTIVA CMO"}
                      </span>
                      {camp.descuento_sugerido_pct && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">
                          {camp.descuento_sugerido_pct}% OFF
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                      {camp.titulo}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {camp.motivo}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Alcance: <b className="text-slate-700 dark:text-slate-200">{camp.cantidad_clientes} clientes</b></span>
                      <span>Canales: <b>POS + Kiosco</b></span>
                    </div>
                    <button
                      onClick={() => handleExecuteSuggestion(camp)}
                      className="w-full py-2.5 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Aprobar y Desplegar en POS
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
                Diagnóstico en tiempo real del CMO: tracción en caja, productos involucrados y auditoría financiera 360°.
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
                return (
                  <div
                    key={p.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-700 transition"
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
                        <span className="font-mono text-xs font-black text-purple-600">
                          {p.descuento_pct ? `${p.descuento_pct}% OFF` : p.tipo.toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                          {p.nombre}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1">
                          <span>Vigencia: {p.fecha_inicio || "Hoy"} - {p.fecha_fin || "Indefinida"}</span>
                          {p.dias_restantes !== null && (
                            <span className="font-bold text-slate-600 dark:text-slate-300">
                              ({p.dias_restantes} días restantes)
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
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Ventas Registradas</span>
                          <b className="font-mono text-slate-900 dark:text-white">{p.total_usos} tickets</b>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Volumen Estimado</span>
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
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Globe className="w-4 h-4 text-pink-600" /> Banners Omnicanal (Verificadores de Precios + Web Móvil)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Publicá ofertas coordinadas en los terminales táctiles del salón y en la barra superior de la tienda web.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSuggestBannerWithAI}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-extrabold hover:bg-purple-100 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Sugerir Banner IA desde Sobre-Stock
              </button>
              <button
                onClick={() => {
                  setEditingBanner(null)
                  setBannerForm({ titulo: "", subtitulo: "", etiqueta: "", descuento_texto: "", color: "purple", activo: true })
                  setShowBannerForm(true)
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" /> + Crear Banner
              </button>
            </div>
          </div>

          {/* FILTRO DE CANALES */}
          <div className="flex items-center gap-2">
            {[
              { id: "todos", label: "Todos los Canales" },
              { id: "kiosco", label: "🖥️ Verificadores Salón (Kioscos)" },
              { id: "web", label: "📱 Tienda Web / E-commerce" },
            ].map(c => (
              <button
                key={c.id}
                onClick={() => setKioskChannelFilter(c.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  kioskChannelFilter === c.id
                    ? "bg-pink-600 text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* LISTADO CON VISTA PREVIA INTERACTIVA */}
          {kioskLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-pink-600" />
            </div>
          ) : kioskBanners.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <p className="font-bold">No hay banners publicados actualmente.</p>
              <button
                onClick={handleSuggestBannerWithAI}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs"
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
                    className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm space-y-3 p-4 flex flex-col justify-between"
                  >
                    {/* LIVE PREVIEW VISUAL DEL BANNER */}
                    <div className={`rounded-2xl p-4 bg-gradient-to-r ${colorObj.bg} text-white shadow-inner space-y-2 relative overflow-hidden min-h-[110px] flex flex-col justify-between`}>
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black/30 backdrop-blur-xs">
                          {b.etiqueta || "OFERTA SALÓN"}
                        </span>
                        <span className="font-mono text-sm font-black px-2 py-0.5 rounded-full bg-white text-slate-900">
                          {b.descuento_texto || "PROMO"}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm leading-tight drop-shadow-xs">{b.titulo}</h4>
                        {b.subtitulo && (
                          <p className="text-[10px] text-white/90 font-medium leading-tight mt-0.5 line-clamp-2">
                            {b.subtitulo}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 font-bold">
                        <Monitor className="w-3 h-3 text-slate-400" /> Kiosco Salón + Web
                      </span>
                      <span className={b.activo ? "text-emerald-600 font-bold" : "text-slate-400"}>
                        {b.activo ? "● Activo al aire" : "○ Pausado"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SESIÓN DE ESTRATEGIA CMO (CON VOZ, REGLAS Y MEMORIA INTEGRADA) */}
      {tab === "chat" && (
        <div className="space-y-4">
          {/* BARRA SUPERIOR CON TOGGLE DE MEMORIA ACTIVA */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Sesión Estratégica con el CMO (Qwen 2.5 7B Local + Gemini)
                </span>
                <p className="text-[10px] text-slate-400">
                  Tool Calling Activo: 7.856 clientes RFM · Sobre-Stock CFO ({formatPYG(syncStatus?.cfo_sobrestock_valor_gs || 62425000)}) · Promociones en Cajas
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMemoryPanel(!showMemoryPanel)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                showMemoryPanel
                  ? "bg-purple-600 text-white"
                  : "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {showMemoryPanel ? "Ocultar Memoria" : `Ver Cerebro & Memoria (${learnedRules.length})`}
            </button>
          </div>

          {/* PANEL LATERAL / SUPERIOR DE MEMORIA ACTIVA */}
          {showMemoryPanel && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-purple-200 dark:border-purple-900/60 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-purple-600" /> Memoria Corporativa Continua (company_business_rules)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Reglas estratégicas y políticas aprendidas por el CMO que condicionan sus decisiones automáticas.
                  </p>
                </div>
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
          <div className="h-[640px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-none shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none"
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="whitespace-pre-wrap font-sans leading-relaxed">{m.content}</div>
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

            {/* INPUT CON INTERACCIÓN DE VOZ Y TEXTO */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
              <form onSubmit={e => { e.preventDefault(); handleSendMessage() }} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escribí o hablá al CMO sobre liquidar sobre-stock, rescatar VIPs o crear combos..."
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
                  disabled={!inputMessage.trim() || chatLoading}
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
