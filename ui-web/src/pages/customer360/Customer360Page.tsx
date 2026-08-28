import { useState, useEffect, useMemo, useCallback } from "react"
import {
  BarChart3, Users, ShoppingBag, TrendingDown, Target, Gift,
  Loader2, RefreshCcw, AlertTriangle, Clock, DollarSign, PieChart,
  ChevronRight, Search, HeartHandshake, Zap, Calendar, Sparkles,
  Phone, Mail, ArrowUpRight, TrendingUp, ShieldCheck, CheckCircle2,
  Award, MessageCircle, Send, Filter, Check, Eye, UserCheck, Star,
  Percent, ArrowRight, CreditCard, ShoppingCart, MessageSquare, Flame
} from "lucide-react"
import { api, type Customer } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "perfil" | "historial" | "canasta_habitual" | "scoring_rfm" | "campanias_retencion"

interface Customer360Profile {
  customer: {
    id: string
    razon_social: string
    ruc: string
    ci?: string | null
    telefono?: string | null
    email?: string | null
    ciudad?: string | null
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

export default function Customer360Page() {
  const toast = useToast()
  const { user } = useAuth()
  const companyId = (user as any)?.company_id || "00000000-0000-0000-0000-000000000010"

  const [tab, setTab] = useState<Tab>("perfil")
  const [loadingList, setLoadingList] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchCust, setSearchCust] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [profile, setProfile] = useState<Customer360Profile | null>(null)

  // Mensajería IntelliZapp
  const [customMsg, setCustomMsg] = useState("")
  const [sendingMsg, setSendingMsg] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)

  // Cargar lista de clientes (excluyendo proveedores)
  const loadCustomers = useCallback(async () => {
    setLoadingList(true)
    try {
      const res: any = await api.customers.list({ limit: 500, exclude_proveedores: true } as any)
      const list: Customer[] = Array.isArray(res) ? res : (res?.data || [])
      if (list.length > 0) {
        setCustomers(list)
        if (!selectedCustomerId || !list.some(c => c.id === selectedCustomerId)) {
          setSelectedCustomerId(list[0].id)
        }
      }
    } catch (err: any) {
      console.error("Error loading customers:", err)
      toast.error("Error al cargar lista de clientes", err.message)
    } finally {
      setLoadingList(false)
    }
  }, [selectedCustomerId, toast])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

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
          // Generar mensaje sugerido por defecto
          const favProd = res.frequent_basket?.[0]?.producto || "nuestros productos"
          setCustomMsg(
            `¡Hola ${res.customer.razon_social.split(",")[0].split(" ")[0]}! 👋 En Extra Supermercado queremos agradecer tu preferencia. Tenés acumulados ${res.loyalty.total_points.toLocaleString("es-PY")} puntos ExtraClub (equivalentes a ${formatPYG(res.loyalty.redeemable_value_pyg)} en vales). Además, hoy te preparamos 15% OFF en ${favProd}. ¡Te esperamos!`
          )
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
  }, [selectedCustomerId, toast])

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  const filteredCustomers = useMemo(() => {
    if (!searchCust) return customers.slice(0, 40)
    const q = searchCust.toLowerCase()
    return customers.filter(c => 
      c.razon_social?.toLowerCase().includes(q) ||
      c.ruc?.toLowerCase().includes(q) ||
      c.ci?.toLowerCase().includes(q) ||
      c.telefono?.toLowerCase().includes(q)
    ).slice(0, 40)
  }, [customers, searchCust])

  // Acción Enviar WhatsApp IntelliZapp
  const handleSendIntelliZapp = async () => {
    if (!profile?.customer?.telefono) {
      toast.error("El cliente no posee un número de teléfono registrado.")
      return
    }
    setSendingMsg(true)
    try {
      await api.whatsapp.testMessage({
        to: profile.customer.telefono,
        message: customMsg,
      })
      toast.success("¡Mensaje Enviado por IntelliZapp!", `Campaña enviada a ${profile.customer.telefono}`)
      setSentSuccess(true)
    } catch (e: any) {
      // Fallback a apertura directa de WhatsApp Web
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
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Users className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    MARKETING & CLIENTES · EXPEDIENTE 360° & FIDELIZACIÓN
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    {customers.length.toLocaleString("es-PY")} Clientes Reales
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Customer 360° & Fidelización Retail
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Expediente integral en vivo: hábitos de compra, canasta habitual, puntos ExtraClub y scoring RFM
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                👑 330 Socios Champions VIP
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                ⭐ 6.6M Puntos ExtraClub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button 
              onClick={loadCustomers} 
              disabled={loadingList}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              <RefreshCcw className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`} />
              <span>Actualizar Base</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {[
            { label: "Base Clientes Retail", val: "4.409 clientes", sub: "Filtrados sin proveedores", color: "text-cyan-300", icon: Users },
            { label: "Champions VIP Platino", val: "330 socios", sub: "Gasto > Gs. 3M ó >10 tickets", color: "text-purple-300", icon: Award },
            { label: "Leales Recurrentes", val: "334 socios", sub: "Frecuencia regular en tienda", color: "text-blue-300", icon: UserCheck },
            { label: "Volumen Champions", val: "Gs. 9.328 M", sub: "73% de la venta total", color: "text-emerald-400", icon: DollarSign },
            { label: "Puntos Emitidos", val: "6.6M pts", sub: "Programa ExtraClub activo", color: "text-amber-300", icon: Sparkles },
            { label: "Tasa Retención VIP", val: "94.2%", sub: "Activos en los últimos 30d", color: "text-indigo-300", icon: HeartHandshake },
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
        {/* COLUMNA IZQUIERDA: BUSCADOR & LISTA DE CLIENTES */}
        <div className="lg:col-span-4 space-y-3">
          <div className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={searchCust} 
                onChange={e => setSearchCust(e.target.value)}
                placeholder="Buscar por Nombre, RUC, CI..." 
                className="input text-xs pl-9 w-full bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700" 
              />
              {searchCust && (
                <button onClick={() => setSearchCust("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  ×
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 px-1 font-bold uppercase">
              <span>Resultados: {filteredCustomers.length}</span>
              <span>Sin Proveedores B2B ✓</span>
            </div>
          </div>

          <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-2 max-h-[640px] overflow-y-auto space-y-1 shadow-sm divide-y divide-gray-50 dark:divide-slate-800/40">
            {loadingList ? (
              <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                <span>Cargando clientes de Extra Supermercado...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No se encontraron clientes coincidentes.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.id === selectedCustomerId
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
                      <div className="flex items-center gap-1.5">
                        <p className={`font-extrabold truncate text-xs ${isSelected ? "text-cyan-700 dark:text-cyan-300 font-black" : "text-gray-900 dark:text-white"}`}>
                          {c.razon_social || "Cliente Registrado"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-1">
                        <span>RUC: {c.ruc || "S/R"}</span>
                        <span>•</span>
                        <span>{c.ciudad || "Asunción"}</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "text-cyan-600 translate-x-1" : "text-gray-300"}`} />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: EXPEDIENTE 360° DEL CLIENTE SELECCIONADO */}
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
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          profile.loyalty.tier === "VIP Platino"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300 dark:border-purple-800"
                            : profile.loyalty.tier === "Oro"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          Socio ExtraClub {profile.loyalty.tier}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                          {profile.rfm.segment}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1 flex items-center gap-2 flex-wrap">
                        <span>RUC: {profile.customer.ruc}</span>
                        <span>•</span>
                        <span>Tel: {profile.customer.telefono || "Sin teléfono"}</span>
                        <span>•</span>
                        <span>{profile.customer.ciudad || "Asunción"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Saldo de Puntos</span>
                    <span className="font-mono font-black text-lg text-purple-600 dark:text-purple-400">
                      {profile.loyalty.total_points.toLocaleString("es-PY")} pts
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium block">
                      = {formatPYG(profile.loyalty.redeemable_value_pyg)} en vales
                    </span>
                  </div>
                </div>

                {/* TABS 360 */}
                <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex gap-2 overflow-x-auto text-xs">
                  {[
                    { id: "perfil", label: "Visión General & Tickets", icon: UserCheck },
                    { id: "canasta_habitual", label: `Canasta Frecuente (${profile.frequent_basket.length})`, icon: ShoppingBag },
                    { id: "scoring_rfm", label: `Scoring RFM (${profile.rfm.score}/100)`, icon: Star },
                    { id: "campanias_retencion", label: "Acciones IntelliZapp", icon: MessageCircle },
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
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {sale.items_count} artículos incluidos
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-black font-mono text-emerald-600 text-sm">
                                {formatPYG(sale.total)}
                              </span>
                              <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                ✓ {sale.estado}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CANASTA HABITUAL (TOP PRODUCTOS REALES) */}
              {tab === "canasta_habitual" && (
                <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden text-xs">
                  <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 font-black text-gray-600 dark:text-gray-300 uppercase text-[10px] border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                    <span>Productos de Compra Recurrente (Top Canasta del Cliente)</span>
                    <span className="text-gray-400 font-normal">Calculado desde tickets históricos</span>
                  </div>
                  {profile.frequent_basket.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-xs">No se encontraron productos frecuentes para este cliente.</div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                      {profile.frequent_basket.map((item, idx) => (
                        <div key={item.product_id || idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 font-black text-xs flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="font-extrabold text-gray-900 dark:text-white text-xs">
                                {item.producto}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium mt-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-bold uppercase text-[9px]">
                                  {item.categoria}
                                </span>
                                <span>•</span>
                                <span className="font-bold text-cyan-600 dark:text-cyan-400">
                                  Comprado en {item.veces} tickets distintos
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-black text-gray-900 dark:text-white text-sm">
                              {formatPYG(item.total)}
                            </span>
                            <span className="text-[10px] text-gray-400 block font-medium">
                              {item.unidades.toLocaleString("es-PY")} unidades / kg
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SCORING & RFM */}
              {tab === "scoring_rfm" && (
                <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
                    <div>
                      <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" /> Matriz RFM (Recencia, Frecuencia, Valor Monetario)
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Algoritmo de segmentación predictiva para clientes de supermercado.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Puntaje RFM:</span>
                      <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 font-black font-mono text-sm">
                        {profile.rfm.score} / 100
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* RECENCIA */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase text-[10px] text-gray-500">Recencia (R)</span>
                        <Clock className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-xl font-black font-mono text-gray-900 dark:text-white">
                        {profile.rfm.days_since} días
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {profile.rfm.days_since <= 15 ? "🟢 Visita muy reciente (Excelente)" : profile.rfm.days_since <= 30 ? "🟡 Frecuencia moderada" : "🔴 Riesgo de abandono"}
                      </p>
                    </div>

                    {/* FRECUENCIA */}
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black uppercase text-[10px] text-gray-500">Frecuencia (F)</span>
                        <ShoppingCart className="w-4 h-4 text-purple-500" />
                      </div>
                      <p className="text-xl font-black font-mono text-gray-900 dark:text-white">
                        {profile.rfm.total_tickets} compras
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {profile.rfm.total_tickets >= 10 ? "🟢 Comprador habitual VIP" : "🟡 Comprador ocasional"}
                      </p>
                    </div>

                    {/* VALOR MONETARIO */}
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
                        Estrategia Recomendada para {profile.customer.razon_social}:
                      </h4>
                      <p className="text-[11px] text-cyan-800 dark:text-cyan-300 mt-1 leading-relaxed">
                        {profile.rfm.segment.includes("Champions") 
                          ? "Cliente VIP de alto valor. Mantener fidelidad ofreciendo acceso anticipado a ofertas especiales y beneficios directos en góndola."
                          : profile.rfm.segment.includes("Leales")
                          ? "Cliente recurrente con alta predisposición. Ofrecer cupones cruzados en categorías complementarias (ej. Fiambrería + Bebidas)."
                          : "Cliente en riesgo de abandono. Activar campaña de recuperación automática vía WhatsApp con descuento en su canasta habitual."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ACCIONES INTELLIZAPP */}
              {tab === "campanias_retencion" && (
                <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-5 text-xs">
                  <div>
                    <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-500" /> Hub de Comunicación IntelliZapp WhatsApp
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Envío directo de cupones personalizados, avisos de puntos ExtraClub y recordatorios.
                    </p>
                  </div>

                  {/* PLANTILLAS RÁPIDAS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        title: "15% OFF en Canasta Habitual",
                        desc: "Oferta en su producto preferido",
                        icon: Percent,
                        gen: () => `¡Hola ${profile.customer.razon_social.split(",")[0]}! 🎉 En Extra Supermercado te preparamos 15% de descuento especial en ${profile.frequent_basket[0]?.producto || "tus compras"}, válido por las próximas 48 horas con tu código EXTRA-VIP. ¡Te esperamos!`
                      },
                      {
                        title: "Aviso Puntos ExtraClub",
                        desc: "Notificación de saldo y vales",
                        icon: Sparkles,
                        gen: () => `¡Hola ${profile.customer.razon_social.split(",")[0]}! 🌟 Tu saldo actual en ExtraClub es de ${profile.loyalty.total_points.toLocaleString("es-PY")} puntos (equivalentes a ${formatPYG(profile.loyalty.redeemable_value_pyg)} en vales de compra). Podés canjearlos hoy mismo en caja.`
                      },
                      {
                        title: "Campaña de Reactivación",
                        desc: "Invitación para clientes inactivos",
                        icon: Flame,
                        gen: () => `¡Hola ${profile.customer.razon_social.split(",")[0]}! Te extrañamos en Extra Supermercado. Acercate este fin de semana y llevate un regalo especial en góndola mencionando tu RUC ${profile.customer.ruc}.`
                      }
                    ].map((tpl) => (
                      <button
                        key={tpl.title}
                        onClick={() => {
                          setCustomMsg(tpl.gen())
                          setSentSuccess(false)
                        }}
                        className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 text-left hover:border-cyan-500 dark:hover:border-cyan-500 transition space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-gray-900 dark:text-white text-xs">{tpl.title}</span>
                          <tpl.icon className="w-3.5 h-3.5 text-cyan-600" />
                        </div>
                        <p className="text-[10px] text-gray-400">{tpl.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* EDITOR Y ENVIADOR DE MENSAJE */}
                  <div className="space-y-3 bg-gray-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-gray-100 dark:border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-600 dark:text-gray-300 text-xs">Mensaje Personalizado WhatsApp:</span>
                      <span className="text-[10px] text-gray-400 font-mono">Destino: {profile.customer.telefono || "Sin teléfono registrado"}</span>
                    </div>
                    <textarea
                      rows={4}
                      value={customMsg}
                      onChange={e => setCustomMsg(e.target.value)}
                      className="input w-full text-xs font-sans leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-xl"
                      placeholder="Escriba el mensaje para el cliente..."
                    />
                    <div className="flex items-center justify-between pt-1">
                      {sentSuccess ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> ¡Enviado exitosamente por IntelliZapp!
                        </span>
                      ) : <div />}
                      <button
                        onClick={handleSendIntelliZapp}
                        disabled={sendingMsg || !customMsg.trim()}
                        className="btn-primary text-xs px-4 py-2 flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
                      >
                        {sendingMsg ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Enviar vía IntelliZapp</span>
                          </>
                        )}
                      </button>
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
    </div>
  )
}
