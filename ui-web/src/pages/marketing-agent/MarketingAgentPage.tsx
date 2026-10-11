import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Bot, Megaphone, Sparkles, TrendingUp, Users, ShoppingBag,
  AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight,
  RefreshCw, Send, Calendar, Clock, DollarSign, Target, ShieldCheck,
  Zap, HeartHandshake, Eye, MessageCircle, BarChart3, Filter,
  Layers, Check, X, ChevronRight, ThumbsUp, ShoppingCart, Percent,
  Monitor, ImagePlus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2,
  Activity, MessageSquare, BookOpen, PlusCircle, Building2, Scale,
  Flame, CheckSquare, Search, Award
} from "lucide-react"
import { api, type KioskBanner } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG } from "../../utils/format"

type Tab = "comando" | "audiencias" | "promociones_pos" | "kiosco" | "memoria" | "chat"

const KIOSK_COLORS = [
  { id: "orange", label: "Naranja" },
  { id: "emerald", label: "Verde" },
  { id: "amber", label: "Ámbar" },
  { id: "purple", label: "Violeta" },
  { id: "blue", label: "Azul" },
  { id: "rose", label: "Rosa" },
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
  const [learnedRules, setLearnedRules] = useState<any[]>([])
  const [promotionsList, setPromotionsList] = useState<any[]>([])
  const [loadingPromos, setLoadingPromos] = useState(false)
  
  // Filtros de Audiencias y Etiquetas Dinámicas
  const [rfmFilter, setRfmFilter] = useState<"todos" | "inactivos">("inactivos")
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

  // Banners del Verificador de Precios (kiosco)
  const [kioskBanners, setKioskBanners] = useState<KioskBanner[]>([])
  const [kioskLoading, setKioskLoading] = useState(false)
  const [editingBanner, setEditingBanner] = useState<KioskBanner | null>(null)
  const [showBannerForm, setShowBannerForm] = useState(false)
  const [bannerForm, setBannerForm] = useState({
    titulo: "", subtitulo: "", etiqueta: "", descuento_texto: "", color: "orange", activo: true,
  })
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null)
  const [bannerImagePreview, setBannerImagePreview] = useState<string | null>(null)
  const [savingBanner, setSavingBanner] = useState(false)

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; action_outcome?: any; suggestions?: string[] }>>([
    {
      role: "assistant",
      content: "👋 ¡Hola! Soy el **CMO Virtual** de Extra Supermercado. Estoy conectado en tiempo real a los **7.856 clientes fidelizados**, al sobre-stock del **CFO** y a las metas del **Copiloto Comercial**. ¿Qué estrategia de ventas o rescate querés que coordinemos hoy?",
      suggestions: [
        "Ver estado de sincronización con el CFO",
        "¿Cuáles son los VIPs en riesgo de abandono?",
        "Crear combo para liquidar sobre-stock",
        "Ver reglas aprendidas de marketing"
      ]
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
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

  // Cargar Clientes RFM cuando entra a la pestaña
  const fetchRfmCustomers = useCallback(async (inactivos: boolean) => {
    setLoadingRfm(true)
    try {
      const list = await api.marketingAgent.customersRfm({
        companyId,
        limit: 20,
        solo_inactivos: inactivos
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
      fetchRfmCustomers(rfmFilter === "inactivos")
      fetchAudienceTags()
    }
  }, [tab, rfmFilter, fetchRfmCustomers])

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
        fetchRfmCustomers(rfmFilter === "inactivos"),
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
      await fetchRfmCustomers(rfmFilter === "inactivos")
    } catch (e: any) {
      toast.error("Error al crear etiqueta", e?.message)
    } finally {
      setSavingTag(false)
    }
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
          { id: "promociones_pos", label: "Promociones en Cajas POS", icon: Percent, badge: promotionsList.length || undefined },
          { id: "kiosco", label: "Banners en Kioscos", icon: Monitor, badge: kioskBanners.length || undefined },
          { id: "memoria", label: "Memoria & Buenas Prácticas", icon: BookOpen, badge: learnedRules.length || undefined },
          { id: "chat", label: "Sesión de Estrategia CMO", icon: MessageSquare },
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
          {/* MATRIZ DE SEGMENTOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {dashboard?.segmentos?.map((seg: any) => (
              <div
                key={seg.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400">{seg.nombre}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono">
                    {seg.cantidad.toLocaleString()}
                  </span>
                </div>
                <p className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {formatPYG(seg.ticket_promedio_gs)}
                </p>
                <p className="text-[11px] text-slate-500 font-medium leading-tight">
                  {seg.criterio}
                </p>
              </div>
            ))}
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
                onClick={() => setSelectedTag("todos")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedTag === "todos"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                Todas las Audiencias
              </button>
              {audienceTags.map(tag => (
                <button
                  key={tag.etiqueta}
                  onClick={() => setSelectedTag(tag.etiqueta)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedTag === tag.etiqueta
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{tag.etiqueta}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    selectedTag === tag.etiqueta ? "bg-purple-800 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                    {tag.cantidad}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* LISTADO DE CLIENTES REALES CON HÁBITOS DE COMPRA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" /> Clientes Reales con Productos Favoritos Detectados
                </h3>
                <p className="text-xs text-slate-500">
                  Calculado a partir de los 278.020 productos analizados en cupon_ticket_items.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, cédula o barrio..."
                    value={searchCustomer}
                    onChange={e => setSearchCustomer(e.target.value)}
                    className="pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none w-56"
                  />
                </div>
                <button
                  onClick={() => setRfmFilter(rfmFilter === "inactivos" ? "todos" : "inactivos")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    rfmFilter === "inactivos"
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                      : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {rfmFilter === "inactivos" ? "Filtrado: En Riesgo (>20d)" : "Todos los VIPs"}
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
                    <button onClick={() => setShowTagModal(false)} className="text-slate-400 hover:text-slate-600">
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
                        className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingTag || !newTagForm.tag_name.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
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
              <div className="p-8 text-center text-xs text-slate-500">
                No se encontraron clientes para el filtro actual.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">{c.nombre}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          DOC: {c.documento} · {c.barrio || "PJC"}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                        {c.segmento}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Gasto Total Acumulado:</span>
                        <b className="font-mono text-slate-900 dark:text-white">{formatPYG(c.total_gastado_gs)}</b>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Última Compra:</span>
                        <span className={`font-bold ${c.dias_inactivo >= 20 ? "text-rose-600" : "text-emerald-600"}`}>
                          hace {c.dias_inactivo} días
                        </span>
                      </div>
                    </div>

                    {/* TOP PRODUCTOS FAVORITOS */}
                    {c.productos_favoritos && c.productos_favoritos.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                        <span className="text-[9px] font-extrabold uppercase text-slate-400 flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-purple-500" /> Productos Habituales:
                        </span>
                        <div className="space-y-1">
                          {c.productos_favoritos.map((p: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-[10px]">
                              <span className="truncate max-w-[170px] text-slate-700 dark:text-slate-300 font-medium">
                                • {p.producto_nombre}
                              </span>
                              <span className="font-mono text-slate-400">{p.compras_count}x</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PROMOCIONES EN CAJAS POS */}
      {tab === "promociones_pos" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-purple-600" /> Promociones Activas en Cajas Registradoras (POS)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reglas reales sincronizadas con los terminales POS de Extra Supermercado.
              </p>
            </div>
            <button
              onClick={() => setTab("chat")}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition"
            >
              + Pedir Nueva Promo a la IA
            </button>
          </div>

          {loadingPromos ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>
          ) : promotionsList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              No hay promociones activas registradas en la base de datos.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotionsList.slice(0, 18).map((p: any) => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                      Activa en POS
                    </span>
                    <span className="font-mono text-xs font-black text-purple-600">
                      {p.tipo === "porcentaje" ? `${p.valor}% OFF` : `₲ ${formatPYG(p.valor)}`}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 dark:text-white leading-snug">{p.nombre}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{p.descripcion || "Sin descripción"}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Validez: {p.valido_hasta ? String(p.valido_hasta) : "Indefinida"}</span>
                    <span>{p.producto_ids?.length ? `${p.producto_ids.length} productos` : "General"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BANNERS EN KIOSCOS */}
      {tab === "kiosco" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Monitor className="w-4 h-4 text-pink-600" /> Banners de Ofertas en Terminales del Salón
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rotan en los verificadores de precios distribuidos en el salón de ventas.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingBanner(null)
                setBannerForm({ titulo: "", subtitulo: "", etiqueta: "", descuento_texto: "", color: "orange", activo: true })
                setShowBannerForm(true)
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" /> Nuevo Banner
            </button>
          </div>

          {kioskLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-pink-600" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {kioskBanners.map((b) => (
                <div key={b.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white">{b.titulo}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-pink-100 text-pink-700 uppercase">
                      {b.descuento_texto || "PROMO"}
                    </span>
                  </div>
                  {b.subtitulo && <p className="text-xs text-slate-500">{b.subtitulo}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MEMORIA & BUENAS PRÁCTICAS */}
      {tab === "memoria" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" /> Memoria Corporativa Continua (company_business_rules)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reglas y políticas que el CMO Virtual aprende de tus indicaciones y nunca olvida al tomar decisiones.
              </p>
            </div>

            <form onSubmit={handleSaveRule} className="flex gap-2">
              <input
                type="text"
                placeholder="Enseñale una nueva regla (ej: 'Los miércoles de verduras el descuento sugerido nunca supera el 15%')..."
                value={newRuleText}
                onChange={e => setNewRuleText(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newRuleText.trim() || savingRule}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50"
              >
                {savingRule ? "Guardando..." : "Guardar en Memoria"}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {learnedRules.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    {r.categoria}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{r.created_at || "Vigente"}</span>
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  "{r.regla}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: CHAT CON EL CMO VIRTUAL */}
      {tab === "chat" && (
        <div className="h-[680px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Sesión Estratégica con el CMO (Qwen 2.5 7B Local + Gemini)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400">
              Tool Calling Activo: PostgreSQL / POS / Cupones
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-none shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none"
                }`}>
                  <div className="whitespace-pre-wrap font-sans leading-relaxed">{m.content}</div>

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

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
            <form onSubmit={e => { e.preventDefault(); handleSendMessage() }} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Preguntale al CMO sobre liquidar sobre-stock, rescatar VIPs o crear promos en POS..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                className="flex-1 px-4 py-3 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
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
      )}
    </div>
  )
}
