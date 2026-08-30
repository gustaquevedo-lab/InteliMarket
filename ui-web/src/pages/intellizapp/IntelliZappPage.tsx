import { useState, useEffect, useRef } from "react"
import { useToast } from "../../context/ToastContext"
import { api } from "../../api"
import { Megaphone, BarChart3, Bot, Send, Plus, Play, Trash2, Edit3, X, Users, MessageCircle, Eye, Reply, Activity, Zap, Clock, CheckCircle, AlertTriangle, Search, ChevronLeft, ChevronRight, Smartphone, RefreshCw, RotateCcw, UserCheck, Filter } from "lucide-react"
import type { IntelliZappCampaign, IntelliZappAutomationRule, IntelliZappAnalytics, ChatbotTestResponse } from "../../api"

type Tab = "dashboard" | "campaigns" | "automation" | "simulator"

const TRIGGER_EVENT_LABELS: Record<string, string> = {
  "sale.created": "Venta creada",
  "sale.completed": "Venta completada",
  "payment.received": "Pago recibido",
  "payment.due_soon": "Pago próximo a vencer",
  "payment.overdue": "Pago vencido",
  "customer.created": "Cliente nuevo",
  "customer.inactive": "Cliente inactivo",
  "delivery.created": "Entrega creada",
  "delivery.in_transit": "Entrega en tránsito",
  "delivery.delivered": "Entrega entregada",
  "delivery.failed": "Entrega fallida",
  "credit.limit_exceeded": "Límite de crédito excedido",
  "stock.low": "Stock bajo",
  "promotion.available": "Promoción disponible",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  sending: "Enviando",
  completed: "Completada",
  cancelled: "Cancelada",
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  scheduled: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  sending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  completed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  cancelled: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
}

export default function IntelliZappPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const [analytics, setAnalytics] = useState<IntelliZappAnalytics | null>(null)
  const [campaigns, setCampaigns] = useState<IntelliZappCampaign[]>([])
  const [rules, setRules] = useState<IntelliZappAutomationRule[]>([])

  // Campaign form
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<IntelliZappCampaign | null>(null)
  const [campaignStep, setCampaignStep] = useState(1)
  const [campaignForm, setCampaignForm] = useState({ name: "", description: "", tipo: "promotion", message_template: "", scheduled_at: "" })
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])

  // CRM contacts for recipient selector
  const [allCompanies, setAllCompanies] = useState<any[]>([])
  const [companySearch, setCompanySearch] = useState("")
  const [loadingCompanies, setLoadingCompanies] = useState(false)

  // Rule form
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<IntelliZappAutomationRule | null>(null)
  const [ruleForm, setRuleForm] = useState({ name: "", trigger_event: "sale.created", message_template: "", delay_minutes: 0 })

  const [sendingId, setSendingId] = useState<string | null>(null)

  // Chatbot simulator state
  const [simConvId, setSimConvId] = useState<string | null>(null)
  const [simMessages, setSimMessages] = useState<Array<{ from: "user" | "bot"; text: string; buttons?: Array<{ id: string; title: string }>; state?: string }>>([])
  const [simInput, setSimInput] = useState("")
  const [simSending, setSimSending] = useState(false)
  const [simState, setSimState] = useState("idle")
  const simContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tab !== "simulator") fetchAll()
  }, [tab])

  useEffect(() => {
    if (simContainerRef.current) {
      simContainerRef.current.scrollTop = simContainerRef.current.scrollHeight
    }
  }, [simMessages])

  const fetchAll = async () => {
    setLoading(true)
    try {
      if (tab === "dashboard") {
        const [a, c, r] = await Promise.allSettled([
          api.intellizapp.getAnalytics(),
          api.intellizapp.listCampaigns(),
          api.intellizapp.listRules(),
        ])
        if (a.status === "fulfilled") setAnalytics(a.value)
        if (c.status === "fulfilled") setCampaigns(c.value)
        if (r.status === "fulfilled") setRules(r.value)
      } else if (tab === "campaigns") {
        const c = await api.intellizapp.listCampaigns()
        setCampaigns(c)
      } else if (tab === "automation") {
        const r = await api.intellizapp.listRules()
        setRules(r)
      }
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudieron cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  const loadCompanies = async () => {
    setLoadingCompanies(true)
    try {
      const companies = await api.companies.list()
      setAllCompanies(companies)
    } catch { setAllCompanies([]) }
    setLoadingCompanies(false)
  }

  const openCampaignForm = (campaign?: IntelliZappCampaign) => {
    if (campaign) {
      setEditingCampaign(campaign)
      setCampaignForm({
        name: campaign.name,
        description: campaign.description || "",
        tipo: campaign.tipo,
        message_template: campaign.message_template || "",
        scheduled_at: campaign.scheduled_at ? new Date(campaign.scheduled_at).toISOString().slice(0, 16) : "",
      })
      setSelectedCustomerIds([])
    } else {
      setEditingCampaign(null)
      setCampaignForm({ name: "", description: "", tipo: "promotion", message_template: "", scheduled_at: "" })
      setSelectedCustomerIds([])
    }
    setCampaignStep(1)
    setShowCampaignForm(true)
    loadCompanies()
  }

  const handleSaveCampaign = async () => {
    try {
      const data: any = {
        name: campaignForm.name,
        tipo: campaignForm.tipo,
        message_template: campaignForm.message_template,
        segment_filters: selectedCustomerIds.length > 0 ? { customer_ids: selectedCustomerIds } : null,
      }
      if (campaignForm.description) data.description = campaignForm.description
      if (campaignForm.scheduled_at) data.scheduled_at = new Date(campaignForm.scheduled_at).toISOString()

      if (editingCampaign) {
        await api.intellizapp.updateCampaign(editingCampaign.id, data)
        toast.success("Campaña actualizada", "Los cambios se guardaron correctamente")
      } else {
        await api.intellizapp.createCampaign(data)
        toast.success("Campaña creada", "La campaña se creó correctamente")
      }
      setShowCampaignForm(false)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleLaunchCampaign = async (id: string) => {
    try {
      const result = await api.intellizapp.launchCampaign(id)
      toast.success("Campaña lanzada", `Se segmentaron ${result.total_recipients} destinatarios`)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleSendBatch = async (id: string) => {
    setSendingId(id)
    try {
      const result = await api.intellizapp.sendBatch(id, 50)
      toast.success("Lote enviado", `Enviados: ${result.sent}, Fallidos: ${result.failed}, Restantes: ${result.remaining}`)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setSendingId(null)
    }
  }

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta campaña?")) return
    try {
      await api.intellizapp.deleteCampaign(id)
      toast.success("Eliminada", "La campaña fue eliminada")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleSaveRule = async () => {
    try {
      const data: any = { name: ruleForm.name, trigger_event: ruleForm.trigger_event, message_template: ruleForm.message_template, delay_minutes: ruleForm.delay_minutes }
      if (editingRule) {
        await api.intellizapp.updateRule(editingRule.id, data)
        toast.success("Regla actualizada", "Los cambios se guardaron correctamente")
      } else {
        await api.intellizapp.createRule(data)
        toast.success("Regla creada", "La regla de automatización se creó correctamente")
      }
      setShowRuleForm(false)
      setEditingRule(null)
      setRuleForm({ name: "", trigger_event: "sale.created", message_template: "", delay_minutes: 0 })
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta regla?")) return
    try {
      await api.intellizapp.deleteRule(id)
      toast.success("Eliminada", "La regla fue eliminada")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message)
    }
  }

  const openEditRule = (r: IntelliZappAutomationRule) => {
    setEditingRule(r)
    setRuleForm({
      name: r.name,
      trigger_event: r.trigger_event,
      message_template: r.message_template || "",
      delay_minutes: r.delay_minutes,
    })
    setShowRuleForm(true)
  }

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const filteredCompanies = allCompanies.filter(c => {
    if (!companySearch) return true
    const q = companySearch.toLowerCase()
    return (c.nombre?.toLowerCase().includes(q) ||
      c.ruc?.toLowerCase().includes(q) ||
      c.ciudad?.toLowerCase().includes(q) ||
      c.razon_social?.toLowerCase().includes(q))
  })

  // ─── Chatbot Simulator ──────────────────────────────────────────

  const simSendMessage = async (text: string) => {
    if (!text.trim()) return
    setSimMessages(prev => [...prev, { from: "user", text: text.trim() }])
    setSimInput("")
    setSimSending(true)
    try {
      const res: ChatbotTestResponse = await api.intellizapp.chatbotTest({
        message: text.trim(),
        conversation_id: simConvId || undefined,
      })
      setSimConvId(res.conversation_id)
      setSimState(res.next_state)
      setSimMessages(prev => [...prev, {
        from: "bot",
        text: res.response_text,
        buttons: res.buttons,
        state: res.next_state,
      }])
    } catch {
      setSimMessages(prev => [...prev, {
        from: "bot",
        text: "⚠️ Error conectando con el chatbot. Verificá que el servidor esté corriendo.",
      }])
    }
    setSimSending(false)
  }

  const simReset = async () => {
    setSimConvId(null)
    setSimMessages([{
      from: "bot",
      text: "🤖 *Simulador del Chatbot IntelliZapp*\n\nEscribí un mensaje para comenzar la conversación. El bot responde con menús interactivos como lo haría en WhatsApp.",
    }])
    setSimState("idle")
    // Reset backend conversation
    try {
      if (simConvId) await api.intellizapp.chatbotTest({ message: "hola", conversation_id: simConvId, reset: true })
    } catch {}
  }

  const simInit = () => {
    setSimMessages([{
      from: "bot",
      text: "🤖 *Simulador del Chatbot IntelliZapp*\n\nEscribí un mensaje para comenzar la conversación. El bot responde con menús interactivos como lo haría en WhatsApp.",
    }])
    setSimState("idle")
    setSimConvId(null)
  }

  // ─── Tabs ───────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "campaigns", label: "Campañas", icon: Megaphone },
    { key: "automation", label: "Automatización", icon: Bot },
    { key: "simulator", label: "Simulador Chatbot", icon: Smartphone },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-purple-500" />
            IntelliZapp
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Campañas WhatsApp & Automatización Inteligente</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === key ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ══════════════════ DASHBOARD ══════════════════ */}
      {tab === "dashboard" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600"><Megaphone className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold">{analytics?.total_campaigns || 0}</p><p className="text-xs text-gray-500">Campañas</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><Send className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold">{analytics?.total_sent || 0}</p><p className="text-xs text-gray-500">Enviados</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"><CheckCircle className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold">{analytics ? Math.round(analytics.delivery_rate * 100) : 0}%</p><p className="text-xs text-gray-500">Tasa Entrega</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600"><MessageCircle className="w-5 h-5" /></div>
              <div><p className="text-2xl font-bold">{analytics ? Math.round(analytics.reply_rate * 100) : 0}%</p><p className="text-xs text-gray-500">Tasa Respuesta</p></div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-lg mb-4">Campañas Recientes</h3>
            {campaigns.length === 0 ? (
              <p className="text-center py-8 text-gray-400">No hay campañas aún. Creá tu primera campaña.</p>
            ) : (
              <div className="space-y-3">
                {campaigns.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.tipo} · {new Date(c.created_at).toLocaleDateString("es-PY")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{c.sent_count}/{c.total_recipients}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || ""}`}>{STATUS_LABELS[c.status] || c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Entregados</p><p className="text-xl font-bold">{analytics?.total_delivered || 0}</p></div>
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"><CheckCircle className="w-5 h-5" /></div>
            </div>
            <div className="card p-4 flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Leídos</p><p className="text-xl font-bold">{analytics?.total_read || 0}</p></div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><Eye className="w-5 h-5" /></div>
            </div>
            <div className="card p-4 flex items-center justify-between">
              <div><p className="text-sm text-gray-500">Respondidos</p><p className="text-xl font-bold">{analytics?.total_replied || 0}</p></div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600"><Reply className="w-5 h-5" /></div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-lg mb-4">Reglas de Automatización Activas</h3>
            {rules.filter(r => r.active).length === 0 ? (
              <p className="text-center py-8 text-gray-400">No hay reglas activas. Configurá automatizaciones en la pestaña correspondiente.</p>
            ) : (
              <div className="space-y-2">
                {rules.filter(r => r.active).map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                    <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-gray-500">{TRIGGER_EVENT_LABELS[r.trigger_event] || r.trigger_event} · Espera {r.delay_minutes}min</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">Activa</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════ CAMPAIGNS ══════════════════ */}
      {tab === "campaigns" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Campañas</h3>
            <button onClick={() => openCampaignForm()}
              className="btn-primary flex items-center gap-2 text-sm"><Plus className="w-4 h-4" />Nueva Campaña</button>
          </div>
          {campaigns.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No hay campañas. Hacé clic en "Nueva Campaña" para crear la primera.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="table-header">
                  <th className="table-cell">Nombre</th>
                  <th className="table-cell">Tipo</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell">Progreso</th>
                  <th className="table-cell">Programación</th>
                  <th className="table-cell text-right">Acciones</th>
                </tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} className="table-row">
                      <td className="table-td">
                        <p className="font-medium">{c.name}</p>
                        {c.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{c.description}</p>}
                      </td>
                      <td className="table-td text-sm capitalize">{c.tipo === "promotion" ? "Promoción" : c.tipo === "newsletter" ? "Newsletter" : c.tipo === "reminder" ? "Recordatorio" : c.tipo}</td>
                      <td className="table-td"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || ""}`}>{STATUS_LABELS[c.status] || c.status}</span></td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) + "%" : "0%" }} />
                          </div>
                          <span className="text-xs text-gray-500">{c.sent_count}/{c.total_recipients}</span>
                        </div>
                      </td>
                      <td className="table-td text-sm">
                        {c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString("es-PY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="table-td text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.status === "draft" && (
                            <button onClick={() => handleLaunchCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600" title="Lanzar campaña"><Play className="w-4 h-4" /></button>
                          )}
                          {(c.status === "scheduled" || c.status === "sending") && (
                            <button onClick={() => handleSendBatch(c.id)} disabled={sendingId === c.id} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600" title="Enviar lote">
                              {sendingId === c.id ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          )}
                          <button onClick={() => openCampaignForm(c)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Editar"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ AUTOMATION ══════════════════ */}
      {tab === "automation" && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Reglas de Automatización</h3>
            <button onClick={() => { setEditingRule(null); setRuleForm({ name: "", trigger_event: "sale.created", message_template: "", delay_minutes: 0 }); setShowRuleForm(true) }}
              className="btn-primary flex items-center gap-2 text-sm"><Plus className="w-4 h-4" />Nueva Regla</button>
          </div>
          {rules.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No hay reglas de automatización. Creá la primera para comenzar.</p>
          ) : (
            <div className="space-y-3">
              {rules.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${r.active ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-medium">Evento:</span> {TRIGGER_EVENT_LABELS[r.trigger_event] || r.trigger_event}
                        {r.delay_minutes > 0 && <> · <span className="font-medium">Espera:</span> {r.delay_minutes}min</>}
                      </p>
                      {r.message_template && <p className="text-xs text-gray-400 mt-1 truncate max-w-md">{r.message_template.slice(0, 100)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
                      {r.active ? "Activa" : "Inactiva"}
                    </span>
                    <button onClick={() => openEditRule(r)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteRule(r.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400"><Zap className="w-4 h-4" />Eventos disponibles para automatización</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {Object.entries(TRIGGER_EVENT_LABELS).map(([key, label]) => (
                <span key={key} className="text-xs px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">{label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CHATBOT SIMULATOR ══════════════════ */}
      {tab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat window */}
          <div className="lg:col-span-2 card p-0 flex flex-col overflow-hidden" style={{ maxHeight: "70vh" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
                  IZ
                </div>
                <div>
                  <p className="font-semibold text-sm">IntelliBot <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full ml-1">Online</span></p>
                  <p className="text-xs text-gray-500">Chatbot IntelliZapp · WhatsApp Simulator</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                  Estado: <span className="font-medium text-purple-600 dark:text-purple-400">{simState}</span>
                </span>
                <button onClick={simReset} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Reiniciar conversación">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-gray-50 to-white dark:from-slate-900 dark:to-slate-800/50" style={{ minHeight: "400px" }}>
              {simMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Smartphone className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-400 dark:text-gray-500 mb-2">Simulador de Chatbot</p>
                  <button onClick={simInit} className="btn-primary text-sm px-6 py-2 rounded-full">
                    Iniciar conversación
                  </button>
                </div>
              ) : (
                simMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.from === "user"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-md shadow-md"
                      : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-bl-md shadow-sm"
                    }`}>
                      {msg.from === "bot" && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">IntelliBot</span>
                          {msg.state && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{msg.state}</span>
                          )}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap" style={msg.from === "user" ? { color: "white" } : {}}>{msg.text}</p>
                      {msg.buttons && msg.buttons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {msg.buttons.map(btn => (
                            <button key={btn.id}
                              onClick={() => simSendMessage(btn.title.split(" ").slice(1).join(" ") || btn.id)}
                              className="text-xs px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors font-medium whitespace-nowrap">
                              {btn.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {simSending && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={simEndRef} />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-slate-800">
              <div className="flex gap-2">
                <input type="text" value={simInput} onChange={e => setSimInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && simSendMessage(simInput)}
                  placeholder="Escribí un mensaje para probar el chatbot..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <button onClick={() => simSendMessage(simInput)} disabled={simSending || !simInput.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* State info panel */}
          <div className="card p-5 space-y-5">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <Activity className="w-4 h-4 text-purple-500" />
                Flujo de Conversación
              </h3>
              <p className="text-xs text-gray-500 mt-1">El chatbot navega entre estados según la entrada del usuario.</p>
            </div>

            <div className="space-y-2">
              {[
                { state: "idle", label: "Esperando", desc: "Estado inicial, espera mensaje del usuario" },
                { state: "menu_main", label: "Menú Principal", desc: "Muestra las 4 opciones principales" },
                { state: "menu_products", label: "Catálogo", desc: "Búsqueda, categorías, ofertas" },
                { state: "menu_orders", label: "Pedidos", desc: "Estado, historial, seguimiento" },
                { state: "menu_support", label: "Soporte", desc: "FAQ, agente humano, reclamo" },
                { state: "product_search", label: "Búsqueda", desc: "Buscando producto en catálogo" },
                { state: "order_status", label: "Estado Pedido", desc: "Consultando estado de pedido" },
              ].map(s => (
                <div key={s.state}
                  className={`p-3 rounded-xl border transition-all ${simState === s.state
                    ? "border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 shadow-sm"
                    : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/50 opacity-60"
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${simState === s.state ? "bg-purple-500 animate-pulse" : "bg-gray-400"}`} />
                      <span className={`text-sm font-medium ${simState === s.state ? "text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-gray-400"}`}>
                        {s.label}
                      </span>
                    </div>
                    {simState === s.state && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">Actual</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-4">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/50">
              <h4 className="font-semibold text-xs text-purple-700 dark:text-purple-300 mb-2">💡 Pro tip</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Probá escribiendo "hola" para iniciar el menú, o usá comandos como <code className="text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1 rounded text-[10px]">/stock leche</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CAMPAIGN FORM (Multi-step modal) ══════════════════ */}
      {showCampaignForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCampaignForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Steps indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2].map(step => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${campaignStep >= step ? "bg-purple-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500"}`}>
                    {campaignStep > step ? "✓" : step}
                  </div>
                  <span className={`text-xs font-medium ${campaignStep >= step ? "text-purple-600 dark:text-purple-400" : "text-gray-400"}`}>
                    {step === 1 ? "Información" : "Destinatarios"}
                  </span>
                  {step < 2 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingCampaign ? "Editar Campaña" : "Nueva Campaña"}</h2>
              <button onClick={() => setShowCampaignForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
            </div>

            {campaignStep === 1 && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre</label>
                  <input type="text" value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Promo fin de semana" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Descripción</label>
                  <textarea value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Descripción opcional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Tipo</label>
                  <select value={campaignForm.tipo} onChange={e => setCampaignForm(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                    <option value="promotion">Promoción</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="reminder">Recordatorio</option>
                    <option value="recovery">Recuperación</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Mensaje (variables: {"{nombre}"}, {"{cliente}"}, {"{producto}"})</label>
                  <textarea value={campaignForm.message_template} onChange={e => setCampaignForm(f => ({ ...f, message_template: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono" rows={3}
                    placeholder="Hola {{nombre}}! Tenemos una promo especial para vos..." />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Programar para</label>
                  <input type="datetime-local" value={campaignForm.scheduled_at} onChange={e => setCampaignForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            )}

            {campaignStep === 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Users className="w-4 h-4 inline mr-1" />
                    Seleccionar destinatarios del CRM
                  </p>
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                    {selectedCustomerIds.length} seleccionados
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={companySearch} onChange={e => setCompanySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
                    placeholder="Buscar por nombre, RUC o ciudad..." />
                </div>

                {loadingCompanies ? (
                  <div className="flex items-center justify-center py-8">
                    <Clock className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Cargando contactos del CRM...</span>
                  </div>
                ) : filteredCompanies.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      {companySearch ? "No se encontraron contactos con ese criterio" : "No hay contactos en el CRM"}
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700/50 sticky top-0">
                      <input type="checkbox" checked={selectedCustomerIds.length === filteredCompanies.length && filteredCompanies.length > 0}
                        onChange={() => {
                          if (selectedCustomerIds.length === filteredCompanies.length) {
                            setSelectedCustomerIds([])
                          } else {
                            setSelectedCustomerIds(filteredCompanies.map(c => c.id))
                          }
                        }}
                        className="rounded accent-purple-600" />
                      <span className="text-xs font-medium text-gray-500">Seleccionar todos ({filteredCompanies.length})</span>
                    </div>
                    {filteredCompanies.map(c => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                        <input type="checkbox" checked={selectedCustomerIds.includes(c.id)}
                          onChange={() => toggleCustomer(c.id)} className="rounded accent-purple-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.nombre || c.razon_social || "Sin nombre"}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {c.ruc && <>RUC: {c.ruc} · </>}
                            {c.telefono || "Sin teléfono"}
                            {c.ciudad && <> · {c.ciudad}</>}
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
                          {c.activo !== false ? "Activo" : "Inactivo"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    <strong>{selectedCustomerIds.length}</strong> destinatarios seleccionados.
                    {selectedCustomerIds.length > 0
                      ? " Al lanzar la campaña se resolverán los teléfonos de estos contactos."
                      : " Podés lanzar la campaña sin destinatarios específicos y se usarán los filtros de segmentación."}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {campaignStep > 1 ? (
                <button onClick={() => setCampaignStep(1)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-1">
                  <ChevronLeft className="w-4 h-4" />Anterior
                </button>
              ) : (
                <button onClick={() => setShowCampaignForm(false)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancelar
                </button>
              )}
              {campaignStep < 2 ? (
                <button onClick={() => setCampaignStep(2)} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark flex items-center justify-center gap-1">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSaveCampaign} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark">
                  {editingCampaign ? "Guardar Cambios" : "Crear Campaña"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rule form modal */}
      {showRuleForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRuleForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingRule ? "Editar Regla" : "Nueva Regla de Automatización"}</h2>
              <button onClick={() => setShowRuleForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre</label>
                <input type="text" value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Agradecer compra" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Evento Trigger</label>
                <select value={ruleForm.trigger_event} onChange={e => setRuleForm(f => ({ ...f, trigger_event: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(TRIGGER_EVENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Minutos de espera antes de enviar</label>
                <input type="number" value={ruleForm.delay_minutes} onChange={e => setRuleForm(f => ({ ...f, delay_minutes: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" min="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Mensaje (variables: {"{nombre}"}, {"{cliente}"}, {"{monto}"}, {"{producto}"})</label>
                <textarea value={ruleForm.message_template} onChange={e => setRuleForm(f => ({ ...f, message_template: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono" rows={3}
                  placeholder="Gracias por tu compra {{nombre}}! Tu pedido de {{monto}} Gs está en preparación..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRuleForm(false)} className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
              <button onClick={handleSaveRule} className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark">{editingRule ? "Guardar" : "Crear Regla"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
