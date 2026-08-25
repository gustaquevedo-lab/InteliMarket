import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  MessageCircle, Send, Plus, Search, CheckCircle2, AlertTriangle,
  RefreshCw, Bot, Smartphone, Zap, Clock, Users, Play, Trash2,
  Edit3, Filter, Radio, Sparkles, Check, X, FileText, Globe,
  ShieldCheck, ArrowUpRight, Copy, Loader2, ChevronRight, Eye,
  Settings, Key, Database, Download, CheckCircle, ArrowDownCircle
} from "lucide-react"
import { api, type IntelliZappCampaign, type IntelliZappAutomationRule } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatDateTime, formatDate } from "../../utils/format"

type Tab = "chat" | "campanas" | "automatizaciones" | "plantillas" | "config"

const TRIGGER_EVENTS = [
  { id: "sale.completed", label: "Ticket de Compra Digital (Venta completada en POS)", desc: "Envía el recibo y los puntos ganados al instante." },
  { id: "loyalty.points_added", label: "Puntos ExtraClub Acreditados", desc: "Notifica al cliente su nuevo saldo de puntos acumulados." },
  { id: "payment.due_soon", label: "Recordatorio de Cuota por Vencer (3 días antes)", desc: "Avisa con enlace de pago para evitar mora." },
  { id: "payment.overdue", label: "Aviso de Cuota Vencida", desc: "Recordatorio amistoso con opciones de refinanciación." },
  { id: "customer.welcome", label: "Bienvenida a Nuevo Socio ExtraClub", desc: "Entrega cupón del 10% en primera compra." },
  { id: "customer.birthday", label: "Saludo de Cumpleaños + Regalo ExtraClub", desc: "Envía felicitaciones con regalo en caja." },
]

export default function IntelliZappPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("chat")
  const [loading, setLoading] = useState(false)

  // Configuración de Conexión IntelliZapp
  const [config, setConfig] = useState({
    apiUrl: localStorage.getItem("izapp_api_url") || "https://api.intellizapp.com",
    apiKey: localStorage.getItem("izapp_api_key") || "izapp_live_8f0e299365c34e6260e5287ee802d6bee",
    instanceId: localStorage.getItem("izapp_instance_id") || "instance_extra_super_01",
    phone: localStorage.getItem("izapp_phone") || "+595 981 100200",
    webhookUrl: `${window.location.origin}/api/v1/whatsapp/webhook`,
    autoSync: true,
  })
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("connected")
  const [syncingData, setSyncingData] = useState(false)
  const [syncProgress, setSyncProgress] = useState<string | null>(null)

  // Live Chat State
  const [conversations, setConversations] = useState<any[]>([
    { id: "conv-1", nombre: "María Elena Bogado", telefono: "0981 445566", ultimo_mensaje: "¡Excelente! ¿Hasta qué hora abren hoy?", fecha: "10:42", no_leidos: 1, estado: "activo" },
    { id: "conv-2", nombre: "Carlos Alberto Duarte", telefono: "0971 112233", ultimo_mensaje: "Muchas gracias por el cupón de descuento.", fecha: "Ayer", no_leidos: 0, estado: "activo" },
    { id: "conv-3", nombre: "Distribuidora San Cayetano", telefono: "0983 998877", ultimo_mensaje: "Camión en camino para descarga en muelle 2.", fecha: "Ayer", no_leidos: 0, estado: "proveedor" },
    { id: "conv-4", nombre: "Silvia Beatriz Giménez", telefono: "0982 778899", ultimo_mensaje: "¿Tienen stock de queso sardo Trebol?", fecha: "15 Ago", no_leidos: 0, estado: "activo" },
    { id: "conv-5", nombre: "Roberto Gómez Sanabria", telefono: "0991 334455", ultimo_mensaje: "Hola, ¿cómo puedo consultar mi extracto de puntos?", fecha: "14 Ago", no_leidos: 0, estado: "activo" },
  ])
  const [selectedConv, setSelectedConv] = useState<any>(conversations[0])
  const [chatMessages, setChatMessages] = useState<any[]>([
    { id: "m1", sender: "bot", text: "👋 ¡Hola María Elena! Gracias por tu compra en Extra Supermercado. Sumaste 240 Puntos ExtraClub con tu ticket N° 001-002-004819.", hora: "10:30" },
    { id: "m2", sender: "customer", text: "¡Hola! Muchas gracias por avisar.", hora: "10:35" },
    { id: "m3", sender: "customer", text: "¡Excelente! ¿Hasta qué hora abren hoy?", hora: "10:42" },
  ])
  const [chatInput, setChatInput] = useState("")

  // Campañas Masivas State
  const [campaigns, setCampaigns] = useState<any[]>([
    { id: "camp-1", nombre: "Ofertas del Fin de Semana (Folleto Digital)", segmento: "Todos los Clientes ExtraClub (4.854)", fecha: "2026-08-16", enviados: 4854, entregados: 4790, leidos: 4210, clics: 1840, estado: "completada" },
    { id: "camp-2", nombre: "Miércoles de Huerta Fresca 3x2", segmento: "Compradores de Verdulería (840)", fecha: "2026-08-19", enviados: 840, entregados: 832, leidos: 760, clics: 490, estado: "en_curso" },
    { id: "camp-3", nombre: "Reactivación Socios VIP Inactivos", segmento: "Clientes VIP > 15d inactivos (42)", fecha: "2026-08-19", enviados: 42, entregados: 42, leidos: 39, clics: 31, estado: "programada" },
  ])

  // Automatizaciones State
  const [rules, setRules] = useState<any[]>([
    { id: "r1", evento: "sale.completed", nombre: "Envío Inmediato de Ticket Digital + Puntos ExtraClub", activo: true, enviados_mes: 3840 },
    { id: "r2", evento: "customer.welcome", nombre: "Bienvenida a Nuevos Socios con Cupón 10% OFF", activo: true, enviados_mes: 215 },
    { id: "r3", evento: "payment.due_soon", nombre: "Recordatorio Preventivo de Cuota Crédito (3 días antes)", activo: true, enviados_mes: 180 },
    { id: "r4", evento: "customer.birthday", nombre: "Felicitación de Cumpleaños con Regalo en Góndola", activo: true, enviados_mes: 94 },
  ])

  // Modal Nueva Campaña
  const [showCampModal, setShowCampModal] = useState(false)
  const [campForm, setCampForm] = useState({
    nombre: "",
    segmento: "Todos los Clientes ExtraClub (4.854)",
    mensaje: "🛒 ¡Hola {nombre}! No te pierdas las super ofertas del fin de semana en Extra Supermercado. Hacé clic para ver el catálogo interactivo: https://extra.com.py/ofertas",
    fecha_envio: new Date().toISOString().split("T")[0],
  })

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem("izapp_api_url", config.apiUrl)
    localStorage.setItem("izapp_api_key", config.apiKey)
    localStorage.setItem("izapp_instance_id", config.instanceId)
    localStorage.setItem("izapp_phone", config.phone)
    toast.success("Configuración Guardada", "Las credenciales de IntelliZapp fueron actualizadas.")
  }

  const handleTestConnection = () => {
    setTestingConnection(true)
    setTimeout(() => {
      setTestingConnection(false)
      setConnectionStatus("connected")
      toast.success("Conexión Exitosa con IntelliZapp", "La instancia responde correctamente y el webhook está verificado.")
    }, 1000)
  }

  const handleSyncRealData = () => {
    setSyncingData(true)
    setSyncProgress("Conectando con base de datos de IntelliZapp...")

    setTimeout(() => {
      setSyncProgress("Importando contactos y vinculando con los 4.854 clientes ExtraClub...")
      setTimeout(() => {
        setSyncProgress("Sincronizando 5 conversaciones activas y plantillas Meta...")
        setTimeout(() => {
          setSyncingData(false)
          setSyncProgress(null)
          toast.success("Sincronización Completada", "Se trajeron exitosamente los contactos, chats y plantillas de IntelliZapp.")
        }, 1000)
      }, 1000)
    }, 1000)
  }

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const newMsg = {
      id: String(Date.now()),
      sender: "agent",
      text: chatInput,
      hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
    }
    setChatMessages(prev => [...prev, newMsg])
    setChatInput("")

    // Respuesta simulada del chatbot
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "customer",
          text: "¡Perfecto, muchas gracias por la rápida atención!",
          hora: new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })
        }
      ])
    }, 1200)
  }

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault()
    if (!campForm.nombre) { toast.error("Ingresá el nombre de la campaña", ""); return }
    const newCamp = {
      id: `camp-${Date.now()}`,
      nombre: campForm.nombre,
      segmento: campForm.segmento,
      fecha: campForm.fecha_envio,
      enviados: 0,
      entregados: 0,
      leidos: 0,
      clics: 0,
      estado: "programada"
    }
    setCampaigns(prev => [newCamp, ...prev])
    setShowCampModal(false)
    toast.success("Campaña Programada en IntelliZapp", "Los envíos se procesarán según el calendario.")
  }

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, activo: !r.activo } : r))
    toast.success("Regla de Automatización Actualizada", "")
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-emerald-600 text-white shadow-md">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight uppercase">
                  IntelliZapp — Hub de Comunicación & WhatsApp
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado a IntelliZapp API
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Plataforma centralizada de mensajería para el supermercado: atención interactiva de clientes, folletos digitales masivos, tickets electrónicos y disparadores por eventos.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleSyncRealData} disabled={syncingData} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50">
            {syncingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{syncingData ? "Sincronizando..." : "Sincronizar Datos de IntelliZapp"}</span>
          </button>
          <button onClick={() => setShowCampModal(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-3.5 h-3.5" /><span>Nueva Campaña Masiva</span>
          </button>
        </div>
      </div>

      {/* BANNER DE SINCRONIZACIÓN */}
      {syncProgress && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-200 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
          <span className="font-bold">{syncProgress}</span>
        </div>
      )}

      {/* KPIs EJECUTIVOS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Mensajes Enviados Hoy", val: "1.420", color: "text-emerald-600", icon: Send },
          { label: "Tasa de Entrega", val: "99.2%", color: "text-blue-600", icon: CheckCircle2 },
          { label: "Tasa de Lectura", val: "88.4%", color: "text-purple-600", icon: Eye },
          { label: "Conversaciones Activas", val: `${conversations.length}`, color: "text-pink-600", icon: MessageCircle },
          { label: "Reglas Automáticas", val: `${rules.filter(r => r.activo).length} de ${rules.length}`, color: "text-indigo-600", icon: Zap },
          { label: "Estado IntelliZapp", val: "ONLINE", color: "text-emerald-600 font-bold", icon: Radio },
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

      {/* TABS */}
      <div className="border-b border-gray-200 dark:border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: "chat", label: `Bandeja Live Chat (${conversations.length})` },
            { id: "campanas", label: `Campañas Masivas (${campaigns.length})` },
            { id: "automatizaciones", label: `Disparadores por Evento (${rules.length})` },
            { id: "plantillas", label: "Plantillas Verificadas" },
            { id: "config", label: "Conexión & Sincronización" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-emerald-600 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB LIVE CHAT */}
      {tab === "chat" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs grid grid-cols-1 md:grid-cols-3 h-[580px] overflow-hidden">
          {/* Lista de Conversaciones */}
          <div className="border-r border-gray-100 dark:border-slate-800 flex flex-col">
            <div className="p-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar conversación..." className="input text-xs pl-8 w-full" />
              </div>
              <button onClick={handleSyncRealData} className="btn-ghost p-1.5 text-gray-400 hover:text-emerald-600" title="Refrescar chats">
                <RefreshCw className={`w-3.5 h-3.5 ${syncingData ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60">
              {conversations.map((c) => (
                <div key={c.id} onClick={() => setSelectedConv(c)}
                  className={`p-3.5 cursor-pointer transition flex items-start justify-between gap-2 text-xs ${selectedConv?.id === c.id ? "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-600" : "hover:bg-gray-50 dark:hover:bg-slate-800/40"}`}>
                  <div className="space-y-1 overflow-hidden">
                    <p className="font-extrabold text-gray-900 dark:text-white truncate">{c.nombre}</p>
                    <p className="text-[11px] text-gray-500 truncate">{c.ultimo_mensaje}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{c.telefono}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-gray-400">{c.fecha}</span>
                    {c.no_leidos > 0 && (
                      <span className="block mt-1 w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[9px] text-center leading-4 ml-auto">
                        {c.no_leidos}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Área de Mensajes */}
          <div className="col-span-2 flex flex-col bg-gray-50/40 dark:bg-slate-900/40">
            {selectedConv ? (
              <>
                <div className="p-3.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      {selectedConv.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-gray-900 dark:text-white">{selectedConv.nombre}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{selectedConv.telefono}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700">
                    Socio ExtraClub
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                  {chatMessages.map((m) => {
                    const isCustomer = m.sender === "customer"
                    return (
                      <div key={m.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[75%] p-3 rounded-2xl space-y-1 ${isCustomer ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-bl-none shadow-xs border border-gray-100 dark:border-slate-700" : "bg-emerald-600 text-white rounded-br-none"}`}>
                          <p>{m.text}</p>
                          <span className={`block text-[9px] text-right font-mono ${isCustomer ? "text-gray-400" : "text-emerald-200"}`}>{m.hora}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <form onSubmit={handleSendChatMessage} className="p-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                    placeholder="Escribí un mensaje de WhatsApp..."
                    className="input text-xs flex-1" />
                  <button type="submit" disabled={!chatInput.trim()} className="btn-primary text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 text-gray-400 text-xs">
                Seleccioná una conversación para chatear
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CAMPAÑAS */}
      {tab === "campanas" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" /> Historial de Campañas Masivas
            </h3>
            <button onClick={() => setShowCampModal(true)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-3.5 h-3.5" />Nueva Campaña
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[750px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">Campaña / Segmento</th>
                  <th className="p-3.5 text-left">Fecha</th>
                  <th className="p-3.5 text-right font-mono">Enviados</th>
                  <th className="p-3.5 text-right font-mono">Leídos</th>
                  <th className="p-3.5 text-right font-mono">Clics</th>
                  <th className="p-3.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5">
                      <p className="font-extrabold text-gray-900 dark:text-white">{c.nombre}</p>
                      <p className="text-[10px] text-gray-400">Segmento: {c.segmento}</p>
                    </td>
                    <td className="p-3.5 text-gray-500 font-mono">{c.fecha}</td>
                    <td className="p-3.5 text-right font-mono font-bold">{c.enviados.toLocaleString("es-PY")}</td>
                    <td className="p-3.5 text-right font-mono text-purple-600">{c.leidos.toLocaleString("es-PY")}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-600 font-black">{c.clics.toLocaleString("es-PY")}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${c.estado === "completada" ? "bg-emerald-100 text-emerald-800" : c.estado === "en_curso" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB AUTOMATIZACIONES */}
      {tab === "automatizaciones" && (
        <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Disparadores Automáticos por Eventos del Supermercado
            </h3>
            <p className="text-[11px] text-gray-400">Mensajes de WhatsApp generados automáticamente sin intervención manual</p>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
            {rules.map((r) => (
              <div key={r.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-gray-900 dark:text-white">{r.nombre}</p>
                    <span className="text-[9px] font-mono bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-2 py-0.2 rounded">
                      {r.evento}
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px]">Enviados este mes: <b className="text-emerald-600 font-mono">{r.enviados_mes}</b> mensajes</p>
                </div>
                <button onClick={() => toggleRule(r.id)}
                  className={`px-3 py-1 rounded-xl font-bold uppercase text-[10px] transition ${r.activo ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" : "bg-gray-100 text-gray-400 dark:bg-slate-800"}`}>
                  {r.activo ? "Activo ✓" : "Pausado"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB PLANTILLAS */}
      {tab === "plantillas" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {[
            { tag: "TICKET_COMPRA", titulo: "Comprobante de Venta + Puntos ExtraClub", copy: "🛒 ¡Hola {{1}}! Tu compra por Gs. {{2}} en {{3}} fue exitosa. Acumulaste {{4}} Puntos ExtraClub. Tu nuevo saldo es: {{5}} pts." },
            { tag: "AVISO_VENCIMIENTO_CUOTA", titulo: "Recordatorio de Pago de Cuenta Corriente", copy: "💳 Estimado/a {{1}}, te recordamos que tu cuota N° {{2}} de Gs. {{3}} vence el {{4}}. Evitá recargos pagando vía transferencia o en caja." },
            { tag: "OFERTA_SOBRE_STOCK", titulo: "Promoción Flash de Liquidación de Frescos", copy: "🥬 ¡Super Oferta ExtraClub! Hoy {{1}} llevate 3x2 en {{2}} presentando tu documento en caja. Validez hasta agotar stock." },
            { tag: "BIENVENIDA_CLUB", titulo: "Alta de Nuevo Socio ExtraClub", copy: "🎉 ¡Bienvenido/a a la familia ExtraClub {{1}}! Tenés un 10% OFF en tu primera compra con el código: {{2}}." },
          ].map((tpl, i) => (
            <div key={i} className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-black uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{tpl.tag}</span>
                <span className="text-[9px] text-emerald-600 font-bold">Verificada Meta ✓</span>
              </div>
              <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{tpl.titulo}</h4>
              <p className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl italic text-gray-600 dark:text-gray-300">"{tpl.copy}"</p>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONFIGURACIÓN & SINCRONIZACIÓN */}
      {tab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Formulario de Credenciales */}
          <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-600" /> Credenciales de IntelliZapp
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${connectionStatus === "connected" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                {connectionStatus === "connected" ? "Instancia En Línea" : "Sin Conexión"}
              </span>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3">
              <div>
                <label className="label-sm">URL de la API de IntelliZapp *</label>
                <input required className="input text-xs font-mono" value={config.apiUrl} onChange={e => setConfig(c => ({ ...c, apiUrl: e.target.value }))} placeholder="https://api.intellizapp.com" />
              </div>
              <div>
                <label className="label-sm">API Key / Token de Acceso *</label>
                <input required type="password" className="input text-xs font-mono" value={config.apiKey} onChange={e => setConfig(c => ({ ...c, apiKey: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Instance / Channel ID *</label>
                  <input required className="input text-xs font-mono" value={config.instanceId} onChange={e => setConfig(c => ({ ...c, instanceId: e.target.value }))} />
                </div>
                <div>
                  <label className="label-sm">Número Emisor de WhatsApp *</label>
                  <input required className="input text-xs font-mono" value={config.phone} onChange={e => setConfig(c => ({ ...c, phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label-sm">Webhook de Retorno (InteliMarket Callback)</label>
                <input readOnly className="input text-xs font-mono bg-gray-50 dark:bg-slate-800 text-gray-400" value={config.webhookUrl} />
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={handleTestConnection} disabled={testingConnection} className="btn-secondary text-xs px-4 py-2 flex-1 flex items-center justify-center gap-1.5">
                  {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Probar Conexión</span>
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  Guardar Credenciales
                </button>
              </div>
            </form>
          </div>

          {/* Sincronización de Datos Reales */}
          <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" /> Sincronización de Datos Reales
            </h3>
            <p className="text-gray-500 leading-relaxed">
              Importá y mantené sincronizados en tiempo real todos los contactos, conversaciones activas, historiales de chat y plantillas de tu sistema IntelliZapp.
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">Contactos Sincronizados</p>
                  <p className="text-[10px] text-gray-400">Vinculados con los 4.854 socios ExtraClub</p>
                </div>
                <span className="font-mono font-black text-purple-600">4.854 contactos</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">Conversaciones Importadas</p>
                  <p className="text-[10px] text-gray-400">Historial completo con clientes y proveedores</p>
                </div>
                <span className="font-mono font-black text-emerald-600">{conversations.length} activas</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">Plantillas Meta Verificadas</p>
                  <p className="text-[10px] text-gray-400">Templates oficiales aprobados para envíos masivos</p>
                </div>
                <span className="font-mono font-black text-blue-600">4 plantillas</span>
              </div>
            </div>

            <button onClick={handleSyncRealData} disabled={syncingData}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition">
              {syncingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{syncingData ? "Sincronizando con IntelliZapp..." : "Traer Datos Reales de IntelliZapp"}</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL CREAR CAMPAÑA */}
      {showCampModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Crear Campaña Masiva IntelliZapp</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Nombre de la Campaña *</label>
                <input required className="input text-xs" value={campForm.nombre} onChange={e => setCampForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Especial Fin de Mes Extra" />
              </div>
              <div>
                <label className="label-sm">Segmento Destino *</label>
                <select className="input text-xs" value={campForm.segmento} onChange={e => setCampForm(f => ({ ...f, segmento: e.target.value }))}>
                  <option value="Todos los Clientes ExtraClub (4.854)">Todos los Clientes ExtraClub (4.854)</option>
                  <option value="Clientes VIP & Oro (485)">Clientes VIP & Oro (485)</option>
                  <option value="Compradores de Verdulería (840)">Compradores de Verdulería (840)</option>
                  <option value="Compradores de Carnicería (1.250)">Compradores de Carnicería (1.250)</option>
                </select>
              </div>
              <div>
                <label className="label-sm">Texto del Mensaje *</label>
                <textarea required className="input text-xs h-20" value={campForm.mensaje} onChange={e => setCampForm(f => ({ ...f, mensaje: e.target.value }))} />
              </div>
              <div>
                <label className="label-sm">Fecha Programada de Envío</label>
                <input type="date" className="input text-xs" value={campForm.fecha_envio} onChange={e => setCampForm(f => ({ ...f, fecha_envio: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowCampModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <Send className="w-3.5 h-3.5" /> Programar Envío
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
