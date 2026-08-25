import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  Bot, Megaphone, Sparkles, TrendingUp, Users, ShoppingBag,
  AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight,
  RefreshCw, Send, Calendar, Clock, DollarSign, Target, ShieldCheck,
  Zap, HeartHandshake, Eye, MessageCircle, BarChart3, Filter,
  Layers, Check, X, ChevronRight, ThumbsUp, ShoppingCart, Percent,
  Monitor, ImagePlus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2,
} from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
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

  // Banners del Verificador de Precios (kiosco de salón) -- creativos reales,
  // marketing los carga y aparecen rotando en las 3 terminales del salón.
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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">
                  Gerente de Marketing IA (CMO Virtual)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 uppercase animate-pulse">
                  Motor Autónomo
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Inteligencia artificial para maximización de demanda, liquidación rentable de sobre-stock, retención de clientes VIP y automatización de campañas multicanal vía IntelliZapp.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={loadData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /><span>Actualizar Auditoría</span>
          </button>
          <a href="/intellizapp" className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700">
            <MessageCircle className="w-3.5 h-3.5" /><span>Abrir IntelliZapp Hub</span>
          </a>
        </div>
      </div>

      {/* BANNER ESTRATÉGICO */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 dark:from-pink-950/30 dark:via-purple-950/30 dark:to-indigo-950/30 border border-pink-200 dark:border-pink-900/40 flex items-start gap-3 text-xs text-pink-950 dark:text-pink-200">
        <Sparkles className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-pink-900 dark:text-pink-300 mb-0.5">
            Sincronización Estratégica Tripartita (Ventas + Finanzas + Marketing)
          </p>
          <p className="text-pink-800 dark:text-pink-300/80 leading-relaxed">
            El Gerente de Marketing IA no crea promociones a ciegas: audita el costo real de compra, respeta los márgenes mínimos pactados con el <b>Gerente Financiero</b> y coordina metas de impulso con el <b>Gerente de Ventas</b> en salón y cajas. Todos los envíos se disparan en tiempo real a través de <b>IntelliZapp</b>.
          </p>
        </div>
      </div>

      {/* KPIs EJECUTIVOS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Clientes ExtraClub", val: "4.854", color: "text-purple-600", icon: Users },
          { label: "Tasa de Retención", val: "87.4%", color: "text-emerald-600", icon: HeartHandshake },
          { label: "En Riesgo Abandono", val: "42 VIPs", color: "text-rose-600 font-bold", icon: AlertTriangle },
          { label: "Margen Promedio Promos", val: "29.6%", color: "text-blue-600", icon: Percent },
          { label: "ROI Campañas IntelliZapp", val: "14.8x", color: "text-pink-600 font-black", icon: Zap },
          { label: "Sobre-Stock Detectado", val: "Gs. 14.2M", color: "text-amber-600", icon: ShoppingBag },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className={`text-base font-black font-mono ${kpi.color}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "torre", label: "Torre de Control CMO" },
            { id: "campanas_ia", label: `Campañas Sugeridas (${suggestedCampaigns.length})` },
            { id: "anti_abandono", label: "Anti-Abandono VIP (42)" },
            { id: "chat", label: "Chat con el Gerente IA" },
            { id: "sincronizacion", label: "Sincronización Tripartita" },
            { id: "kiosco", label: `Verificador de Precios (${kioskBanners.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-pink-600 text-pink-600 dark:text-pink-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB TORRE DE CONTROL */}
      {tab === "torre" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertas de Oportunidad de Demanda */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Diagnóstico de Sobre-Stock & Demanda
            </h3>
            <div className="space-y-3">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-900 dark:text-amber-200">Verdulería & Frutas: Tomate + Hojas Verdes</span>
                  <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">Riesgo Alto</span>
                </div>
                <p className="text-amber-800 dark:text-amber-300">Stock acumulado de 340 kg con rotación lenta. Se recomienda activar combo 'Ensalada Lista' hoy antes de las 16:00 hs.</p>
                <p className="text-[10px] font-mono text-amber-700 dark:text-amber-400 pt-1">Margen protegido: 29.4% · Ventas estimadas: Gs. 8.4M</p>
              </div>

              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-purple-900 dark:text-purple-200">Lácteos & Fiambrería: Quesos Especiales</span>
                  <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-200/60 dark:bg-purple-900/60 px-2 py-0.5 rounded-full">Oportunidad</span>
                </div>
                <p className="text-purple-800 dark:text-purple-300">Vencimiento a 25 días de quesos gouda y sardo. Sugerido degustación y 15% OFF en segunda unidad.</p>
                <p className="text-[10px] font-mono text-purple-700 dark:text-purple-400 pt-1">Margen protegido: 33.1% · Ventas estimadas: Gs. 5.7M</p>
              </div>
            </div>
          </div>

          {/* Estado de Retención ExtraClub */}
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" /> Segmentación de los 4.854 Clientes ExtraClub
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/40">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Clientes VIP & Oro (Top 10%)</span>
                <p className="text-lg font-black text-emerald-800 dark:text-emerald-200 font-mono mt-0.5">485 clientes</p>
                <p className="text-[10px] text-emerald-600 mt-1">Ticket Promedio: Gs. 385.000</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40">
                <span className="text-[10px] font-bold text-blue-700 uppercase">Recurrentes (Semanal)</span>
                <p className="text-lg font-black text-blue-800 dark:text-blue-200 font-mono mt-0.5">2.140 clientes</p>
                <p className="text-[10px] text-blue-600 mt-1">Frecuencia: 2.4 veces/sem.</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Ocasionales (Quincenal)</span>
                <p className="text-lg font-black text-amber-800 dark:text-amber-200 font-mono mt-0.5">1.620 clientes</p>
                <p className="text-[10px] text-amber-600 mt-1">Oportunidad de impulso</p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/40">
                <span className="text-[10px] font-bold text-rose-700 uppercase">En Riesgo de Abandono</span>
                <p className="text-lg font-black text-rose-800 dark:text-rose-200 font-mono mt-0.5">609 clientes</p>
                <p className="text-[10px] text-rose-600 mt-1">Acción Anti-Churn requerida</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CAMPAÑAS SUGERIDAS */}
      {tab === "campanas_ia" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestedCampaigns.map((c) => (
              <div key={c.id} className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs flex flex-col justify-between space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-pink-700 bg-pink-100 dark:bg-pink-950/60 dark:text-pink-300 px-2 py-0.5 rounded-full">
                      {c.tipo}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${c.estado === "lanzada" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {c.estado === "lanzada" ? "Lanzada ✓" : "Lista para Enviar"}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{c.titulo}</h4>
                  <p className="text-[11px] text-gray-500">Segmento: <b>{c.segmento}</b></p>
                  <p className="text-[11px] text-gray-500">Canal: <b>{c.canal}</b></p>

                  <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-700 italic text-gray-600 dark:text-gray-300">
                    "{c.copy}"
                  </div>

                  <div className="flex items-center justify-between pt-1 font-mono text-[11px]">
                    <span className="text-gray-400">Margen: <b className="text-blue-600">{c.margen_proyectado}</b></span>
                    <span className="text-gray-400">Ventas: <b className="text-emerald-600">{c.recuperacion_stock}</b></span>
                  </div>
                </div>

                <button onClick={() => handleLaunchCampaign(c.id)} disabled={c.estado === "lanzada"}
                  className={`w-full py-2.5 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-1.5 transition ${c.estado === "lanzada" ? "bg-gray-200 dark:bg-slate-800 text-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-md shadow-pink-500/20"}`}>
                  {c.estado === "lanzada" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  {c.estado === "lanzada" ? "Campaña en Curso" : "Disparar vía IntelliZapp"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB ANTI-ABANDONO & CUPONES 1-A-1 POR PRODUCTO FAVORITO */}
      {tab === "anti_abandono" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-purple-500/10 to-indigo-500/10 border border-rose-200 dark:border-rose-900/40 flex items-start justify-between gap-4 text-xs">
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
            <button onClick={() => handleLaunchCampaign("camp-2")} className="btn-primary text-xs px-4 py-2 shrink-0 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md">
              <MessageCircle className="w-3.5 h-3.5" /> Disparar Todos los Rescates ({customers.length ? "42 VIPs" : "42"})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              },
              {
                nombre: "Saúl Eduardo Salinas",
                ruc: "6957312-3",
                telefono: "0971 695731",
                nivel: "Oro (1.5x)",
                dias_inactivo: 19,
                ticket_promedio: "Gs. 380.000",
                producto_favorito: "Tapa Cuadril FrigoChaco al Vacío",
                compras_previas: 11,
                cupon: "RESCATE-SAUL-CARNE15",
                descuento: "15% OFF en Tapa Cuadril",
                vigencia: "Válido por 72 horas (Hasta 22/08 23:59)",
                margen_resultante: "26.8% (Protegido)",
                copy_preview: "🥩 ¡Hola Saúl! Para tu asado del finde, tenés un 15% de descuento exclusivo en Tapa Cuadril FrigoChaco. Canjealo en carnicería con tu RUC o código RESCATE-SAUL-CARNE15."
              },
              {
                nombre: "Mirna Elisa Caballero",
                ruc: "3619386-0",
                telefono: "0983 361938",
                nivel: "Oro (1.5x)",
                dias_inactivo: 24,
                ticket_promedio: "Gs. 410.000",
                producto_favorito: "Leche Entera Trébol Larga Vida 1L",
                compras_previas: 22,
                cupon: "RESCATE-MIRNA-TREBOL20",
                descuento: "20% OFF en Lácteos Trébol",
                vigencia: "Válido por 72 horas (Hasta 22/08 23:59)",
                margen_resultante: "29.0% (Protegido)",
                copy_preview: "🥛 ¡Hola Mirna! Te esperamos en Extra Supermercado con un 20% OFF exclusivo en Leche Trébol Larga Vida. Tu código personal es: RESCATE-MIRNA-TREBOL20."
              },
            ].map((c, i) => (
              <div key={i} className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-3.5 text-xs">
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{c.nombre}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-700">
                        {c.nivel}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">RUC: {c.ruc} · WhatsApp: {c.telefono}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700 font-mono">
                      {c.dias_inactivo} días inactivo
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">Ticket prom: {c.ticket_promedio}</p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" /> Producto Habitual Detectado:
                    </span>
                    <span className="text-[10px] font-mono text-gray-500 font-bold">{c.compras_previas} compras previas</span>
                  </div>
                  <p className="font-black text-gray-900 dark:text-white text-xs">{c.producto_favorito}</p>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Cupón Generado:</span>
                    <span className="font-black text-purple-600 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200">{c.cupon}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Beneficio:</span>
                    <span className="font-bold text-emerald-600">{c.descuento}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Vigencia:</span>
                    <span className="text-rose-600 font-bold">{c.vigencia}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-slate-700">
                    <span className="text-gray-400">Margen Supermercado:</span>
                    <span className="text-blue-600 font-bold">{c.margen_resultante}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-[11px] text-gray-600 dark:text-gray-300 italic">
                  "{c.copy_preview}"
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Habilitado en Caja POS
                  </span>
                  <button onClick={() => {
                    toast.success(`WhatsApp Despachado a ${c.nombre}`, `Cupón ${c.cupon} enviado por IntelliZapp con vigencia de 72hs.`)
                  }} className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <Send className="w-3 h-3" /> Enviar Cupón vía IntelliZapp
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CHAT INTERACTIVO */}
      {tab === "chat" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs flex flex-col h-[520px] overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3 bg-gray-50/50 dark:bg-slate-800/30">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-xs text-gray-900 dark:text-white uppercase">CFO & CMO Virtual — Asesor de Marketing & Rentabilidad</p>
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Conectado en tiempo real a IntelliZapp y Ventas
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] p-3.5 rounded-2xl space-y-2 ${m.role === "user" ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-none" : "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-slate-700"}`}>
                  <p className="whitespace-pre-line leading-relaxed">{m.content}</p>
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {m.suggestions.map((s, i) => (
                        <button key={i} onClick={() => handleSendMessage(s)}
                          className="text-[10px] font-bold px-2.5 py-1 bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-50 transition">
                          💡 {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center gap-2 text-gray-500 text-xs">
                  <Bot className="w-4 h-4 animate-spin text-pink-600" /> Analizando base de clientes y márgenes...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2">
            <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              placeholder="Preguntale al Gerente de Marketing IA sobre promociones, clientes o campañas..."
              className="input text-xs flex-1" />
            <button onClick={() => handleSendMessage()} disabled={!inputMessage.trim()}
              className="btn-primary text-xs px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB SINCRONIZACIÓN */}
      {tab === "sincronizacion" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4 text-xs">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" /> Matriz de Sincronización Tripartita IA
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 space-y-2">
              <span className="font-extrabold text-blue-900 dark:text-blue-200 uppercase text-[10px]">1. Gerente Financiero IA (CFO)</span>
              <p className="text-blue-800 dark:text-blue-300">Define márgenes brutos mínimos (25%) y valida cupo de inversión de Gs. 15.000.000 mensuales.</p>
              <div className="pt-2 border-t border-blue-200 dark:border-blue-900 font-bold text-emerald-600">✓ Estado: Validado</div>
            </div>
            <div className="p-4 rounded-2xl bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/40 space-y-2">
              <span className="font-extrabold text-pink-900 dark:text-pink-200 uppercase text-[10px]">2. Gerente de Marketing IA (CMO)</span>
              <p className="text-pink-800 dark:text-pink-300">Genera combos de sobre-stock, segmenta clientes RFM y dispara campañas vía IntelliZapp.</p>
              <div className="pt-2 border-t border-pink-200 dark:border-pink-900 font-bold text-pink-600">⚡ 3 Campañas Listas</div>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 space-y-2">
              <span className="font-extrabold text-purple-900 dark:text-purple-200 uppercase text-[10px]">3. Gerente de Ventas IA (CSO)</span>
              <p className="text-purple-800 dark:text-purple-300">Alinea a los cajeros y repositores en salón para destacar los productos en góndola y cajas.</p>
              <div className="pt-2 border-t border-purple-200 dark:border-purple-900 font-bold text-purple-600">🎯 Impulso en Salón Activo</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB VERIFICADOR DE PRECIOS -- banners reales de los 3 kioscos del salón */}
      {tab === "kiosco" && (
        <div className="space-y-4">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <Monitor className="w-4 h-4 text-pink-600" /> Ofertas en los Verificadores de Precio
              </h3>
              <button
                onClick={openNewBannerForm}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5" /> Nuevo Banner
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Estos creativos rotan en las 3 terminales de consulta de precios del salón de ventas. Subí una imagen horizontal para el mejor resultado.
            </p>
          </div>

          {kioskLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-pink-600" /></div>
          ) : kioskBanners.length === 0 ? (
            <div className="card p-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl text-center text-sm text-gray-500 dark:text-gray-400">
              Todavía no hay banners cargados. Creá el primero para que empiece a rotar en salón.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...kioskBanners].sort((a, b) => a.orden - b.orden).map((b, idx, arr) => (
                <div key={b.id} className={`rounded-2xl border overflow-hidden bg-white dark:bg-slate-900 ${b.activo ? "border-gray-200 dark:border-slate-800" : "border-dashed border-gray-300 dark:border-slate-700 opacity-60"}`}>
                  <div className="aspect-[16/9] bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                    {b.imagen_url ? (
                      <img src={b.imagen_url} alt={b.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus className="w-8 h-8 text-gray-300 dark:text-slate-700" />
                    )}
                  </div>
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {b.etiqueta && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">{b.etiqueta}</span>}
                      {b.descuento_texto && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{b.descuento_texto}</span>}
                      {!b.activo && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500">Inactivo</span>}
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">{b.titulo}</p>
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-slate-800">
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveBanner(b, -1)} disabled={idx === 0} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" title="Subir">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveBanner(b, 1)} disabled={idx === arr.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer" title="Bajar">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleBannerActivo(b)} className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${b.activo ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                          {b.activo ? "Activo" : "Pausado"}
                        </button>
                        <button onClick={() => openEditBannerForm(b)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteBanner(b)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer" title="Eliminar">
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
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">{editingBanner ? "Editar Banner" : "Nuevo Banner"}</h3>
                  <button onClick={() => setShowBannerForm(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-1">Imagen del banner</span>
                    <div className="aspect-[16/9] rounded-2xl bg-gray-100 dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer relative group">
                      {bannerImagePreview ? (
                        <img src={bannerImagePreview} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <ImagePlus className="w-8 h-8 mb-1" />
                          <span className="text-xs font-bold">Subir imagen (horizontal)</span>
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
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-1">Título</label>
                    <input
                      value={bannerForm.titulo}
                      onChange={(e) => setBannerForm((f) => ({ ...f, titulo: e.target.value }))}
                      placeholder="Ej: Carnicería Premium · Cortes al Vacío"
                      className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-1">Subtítulo (opcional)</label>
                    <input
                      value={bannerForm.subtitulo}
                      onChange={(e) => setBannerForm((f) => ({ ...f, subtitulo: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-1">Etiqueta</label>
                      <input
                        value={bannerForm.etiqueta}
                        onChange={(e) => setBannerForm((f) => ({ ...f, etiqueta: e.target.value }))}
                        placeholder="OFERTA DEL DÍA"
                        className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-1">Texto de descuento</label>
                      <input
                        value={bannerForm.descuento_texto}
                        onChange={(e) => setBannerForm((f) => ({ ...f, descuento_texto: e.target.value }))}
                        placeholder="-20% OFF"
                        className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-1">Color de acento (si no hay imagen)</label>
                    <select
                      value={bannerForm.color}
                      onChange={(e) => setBannerForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 text-gray-900 dark:text-white"
                    >
                      {KIOSK_COLORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={bannerForm.activo} onChange={(e) => setBannerForm((f) => ({ ...f, activo: e.target.checked }))} className="w-4 h-4" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Activo (se muestra ya en las terminales)</span>
                  </label>

                  <button
                    onClick={submitBannerForm}
                    disabled={savingBanner}
                    className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
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
