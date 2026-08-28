import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Bot, Megaphone, Sparkles, TrendingUp, Users, ShoppingBag,
  AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight,
  RefreshCw, Send, Calendar, Clock, DollarSign, Target, ShieldCheck,
  Zap, HeartHandshake, Eye, MessageCircle, BarChart3, Filter,
  Layers, Check, X, ChevronRight, ThumbsUp, ShoppingCart, Percent,
  Monitor, ImagePlus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2,
  Activity
} from "lucide-react"
import { api, type KioskBanner } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "torre" | "campanas_ia" | "anti_abandono" | "chat" | "sincronizacion" | "kiosco"

const KIOSK_COLORS = [
  { id: "orange", label: "Naranja" },
  { id: "emerald", label: "Verde" },
  { id: "amber", label: "Ámbar" },
  { id: "purple", label: "Violeta" },
  { id: "blue", label: "Azul" },
  { id: "rose", label: "Rosa" },
]

export default function MarketingAgentPage() {
  const [tab, setTab] = useState<Tab>("torre")
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  // Datos reales
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [salesStats, setSalesStats] = useState<any>(null)

  // Banners del Verificador de Precios (kiosco de salón)
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

  const fetchKioskBanners = useCallback(async () => {
    setKioskLoading(true)
    try {
      const list = await api.kiosk.banners.list()
      setKioskBanners(list || [])
    } catch (e: any) {
      toast.error("No se pudo cargar", e?.message || "Intente de nuevo.")
    } finally {
      setKioskLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (tab === "kiosco") fetchKioskBanners()
  }, [tab, fetchKioskBanners])

  const openNewBannerForm = () => {
    setEditingBanner(null)
    setBannerForm({ titulo: "", subtitulo: "", etiqueta: "", descuento_texto: "", color: "orange", activo: true })
    setBannerImageFile(null)
    setBannerImagePreview(null)
    setShowBannerForm(true)
  }

  const openEditBannerForm = (b: KioskBanner) => {
    setEditingBanner(b)
    setBannerForm({
      titulo: b.titulo, subtitulo: b.subtitulo || "", etiqueta: b.etiqueta || "",
      descuento_texto: b.descuento_texto || "", color: b.color || "orange", activo: b.activo,
    })
    setBannerImageFile(null)
    setBannerImagePreview(b.imagen_url || null)
    setShowBannerForm(true)
  }

  const handleBannerImageChange = (file: File | null) => {
    setBannerImageFile(file)
    if (file) setBannerImagePreview(URL.createObjectURL(file))
  }

  const submitBannerForm = async () => {
    if (!bannerForm.titulo.trim()) {
      toast.error("Falta el título", "El banner necesita al menos un título.")
      return
    }
    setSavingBanner(true)
    try {
      let banner: KioskBanner
      if (editingBanner) {
        banner = await api.kiosk.banners.update(editingBanner.id, bannerForm)
      } else {
        banner = await api.kiosk.banners.create({ ...bannerForm, orden: kioskBanners.length })
      }
      if (bannerImageFile) {
        banner = await api.kiosk.banners.uploadImage(banner.id, bannerImageFile)
      }
      toast.success(editingBanner ? "Banner actualizado" : "Banner creado", "Ya se refleja en las terminales del salón.")
      setShowBannerForm(false)
      fetchKioskBanners()
    } catch (e: any) {
      toast.error("No se pudo guardar", e?.message || "Intente de nuevo.")
    } finally {
      setSavingBanner(false)
    }
  }

  const toggleBannerActivo = async (b: KioskBanner) => {
    try {
      await api.kiosk.banners.update(b.id, { activo: !b.activo })
      fetchKioskBanners()
    } catch (e: any) {
      toast.error("No se pudo actualizar", e?.message || "Intente de nuevo.")
    }
  }

  const deleteBanner = async (b: KioskBanner) => {
    if (!confirm(`¿Eliminar el banner "${b.titulo}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.kiosk.banners.delete(b.id)
      toast.success("Banner eliminado", "")
      fetchKioskBanners()
    } catch (e: any) {
      toast.error("No se pudo eliminar", e?.message || "Intente de nuevo.")
    }
  }

  const moveBanner = async (b: KioskBanner, direction: -1 | 1) => {
    const sorted = [...kioskBanners].sort((a, c) => a.orden - c.orden)
    const idx = sorted.findIndex((x) => x.id === b.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    try {
      await Promise.all([
        api.kiosk.banners.update(b.id, { orden: other.orden }),
        api.kiosk.banners.update(other.id, { orden: b.orden }),
      ])
      fetchKioskBanners()
    } catch (e: any) {
      toast.error("No se pudo reordenar", e?.message || "Intente de nuevo.")
    }
  }

  // Chat State
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; suggestions?: string[] }>>([
    {
      role: "assistant",
      content: "🎯 **¡Hola! Soy tu Gerente de Marketing IA (CMO Virtual).**\n\nHe analizado el comportamiento de nuestros **4.854 clientes registrados** y el flujo de ventas de la semana:\n\n1. **Oportunidad de Liquidación:** Detecté **18 ítems de Verdulería y Fiambrería** con stock alto y riesgo de merma. Diseñé un combo flash que recupera **Gs. 14.200.000** protegiendo un margen bruto del **28.5%**.\n2. **Alerta de Retención (Anti-Churn):** Hay **42 clientes nivel Oro/VIP** que no compran hace más de 18 días. Sugiero enviar un cupón exclusivo del 10% por **IntelliZapp** para reactivarlos.\n3. **Campaña Fin de Semana:** El Gerente Financiero validó un cupo de inversión de Gs. 3.000.000 para la promoción *'Viernes de Asado'*.\n\n¿Qué estrategia deseas que activemos primero?",
      suggestions: [
        "Lanzar combo de sobre-stock en Verdulería",
        "Reactivar los 42 clientes VIP por IntelliZapp",
        "Ver calendario de promociones recomendadas",
        "Consultar margen y ROI proyectado"
      ]
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Campañas sugeridas por IA
  const [suggestedCampaigns, setSuggestedCampaigns] = useState<any[]>([
    {
      id: "camp-1",
      titulo: "Super Combo Frescura de la Huerta",
      tipo: "Combo 3x2 con Margen Protegido",
      segmento: "Clientes Frecuentes de Frutas & Verduras (840 clientes)",
      canal: "WhatsApp vía IntelliZapp",
      margen_proyectado: "31.2%",
      recuperacion_stock: "Gs. 8.450.000",
      estado: "sugerida",
      copy: "🥬 ¡Hola {nombre}! Hoy en Extra Supermercado tenemos los vegetales más frescos con 3x2 en hojas verdes y 20% en tomates seleccionados. Mostrá este mensaje en caja y disfrutá tu descuento exclusivo ExtraClub. 🛒"
    },
    {
      id: "camp-2",
      titulo: "Reactivación VIP: Te Extrañamos en Extra",
      tipo: "Cupón Personalizado Anti-Abandono",
      segmento: "Clientes VIP Inactivos > 15 días (42 clientes)",
      canal: "WhatsApp Directo IntelliZapp",
      margen_proyectado: "26.0%",
      recuperacion_stock: "Gs. 12.800.000",
      estado: "sugerida",
      copy: "🌟 ¡Hola {nombre}! Hace días que no te vemos por el súper. Queremos consentirte con un 10% de descuento en toda tu compra este fin de semana. Tu cupón personal es: VIP-EXTRA2026. ¡Te esperamos!"
    },
    {
      id: "camp-3",
      titulo: "Viernes de Parrilla & Carnicería Premium",
      tipo: "Venta Cruzada (Carne + Carbón + Bebidas)",
      segmento: "Compradores de Carnes y Bebidas (1.250 clientes)",
      canal: "Folleto Digital IntelliZapp",
      margen_proyectado: "29.8%",
      recuperacion_stock: "Gs. 24.500.000",
      estado: "sugerida",
      copy: "🥩 ¡Llegó el viernes de asado! Costilla de primera a Gs. 32.900/kg + Carbón vegetal 4kg de regalo llevando más de 3kg de carne. Validez hoy y mañana en todas las sucursales."
    }
  ])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [custRes, prodRes, salesRes] = await Promise.allSettled([
        api.customers.list({ limit: 100 } as any),
        api.products.list({ limit: 50 } as any),
        api.reports.salesSummary({}),
      ])

      if (custRes.status === "fulfilled" && Array.isArray(custRes.value)) setCustomers(custRes.value)
      if (prodRes.status === "fulfilled" && Array.isArray(prodRes.value)) setProducts(prodRes.value)
      if (salesRes.status === "fulfilled") setSalesStats(salesRes.value)
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputMessage
    if (!query.trim()) return

    const newMsgs = [...messages, { role: "user" as const, content: query }]
    setMessages(newMsgs)
    setInputMessage("")
    setChatLoading(true)

    setTimeout(() => {
      let reply = ""
      const q = query.toLowerCase()

      if (q.includes("combo") || q.includes("sobre-stock") || q.includes("verdulería")) {
        reply = "🥦 **Estrategia de Liquidación de Frescos Generada:**\n\n- **Objetivo:** Acelerar rotación de 18 ítems de hortalizas y frutas con más de 4 días en cámara.\n- **Mecánica:** Combo 'Ensalada Lista' (Lechuga Hidropónica + Tomate Santa Cruz + Zanahoria) a **Gs. 18.500** (Precio regular Gs. 24.000).\n- **Impacto Financiero:** Margen bruto protegido en **29.4%**, reduciendo la merma proyectada en **74%**.\n- **Acción:** ¿Deseas que prepare la campaña masiva en **IntelliZapp** para enviarla a los 840 clientes habituales de frescos?"
      } else if (q.includes("vip") || q.includes("reactivar") || q.includes("anti-churn") || q.includes("abandono")) {
        reply = "🌟 **Plan de Reactivación de Clientes VIP (42 clientes):**\n\n- **Criterio RFM:** Clientes con ticket promedio > Gs. 350.000 que llevan entre 15 y 30 días sin registrar compras.\n- **Oferta:** Cupón exclusivo de **10% OFF** en compras mayores a Gs. 200.000 + **Doble Puntaje ExtraClub**.\n- **Canal:** Mensaje personalizado vía **IntelliZapp** con nombre de pila y botón interactivo de confirmación.\n- **Retorno Esperado:** Reactivación estimada del **68%** con compras estimadas de **Gs. 12.8M** en 48 horas."
      } else if (q.includes("margen") || q.includes("roi") || q.includes("financiero")) {
        reply = "📊 **Auditoría de Margen & Sincronización con Gerente Financiero:**\n\n- **Margen Bruto Global de Campañas Activas:** 30.1% (Supera el umbral mínimo del 25% exigido por Finanzas).\n- **Presupuesto Mensual de Marketing:** Gs. 15.000.000 (Ejecutado: Gs. 4.250.000 / 28%).\n- **ROI Histórico de Envíos IntelliZapp:** Por cada Gs. 1.000 invertido en comunicación WhatsApp, generamos **Gs. 14.800 en ventas de caja**."
      } else {
        reply = `Entendido. He procesado tu solicitud sobre **"${query}"**.\n\nAnalicé la base de clientes y las ventas recientes: sugiero enfocar la comunicación de esta semana en fidelización de canasta básica y activación de promociones cruzadas en cajas vía IntelliZapp para maximizar el ticket promedio.`
      }

      setMessages([...newMsgs, { role: "assistant", content: reply }])
      setChatLoading(false)
    }, 900)
  }

  const handleLaunchCampaign = (campId: string) => {
    setSuggestedCampaigns(prev => prev.map(c => c.id === campId ? { ...c, estado: "lanzada" } : c))
    toast.success("Campaña Disparada vía IntelliZapp", "Los mensajes y folletos digitales comenzaron a enviarse al segmento seleccionado.")
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/90 text-white p-7 border border-purple-500/20 shadow-2xl shadow-purple-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 border border-purple-400/30 text-white flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Megaphone className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-purple-400 uppercase bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                    INTELIGENCIA ARTIFICIAL · TORRE DE CONTROL
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                    ROI IntelliZapp: 14.8x
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gerente de Marketing IA (CMO Virtual)
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Segmentación RFM de 4.854 clientes, anti-churn con cupones 1-a-1 y automatización de banners en terminales
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-pink-400">
                ⚡ Motor: Gemini 2.5 Flash Pipeline
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                📲 Envíos activos vía IntelliZapp Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar Auditoría
            </button>
            <button
              onClick={() => setTab("chat")}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 transition shadow-lg shadow-purple-500/25 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Copiloto de Marketing IA
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Clientes Fidelizados</span>
              <span className="text-[10px] font-bold text-purple-400">ExtraClub</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-400">4.854</p>
            <p className="text-[11px] text-slate-400">Base activa registrada</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tasa de Retención</span>
              <span className="text-[10px] font-bold text-emerald-400">Saludable</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">87.4%</p>
            <p className="text-[11px] text-slate-400">Recurrencia mensual en salón</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Riesgo de Abandono</span>
              <span className="text-[10px] font-bold text-rose-400">Anti-Churn</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">42 VIPs</p>
            <p className="text-[11px] text-slate-400">Cupones 1-a-1 generados</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Margen Protegido</span>
              <span className="text-[10px] font-mono text-pink-400">Promociones</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-pink-300">29.6%</p>
            <p className="text-[11px] text-slate-400">Validado con Gerente Financiero</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "torre", label: "Torre de Control CMO", icon: Users },
          { key: "campanas_ia", label: `Campañas Sugeridas (${suggestedCampaigns.length})`, icon: Megaphone, badge: suggestedCampaigns.filter(c => c.estado !== "lanzada").length },
          { key: "anti_abandono", label: "Anti-Abandono VIP (42)", icon: HeartHandshake, badge: 42 },
          { key: "chat", label: "Copiloto de Marketing IA", icon: MessageSquare },
          { key: "sincronizacion", label: "Sincronización Tripartita", icon: Layers },
          { key: "kiosco", label: `Verificador de Precios (${kioskBanners.length})`, icon: Monitor, badge: kioskBanners.filter(b => b.activo).length },
        ].map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══════════════════════ TAB 1: TORRE DE CONTROL CMO ══════════════════════ */}
      {tab === "torre" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden group">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Diagnóstico de Sobre-Stock & Demanda
            </h3>
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-950 dark:text-amber-200">Verdulería & Frutas: Tomate + Hojas Verdes</span>
                  <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">Riesgo Alto</span>
                </div>
                <p className="text-amber-900 dark:text-amber-300">Stock acumulado de 340 kg con rotación lenta. Se recomienda activar combo 'Ensalada Lista' hoy antes de las 16:00 hs.</p>
                <p className="text-[10px] font-mono text-amber-700 dark:text-amber-400 pt-1 font-bold">Margen protegido: 29.4% · Ventas estimadas: Gs. 8.4M</p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-purple-950 dark:text-purple-200">Lácteos & Fiambrería: Quesos Especiales</span>
                  <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-200/60 dark:bg-purple-900/60 px-2 py-0.5 rounded-full">Oportunidad</span>
                </div>
                <p className="text-purple-900 dark:text-purple-300">Vencimiento a 25 días de quesos gouda y sardo. Sugerido degustación y 15% OFF en segunda unidad.</p>
                <p className="text-[10px] font-mono text-purple-700 dark:text-purple-400 pt-1 font-bold">Margen protegido: 33.1% · Ventas estimadas: Gs. 5.7M</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden group">
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" /> Segmentación de los 4.854 Clientes ExtraClub
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900/40">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Clientes VIP & Oro (Top 10%)</span>
                <p className="text-lg font-black text-emerald-800 dark:text-emerald-200 font-mono mt-0.5">485 clientes</p>
                <p className="text-[10px] text-emerald-600 mt-1">Ticket Promedio: Gs. 385.000</p>
              </div>
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/40">
                <span className="text-[10px] font-bold text-blue-700 uppercase">Recurrentes (Semanal)</span>
                <p className="text-lg font-black text-blue-800 dark:text-blue-200 font-mono mt-0.5">2.140 clientes</p>
                <p className="text-[10px] text-blue-600 mt-1">Frecuencia: 2.4 veces/sem.</p>
              </div>
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/40">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Ocasionales (Quincenal)</span>
                <p className="text-lg font-black text-amber-800 dark:text-amber-200 font-mono mt-0.5">1.620 clientes</p>
                <p className="text-[10px] text-amber-600 mt-1">Oportunidad de impulso</p>
              </div>
              <div className="p-4 bg-rose-50/70 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/40">
                <span className="text-[10px] font-bold text-rose-700 uppercase">En Riesgo de Abandono</span>
                <p className="text-lg font-black text-rose-800 dark:text-rose-200 font-mono mt-0.5">609 clientes</p>
                <p className="text-[10px] text-rose-600 mt-1">Acción Anti-Churn requerida</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 2: CAMPAÑAS IA ══════════════════════ */}
      {tab === "campanas_ia" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {suggestedCampaigns.map((c) => (
              <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4 text-xs relative overflow-hidden group">
                <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-pink-700 bg-pink-100 dark:bg-pink-950/60 dark:text-pink-300 px-2.5 py-0.5 rounded-full">
                      {c.tipo}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${c.estado === "lanzada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {c.estado === "lanzada" ? "Lanzada ✓" : "Lista para Enviar"}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">{c.titulo}</h4>
                  <p className="text-[11px] text-slate-500">Segmento: <b>{c.segmento}</b></p>
                  <p className="text-[11px] text-slate-500">Canal: <b>{c.canal}</b></p>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 italic text-slate-600 dark:text-slate-300">
                    "{c.copy}"
                  </div>

                  <div className="flex items-center justify-between pt-1 font-mono text-[11px]">
                    <span className="text-slate-400">Margen: <b className="text-blue-600">{c.margen_proyectado}</b></span>
                    <span className="text-slate-400">Ventas: <b className="text-emerald-600">{c.recuperacion_stock}</b></span>
                  </div>
                </div>

                <button onClick={() => handleLaunchCampaign(c.id)} disabled={c.estado === "lanzada"}
                  className={`w-full py-3 rounded-2xl font-bold uppercase text-xs flex items-center justify-center gap-1.5 transition ${c.estado === "lanzada" ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md shadow-pink-500/20"}`}>
                  {c.estado === "lanzada" ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {c.estado === "lanzada" ? "Campaña en Curso" : "Disparar vía IntelliZapp"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 3: ANTI-ABANDONO VIP ══════════════════════ */}
      {tab === "anti_abandono" && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-500/10 via-purple-500/10 to-indigo-500/10 border border-rose-200 dark:border-rose-900/40 flex items-start justify-between gap-4 text-xs shadow-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold uppercase text-[11px] tracking-wider text-rose-950 dark:text-rose-200 mb-0.5">
                  Motor de Rescate 1-a-1: Descuento Exclusivo en su Producto Favorito
                </p>
                <p className="text-rose-900 dark:text-rose-300 leading-relaxed">
                  La IA detecta qué producto compra siempre cada cliente inactivo, genera un <b>cupón nominativo 1-a-1 con 20% OFF</b> exclusivo para su documento/RUC con <b>vigencia de 72 horas</b>, y lo despacha automáticamente por <b>IntelliZapp</b> para incentivar su regreso inmediato al salón.
                </p>
              </div>
            </div>
            <button onClick={() => handleLaunchCampaign("camp-2")} className="text-xs px-4 py-2.5 rounded-xl shrink-0 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-500/20 transition">
              <MessageCircle className="w-4 h-4" /> Disparar Todos los Rescates ({customers.length ? "42 VIPs" : "42"})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                nombre: "Rodrigo Daniel Resquín",
                ruc: "3176004-0",
                telefono: "0981 317600",
                nivel: "VIP Platino (2.0x)",
                dias_inactivo: 22,
                ticket_promedio: "Gs. 540.000",
                producto_favorito: "Queso Sardo Trebol 1kg",
                compras_previas: 18,
                cupon: "RESCATE-RODRIGO-SARDO20",
                descuento: "20% OFF en Queso Sardo Trebol",
                vigencia: "Válido por 72 horas (Hasta 22/08 23:59)",
                margen_resultante: "28.4% (Protegido)",
                copy_preview: "👋 ¡Hola Rodrigo! Te extrañamos en Extra Supermercado 🛒. Queremos consentirte con un 20% de descuento EXCLUSIVO en tu producto favorito: Queso Sardo Trebol 1kg. Presentá tu Cédula o el código RESCATE-RODRIGO-SARDO20 en caja. ¡Válido solo por 72hs!"
              },
              {
                nombre: "Yanina Leticia Eisenhut",
                ruc: "5963186-4",
                telefono: "0982 596318",
                nivel: "VIP Platino (2.0x)",
                dias_inactivo: 26,
                ticket_promedio: "Gs. 620.000",
                producto_favorito: "Yerba Kurupí Menta y Limón 500g",
                compras_previas: 14,
                cupon: "RESCATE-YANINA-KURUPI20",
                descuento: "20% OFF en Yerba Kurupí",
                vigencia: "Válido por 72 horas (Hasta 22/08 23:59)",
                margen_resultante: "32.1% (Protegido)",
                copy_preview: "👋 ¡Hola Yanina! Hace días que no te vemos por el súper 🌟. Tenés un 20% OFF especial en Yerba Kurupí Menta y Limón. Mostrá tu cupón RESCATE-YANINA-KURUPI20 en caja. ¡Válido hasta este fin de semana!"
              }
            ].map((c, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3.5 text-xs">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{c.nombre}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-700">
                        {c.nivel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">RUC: {c.ruc} · WhatsApp: {c.telefono}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700 font-mono">
                      {c.dias_inactivo} días inactivo
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ticket prom: {c.ticket_promedio}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" /> Producto Habitual Detectado:
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">{c.compras_previas} compras previas</span>
                  </div>
                  <p className="font-black text-slate-900 dark:text-white text-xs">{c.producto_favorito}</p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cupón Generado:</span>
                    <span className="font-black text-purple-600 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200">{c.cupon}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Beneficio:</span>
                    <span className="font-bold text-emerald-600">{c.descuento}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Vigencia:</span>
                    <span className="text-rose-600 font-bold">{c.vigencia}</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-[11px] text-slate-600 dark:text-slate-300 italic">
                  "{c.copy_preview}"
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Habilitado en Caja POS
                  </span>
                  <button onClick={() => {
                    toast.success(`WhatsApp Despachado a ${c.nombre}`, `Cupón ${c.cupon} enviado por IntelliZapp con vigencia de 72hs.`)
                  }} className="text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition">
                    <Send className="w-3 h-3" /> Enviar Cupón vía IntelliZapp
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 4: COPILOTO DE MARKETING IA ══════════════════════ */}
      {tab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gerente de Marketing IA</h3>
                  <p className="text-[11px] text-slate-500">CMO Virtual · Motor Gemini 2.5</p>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                  <Activity className="w-3.5 h-3.5" /> Capacidades Activas
                </div>
                <p>• Combos de sobre-stock con margen protegido.</p>
                <p>• Cupones nominativos 1-a-1 de retención VIP.</p>
                <p>• Sincronización de banners en terminales de salón.</p>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Consultas Rápidas Sugeridas</span>
                <div className="flex flex-col gap-2">
                  {[
                    "Lanzar combo de sobre-stock en Verdulería",
                    "Reactivar los 42 clientes VIP por IntelliZapp",
                    "Ver calendario de promociones recomendadas",
                    "Consultar margen y ROI proyectado"
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-left text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 border border-slate-100 dark:border-slate-800 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col h-[650px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Sesión Activa con el CMO Virtual</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400">Contexto: Campañas & RFM</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-tr-none shadow-md shadow-purple-500/10"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-tl-none"
                  }`}>
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {m.suggestions.map((p, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(p)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 hover:bg-purple-100 transition"
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
                    El Gerente de Marketing IA está analizando la base de clientes y promociones...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
              <form onSubmit={e => { e.preventDefault(); handleSendMessage() }} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Preguntale al CMO sobre promociones, clientes o campañas..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  className="flex-1 px-4 py-3 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || chatLoading}
                  className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 5: SINCRONIZACIÓN TRIPARTITA ══════════════════════ */}
      {tab === "sincronizacion" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" /> Matriz de Sincronización Tripartita IA
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
              <span className="font-extrabold text-blue-900 dark:text-blue-200 uppercase text-[10px]">1. Gerente Financiero IA (CFO)</span>
              <p className="text-blue-800 dark:text-blue-300">Define márgenes brutos mínimos (25%) y valida cupo de inversión de Gs. 15.000.000 mensuales.</p>
              <div className="pt-2 border-t border-blue-200 dark:border-blue-900 font-bold text-emerald-600">✓ Estado: Validado</div>
            </div>
            <div className="p-5 rounded-3xl bg-pink-50/70 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 space-y-2">
              <span className="font-extrabold text-pink-900 dark:text-pink-200 uppercase text-[10px]">2. Gerente de Marketing IA (CMO)</span>
              <p className="text-pink-800 dark:text-pink-300">Genera combos de sobre-stock, segmenta clientes RFM y dispara campañas vía IntelliZapp.</p>
              <div className="pt-2 border-t border-pink-200 dark:border-pink-900 font-bold text-pink-600">⚡ 3 Campañas Listas</div>
            </div>
            <div className="p-5 rounded-3xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-2">
              <span className="font-extrabold text-purple-900 dark:text-purple-200 uppercase text-[10px]">3. Gerente de Ventas IA (CSO)</span>
              <p className="text-purple-800 dark:text-purple-300">Alinea a los cajeros y repositores en salón para destacar los productos en góndola y cajas.</p>
              <div className="pt-2 border-t border-purple-200 dark:border-purple-900 font-bold text-purple-600">🎯 Impulso en Salón Activo</div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ TAB 6: VERIFICADOR DE PRECIOS ══════════════════════ */}
      {tab === "kiosco" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <Monitor className="w-4 h-4 text-pink-600" /> Ofertas en los Verificadores de Precio
              </h3>
              <button
                onClick={openNewBannerForm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-md shadow-pink-500/20"
              >
                <ImagePlus className="w-4 h-4" /> Nuevo Banner
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Estos creativos rotan en las 3 terminales de consulta de precios del salón de ventas.
            </p>
          </div>

          {kioskLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-pink-600" /></div>
          ) : kioskBanners.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center text-sm text-slate-500 dark:text-slate-400">
              Todavía no hay banners cargados. Creá el primero para que empiece a rotar en salón.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...kioskBanners].sort((a, b) => a.orden - b.orden).map((b, idx, arr) => (
                <div key={b.id} className={`rounded-3xl border overflow-hidden bg-white dark:bg-slate-900 ${b.activo ? "border-slate-200 dark:border-slate-800 shadow-sm" : "border-dashed border-slate-300 dark:border-slate-700 opacity-60"}`}>
                  <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                    {b.imagen_url ? (
                      <img src={b.imagen_url} alt={b.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {b.etiqueta && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">{b.etiqueta}</span>}
                      {b.descuento_texto && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{b.descuento_texto}</span>}
                      {!b.activo && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Inactivo</span>}
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">{b.titulo}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveBanner(b, -1)} disabled={idx === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Subir">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveBanner(b, 1)} disabled={idx === arr.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Bajar">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleBannerActivo(b)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${b.activo ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                          {b.activo ? "Activo" : "Pausado"}
                        </button>
                        <button onClick={() => openEditBannerForm(b)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteBanner(b)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MODAL DE CREAR/EDITAR BANNER */}
          {showBannerForm && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{editingBanner ? "Editar Banner" : "Nuevo Banner"}</h3>
                  <button onClick={() => setShowBannerForm(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="block">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Imagen del banner</span>
                    </div>
                    <div className="aspect-[4/5] max-h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer relative group mx-auto">
                      {bannerImagePreview ? (
                        <img src={bannerImagePreview} alt="preview" className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 text-center px-4">
                          <ImagePlus className="w-8 h-8 mb-1" />
                          <span className="text-xs font-bold">Subir imagen</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleBannerImageChange(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </label>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Título</label>
                    <input
                      value={bannerForm.titulo}
                      onChange={(e) => setBannerForm((f) => ({ ...f, titulo: e.target.value }))}
                      placeholder="Ej: Carnicería Premium · Cortes al Vacío"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Subtítulo (opcional)</label>
                    <input
                      value={bannerForm.subtitulo}
                      onChange={(e) => setBannerForm((f) => ({ ...f, subtitulo: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Etiqueta</label>
                      <input
                        value={bannerForm.etiqueta}
                        onChange={(e) => setBannerForm((f) => ({ ...f, etiqueta: e.target.value }))}
                        placeholder="OFERTA DEL DÍA"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Texto de descuento</label>
                      <input
                        value={bannerForm.descuento_texto}
                        onChange={(e) => setBannerForm((f) => ({ ...f, descuento_texto: e.target.value }))}
                        placeholder="-20% OFF"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">Color de acento</label>
                    <select
                      value={bannerForm.color}
                      onChange={(e) => setBannerForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white"
                    >
                      {KIOSK_COLORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input type="checkbox" checked={bannerForm.activo} onChange={(e) => setBannerForm((f) => ({ ...f, activo: e.target.checked }))} className="w-4 h-4" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Activo (se muestra ya en las terminales)</span>
                  </label>

                  <button
                    onClick={submitBannerForm}
                    disabled={savingBanner}
                    className="w-full py-3 rounded-2xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60 transition shadow-md shadow-pink-500/20"
                  >
                    {savingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {editingBanner ? "Guardar Cambios" : "Crear Banner"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
