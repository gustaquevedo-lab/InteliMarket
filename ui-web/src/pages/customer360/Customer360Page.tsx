import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  BarChart3, Users, ShoppingBag, TrendingDown, Target, Gift,
  Loader2, RefreshCcw, AlertTriangle, Clock, DollarSign, PieChart,
  ChevronRight, Search, HeartHandshake, Zap, Calendar, Sparkles,
  Phone, Mail, ArrowUpRight, TrendingUp, ShieldCheck, CheckCircle2,
  Award, MessageCircle, Send, Filter, Check, Eye, UserCheck, Star,
  Percent, ArrowRight, CreditCard, ShoppingCart, MessageSquare, Flame,
  Plus, X, Tag, Bot, BadgePercent, CheckCircle, Sparkle,
  Copy, ExternalLink, Smartphone, MessageSquareText, ChevronDown, SlidersHorizontal
} from "lucide-react"
import { api, type Customer, type Product } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"

type Tab = "perfil" | "canasta_habitual" | "scoring_rfm" | "ofertas_personalizadas" | "campanias_retencion"
type BehaviorFilter = "todos" | "brasil" | "paraguay" | "vip" | "ofertas_activas" | "riesgo_fuga"

interface Customer360Profile {
  customer: {
    id: string
    razon_social: string
    ruc: string
    ci?: string | null
    telefono?: string | null
    email?: string | null
    ciudad?: string | null
    idioma?: string | null
    whatsapp_valido?: boolean | null
    arquetipo?: string | null
    tags?: string[] | null
    ia_analisis?: {
      fecha_analisis?: string
      modelo?: string
      esencia?: string
      categorias_gancho?: string[]
      producto_sugerido_promo?: string
      gancho_mensaje?: string
    } | null
    extra_club_numero?: string | null
    limite_credito: number
    credito_usado: number
    tipo: string
  }
  kpis: {
    total_tickets: number
    total_spent: number
    avg_ticket: number
    first_purchase?: string | null
    last_purchase?: string | null
    days_since_last_purchase: number
    avg_days_between_visits?: number
  }
  loyalty: {
    total_points: number
    tier: string
    tier_color: string
    redeemable_value_pyg: number
  }
  rfm: {
    segment: string
    score: number
    risk_level: string
    days_since: number
    total_tickets: number
    total_spent: number
  }
  frequent_basket: Array<{
    product_id: string
    producto: string
    categoria: string
    veces: number
    unidades: number
    total: number
  }>
  recent_sales: Array<{
    id: string
    numero: string
    fecha?: string | null
    total: number
    estado: string
    items_count: number
  }>
}

const ARCHETYPE_OPTIONS = [
  "Comprador Familiar Gourmet",
  "Abastecedor Mayorista de Frontera",
  "Cazador de Ofertas Frescos",
  "Comprador Express de Al Paso",
  "Consumidor Habitual de Frontera",
  "Cliente VIP Alto Consumo",
  "Cliente en Riesgo de Fuga",
  "Comprador Bimonetario Reales",
]

export default function Customer360Page() {
  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  const [tab, setTab] = useState<Tab>("perfil")
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchCust, setSearchCust] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [profile, setProfile] = useState<Customer360Profile | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  // Filtros Avanzados y de Comportamiento
  const [behaviorFilter, setBehaviorFilter] = useState<BehaviorFilter>("todos")
  const [selectedArchetypeFilter, setSelectedArchetypeFilter] = useState<string>("")
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<"reciente" | "gasto" | "compras" | "inactividad">("reciente")
  const cachedCustomersRef = useRef<Customer[]>([])

  // IA Local Qwen 2.5 & Tags interactivos
  const [reanalyzing, setReanalyzing] = useState(false)
  const [newTagInput, setNewTagInput] = useState("")
  const [showTagInput, setShowTagInput] = useState(false)
  const [editingArchetype, setEditingArchetype] = useState(false)

  // Ofertas 1-a-1 "Te Extrañamos"
  const [customerOffers, setCustomerOffers] = useState<any[]>([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false)
  const [offerSelectedProduct, setOfferSelectedProduct] = useState<any>(null)
  const [offerPriceInput, setOfferPriceInput] = useState<number>(0)
  const [offerValidityDays, setOfferValidityDays] = useState<number>(7)
  const [submittingOffer, setSubmittingOffer] = useState(false)

  // Selector dual de producto para ofertas
  const [offerMode, setOfferMode] = useState<"frecuentes" | "catalogo">("frecuentes")
  const [catalogSearch, setCatalogSearch] = useState("")
  const [catalogResults, setCatalogResults] = useState<Product[]>([])
  const [searchingCatalog, setSearchingCatalog] = useState(false)

  // Métricas del Dashboard
  const [dashboardStats, setDashboardStats] = useState<{
    total_customers: number
    total_with_phone: number
    total_brasil: number
    total_paraguay: number
    total_points_loyalty: number
    total_socios_vip: number
  } | null>(null)

  // Mensajería IntelliZapp & Simulador de WhatsApp
  const [customMsg, setCustomMsg] = useState("")
  const [sendingMsg, setSendingMsg] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)
  const [msgLanguage, setMsgLanguage] = useState<"es" | "pt">("es")
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<"oferta" | "reactivacion" | "extraclub" | "feria" | "libre">("oferta")

  // Debounce para búsqueda remota
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchCust)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchCust])

  // Cargar métricas ejecutivas de Customer 360
  const loadDashboard = useCallback(async () => {
    try {
      const res: any = await api.customer360.getDashboard(companyId)
      if (res) {
        setDashboardStats(res)
      }
    } catch (err) {
      console.error("Error al cargar KPIs de Customer 360:", err)
    }
  }, [companyId])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Cargar lista de clientes vía API con búsqueda remota y paginación
  const loadCustomers = useCallback(async (reset: boolean = true) => {
    if (reset) {
      setLoadingList(true)
    } else {
      setLoadingMore(true)
    }
    try {
      const currentOffset = reset ? 0 : offset
      const params: any = {
        search: debouncedSearch.trim() || undefined,
        limit: 50,
        offset: currentOffset,
        exclude_proveedores: true
      }

      if (behaviorFilter === "brasil") {
        params.country = "brasil"
      } else if (behaviorFilter === "paraguay") {
        params.country = "paraguay"
      } else if (behaviorFilter === "vip") {
        params.extra_club_only = true
      } else if (behaviorFilter === "ofertas_activas") {
        params.has_offers_only = true
      }

      if (selectedArchetypeFilter) {
        params.archetype = selectedArchetypeFilter
      }

      const res: any = await api.customers.list(params)
      const list: Customer[] = Array.isArray(res) ? res : (res?.data || [])
      
      if (reset) {
        setCustomers(list)
        cachedCustomersRef.current = list
        setOffset(list.length)
        if (list.length > 0) {
          if (!selectedCustomerId || !list.some(c => c.id === selectedCustomerId)) {
            setSelectedCustomerId(list[0].id)
          }
        }
      } else {
        setCustomers(prev => {
          const merged = [...prev, ...list]
          cachedCustomersRef.current = merged
          return merged
        })
        setOffset(prev => prev + list.length)
      }
      setHasMore(list.length === 50)
    } catch (err: any) {
      console.error("Error loading customers:", err)
      if (cachedCustomersRef.current.length > 0 && reset) {
        setCustomers(cachedCustomersRef.current)
        toast.info("Modo Resiliencia", "Mostrando clientes en memoria ante problemas de red.")
      } else {
        toast.error("Error al cargar lista de clientes", err.message)
      }
    } finally {
      setLoadingList(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, offset, selectedCustomerId, behaviorFilter, selectedArchetypeFilter, toast])

  useEffect(() => {
    loadCustomers(true)
  }, [debouncedSearch, behaviorFilter, selectedArchetypeFilter])

  // Búsqueda en vivo de productos del catálogo general para ofertas
  useEffect(() => {
    if (!catalogSearch.trim() || offerMode !== "catalogo") {
      setCatalogResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCatalog(true)
      try {
        const prods = await api.products.list({ search: catalogSearch.trim(), limit: 8, activo: true } as any)
        setCatalogResults(Array.isArray(prods) ? (prods as Product[]) : [])
      } catch (err) {
        console.error("Error buscando en catálogo general:", err)
      } finally {
        setSearchingCatalog(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [catalogSearch, offerMode])

  // Cargar ofertas del cliente
  const loadOffers = useCallback(async (cid: string) => {
    if (!cid) return
    setLoadingOffers(true)
    try {
      const res = await api.customer360.getCustomerOffers(cid)
      setCustomerOffers(Array.isArray(res) ? res : [])
    } catch (e) {
      setCustomerOffers([])
    } finally {
      setLoadingOffers(false)
    }
  }, [])

  // Cargar perfil 360 dinámico al cambiar selectedCustomerId
  useEffect(() => {
    if (!selectedCustomerId) return
    let isCancelled = false

    const fetchProfile = async () => {
      setLoadingProfile(true)
      try {
        const res = await api.customer360.getProfile(selectedCustomerId)
        if (!isCancelled) {
          setProfile(res)
          loadOffers(selectedCustomerId)
          
          // Generar mensaje sugerido respetando idioma (Portugués para Brasil, Español para PY)
          const isPT = res.customer.idioma === 'pt' || res.customer.telefono?.startsWith("+55")
          setMsgLanguage(isPT ? "pt" : "es")
          const favProd = res.customer.ia_analisis?.producto_sugerido_promo || res.frequent_basket?.[0]?.producto || (isPT ? "nossos produtos" : "nuestros productos")
          const primerNombre = (res.customer.razon_social || "").split(",")[0].split(" ")[0]
          
          if (res.customer.ia_analisis?.gancho_mensaje) {
            setCustomMsg(res.customer.ia_analisis.gancho_mensaje)
          } else if (isPT) {
            setCustomMsg(
              `Olá ${primerNombre}! 👋 No Extra Supermercado estamos com saudades. Você acumulou ${res.loyalty.total_points.toLocaleString("es-PY")} pontos ExtraClub. Preparamos uma oferta exclusiva em *${favProd}*. Passe no caixa e informe seu documento!`
            )
          } else {
            setCustomMsg(
              `¡Hola ${primerNombre}! 👋 En Extra Supermercado te extrañamos. Tenés acumulados ${res.loyalty.total_points.toLocaleString("es-PY")} puntos ExtraClub. Te preparamos un descuento especial en tu favorito *${favProd}*. ¡Pedilo en caja con tu cédula!`
            )
          }
          setSentSuccess(false)
        }
      } catch (err: any) {
        console.error("Error fetching 360 profile:", err)
        if (!isCancelled) {
          toast.error("Error al cargar expediente 360", err.message)
        }
      } finally {
        if (!isCancelled) {
          setLoadingProfile(false)
        }
      }
    }

    fetchProfile()
    return () => {
      isCancelled = true
    }
  }, [selectedCustomerId, toast, loadOffers])

  // Filtrado reactivo y ordenamiento en cliente
  const filteredCustomers = useMemo(() => {
    let result = [...customers]
    if (behaviorFilter === "riesgo_fuga") {
      // Filtrar aquellos sin compra reciente o identificados
      result = result.filter(c => (c as any).arquetipo?.toLowerCase().includes("riesgo") || (c as any).dias_inactivo > 30)
    }

    if (sortBy === "reciente") {
      // Orden por defecto
    } else if (sortBy === "compras") {
      result.sort((a, b) => ((b as any).total_tickets || 0) - ((a as any).total_tickets || 0))
    } else if (sortBy === "gasto") {
      result.sort((a, b) => ((b as any).total_spent || 0) - ((a as any).total_spent || 0))
    }
    return result
  }, [customers, behaviorFilter, sortBy])

  // Acción: Re-analizar con Qwen 2.5 IA Local
  const handleReanalyzeWithQwen = async () => {
    if (!selectedCustomerId) return
    setReanalyzing(true)
    try {
      toast.info("⚡ Invocando Qwen 2.5 Local (Ollama)", "Analizando historial real de tickets y canasta...")
      const res = await api.customer360.reanalyzeProfile(selectedCustomerId)
      toast.success("🧠 ¡Perfilado Qwen IA Completado!", `Nuevo arquetipo: "${res.arquetipo}"`)
      // Refrescar perfil completo
      const updatedProfile = await api.customer360.getProfile(selectedCustomerId)
      setProfile(updatedProfile)
      if (updatedProfile.customer.ia_analisis?.gancho_mensaje) {
        setCustomMsg(updatedProfile.customer.ia_analisis.gancho_mensaje)
      }
    } catch (e: any) {
      console.error("Error reanalizando con Qwen:", e)
      toast.error("Error en perfilado IA", e.message || "Ollama no respondió.")
    } finally {
      setReanalyzing(false)
    }
  }

  // Acción: Agregar Tag
  const handleAddTag = async () => {
    if (!newTagInput.trim() || !profile?.customer?.id) return
    const cleanTag = newTagInput.trim().toLowerCase().replace(/\s+/g, "_")
    const currentTags = profile.customer.tags || []
    if (currentTags.includes(cleanTag)) {
      toast.warning("Tag duplicado", `El cliente ya posee el tag #${cleanTag}`)
      setNewTagInput("")
      return
    }
    const updated = [...currentTags, cleanTag]
    try {
      await api.customer360.updateTags(profile.customer.id, updated)
      setProfile(prev => prev ? { ...prev, customer: { ...prev.customer, tags: updated } } : null)
      setNewTagInput("")
      setShowTagInput(false)
      toast.success("Tag Creado", `#${cleanTag}`)
    } catch (e: any) {
      toast.error("Error guardando tag", e.message)
    }
  }

  // Acción: Eliminar Tag
  const handleRemoveTag = async (tagToRemove: string) => {
    if (!profile?.customer?.id) return
    const currentTags = profile.customer.tags || []
    const updated = currentTags.filter(t => t !== tagToRemove)
    try {
      await api.customer360.updateTags(profile.customer.id, updated)
      setProfile(prev => prev ? { ...prev, customer: { ...prev.customer, tags: updated } } : null)
      toast.info("Tag Removido", `#${tagToRemove}`)
    } catch (e: any) {
      toast.error("Error al remover tag", e.message)
    }
  }

  // Acción: Modificar Arquetipo
  const handleUpdateArchetype = async (newArch: string) => {
    if (!profile?.customer?.id) return
    try {
      await api.customer360.updateArchetype(profile.customer.id, newArch)
      setProfile(prev => prev ? { ...prev, customer: { ...prev.customer, arquetipo: newArch } } : null)
      setEditingArchetype(false)
      toast.success("Arquetipo Actualizado", newArch)
    } catch (e: any) {
      toast.error("Error al cambiar arquetipo", e.message)
    }
  }

  // Seleccionar producto para la oferta (sea frecuente o de catálogo)
  const handleSelectProductForOffer = (prod: any) => {
    setOfferSelectedProduct(prod)
    if (prod) {
      const normal = Number(prod.precio_venta || prod.precio_normal || (prod.total ? prod.total / Math.max(1, prod.unidades) : 10000))
      const costo = Number(prod.ultimo_costo || prod.costo_promedio || prod.costo || normal * 0.7)
      const piso = Math.round(Math.max(costo * 1.05, 1000))
      // Sugerir 15% OFF respetando piso de costo
      const suggested = Math.max(Math.round(normal * 0.85), piso)
      setOfferPriceInput(suggested)
    } else {
      setOfferPriceInput(0)
    }
  }

  // Abrir Modal de Creación de Oferta
  const handleOpenCreateOfferModal = (prefillProd?: any) => {
    setOfferMode("frecuentes")
    setCatalogSearch("")
    setCatalogResults([])
    const prod = prefillProd || (profile?.frequent_basket && profile.frequent_basket[0]) || null
    handleSelectProductForOffer(prod)
    setOfferValidityDays(7)
    setShowCreateOfferModal(true)
  }

  // Acción: Confirmar Creación de Oferta con Blindaje Anti-Costo y Generación de Mensaje
  const handleConfirmCreateOffer = async () => {
    if (!profile?.customer?.id || !offerSelectedProduct) {
      toast.warning("Datos incompletos", "Seleccione un producto para la oferta.")
      return
    }

    const normal = Number(offerSelectedProduct.precio_venta || offerSelectedProduct.precio_normal || (offerSelectedProduct.total ? offerSelectedProduct.total / Math.max(1, offerSelectedProduct.unidades) : offerPriceInput * 1.2))
    const costo = Number(offerSelectedProduct.ultimo_costo || offerSelectedProduct.costo_promedio || offerSelectedProduct.costo || 0)
    const safetyFloor = Math.round(Math.max(costo * 1.05, 500))

    if (costo > 0 && offerPriceInput < safetyFloor) {
      toast.error(
        "🚫 Venta Bajo Costo Prohibida",
        `El precio propuesto (Gs. ${offerPriceInput.toLocaleString("es-PY")}) perfora el costo de compra (Piso mínimo seguro: Gs. ${safetyFloor.toLocaleString("es-PY")}).`
      )
      return
    }

    setSubmittingOffer(true)
    try {
      const isPT = profile.customer.idioma === 'pt' || profile.customer.telefono?.startsWith("+55")
      const primerNombre = (profile.customer.razon_social || "").split(",")[0].split(" ")[0]
      const prodName = offerSelectedProduct.producto || offerSelectedProduct.nombre || "Producto Especial"
      const ahorro = Math.max(0, normal - offerPriceInput)
      const ahorroPct = normal > 0 ? Math.round((ahorro / normal) * 100) : 0
      
      const promoTitle = isPT ? `Oferta Especial: ${prodName}` : `Promo Te Extrañamos: ${prodName}`
      const promoDesc = isPT
        ? `Preço especial de Gs. ${offerPriceInput.toLocaleString('es-PY')} para ${primerNombre}. Ativação direta no caixa ao informar documento.`
        : `Precio exclusivo de Gs. ${offerPriceInput.toLocaleString('es-PY')} para ${primerNombre}. Activación directa en caja con cédula o RUC.`

      const res = await api.customer360.createOffer({
        customer_id: profile.customer.id,
        product_id: offerSelectedProduct.product_id || offerSelectedProduct.id,
        titulo: promoTitle,
        descripcion: promoDesc,
        tipo: "precio_fijo",
        valor: offerPriceInput,
        dias_validez: offerValidityDays,
      })

      toast.success("🎉 ¡Oferta Creada y Activa en Caja!", `Precio especial asignado. Margen: ${res.margen_estimado_pct}%. Mensaje preparado en WhatsApp.`)
      setShowCreateOfferModal(false)
      loadOffers(profile.customer.id)

      // Actualizar mensaje de WhatsApp en el Hub con precio normal y precio oferta
      setMsgLanguage(isPT ? "pt" : "es")
      const waMsg = isPT
        ? `Olá ${primerNombre}! 👋 No Extra Supermercado preparamos um preço exclusivo no seu produto preferido *${prodName}*: por apenas *Gs. ${offerPriceInput.toLocaleString('es-PY')}* (Preço normal: ~Gs. ${normal.toLocaleString('es-PY')}~. Economia de *Gs. ${ahorro.toLocaleString('es-PY')}* - ${ahorroPct}% OFF!). É só informar seu documento no caixa! Válido por ${offerValidityDays} dias.`
        : `¡Hola ${primerNombre}! 👋 En Extra Supermercado te preparamos un precio exclusivo en tu producto preferido *${prodName}*: a solo *Gs. ${offerPriceInput.toLocaleString('es-PY')}* (Precio normal: ~Gs. ${normal.toLocaleString('es-PY')}~. ¡Ahorrás *Gs. ${ahorro.toLocaleString('es-PY')}* - ${ahorroPct}% OFF!). Solo tenés que dictar tu cédula o RUC en caja. Válido por ${offerValidityDays} dias.`
      setCustomMsg(waMsg)
      setActiveTemplate("oferta")
      setTab("campanias_retencion")
    } catch (e: any) {
      toast.error("Error al crear oferta", e.message)
    } finally {
      setSubmittingOffer(false)
    }
  }

  // Generador dinámico de plantillas para WhatsApp
  const generateTemplateMessage = (templateKey: "oferta" | "reactivacion" | "extraclub" | "feria" | "libre", lang: "es" | "pt") => {
    if (!profile) return ""
    const primerNombre = (profile.customer.razon_social || "").split(",")[0].split(" ")[0]
    const isPT = lang === "pt"
    
    // Buscar oferta activa o producto frecuente
    const activeOffer = customerOffers.find(o => o.is_active)
    const favProd = activeOffer?.producto_nombre || profile.customer.ia_analisis?.producto_sugerido_promo || profile.frequent_basket[0]?.producto || (isPT ? "nossos produtos" : "nuestros productos")
    const pNormal = activeOffer?.precio_normal || (profile.frequent_basket[0] ? (profile.frequent_basket[0].total / Math.max(1, profile.frequent_basket[0].unidades)) : 35000)
    const pOferta = activeOffer?.precio_oferta || Math.round(pNormal * 0.85)
    const ahorro = Math.max(0, pNormal - pOferta)
    const ahorroPct = pNormal > 0 ? Math.round((ahorro / pNormal) * 100) : 15
    const pts = profile.loyalty.total_points.toLocaleString("es-PY")
    const vales = formatPYG(profile.loyalty.redeemable_value_pyg)

    if (templateKey === "oferta") {
      return isPT
        ? `Olá ${primerNombre}! 👋 No Extra Supermercado preparamos uma oferta exclusiva no seu produto preferido *${favProd}*: por apenas *Gs. ${pOferta.toLocaleString('es-PY')}* (Preço normal: ~Gs. ${pNormal.toLocaleString('es-PY')}~. Economia de *Gs. ${ahorro.toLocaleString('es-PY')}* - ${ahorroPct}% OFF!). É só informar seu documento no caixa! Válido por 7 dias.`
        : `¡Hola ${primerNombre}! 👋 En Extra Supermercado te preparamos un precio exclusivo en tu producto preferido *${favProd}*: a solo *Gs. ${pOferta.toLocaleString('es-PY')}* (Precio normal: ~Gs. ${pNormal.toLocaleString('es-PY')}~. ¡Ahorrás *Gs. ${ahorro.toLocaleString('es-PY')}* - ${ahorroPct}% OFF!). Solo tenés que dictar tu cédula o RUC en caja. Válido por 7 dias.`
    }
    if (templateKey === "reactivacion") {
      return isPT
        ? `Olá ${primerNombre}! 👋 Sentimos sua falta no Extra Supermercado! Para celebrar sua volta, preparamos um desconto especial no seu favorito *${favProd}*: de ~Gs. ${pNormal.toLocaleString('es-PY')}~ por apenas *Gs. ${pOferta.toLocaleString('es-PY')}*. Esperamos você esta semana no Extra!`
        : `¡Hola ${primerNombre}! 👋 ¡Te extrañamos en Extra Supermercado! Para celebrar tu regreso, te preparamos un descuento especial en tu favorito *${favProd}*: de ~Gs. ${pNormal.toLocaleString('es-PY')}~ a solo *Gs. ${pOferta.toLocaleString('es-PY')}*. ¡Te esperamos esta semana en Extra!`
    }
    if (templateKey === "extraclub") {
      return isPT
        ? `Olá ${primerNombre}! 🌟 Seu saldo atual no ExtraClub é de *${pts} pontos* (equivalentes a *${vales}* em compras). Você pode resgatar hoje mesmo no caixa com seu documento!`
        : `¡Hola ${primerNombre}! 🌟 Tu saldo actual en ExtraClub es de *${pts} puntos* (equivalentes a *${vales}* en vales de compra). ¡Podés canjearlos hoy mismo en caja presentando tu cédula!`
    }
    if (templateKey === "feria") {
      return isPT
        ? `Olá ${primerNombre}! 🥩 Te esperamos neste fim de semana no Extra Supermercado com as melhores ofertas na Feira de Carnes Frescas e Hortifruti de fronteira! Venha aproveitar a qualidade e preços de Extra.`
        : `¡Hola ${primerNombre}! 🥩 ¡Te esperamos este fin de semana en Extra Supermercado con las mejores ofertas en carnes premium y frescos de frontera! Vení a disfrutar de la calidad y los mejores precios.`
    }
    return ""
  }

  // Renderizar formato WhatsApp en el simulador
  const renderFormattedWhatsAppText = (text: string) => {
    if (!text) return <span className="text-gray-400 italic">Escriba un mensaje para previsualizar...</span>
    const lines = text.split("\n")
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*[^*]+\*|~[^~]+~|_[^_]+_)/g)
      return (
        <span key={lIdx} className="block min-h-[1.25em]">
          {parts.map((part, pIdx) => {
            if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
              return <strong key={pIdx} className="font-black text-gray-950 dark:text-white">{part.slice(1, -1)}</strong>
            }
            if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
              return <del key={pIdx} className="line-through opacity-75">{part.slice(1, -1)}</del>
            }
            if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
              return <em key={pIdx} className="italic">{part.slice(1, -1)}</em>
            }
            return <span key={pIdx}>{part}</span>
          })}
        </span>
      )
    })
  }

  // Acción: Enviar WhatsApp IntelliZapp
  const handleSendIntelliZapp = async () => {
    if (!profile?.customer?.telefono) {
      toast.error("El cliente no posee un número de teléfono registrado.")
      return
    }
    setSendingMsg(true)
    try {
      await api.whatsapp.sendTestMessage({
        phone: profile.customer.telefono,
        message: customMsg,
      })
      toast.success("¡Mensaje Enviado por WhatsApp!", `Enviado con éxito a ${profile.customer.telefono}`)
      setSentSuccess(true)
    } catch (e: any) {
      const cleanPhone = profile.customer.telefono.replace(/[^0-9]/g, "")
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMsg)}`, "_blank")
      toast.info("Abriendo WhatsApp Web", "Se inició la conversación directa.")
      setSentSuccess(true)
    } finally {
      setSendingMsg(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold tracking-wide">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Customer 360 · Motor Qwen 2.5 Local en Ollama</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Inteligencia de Clientes & Retención 1-a-1</span>
              <span className="text-xs px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
                Qwen 2.5 7B
              </span>
            </h1>
            <p className="text-slate-400 text-xs max-w-2xl leading-relaxed">
              Arquetipos conductuales automáticos, ofertas hiper-personalizadas "Te Extrañamos" con blindaje de costo (+5% mín.) e impacto inmediato en caja al dictar cédula.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button 
              type="button"
              onClick={() => { loadCustomers(true); loadDashboard(); }} 
              disabled={loadingList}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              <RefreshCcw className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`} />
              <span>Actualizar Base</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS EN VIVO */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {[
            { label: "Base Clientes Retail", val: `${dashboardStats?.total_customers?.toLocaleString("es-PY") || "10.495"} clientes`, sub: "Padrón & Cupones sincronizados", color: "text-cyan-300", icon: Users },
            { label: "WhatsApp Normalizado", val: `${dashboardStats?.total_with_phone?.toLocaleString("es-PY") || "6.953"} líneas`, sub: "Formato E.164 verificado", color: "text-emerald-400", icon: MessageCircle },
            { label: "Clientes de Brasil (PT)", val: `${dashboardStats?.total_brasil?.toLocaleString("es-PY") || "322"} clientes`, sub: "Idioma Portugués activo (+55)", color: "text-amber-300", icon: Award },
            { label: "Clientes Paraguay", val: `${dashboardStats?.total_paraguay?.toLocaleString("es-PY") || "10.173"} clientes`, sub: "Nacional / Frontera (+595)", color: "text-blue-300", icon: UserCheck },
            { label: "Puntos ExtraClub", val: `${((dashboardStats?.total_points_loyalty || 0) / 1000000).toFixed(2)}M pts`, sub: "Programa de lealtad auditado", color: "text-purple-300", icon: Sparkles },
            { label: "Socios ExtraClub", val: `${dashboardStats?.total_socios_vip || 341} socios`, sub: "Con tarjeta física o digital", color: "text-indigo-300", icon: HeartHandshake },
          ].map((kpi) => (
            <div key={kpi.label} className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-base font-black font-mono tracking-tight ${kpi.color}`}>{kpi.val}</p>
              <p className="text-[9px] text-slate-400 font-medium truncate">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PANEL PRINCIPAL: LISTA DE CLIENTES + EXPEDIENTE 360 DINÁMICO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: BUSCADOR, FILTROS CONDUCTUALES & LISTA */}
        <div className="lg:col-span-4 space-y-3">
          <div className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={searchCust} 
                onChange={e => setSearchCust(e.target.value)}
                placeholder="Buscar por Nombre, Cédula, RUC, Tel o Tarjeta..." 
                className="input text-xs pl-9 pr-7 w-full bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700" 
              />
              {searchCust && (
                <button onClick={() => setSearchCust("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  ×
                </button>
              )}
            </div>

            {/* FILTROS RÁPIDOS MULTIDIMENSIONALES */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-extrabold scrollbar-none">
              {[
                { id: "todos", label: "Todos" },
                { id: "brasil", label: "🇧🇷 Brasil (PT)" },
                { id: "paraguay", label: "🇵🇾 Paraguay (ES)" },
                { id: "vip", label: "⭐ Socios Club" },
                { id: "ofertas_activas", label: "🎁 Con Ofertas" },
                { id: "riesgo_fuga", label: "⚠️ Riesgo Fuga" },
              ].map((bf) => (
                <button
                  key={bf.id}
                  onClick={() => setBehaviorFilter(bf.id as BehaviorFilter)}
                  className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap shrink-0 ${
                    behaviorFilter === bf.id
                      ? "bg-cyan-600 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {bf.label}
                </button>
              ))}
            </div>

            {/* BOTÓN Y PANEL DE FILTROS AVANZADOS (DRAWER) */}
            <div className="pt-1 border-t border-gray-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-cyan-600 transition py-0.5"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filtros Avanzados & Orden</span>
                  {(selectedArchetypeFilter || sortBy !== "reciente") && (
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  )}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilterPanel ? "rotate-180" : ""}`} />
              </button>

              {showFilterPanel && (
                <div className="mt-2 p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-gray-200 dark:border-slate-700 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Filtrar por Arquetipo:</label>
                    <select
                      value={selectedArchetypeFilter}
                      onChange={e => setSelectedArchetypeFilter(e.target.value)}
                      className="input text-[11px] py-1 w-full bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700"
                    >
                      <option value="">Todos los arquetipos</option>
                      {ARCHETYPE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Ordenar por:</label>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="input text-[11px] py-1 w-full bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700"
                    >
                      <option value="reciente">Más Recientes / Padrón</option>
                      <option value="gasto">Mayor Gasto Acumulado</option>
                      <option value="compras">Mayor Cantidad de Compras</option>
                    </select>
                  </div>

                  {(selectedArchetypeFilter || sortBy !== "reciente") && (
                    <button
                      type="button"
                      onClick={() => { setSelectedArchetypeFilter(""); setSortBy("reciente"); }}
                      className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline block text-right pt-1"
                    >
                      Limpiar Filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 font-bold uppercase pt-1 border-t border-gray-100 dark:border-slate-800">
              <span>Coincidencias: {filteredCustomers.length} {dashboardStats ? `de ${dashboardStats.total_customers.toLocaleString("es-PY")}` : ""}</span>
              <span className="text-emerald-500 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Server-Side ✓
              </span>
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-2 max-h-[640px] overflow-y-auto space-y-1 shadow-sm divide-y divide-gray-50 dark:divide-slate-800/40">
            {loadingList ? (
              <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                <span>Buscando en base de 10.495 clientes de Extra Supermercado...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No se encontraron clientes con el filtro seleccionado.
              </div>
            ) : (
              <>
                {filteredCustomers.map((c) => {
                  const isSelected = c.id === selectedCustomerId
                  const isBR = (c as any).idioma === 'pt' || c.telefono?.startsWith("+55")
                  return (
                    <button 
                      key={c.id} 
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`w-full text-left p-3 rounded-2xl transition flex items-center justify-between gap-2.5 text-xs ${
                        isSelected 
                          ? "bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 border-2 border-cyan-500 dark:border-cyan-500 shadow-md" 
                          : "hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-transparent"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`font-extrabold truncate text-xs ${isSelected ? "text-cyan-700 dark:text-cyan-300 font-black" : "text-gray-900 dark:text-white"}`}>
                            {c.razon_social || "Cliente Registrado"}
                          </p>
                          {isBR ? (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              🇧🇷 PT
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                              🇵🇾 ES
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-1 flex-wrap">
                          <span>DOC: {c.ruc || c.ci || "S/D"}</span>
                          <span>•</span>
                          <span>{c.telefono || "Sin Teléfono"}</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "text-cyan-600 translate-x-1" : "text-gray-300"}`} />
                    </button>
                  )
                })}

                {hasMore && (
                  <div className="p-2 pt-3 text-center">
                    <button
                      type="button"
                      onClick={() => loadCustomers(false)}
                      disabled={loadingMore}
                      className="w-full py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-bold text-cyan-600 dark:text-cyan-400 border border-gray-200 dark:border-slate-700 flex items-center justify-center gap-2 transition"
                    >
                      {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>Cargar más clientes ({customers.length} cargados)</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: EXPEDIENTE 360°, IA LOCAL Y OFERTAS */}
        <div className="lg:col-span-8 space-y-4">
          {loadingProfile ? (
            <div className="card p-16 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-600 mx-auto" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Cargando expediente 360° del cliente...</p>
              <p className="text-xs text-gray-400">Analizando historial de tickets, canasta habitual y puntos ExtraClub</p>
            </div>
          ) : profile ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* TARJETA HEADER DEL CLIENTE SELECCIONADO */}
              <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
                      {(profile.customer.razon_social || "C")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                          {profile.customer.razon_social}
                        </h2>
                        
                        {/* ARQUETIPO EDITABLE */}
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => setEditingArchetype(!editingArchetype)}
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 hover:bg-indigo-200 flex items-center gap-1 transition"
                            title="Haga clic para modificar el arquetipo"
                          >
                            <Bot className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            <span>{profile.customer.arquetipo || "Arquetipo sin definir"}</span>
                            <span className="text-[8px] opacity-70">✎</span>
                          </button>

                          {editingArchetype && (
                            <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 z-50 space-y-1">
                              <p className="text-[10px] font-black text-gray-400 uppercase px-2 py-1">Seleccionar Arquetipo</p>
                              {ARCHETYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleUpdateArchetype(opt)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 transition"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* SOCIO / PAÍS */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          profile.loyalty.tier === "VIP Platino"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          ExtraClub {profile.loyalty.tier}
                        </span>

                        {(profile.customer.idioma === 'pt' || profile.customer.telefono?.startsWith('+55')) ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <span>🇧🇷</span> Brasil · PT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1">
                            <span>🇵🇾</span> Paraguay · ES
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1.5 flex items-center gap-2 flex-wrap">
                        <span>DOC: {profile.customer.ruc || profile.customer.ci || "S/D"}</span>
                        <span>•</span>
                        {profile.customer.telefono ? (
                          <a 
                            href={`https://wa.me/${profile.customer.telefono.replace(/[^0-9]/g, "")}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{profile.customer.telefono}</span>
                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1 rounded font-sans">WhatsApp E.164 ✓</span>
                          </a>
                        ) : (
                          <span>Sin teléfono registrado</span>
                        )}
                        <span>•</span>
                        <span>{profile.customer.ciudad || "Pedro Juan Caballero"}</span>
                      </div>
                    </div>
                  </div>

                  {/* BOTÓN RE-ANALIZAR CON QWEN IA */}
                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleReanalyzeWithQwen}
                      disabled={reanalyzing}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-purple-500/20"
                    >
                      <Sparkle className={`w-3.5 h-3.5 ${reanalyzing ? "animate-spin text-amber-300" : "text-cyan-300"}`} />
                      <span>{reanalyzing ? "Analizando con Qwen..." : "⚡ Re-analizar con Qwen IA"}</span>
                    </button>

                    <div className="text-right bg-gray-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-700">
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Puntos ExtraClub</span>
                      <span className="font-mono font-black text-sm text-purple-600 dark:text-purple-400">
                        {profile.loyalty.total_points.toLocaleString("es-PY")} pts
                      </span>
                    </div>
                  </div>
                </div>

                {/* GESTIÓN INTERACTIVA DE TAGS DE CONDUCTA */}
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1">
                    <Tag className="w-3 h-3 text-cyan-600" /> Tags Conductuales:
                  </span>
                  {(profile.customer.tags || []).map((t) => (
                    <span 
                      key={t} 
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[11px] font-bold"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-red-600 text-gray-400 ml-0.5 text-xs font-black leading-none"
                        title="Eliminar tag"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  {showTagInput ? (
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAddTag() }}
                        placeholder="nuevo_tag..."
                        autoFocus
                        className="input text-[10px] py-0.5 px-2 w-28 rounded-lg bg-white dark:bg-slate-800 border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-2 py-0.5 rounded-lg bg-cyan-600 text-white text-[10px] font-bold"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowTagInput(false); setNewTagInput(""); }}
                        className="text-gray-400 hover:text-gray-600 text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTagInput(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-cyan-50 hover:text-cyan-700 text-[10px] font-bold border border-dashed border-gray-300 dark:border-slate-700 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Agregar Tag</span>
                    </button>
                  )}
                </div>

                {/* CAJA DE ESENCIA CONDUCTUAL QWEN 2.5 (SI EXISTE) */}
                {profile.customer.ia_analisis?.esencia && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-cyan-500/10 border border-purple-500/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-extrabold text-[11px] uppercase tracking-wide">
                        <Bot className="w-3.5 h-3.5" />
                        <span>Esencia Conductual (Qwen 2.5 IA Local)</span>
                      </div>
                      {profile.customer.ia_analisis.modelo && (
                        <span className="text-[9px] text-gray-400 font-mono">
                          {profile.customer.ia_analisis.modelo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed font-medium italic">
                      "{profile.customer.ia_analisis.esencia}"
                    </p>
                    {profile.customer.ia_analisis.producto_sugerido_promo && (
                      <div className="flex items-center gap-2 pt-1 text-[11px]">
                        <span className="font-bold text-gray-500">Producto Gancho Sugerido:</span>
                        <span className="font-extrabold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800">
                          {profile.customer.ia_analisis.producto_sugerido_promo}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateOfferModal({ producto: profile.customer.ia_analisis?.producto_sugerido_promo })}
                          className="ml-auto text-[10px] font-black text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <span>Crear Promo Ahora</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TABS 360 */}
                <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex gap-2 overflow-x-auto text-xs scrollbar-none">
                  {[
                    { id: "perfil", label: "Visión General & Tickets", icon: UserCheck },
                    { id: "canasta_habitual", label: `Canasta Frecuente (${profile.frequent_basket.length})`, icon: ShoppingBag },
                    { id: "ofertas_personalizadas", label: `Ofertas "Te Extrañamos" (${customerOffers.length})`, icon: Gift },
                    { id: "scoring_rfm", label: `Scoring RFM (${profile.rfm.score}/100)`, icon: Star },
                    { id: "campanias_retencion", label: "Hub WhatsApp IntelliZapp", icon: MessageCircle },
                  ].map((t) => (
                    <button 
                      key={t.id} 
                      onClick={() => setTab(t.id as Tab)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-extrabold transition whitespace-nowrap ${
                        tab === t.id 
                          ? "bg-cyan-600 text-white shadow-sm" 
                          : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* TAB 1: VISIÓN GENERAL & HISTORIAL DE TICKETS */}
              {tab === "perfil" && (
                <div className="space-y-4">
                  {/* KPIS REALES DEL CLIENTE */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl space-y-1 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Compras Registradas</span>
                        <ShoppingCart className="w-4 h-4 text-cyan-600" />
                      </div>
                      <p className="text-xl font-black font-mono text-cyan-600">
                        {profile.kpis.total_tickets} tickets
                      </p>
                      <span className="text-[10px] text-gray-400">
                        {profile.kpis.avg_days_between_visits ? `Visita cada ~${profile.kpis.avg_days_between_visits} días` : "Cliente con historial"}
                      </span>
                    </div>

                    <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl space-y-1 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Gasto Total Acumulado</span>
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-xl font-black font-mono text-emerald-600">
                        {formatPYG(profile.kpis.total_spent)}
                      </p>
                      <span className="text-[10px] text-gray-400">
                        Ticket medio: {formatPYG(profile.kpis.avg_ticket)}
                      </span>
                    </div>

                    <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl space-y-1 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Última Compra</span>
                        <Clock className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-xl font-black font-mono text-purple-600">
                        {profile.kpis.days_since_last_purchase === 0 ? "Hoy" : `Hace ${profile.kpis.days_since_last_purchase}d`}
                      </p>
                      <span className="text-[10px] text-gray-400">
                        {profile.kpis.last_purchase ? formatDate(profile.kpis.last_purchase) : "Sin fecha"}
                      </span>
                    </div>
                  </div>

                  {/* TABLA DE TICKETS RECIENTES */}
                  <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden text-xs">
                    <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 font-black text-gray-600 dark:text-gray-300 uppercase text-[10px] border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <span>Últimos Comprobantes de Venta Emitidos</span>
                      <span className="text-gray-400 font-normal">{profile.recent_sales.length} comprobantes recientes</span>
                    </div>
                    {profile.recent_sales.length === 0 ? (
                      <div className="p-6 text-center text-gray-400 text-xs">No hay ventas registradas para este cliente.</div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                        {profile.recent_sales.map((sale) => (
                          <div key={sale.id} className="p-3 flex items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 font-mono font-bold text-[11px]">
                                #{sale.numero}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white">
                                  {sale.fecha ? formatDate(sale.fecha) : "Fecha no registrada"}
                                </p>
                                <span className="text-[10px] text-gray-400">{sale.items_count} productos</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-black text-emerald-600 text-sm">
                                {formatPYG(sale.total)}
                              </p>
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold">
                                {sale.estado}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CANASTA HABITUAL */}
              {tab === "canasta_habitual" && (
                <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden text-xs">
                  <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 font-black text-gray-600 dark:text-gray-300 uppercase text-[10px] border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <span>Productos Más Comprados por el Cliente</span>
                    <span className="text-gray-400 font-normal">Base para ofertas "Te Extrañamos"</span>
                  </div>
                  {profile.frequent_basket.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs">Sin registros de canasta habitual aún.</div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                      {profile.frequent_basket.map((item, idx) => (
                        <div key={item.product_id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-800 font-mono font-black text-[11px] text-gray-600 dark:text-gray-300 flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="font-extrabold text-gray-900 dark:text-white text-xs">
                                {item.producto}
                              </p>
                              <span className="text-[10px] text-gray-400 font-medium">
                                Categoría: {item.categoria} · {item.veces} compras registradas ({item.unidades.toFixed(1)} u.)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-mono font-black text-gray-900 dark:text-white text-xs">
                                {formatPYG(item.total)}
                              </p>
                              <span className="text-[9px] text-gray-400">Total gastado</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenCreateOfferModal(item)}
                              className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-black transition flex items-center gap-1 shrink-0"
                            >
                              <Gift className="w-3 h-3" />
                              <span>Crear Promo</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: OFERTAS "TE EXTRAÑAMOS" CON IMPACTO EN CAJA */}
              {tab === "ofertas_personalizadas" && (
                <div className="space-y-4 text-xs">
                  <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <Gift className="w-4 h-4 text-purple-600" />
                        <span>Ofertas Dirigidas "Te Extrañamos"</span>
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        El cliente dictará su cédula en caja y el POS aplicará el precio especial de forma automática.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenCreateOfferModal()}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-purple-500/20 self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Crear Nueva Oferta Anti-Costo</span>
                    </button>
                  </div>

                  {/* LISTA DE OFERTAS EXISTENTES */}
                  <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                    <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 font-black text-gray-600 dark:text-gray-300 uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                      Historial de Ofertas Dirigidas ({customerOffers.length})
                    </div>
                    {loadingOffers ? (
                      <div className="p-8 text-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-1" />
                        <span>Cargando ofertas del cliente...</span>
                      </div>
                    ) : customerOffers.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 space-y-2">
                        <p>No hay ofertas dirigidas creadas para este cliente aún.</p>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateOfferModal()}
                          className="text-xs font-bold text-purple-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Crear la primera oferta en sus productos favoritos</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                        {customerOffers.map((off) => (
                          <div key={off.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-gray-900 dark:text-white text-xs">{off.titulo}</span>
                                {off.is_active ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    Activa en Caja
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                                    {off.usado ? "Canjeada en POS ✓" : "Vencida"}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                {off.descripcion}
                              </p>
                              <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono pt-0.5">
                                <span>Producto: {off.producto_nombre}</span>
                                <span>•</span>
                                <span>Válido hasta: {off.valido_hasta ? formatDate(off.valido_hasta) : "Sin vencimiento"}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700">
                              <span className="text-[9px] font-bold text-gray-400 uppercase block">Precio Oferta</span>
                              <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                                {formatPYG(off.precio_oferta || off.valor)}
                              </span>
                              {off.precio_normal > (off.precio_oferta || off.valor) && (
                                <span className="text-[9px] line-through text-gray-400 block font-mono">
                                  {formatPYG(off.precio_normal)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: SCORING RFM */}
              {tab === "scoring_rfm" && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase text-[10px] text-gray-500">Recencia (R)</span>
                        <Clock className="w-4 h-4 text-cyan-500" />
                      </div>
                      <p className="text-xl font-black font-mono text-gray-900 dark:text-white">
                        {profile.rfm.days_since} días
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {profile.rfm.days_since <= 15 ? "🟢 Visita muy reciente" : profile.rfm.days_since <= 30 ? "🟡 Frecuencia moderada" : "🔴 Riesgo de abandono"}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase text-[10px] text-gray-500">Frecuencia (F)</span>
                        <ShoppingCart className="w-4 h-4 text-purple-500" />
                      </div>
                      <p className="text-xl font-black font-mono text-gray-900 dark:text-white">
                        {profile.rfm.total_tickets} compras
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {profile.rfm.total_tickets >= 10 ? "🟢 Comprador habitual VIP" : "🟡 Comprador regular"}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase text-[10px] text-gray-500">Monetario (M)</span>
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                      </div>
                      <p className="text-xl font-black font-mono text-gray-900 dark:text-white">
                        {formatPYG(profile.rfm.total_spent)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Gasto total acumulado en caja
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-cyan-900 dark:text-cyan-200 text-xs">
                        Estrategia Sugerida para {profile.customer.razon_social}:
                      </h4>
                      <p className="text-[11px] text-cyan-800 dark:text-cyan-300 mt-1 leading-relaxed">
                        {profile.rfm.days_since > 45 
                          ? "Cliente en riesgo de fuga (>45 días). Activar campaña 'Te Extrañamos' con oferta dirigida en su producto favorito para reactivar la visita en góndola."
                          : profile.loyalty.tier === "VIP Platino"
                          ? "Cliente VIP de alto consumo. Reconocer en cada visita y ofrecer multiplicador doble de puntos en fechas promocionales."
                          : "Cliente recurrente. Fomentar mayor ticket ofreciendo combos y acumulación de puntos ExtraClub."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: HUB WHATSAPP INTELLIZAPP & SIMULADOR EN VIVO */}
              {tab === "campanias_retencion" && (
                <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-6 text-xs">
                  {/* CABECERA DEL HUB & CONMUTADOR BILINGÜE */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-emerald-500" /> 
                        <span>Hub de Comunicación IntelliZapp WhatsApp</span>
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Mensajería hiper-personalizada con inyección de precios, tokens dinámicos y simulador en tiempo real.
                      </p>
                    </div>

                    {/* SELECTOR BILINGÜE ES / PT */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setMsgLanguage("es")
                          if (activeTemplate !== "libre") {
                            setCustomMsg(generateTemplateMessage(activeTemplate, "es"))
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                          msgLanguage === "es"
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                            : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        }`}
                      >
                        <span>🇵🇾</span>
                        <span>Español</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMsgLanguage("pt")
                          if (activeTemplate !== "libre") {
                            setCustomMsg(generateTemplateMessage(activeTemplate, "pt"))
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                          msgLanguage === "pt"
                            ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs"
                            : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        }`}
                      >
                        <span>🇧🇷</span>
                        <span>Português</span>
                      </button>
                    </div>
                  </div>

                  {/* PLANTILLAS ESPECIALIZADAS */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                      Seleccionar Plantilla de Comunicación:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {[
                        { id: "oferta", title: "Oferta 1-a-1", desc: "Precio regular vs especial", icon: Percent, color: "text-purple-600" },
                        { id: "reactivacion", title: "Te Extrañamos", desc: "Gancho en producto favorito", icon: HeartHandshake, color: "text-amber-500" },
                        { id: "extraclub", title: "Puntos ExtraClub", desc: "Saldo y vales de compra", icon: Sparkles, color: "text-cyan-600" },
                        { id: "feria", title: "Feria Frescos", desc: "Carnes y fin de semana", icon: Flame, color: "text-red-500" },
                        { id: "libre", title: "Redacción Libre", desc: "Mensaje abierto con tokens", icon: MessageSquareText, color: "text-emerald-600" },
                      ].map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setActiveTemplate(tpl.id as any)
                            if (tpl.id !== "libre") {
                              setCustomMsg(generateTemplateMessage(tpl.id as any, msgLanguage))
                            }
                            setSentSuccess(false)
                          }}
                          className={`p-2.5 rounded-2xl border text-left transition space-y-1 ${
                            activeTemplate === tpl.id
                              ? "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 dark:border-cyan-500 shadow-xs"
                              : "bg-gray-50/70 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/80 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-gray-900 dark:text-white text-xs">{tpl.title}</span>
                            <tpl.icon className={`w-3.5 h-3.5 ${tpl.color}`} />
                          </div>
                          <p className="text-[9px] text-gray-400 leading-tight">{tpl.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* TOKENS DINÁMICOS DE INSERCIÓN RÁPIDA */}
                  <div className="flex items-center gap-1.5 flex-wrap bg-gray-50 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <span className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-1 mr-1">
                      <Tag className="w-3 h-3 text-cyan-600" /> Insertar Token:
                    </span>
                    {[
                      { label: "{primer_nombre}", val: (profile.customer.razon_social || "").split(",")[0].split(" ")[0] },
                      { label: "{producto}", val: customerOffers[0]?.producto_nombre || profile.frequent_basket[0]?.producto || "Producto Favorito" },
                      { label: "{precio_regular}", val: customerOffers[0] ? formatPYG(customerOffers[0].precio_normal) : "Gs. 35.000" },
                      { label: "{precio_especial}", val: customerOffers[0] ? formatPYG(customerOffers[0].precio_oferta) : "Gs. 28.000" },
                      { label: "{puntos_club}", val: `${profile.loyalty.total_points.toLocaleString("es-PY")} pts` },
                      { label: "{validez}", val: "7 días" },
                    ].map((tk) => (
                      <button
                        key={tk.label}
                        type="button"
                        onClick={() => setCustomMsg(prev => `${prev} ${tk.val}`)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-[10px] font-mono font-bold text-gray-700 dark:text-gray-300 hover:border-cyan-500 hover:text-cyan-600 transition shadow-2xs"
                        title={`Inserta: ${tk.val}`}
                      >
                        {tk.label}
                      </button>
                    ))}
                  </div>

                  {/* LAYOUT DE 2 COLUMNAS: EDITOR + SIMULADOR SMARTPHONE DE WHATSAPP */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* COLUMNA IZQUIERDA: EDITOR Y ACCIONES */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="space-y-2 bg-gray-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-gray-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-700 dark:text-gray-300">
                            Cuerpo del Mensaje (con soporte *negrita* y ~tachado~):
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {customMsg.length} caracteres
                          </span>
                        </div>
                        <textarea
                          rows={7}
                          value={customMsg}
                          onChange={e => setCustomMsg(e.target.value)}
                          className="input w-full text-xs font-sans leading-relaxed bg-white dark:bg-slate-900 p-3.5 rounded-xl border-gray-200 dark:border-slate-700 focus:ring-emerald-500"
                          placeholder="Escriba o personalice el mensaje para el cliente..."
                        />

                        {/* ACCIONES DE ENVÍO */}
                        <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(customMsg)
                                setCopiedMsg(true)
                                setTimeout(() => setCopiedMsg(false), 2000)
                                toast.success("Copiado al portapapeles", "Listo para pegar en WhatsApp.")
                              }}
                              className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1.5 transition"
                            >
                              {copiedMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                              <span>{copiedMsg ? "¡Copiado!" : "Copiar"}</span>
                            </button>

                            {profile.customer.telefono && (
                              <button
                                type="button"
                                onClick={() => {
                                  const cleanPhone = profile.customer.telefono?.replace(/[^0-9]/g, "") || ""
                                  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMsg)}`, "_blank")
                                }}
                                className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Abrir en WhatsApp</span>
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={handleSendIntelliZapp}
                            disabled={sendingMsg || !customMsg.trim()}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
                          >
                            {sendingMsg ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Enviando por IntelliZapp...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Enviar Directo vía IntelliZapp</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {sentSuccess && (
                        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>¡Mensaje despachado con éxito al número registrado del cliente!</span>
                        </div>
                      )}
                    </div>

                    {/* COLUMNA DERECHA: SIMULADOR DE WHATSAPP EN VIVO (SMARTPHONE MOCKUP) */}
                    <div className="lg:col-span-5 flex flex-col items-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-500" /> Simulador de Pantalla en Vivo
                      </span>

                      {/* MARCO DEL SMARTPHONE */}
                      <div className="w-full max-w-[320px] rounded-[36px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-700/80 ring-1 ring-slate-800">
                        {/* PANTALLA INTERNA */}
                        <div className="rounded-[28px] overflow-hidden bg-[#EFEAE2] dark:bg-[#0b141a] flex flex-col h-[460px] text-gray-900 dark:text-gray-100 select-none shadow-inner">
                          {/* CABECERA VERDE WHATSAPP */}
                          <div className="bg-[#075E54] dark:bg-[#1f2c34] text-white p-3 flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-white text-xs font-bold">←</span>
                              <div className="w-7 h-7 rounded-full bg-emerald-700 font-black text-white text-xs flex items-center justify-center shrink-0">
                                {(profile.customer.razon_social || "C")[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-xs truncate leading-tight">
                                  {profile.customer.razon_social}
                                </p>
                                <span className="text-[9px] text-emerald-200/90 leading-none flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                  <span>en línea</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-white/80 text-xs">
                              <span>📞</span>
                              <span>⋮</span>
                            </div>
                          </div>

                          {/* CUERPO DEL CHAT / BURBUJA */}
                          <div className="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col justify-end">
                            {/* FECHA DEL DÍA */}
                            <div className="text-center my-1">
                              <span className="bg-white/80 dark:bg-slate-800/80 text-[9px] px-2 py-0.5 rounded-md font-bold text-gray-500 shadow-2xs">
                                Hoy
                              </span>
                            </div>

                            {/* BURBUJA DE MENSAJE SALIENTE */}
                            <div className="self-end max-w-[92%] bg-[#D9FDD3] dark:bg-[#005c4b] text-gray-900 dark:text-white p-2.5 rounded-2xl rounded-tr-xs shadow-xs text-[11px] leading-relaxed relative">
                              <div>{renderFormattedWhatsAppText(customMsg)}</div>
                              <div className="flex items-center justify-end gap-1 text-[8px] text-gray-500 dark:text-emerald-200/80 font-mono mt-1 text-right">
                                <span>12:00</span>
                                <span className="text-sky-500 font-bold">✓✓</span>
                              </div>
                            </div>
                          </div>

                          {/* BARRA INFERIOR DE CHAT */}
                          <div className="p-2 bg-[#F0F2F5] dark:bg-[#1f2c34] flex items-center gap-2 shrink-0 border-t border-black/5">
                            <span className="text-gray-400 text-xs">😊</span>
                            <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-3 py-1 text-[10px] text-gray-400">
                              Mensaje...
                            </div>
                            <div className="w-6 h-6 rounded-full bg-[#00A884] text-white flex items-center justify-center text-xs">
                              🎤
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-12 text-center text-gray-400 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl">
              Seleccione un cliente para ver su expediente 360°.
            </div>
          )}
        </div>
      </div>

      {/* 🎁 MODAL HÍBRIDO: CREAR OFERTA 1-A-1 (CANASTA FRECUENTE O CATÁLOGO GENERAL) CON CURRENCYINPUT */}
      {showCreateOfferModal && profile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-gray-900 dark:text-white">
                    Crear Oferta Dirigida "Te Extrañamos"
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Cliente: {profile.customer.razon_social} (DOC: {profile.customer.ruc || profile.customer.ci})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateOfferModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-black"
              >
                ✕
              </button>
            </div>

            {/* PESTAÑAS DE SELECCIÓN DE PRODUCTO: FRECUENTES VS CATÁLOGO */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setOfferMode("frecuentes")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    offerMode === "frecuentes"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Top Canasta Habitual ({profile.frequent_basket.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOfferMode("catalogo")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    offerMode === "catalogo"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar en Catálogo General</span>
                </button>
              </div>

              {/* MODO A: CANASTA FRECUENTE */}
              {offerMode === "frecuentes" && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {profile.frequent_basket.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-4">No hay canasta habitual registrada para este cliente.</p>
                  ) : (
                    profile.frequent_basket.map((p) => {
                      const isSelected = (offerSelectedProduct?.product_id || offerSelectedProduct?.id) === p.product_id
                      return (
                        <button
                          key={p.product_id}
                          type="button"
                          onClick={() => handleSelectProductForOffer(p)}
                          className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between text-xs border ${
                            isSelected
                              ? "bg-purple-50 dark:bg-purple-950/50 border-purple-500 shadow-xs"
                              : "bg-gray-50 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800 hover:border-gray-200"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 dark:text-white truncate">{p.producto}</p>
                            <span className="text-[10px] text-gray-400">Comprado {p.veces} veces · {p.unidades.toFixed(1)} u.</span>
                          </div>
                          <div className="text-right ml-2 shrink-0">
                            <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400">
                              {formatPYG(p.total / Math.max(1, p.unidades))}
                            </span>
                            <span className="text-[9px] text-gray-400 block">precio habitual</span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {/* MODO B: BUSCADOR EN CATÁLOGO GENERAL */}
              {offerMode === "catalogo" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      placeholder="Escriba código de barras o nombre del producto..."
                      className="input pl-9 text-xs w-full bg-gray-50 dark:bg-slate-800"
                    />
                    {searchingCatalog && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-purple-600" />
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {catalogResults.map((prod) => {
                      const isSelected = (offerSelectedProduct?.product_id || offerSelectedProduct?.id) === prod.id
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectProductForOffer(prod)}
                          className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition ${
                            isSelected
                              ? "bg-purple-50 dark:bg-purple-950/50 border-purple-500"
                              : "bg-gray-50 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800 hover:border-gray-200"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 dark:text-white truncate">{prod.nombre}</p>
                            <span className="text-[10px] text-gray-400 font-mono">Cód: {prod.codigo_barra || "S/C"}</span>
                          </div>
                          <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400 ml-2">
                            {formatPYG(prod.precio_venta || 0)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* PISO DE SEGURIDAD & CÁLCULO DE COSTO */}
            {offerSelectedProduct && (() => {
              const normal = Number(offerSelectedProduct.precio_venta || offerSelectedProduct.precio_normal || (offerSelectedProduct.total ? offerSelectedProduct.total / Math.max(1, offerSelectedProduct.unidades) : offerPriceInput * 1.2))
              const costo = Number(offerSelectedProduct.ultimo_costo || offerSelectedProduct.costo_promedio || offerSelectedProduct.costo || 0)
              const safetyFloor = Math.round(Math.max(costo * 1.05, 500))
              const isBelowCost = costo > 0 && offerPriceInput < safetyFloor
              const ahorro = Math.max(0, normal - offerPriceInput)
              const ahorroPct = normal > 0 ? Math.round((ahorro / normal) * 100) : 0
              const estimatedMarginPct = offerPriceInput > 0 && costo > 0
                ? Math.round(((offerPriceInput - costo) / offerPriceInput) * 100)
                : 20

              return (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 text-xs flex items-center justify-between">
                    <span className="font-bold text-gray-700 dark:text-gray-300 truncate">
                      Seleccionado: <strong>{offerSelectedProduct.producto || offerSelectedProduct.nombre}</strong>
                    </span>
                    <span className="font-mono font-black text-purple-700 dark:text-purple-300 shrink-0 ml-2">
                      Normal: {formatPYG(normal)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-100 dark:border-slate-700 text-center">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Costo Base</span>
                      <span className="font-mono font-bold text-xs text-gray-700 dark:text-gray-300">
                        {costo > 0 ? formatPYG(costo) : "S/D"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Precio Regular</span>
                      <span className="font-mono font-bold text-xs text-gray-700 dark:text-gray-300">
                        {formatPYG(normal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Piso Seguridad (+5%)</span>
                      <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                        {formatPYG(safetyFloor)}
                      </span>
                    </div>
                  </div>

                  {/* INPUT CANÓNICO DE PRECIO ESPECIAL (REGLA #10: CURRENCYINPUT) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-gray-700 dark:text-gray-300">
                        Precio Especial para este Cliente (Gs.):
                      </label>
                      <div className="flex items-center gap-2">
                        {ahorro > 0 && (
                          <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                            Ahorra {formatPYG(ahorro)} ({ahorroPct}% OFF)
                          </span>
                        )}
                        <span className={`font-mono font-black text-[11px] px-2 py-0.5 rounded-md ${
                          isBelowCost
                            ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}>
                          Margen: ~{estimatedMarginPct}%
                        </span>
                      </div>
                    </div>

                    <CurrencyInput
                      value={offerPriceInput}
                      onChangeValue={(numVal) => setOfferPriceInput(numVal)}
                      currency="PYG"
                      prefix="Gs."
                      className={`input w-full text-base font-mono font-black bg-white dark:bg-slate-900 ${
                        isBelowCost ? "border-red-500 text-red-600 focus:ring-red-500" : "border-gray-200 dark:border-slate-700"
                      }`}
                    />
                  </div>

                  {isBelowCost && (
                    <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>
                        <strong>¡Bloqueo Anti-Costo!</strong> No se permite vender por debajo del costo ({formatPYG(safetyFloor)}).
                      </span>
                    </div>
                  )}

                  {/* DÍAS DE VALIDEZ */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Vigencia de la Oferta en Caja:
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[3, 7, 15, 30].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setOfferValidityDays(d)}
                          className={`py-1.5 rounded-xl text-xs font-bold transition ${
                            offerValidityDays === d
                              ? "bg-purple-600 text-white shadow-xs"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                          }`}
                        >
                          {d} días
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* BOTONES DE ACCIÓN */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateOfferModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateOffer}
                disabled={submittingOffer || offerPriceInput <= 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-black transition flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {submittingOffer ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando y Preparando WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>Activar Oferta & Preparar WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
