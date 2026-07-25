import { useState, useEffect, useCallback } from "react"
import {
  Shield, Search, Loader2, Clock, User, FileText, DollarSign, Package,
  Users, Truck, Settings, RefreshCw, Eye, EyeOff, AlertTriangle, CheckCircle,
  XCircle, TrendingDown, TrendingUp, Lock, Activity, BarChart2, List,
  LayoutDashboard, Filter, ChevronDown, ChevronUp, Edit3, Plus, Download,
  AlertOctagon, Wifi, CreditCard, RotateCcw, Minus
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

/* ─────────────────────── TYPES ─────────────────────── */
interface AuditLog {
  id: string
  company_id?: string
  user_id?: string
  accion?: string
  entidad?: string
  entidad_id?: string
  datos_anteriores?: Record<string, unknown>
  datos_nuevos?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at?: string
}

interface InternalAlert {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  type: string
  description: string
  user?: string
  area: string
  timestamp: string
  resolved: boolean
  recommendation: string
}

interface CashSession {
  id: string
  date: string
  cashier: string
  expected: number
  actual: number
  diff: number
  status: "ok" | "warning" | "critical"
  discounts: number
  returns: number
  voids: number
}

interface RiskItem {
  id: string
  risk: string
  area: string
  probability: number
  impact: number
  owner: string
  status: "active" | "mitigated" | "accepted"
  notes: string
}

type Tab = "dashboard" | "alerts" | "cash" | "log" | "risks"

/* ─────────────────────── MOCK DATA ─────────────────────── */
const MOCK_LOGS: AuditLog[] = [
  { id: "a1", accion: "venta_completada", entidad: "Venta", user_id: "Alicia Gimenez", created_at: "2026-05-27T10:15:00Z", datos_nuevos: { total: 3450000, items: 15, sucursal: "Centro" } },
  { id: "a2", accion: "desposte_ejecutado", entidad: "Carnicería", user_id: "Carlos Maidana", created_at: "2026-05-27T09:30:00Z", datos_nuevos: { peso_entrada: 220, rendimiento: 100 } },
  { id: "a3", accion: "transferencia_despachada", entidad: "Inventario", user_id: "Marta Benítez", created_at: "2026-05-27T08:00:00Z", datos_anteriores: { stock: 150 }, datos_nuevos: { origen: "CD", destino: "Centro", stock: 120 } },
  { id: "a4", accion: "descuento_manual", entidad: "Venta", user_id: "Roberto Díaz", created_at: "2026-05-27T11:22:00Z", datos_anteriores: { precio: 85000 }, datos_nuevos: { precio: 42500, descuento_pct: 50 } },
  { id: "a5", accion: "anulacion_venta", entidad: "Venta", user_id: "Roberto Díaz", created_at: "2026-05-27T11:45:00Z", datos_anteriores: { total: 120000 }, datos_nuevos: { motivo: "error_cajero" } },
  { id: "a6", accion: "stock_ajustado", entidad: "Inventario", user_id: "Sistema", created_at: "2026-05-27T00:05:00Z", datos_anteriores: { cant: 500 }, datos_nuevos: { cant: 460, merma: 40 } },
  { id: "a7", accion: "login_usuario", entidad: "Seguridad", user_id: "Admin", created_at: "2026-05-27T02:33:00Z", ip_address: "201.217.18.45", datos_nuevos: { ip: "201.217.18.45", pais: "Argentina" } },
  { id: "a8", accion: "precio_modificado", entidad: "Producto", user_id: "Marta Benítez", created_at: "2026-05-26T16:10:00Z", datos_anteriores: { precio: 15000 }, datos_nuevos: { precio: 9000, variacion_pct: -40 } },
  { id: "a9", accion: "devolucion_registrada", entidad: "Venta", user_id: "Alicia Gimenez", created_at: "2026-05-27T12:05:00Z", datos_nuevos: { monto: 85000, motivo: "producto_defectuoso" } },
  { id: "a10", accion: "cliente_creado", entidad: "Cliente", user_id: "Marta Benítez", created_at: "2026-05-26T14:20:00Z", datos_nuevos: { nombre: "Supermercados ABC", ruc: "80123456-1" } },
]

const MOCK_ALERTS: InternalAlert[] = [
  { id: "al1", severity: "critical", type: "Descuento excesivo sin autorización", description: "Roberto Díaz aplicó descuento del 50% (Gs 42.500) sin aprobación gerencial. Umbral: 30%.", user: "Roberto Díaz", area: "POS / Cajero", timestamp: "2026-05-27T11:22:00Z", resolved: false, recommendation: "Revertir descuento y notificar al gerente de turno. Evaluar suspensión temporal del permiso de descuento." },
  { id: "al2", severity: "critical", type: "Anulaciones múltiples mismo cajero", description: "Roberto Díaz realizó 3 anulaciones en la última hora. Patrón anómalo detectado.", user: "Roberto Díaz", area: "POS / Cajero", timestamp: "2026-05-27T11:45:00Z", resolved: false, recommendation: "Revisar las tickets anulados con supervisión. Verificar si hay faltante de caja asociado." },
  { id: "al3", severity: "high", type: "Diferencia de caja superior a Gs 50.000", description: "Cierre de caja nocturno presentó diferencia de Gs 87.000. Cajera: Alicia Gimenez.", user: "Alicia Gimenez", area: "Caja N°2", timestamp: "2026-05-26T23:55:00Z", resolved: false, recommendation: "Corroborar el conteo físico. Solicitar reconteo y cruzar con registro POS del turno." },
  { id: "al4", severity: "high", type: "Login desde IP desconocida en horario nocturno", description: "Usuario Admin accedió desde IP 201.217.18.45 (Argentina) a las 02:33 hs.", user: "Admin", area: "Seguridad", timestamp: "2026-05-27T02:33:00Z", resolved: false, recommendation: "Verificar con el propietario de la cuenta. Si no fue autorizado, bloquear sesión y cambiar contraseña." },
  { id: "al5", severity: "medium", type: "Precio de producto reducido -40% sin justificación", description: "Marta Benítez modificó el precio de 'Arroz 5kg' de Gs 15.000 a Gs 9.000 (-40%).", user: "Marta Benítez", area: "Productos", timestamp: "2026-05-26T16:10:00Z", resolved: false, recommendation: "Confirmar si el cambio fue autorizado por gerencia. Revisar historial de cambios de precios del usuario." },
  { id: "al6", severity: "medium", type: "Merma nocturna excede promedio histórico", description: "Ajuste automático de stock registró merma de 40 unidades (8%). Promedio histórico: 3.2%.", user: "Sistema", area: "Inventario", timestamp: "2026-05-27T00:05:00Z", resolved: false, recommendation: "Realizar inventario físico de los artículos afectados. Cruzar con cámaras de seguridad del período." },
  { id: "al7", severity: "low", type: "Proveedor con alta tasa de rechazo", description: "Distribuidora del Sur acumula 12% de recepciones rechazadas en los últimos 30 días.", user: undefined, area: "Compras / Recepción", timestamp: "2026-05-24T09:00:00Z", resolved: true, recommendation: "Evaluar renegociación de contrato o cambio de proveedor. Aplicar penalización contractual si corresponde." },
  { id: "al8", severity: "low", type: "Producto sin movimiento 45 días", description: "15 SKUs sin ventas en más de 45 días. Posible ocultamiento de merma o falta de rotación.", user: undefined, area: "Inventario", timestamp: "2026-05-20T00:00:00Z", resolved: false, recommendation: "Realizar conteo físico de los SKUs afectados. Evaluar promoción o devolución al proveedor." },
]

const MOCK_CASH: CashSession[] = [
  { id: "c1", date: "2026-05-27", cashier: "Alicia Gimenez", expected: 4850000, actual: 4763000, diff: -87000, status: "critical", discounts: 245000, returns: 1, voids: 0 },
  { id: "c2", date: "2026-05-27", cashier: "Roberto Díaz", expected: 3210000, actual: 3205000, diff: -5000, status: "ok", discounts: 590000, returns: 3, voids: 3 },
  { id: "c3", date: "2026-05-26", cashier: "Alicia Gimenez", expected: 5120000, actual: 5134000, diff: 14000, status: "ok", discounts: 180000, returns: 0, voids: 1 },
  { id: "c4", date: "2026-05-26", cashier: "Lorenzo Caballero", expected: 2890000, actual: 2890000, diff: 0, status: "ok", discounts: 95000, returns: 1, voids: 0 },
  { id: "c5", date: "2026-05-25", cashier: "Roberto Díaz", expected: 3450000, actual: 3395000, diff: -55000, status: "warning", discounts: 420000, returns: 2, voids: 2 },
  { id: "c6", date: "2026-05-25", cashier: "Alicia Gimenez", expected: 4780000, actual: 4799000, diff: 19000, status: "ok", discounts: 135000, returns: 0, voids: 0 },
]

const MOCK_RISKS: RiskItem[] = [
  { id: "r1", risk: "Robo interno por parte de cajeros", area: "POS / Caja", probability: 3, impact: 4, owner: "Gerente Operaciones", status: "active", notes: "Controles implementados: cámaras en cajas, conteo doble al cierre." },
  { id: "r2", risk: "Desabastecimiento por falla de proveedor clave", area: "Compras", probability: 2, impact: 5, owner: "Jefe de Compras", status: "active", notes: "Proveedor alternativo identificado para los 10 SKUs más críticos." },
  { id: "r3", risk: "Incumplimiento HACCP en cadena de frío", area: "Carnicería / Pescadería", probability: 2, impact: 5, owner: "Responsable Calidad", status: "mitigated", notes: "Sensores IoT instalados. Alertas automáticas configuradas." },
  { id: "r4", risk: "Pérdida de datos por falla de servidores", area: "IT / Sistemas", probability: 2, impact: 5, owner: "IT Manager", status: "mitigated", notes: "Backups diarios en la nube. RTO estimado: 4 horas." },
  { id: "r5", risk: "Fraude en devoluciones coordinadas", area: "POS / Caja", probability: 2, impact: 3, owner: "Gerente Operaciones", status: "active", notes: "Pendiente: implementar foto obligatoria en devoluciones >Gs 100.000." },
  { id: "r6", risk: "Multas por emisión incorrecta de factura electrónica", area: "Contabilidad / SIFEN", probability: 3, impact: 4, owner: "Contador", status: "active", notes: "Revisión mensual de rechazos SET pendiente de formalizar." },
  { id: "r7", risk: "Merma no detectada en depósito nocturno", area: "Inventario", probability: 4, impact: 3, owner: "Jefe de Almacén", status: "active", notes: "Alertas automáticas por variación configuradas. Cámaras pendientes en sector F." },
]

const RISK_WEEK = [42, 58, 51, 63, 45, 38, 47]

/* ─────────────────────── HELPERS ─────────────────────── */
const formatGs = (n: number) =>
  "Gs " + Math.abs(n).toLocaleString("es-PY")

const severityConfig = {
  critical: { label: "Crítico", color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", dot: "bg-red-500", icon: <AlertOctagon className="w-4 h-4 text-red-500" /> },
  high:     { label: "Alto",    color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30", dot: "bg-orange-500", icon: <AlertTriangle className="w-4 h-4 text-orange-500" /> },
  medium:   { label: "Medio",   color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/30", dot: "bg-yellow-400", icon: <AlertTriangle className="w-4 h-4 text-yellow-500" /> },
  low:      { label: "Bajo",    color: "text-slate-400",  bg: "bg-slate-500/10 border-slate-500/20",   dot: "bg-slate-400",  icon: <Activity className="w-4 h-4 text-slate-400" /> },
}

const riskScore = (p: number, i: number) => p * i
const riskColor = (score: number) => {
  if (score >= 16) return "text-red-500"
  if (score >= 9) return "text-orange-500"
  if (score >= 4) return "text-yellow-500"
  return "text-green-500"
}
const riskBg = (score: number) => {
  if (score >= 16) return "bg-red-500/15"
  if (score >= 9) return "bg-orange-500/15"
  if (score >= 4) return "bg-yellow-500/15"
  return "bg-green-500/15"
}

const statusLabel = { active: "Activo", mitigated: "Mitigado", accepted: "Aceptado" }
const statusColor = { active: "text-red-400", mitigated: "text-green-400", accepted: "text-slate-400" }

const eventIcon = (accion: string = "") => {
  if (accion.includes("venta") || accion.includes("sale")) return <DollarSign className="w-4 h-4" />
  if (accion.includes("product") || accion.includes("precio")) return <Package className="w-4 h-4" />
  if (accion.includes("cliente") || accion.includes("customer")) return <Users className="w-4 h-4" />
  if (accion.includes("stock") || accion.includes("transfer") || accion.includes("merma")) return <Truck className="w-4 h-4" />
  if (accion.includes("login") || accion.includes("seguridad")) return <Lock className="w-4 h-4" />
  if (accion.includes("descuento") || accion.includes("anulacion") || accion.includes("devolucion")) return <CreditCard className="w-4 h-4" />
  return <FileText className="w-4 h-4" />
}

const eventColor = (accion: string = "") => {
  if (accion.includes("venta")) return "text-green-500 bg-green-500/10"
  if (accion.includes("product") || accion.includes("precio")) return "text-blue-500 bg-blue-500/10"
  if (accion.includes("cliente")) return "text-purple-500 bg-purple-500/10"
  if (accion.includes("stock") || accion.includes("transfer")) return "text-amber-500 bg-amber-500/10"
  if (accion.includes("login") || accion.includes("seguridad")) return "text-rose-500 bg-rose-500/10"
  if (accion.includes("descuento") || accion.includes("anulacion") || accion.includes("devolucion")) return "text-orange-500 bg-orange-500/10"
  return "text-slate-500 bg-slate-500/10"
}

/* ─────────────────────── SPARKLINE ─────────────────────── */
function Sparkline({ data, color = "#ef4444" }: { data: number[]; color?: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const h = 40
  const w = 120
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(" ")[pts.split(" ").length - 1].split(",")[0]} cy={pts.split(" ")[pts.split(" ").length - 1].split(",")[1]} r="3" fill={color} />
    </svg>
  )
}

/* ─────────────────────── COMPONENTS ─────────────────────── */
function KpiCard({ icon, label, value, sub, trend, color = "text-primary" }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral"; color?: string
}) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
        {sub && (
          <p className={`text-xs mt-0.5 flex items-center gap-1 ${trend === "down" ? "text-red-500" : trend === "up" ? "text-green-500" : "text-gray-400"}`}>
            {trend === "down" && <TrendingDown className="w-3 h-3" />}
            {trend === "up" && <TrendingUp className="w-3 h-3" />}
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

function RiskGauge({ score }: { score: number }) {
  const clamped = Math.min(Math.max(score, 0), 100)
  const angle = (clamped / 100) * 180 - 90
  const color = score >= 65 ? "#ef4444" : score >= 40 ? "#f97316" : "#22c55e"
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="110" height="60" viewBox="0 0 110 60">
        <path d="M10 55 A45 45 0 0 1 100 55" fill="none" stroke="#374151" strokeWidth="8" strokeLinecap="round" />
        <path d="M10 55 A45 45 0 0 1 100 55" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * 141} 141`} />
        <g transform={`translate(55,55) rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2="-36" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="4" fill={color} />
        </g>
      </svg>
      <p className="text-2xl font-black" style={{ color }}>{score}</p>
      <p className="text-xs text-gray-500">{score >= 65 ? "RIESGO ALTO" : score >= 40 ? "RIESGO MODERADO" : "BAJO RIESGO"}</p>
    </div>
  )
}

/* ─────────────────────── MAIN PAGE ─────────────────────── */
export default function AuditPage() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [alerts, setAlerts] = useState<InternalAlert[]>(MOCK_ALERTS)
  const [risks, setRisks] = useState<RiskItem[]>(MOCK_RISKS)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showDetails, setShowDetails] = useState<string | null>(null)
  const [configForm, setConfigForm] = useState({ url_base: "", api_key: "", auto_sync: false })
  const [saving, setSaving] = useState(false)
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [showResolved, setShowResolved] = useState(false)
  const [editingRisk, setEditingRisk] = useState<string | null>(null)
  const [newRisk, setNewRisk] = useState(false)
  const [newRiskForm, setNewRiskForm] = useState<Omit<RiskItem, "id">>({
    risk: "", area: "", probability: 3, impact: 3, owner: "", status: "active", notes: ""
  })
  const toast = useToast()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.inteliaudit.logs({ limit: 200 })
      setLogs(Array.isArray(data) && data.length > 0 ? (data as unknown as AuditLog[]) : MOCK_LOGS)
    } catch {
      setLogs(MOCK_LOGS)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.inteliaudit.syncConfig()
      setConfig(data)
      if (data?.url_base) {
        setConfigForm({ url_base: data.url_base, api_key: data.api_key ?? "", auto_sync: data.auto_sync ?? false })
      }
    } catch {}
  }, [])

  useEffect(() => { fetchLogs(); fetchConfig() }, [fetchLogs, fetchConfig])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      if (config && (config as Record<string, unknown>).enabled) {
        await api.inteliaudit.updateSyncConfig(configForm)
      } else {
        await api.inteliaudit.createSyncConfig(configForm)
      }
      toast.success("Guardado", "Configuración de InteliAudit actualizada")
      await fetchConfig()
    } catch {
      toast.error("Error", "No se pudo guardar la configuración")
    } finally {
      setSaving(false)
    }
  }

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a))
    toast.success("Alerta resuelta", "Marcada como revisada")
  }

  const addRisk = () => {
    if (!newRiskForm.risk || !newRiskForm.area) return
    setRisks(prev => [...prev, { ...newRiskForm, id: "r" + Date.now() }])
    setNewRisk(false)
    setNewRiskForm({ risk: "", area: "", probability: 3, impact: 3, owner: "", status: "active", notes: "" })
    toast.success("Riesgo agregado", "Registrado en la matriz de riesgos")
  }

  const toggleRiskStatus = (id: string) => {
    setRisks(prev => prev.map(r => r.id === id ? {
      ...r, status: r.status === "active" ? "mitigated" : r.status === "mitigated" ? "accepted" : "active"
    } : r))
  }

  // Derived stats
  const activeAlerts = alerts.filter(a => !a.resolved)
  const criticalCount = activeAlerts.filter(a => a.severity === "critical").length
  const highCount = activeAlerts.filter(a => a.severity === "high").length
  const totalCashDiff = MOCK_CASH.reduce((s, c) => s + c.diff, 0)
  const riskScoreVal = Math.min(100, Math.round(
    criticalCount * 20 + highCount * 10 + alerts.filter(a => !a.resolved && a.severity === "medium").length * 5 + 10
  ))

  const filteredLogs = logs.filter(e =>
    !search ||
    (e.accion ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.user_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.entidad ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const filteredAlerts = alerts.filter(a => {
    if (!showResolved && a.resolved) return false
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false
    return true
  })

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "alerts", label: "Alertas", icon: <AlertTriangle className="w-4 h-4" />, badge: activeAlerts.length },
    { id: "cash", label: "Control de Caja", icon: <DollarSign className="w-4 h-4" /> },
    { id: "log", label: "Log de Auditoría", icon: <List className="w-4 h-4" /> },
    { id: "risks", label: "Matriz de Riesgos", icon: <BarChart2 className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            InteliAudit &amp; Control Interno
          </h1>
          <p className="text-sm text-gray-500">Gobierno, Riesgo y Control — visión ejecutiva consolidada</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={fetchLogs}><RefreshCw className="w-4 h-4" /></button>
          <button className={`btn-ghost ${showConfig ? "text-primary" : ""}`} onClick={() => setShowConfig(!showConfig)}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Config Panel ── */}
      {showConfig && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Configuración — Sincronización InteliAudit Externo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="input-label">URL Base InteliAudit</label>
              <input className="input-field" placeholder="https://inteliaudit.miempresa.com" value={configForm.url_base} onChange={e => setConfigForm({ ...configForm, url_base: e.target.value })} />
            </div>
            <div>
              <label className="input-label">API Key</label>
              <input className="input-field" type="password" placeholder="••••••••" value={configForm.api_key} onChange={e => setConfigForm({ ...configForm, api_key: e.target.value })} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={configForm.auto_sync} onChange={e => setConfigForm({ ...configForm, auto_sync: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm">Auto-sincronizar</span>
              </label>
            </div>
          </div>
          <button className="btn-primary" onClick={handleSaveConfig} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null} Guardar
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700 pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge ? (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {t.badge > 9 ? "9+" : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: DASHBOARD ══════════════ */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Risk + KPIs row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Risk Gauge card */}
            <div className="card p-6 flex flex-col items-center gap-2 col-span-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Índice de Riesgo Operativo</p>
              <RiskGauge score={riskScoreVal} />
              <p className="text-xs text-gray-400 mt-1">Calculado en base a alertas activas</p>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-red-500 font-bold">{criticalCount} críticas</span>
                <span className="text-orange-500 font-bold">{highCount} altas</span>
              </div>
            </div>

            {/* Sparkline card */}
            <div className="card p-6 col-span-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Evolución del Riesgo — 7 días</p>
              <Sparkline data={RISK_WEEK} color={riskScoreVal >= 65 ? "#ef4444" : riskScoreVal >= 40 ? "#f97316" : "#22c55e"} />
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Hoy</span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="card p-6 col-span-1 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resumen de Hoy</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Alertas sin resolver</span>
                  <span className="font-bold text-red-500">{activeAlerts.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Diferencia de caja</span>
                  <span className={`font-bold ${totalCashDiff < 0 ? "text-red-500" : "text-green-500"}`}>{formatGs(totalCashDiff)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Descuentos manuales</span>
                  <span className="font-bold text-orange-500">{formatGs(MOCK_CASH.filter(c => c.date === "2026-05-27").reduce((s, c) => s + c.discounts, 0))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Anulaciones totales</span>
                  <span className="font-bold text-purple-500">{MOCK_CASH.reduce((s, c) => s + c.voids, 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Riesgos activos</span>
                  <span className="font-bold text-amber-500">{risks.filter(r => r.status === "active").length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<AlertOctagon className="w-5 h-5" />} label="Alertas Críticas" value={criticalCount.toString()} sub="Sin resolver hoy" trend="down" color="text-red-500" />
            <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Descuentos Manuales" value={formatGs(835000)} sub="+18% vs ayer" trend="down" color="text-orange-500" />
            <KpiCard icon={<RotateCcw className="w-5 h-5" />} label="Devoluciones" value="4 ops" sub="Gs 310.000 total" trend="down" color="text-purple-500" />
            <KpiCard icon={<Minus className="w-5 h-5" />} label="Merma diaria" value="8.0%" sub="Promedio: 3.2%" trend="down" color="text-red-500" />
          </div>

          {/* Critical alerts preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-red-500" /> Alertas Críticas Activas
              </h2>
              <button className="text-sm text-primary hover:underline" onClick={() => setTab("alerts")}>Ver todas →</button>
            </div>
            <div className="space-y-2">
              {alerts.filter(a => a.severity === "critical" && !a.resolved).map(a => (
                <div key={a.id} className={`card p-4 border ${severityConfig[a.severity].bg}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">{severityConfig[a.severity].icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{a.type}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                    </div>
                    <button className="btn-ghost text-xs text-green-500 flex-shrink-0" onClick={() => resolveAlert(a.id)}>
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {alerts.filter(a => a.severity === "critical" && !a.resolved).length === 0 && (
                <div className="card p-6 text-center text-green-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-medium">Sin alertas críticas activas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TAB: ALERTS ══════════════ */}
      {tab === "alerts" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1 text-xs text-gray-500"><Filter className="w-3 h-3" /> Severidad:</div>
            {["all", "critical", "high", "medium", "low"].map(s => (
              <button
                key={s}
                onClick={() => setFilterSeverity(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterSeverity === s ? "bg-primary text-white border-primary" : "border-gray-300 dark:border-gray-600 text-gray-500 hover:border-primary"
                }`}
              >
                {s === "all" ? "Todas" : severityConfig[s as keyof typeof severityConfig].label}
              </button>
            ))}
            <label className="flex items-center gap-2 ml-auto text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} className="rounded" />
              Mostrar resueltas
            </label>
          </div>

          {/* Alert cards */}
          {filteredAlerts.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="font-bold">Sin alertas en esta categoría</p>
            </div>
          ) : (
            filteredAlerts.map(a => {
              const cfg = severityConfig[a.severity]
              const isOpen = expandedAlert === a.id
              return (
                <div key={a.id} className={`card border transition-all ${a.resolved ? "opacity-60" : ""} ${cfg.bg}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{a.area}</span>
                          {a.resolved && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full">Resuelta</span>}
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">{a.type}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          {a.user && <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.user}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(a.timestamp).toLocaleString("es-PY")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!a.resolved && (
                          <button className="btn-ghost text-xs text-green-500" title="Marcar como resuelta" onClick={() => resolveAlert(a.id)}>
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button className="btn-ghost text-xs" onClick={() => setExpandedAlert(isOpen ? null : a.id)}>
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Acción Recomendada</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          {a.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══════════════ TAB: CASH CONTROL ══════════════ */}
      {tab === "cash" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Diferencia Total" value={formatGs(totalCashDiff)} sub="Últimos 3 días" trend="down" color="text-red-500" />
            <KpiCard icon={<CreditCard className="w-5 h-5" />} label="Descuentos Manuales" value={formatGs(MOCK_CASH.reduce((s, c) => s + c.discounts, 0))} sub="Todos los cajeros" color="text-orange-500" />
            <KpiCard icon={<RotateCcw className="w-5 h-5" />} label="Total Devoluciones" value={MOCK_CASH.reduce((s, c) => s + c.returns, 0) + " ops"} sub="6 cierres evaluados" color="text-purple-500" />
            <KpiCard icon={<XCircle className="w-5 h-5" />} label="Anulaciones" value={MOCK_CASH.reduce((s, c) => s + c.voids, 0) + " ops"} sub="6 cierres evaluados" color="text-red-500" />
          </div>

          {/* Cash sessions table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Cierres de Caja</h2>
              <button className="btn-ghost text-xs flex items-center gap-1"><Download className="w-3 h-3" />Exportar</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cajero</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Esperado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Real</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Diferencia</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descuentos</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dev.</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Anul.</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_CASH.map((c, i) => (
                    <tr key={c.id} className={`border-b border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/20"}`}>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.date}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.cashier}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatGs(c.expected)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatGs(c.actual)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${c.diff < -50000 ? "text-red-500" : c.diff < 0 ? "text-yellow-500" : "text-green-500"}`}>
                        {c.diff >= 0 ? "+" : ""}{formatGs(c.diff)}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-500">{formatGs(c.discounts)}</td>
                      <td className="px-4 py-3 text-center">{c.returns}</td>
                      <td className="px-4 py-3 text-center">{c.voids}</td>
                      <td className="px-4 py-3 text-center">
                        {c.status === "ok" && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center"><CheckCircle className="w-3 h-3" />OK</span>}
                        {c.status === "warning" && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center"><AlertTriangle className="w-3 h-3" />Atención</span>}
                        {c.status === "critical" && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center"><AlertOctagon className="w-3 h-3" />Crítico</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cashier ranking */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-500" /> Ranking Descuentos Manuales
              </h3>
              {["Roberto Díaz", "Alicia Gimenez", "Lorenzo Caballero"].map((c, i) => {
                const total = MOCK_CASH.filter(x => x.cashier === c).reduce((s, x) => s + x.discounts, 0)
                const max = 1010000
                return (
                  <div key={c} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{i + 1}. {c}</span>
                      <span className="font-bold text-orange-500">{formatGs(total)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${(total / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" /> Ranking Anulaciones
              </h3>
              {["Roberto Díaz", "Alicia Gimenez", "Lorenzo Caballero"].map((c, i) => {
                const total = MOCK_CASH.filter(x => x.cashier === c).reduce((s, x) => s + x.voids, 0)
                const max = 5
                return (
                  <div key={c} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{i + 1}. {c}</span>
                      <span className="font-bold text-red-500">{total} anulaciones</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${(total / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TAB: EXTERNAL AUDIT LOG ══════════════ */}
      {tab === "log" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por acción, usuario o entidad..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn-ghost flex items-center gap-1 text-sm"><Download className="w-4 h-4" />CSV</button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : filteredLogs.length === 0 ? (
              <div className="card p-8 text-center text-gray-400">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">Sin eventos de auditoría</p>
              </div>
            ) : (
              filteredLogs.map((e, i) => (
                <div key={e.id ?? i} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${eventColor(e.accion)}`}>
                      {eventIcon(e.accion)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white capitalize">{(e.accion ?? "").replace(/_/g, " ")}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{e.entidad ?? "?"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1"><User className="w-3 h-3" />{e.user_id ?? "Sistema"}</div>
                        <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.created_at ? new Date(e.created_at).toLocaleString("es-PY") : "-"}</div>
                        {e.ip_address && <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />{e.ip_address}</span>}
                      </div>
                      <button
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                        onClick={() => setShowDetails(showDetails === e.id ? null : (e.id ?? ""))}
                      >
                        {showDetails === e.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showDetails === e.id ? "Ocultar" : "Ver diff"}
                      </button>
                      {showDetails === e.id && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {e.datos_anteriores && Object.keys(e.datos_anteriores).length > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg text-xs font-mono border border-red-200 dark:border-red-800">
                              <span className="text-red-500 font-bold block mb-1">− Antes</span>
                              <pre className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{JSON.stringify(e.datos_anteriores, null, 2)}</pre>
                            </div>
                          )}
                          {e.datos_nuevos && Object.keys(e.datos_nuevos).length > 0 && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-xs font-mono border border-green-200 dark:border-green-800">
                              <span className="text-green-500 font-bold block mb-1">+ Después</span>
                              <pre className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{JSON.stringify(e.datos_nuevos, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════════ TAB: RISK MATRIX ══════════════ */}
      {tab === "risks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Score = Probabilidad × Impacto (1–5 cada uno)</p>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs flex items-center gap-1"><Download className="w-3 h-3" />Exportar</button>
              <button className="btn-primary text-xs flex items-center gap-1" onClick={() => setNewRisk(true)}>
                <Plus className="w-3 h-3" />Agregar Riesgo
              </button>
            </div>
          </div>

          {/* New risk form */}
          {newRisk && (
            <div className="card p-4 border border-primary/30 bg-primary/5 space-y-3">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Nuevo Riesgo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Riesgo identificado</label>
                  <input className="input-field" value={newRiskForm.risk} onChange={e => setNewRiskForm({ ...newRiskForm, risk: e.target.value })} placeholder="Describir el riesgo..." />
                </div>
                <div>
                  <label className="input-label">Área</label>
                  <input className="input-field" value={newRiskForm.area} onChange={e => setNewRiskForm({ ...newRiskForm, area: e.target.value })} placeholder="Ej: Caja, Inventario..." />
                </div>
                <div>
                  <label className="input-label">Probabilidad (1–5)</label>
                  <input className="input-field" type="number" min={1} max={5} value={newRiskForm.probability} onChange={e => setNewRiskForm({ ...newRiskForm, probability: +e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Impacto (1–5)</label>
                  <input className="input-field" type="number" min={1} max={5} value={newRiskForm.impact} onChange={e => setNewRiskForm({ ...newRiskForm, impact: +e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Responsable</label>
                  <input className="input-field" value={newRiskForm.owner} onChange={e => setNewRiskForm({ ...newRiskForm, owner: e.target.value })} placeholder="Nombre o rol..." />
                </div>
                <div>
                  <label className="input-label">Notas</label>
                  <input className="input-field" value={newRiskForm.notes} onChange={e => setNewRiskForm({ ...newRiskForm, notes: e.target.value })} placeholder="Controles implementados..." />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-sm" onClick={addRisk}>Guardar</button>
                <button className="btn-ghost text-sm" onClick={() => setNewRisk(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Risk table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Riesgo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Área</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">P</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">I</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Responsable</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {risks.sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact)).map((r, i) => {
                    const score = riskScore(r.probability, r.impact)
                    const isEditing = editingRisk === r.id
                    return (
                      <tr key={r.id} className={`border-b border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/20"}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white">{r.risk}</p>
                          {r.notes && <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{r.notes}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.area}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">{r.probability}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300">{r.impact}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-black text-lg ${riskColor(score)}`}>{score}</span>
                          <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${riskBg(score)} ${riskColor(score)}`}>
                            {score >= 16 ? "ALTO" : score >= 9 ? "MOD" : score >= 4 ? "BAJO" : "MIN"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.owner}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[r.status]} bg-gray-100 dark:bg-gray-700`}
                            onClick={() => toggleRiskStatus(r.id)}
                            title="Click para cambiar estado"
                          >
                            {statusLabel[r.status]}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="btn-ghost text-xs" onClick={() => setEditingRisk(isEditing ? null : r.id)}>
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/80" />Score ≥16: Alto</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500/80" />Score ≥9: Moderado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/80" />Score ≥4: Bajo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/80" />Score &lt;4: Mínimo</span>
            <span className="ml-auto">P = Probabilidad · I = Impacto · Click en Estado para cambiarlo</span>
          </div>
        </div>
      )}
    </div>
  )
}
