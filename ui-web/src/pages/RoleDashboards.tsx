import { useState, useEffect } from "react"
import { Loader2, Package, AlertTriangle, Truck, ClipboardCheck, Users, Gift, CreditCard, UserPlus, ShieldCheck, Wrench, Clock } from "lucide-react"
import { api, COMPANY_ID, type Customer } from "../api"

// Tres paneles reales, uno por rol operativo nuevo -- cada KPI sale de un
// endpoint que ya existe y ya se usa en alguna pantalla de gestion (no se
// inventa ningun numero). Reemplazan, para estos roles, el Panel de Control
// Estrategico completo (que sigue siendo el dashboard de Admin/Gerente):
// ese panel muestra ventas/margen/caja consolidados, informacion que no es
// del trabajo diario de Deposito, Atencion al Cliente o Salon.

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={`h-1 w-full absolute top-0 left-0 ${color}`} />
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function DashboardShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-6 border border-emerald-500/20 shadow-xl">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

export function DepositoDashboard() {
  const [loading, setLoading] = useState(true)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [lots, setLots] = useState<{ kpis: any; lots: any[] }>({ kpis: {}, lots: [] })
  const [pendingAdjustments, setPendingAdjustments] = useState(0)

  useEffect(() => {
    Promise.all([
      api.stock.lowStock().catch(() => []),
      api.inventory.getLotsExpiries({ limit: 6 }).catch(() => ({ kpis: {}, lots: [] })),
      api.inventory.listAdjustments({ estado: "pendiente" }).catch(() => []),
    ]).then(([low, expiries, adjustments]) => {
      setLowStockCount(Array.isArray(low) ? low.length : 0)
      setLots(expiries || { kpis: {}, lots: [] })
      setPendingAdjustments(Array.isArray(adjustments) ? adjustments.length : 0)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>

  const kpis = lots.kpis || {}

  return (
    <DashboardShell title="Panel de Depósito" subtitle="Quiebres de stock, vencimientos y recepciones que necesitan tu atención hoy">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Productos en Quiebre" value={lowStockCount} sub="Bajo el stock mínimo" color="bg-gradient-to-r from-rose-500 to-red-500" />
        <StatCard icon={Clock} label="Lotes Críticos (7 días)" value={kpis.critico_7d ?? 0} sub={`${kpis.vencidos ?? 0} ya vencidos`} color="bg-gradient-to-r from-amber-500 to-orange-500" />
        <StatCard icon={Package} label="Total Lotes con Stock" value={kpis.total_lotes ?? 0} sub={`Valor en riesgo: ₲ ${Math.round(kpis.valor_en_riesgo || 0).toLocaleString("es-PY")}`} color="bg-gradient-to-r from-blue-500 to-indigo-500" />
        <StatCard icon={ClipboardCheck} label="Ajustes Pendientes" value={pendingAdjustments} sub="Esperando aprobación" color="bg-gradient-to-r from-purple-500 to-pink-500" />
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">Próximos a Vencer</h2>
        {lots.lots?.length ? (
          <div className="space-y-1.5">
            {lots.lots.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">{l.product_nombre}</span>
                <span className={`font-mono font-bold ${l.dias_restantes < 0 ? "text-rose-500" : l.dias_restantes <= 7 ? "text-amber-500" : "text-slate-400"}`}>
                  {l.dias_restantes < 0 ? "Vencido" : `${l.dias_restantes} días`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Sin lotes con vencimiento próximo.</p>
        )}
      </div>
    </DashboardShell>
  )
}

export function AtencionClienteDashboard() {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [solicitudes, setSolicitudes] = useState(0)
  const [rewards, setRewards] = useState(0)

  useEffect(() => {
    Promise.all([
      api.customers.list({ limit: 500 }).catch(() => []),
      api.loyalty.solicitudesTarjetas().catch(() => ({ cola: [] })),
      api.loyalty.rewards(COMPANY_ID, true).catch(() => []),
    ]).then(([custs, sol, rew]) => {
      setCustomers(Array.isArray(custs) ? custs : [])
      setSolicitudes(sol?.cola?.length || 0)
      setRewards(Array.isArray(rew) ? rew.length : 0)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>

  const recientes = [...customers]
    .filter(c => c.created_at)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, 6)

  return (
    <DashboardShell title="Panel de Atención al Cliente" subtitle="Clientes, tarjetas ExtraClub y catálogo de premios">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Clientes Registrados" value={customers.length} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
        <StatCard icon={CreditCard} label="Tarjetas por Imprimir" value={solicitudes} sub="Solicitudes en cola" color="bg-gradient-to-r from-amber-500 to-orange-500" />
        <StatCard icon={Gift} label="Premios Activos" value={rewards} sub="Catálogo de canje" color="bg-gradient-to-r from-purple-500 to-pink-500" />
        <StatCard icon={UserPlus} label="Altas Recientes" value={recientes.length} sub="Últimos registrados" color="bg-gradient-to-r from-blue-500 to-indigo-500" />
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">Clientes Registrados Recientemente</h2>
        {recientes.length ? (
          <div className="space-y-1.5">
            {recientes.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">{c.nombre}</span>
                <span className="font-mono text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleDateString("es-PY") : "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Sin clientes registrados todavía.</p>
        )}
      </div>
    </DashboardShell>
  )
}

export function SalonDashboard() {
  const [loading, setLoading] = useState(true)
  const [haccp, setHaccp] = useState<any>({})
  const [equipment, setEquipment] = useState<any>({})
  const [lots, setLots] = useState<{ kpis: any }>({ kpis: {} })

  useEffect(() => {
    Promise.all([
      api.haccp.dashboard().catch(() => ({})),
      api.equipment.dashboard().catch(() => ({})),
      api.inventory.getLotsExpiries({ limit: 1 }).catch(() => ({ kpis: {} })),
    ]).then(([h, e, l]) => {
      setHaccp(h || {})
      setEquipment(e || {})
      setLots(l || { kpis: {} })
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>

  return (
    <DashboardShell title="Panel de Operaciones de Salón" subtitle="Carnicería, frescos, panadería, HACCP y mantenimiento de equipos">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShieldCheck} label="Conformidad HACCP" value={`${haccp.conformidad_pct ?? 0}%`} sub={`${haccp.monitoreos_hoy ?? 0} monitoreos hoy`} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
        <StatCard icon={AlertTriangle} label="Acciones Correctivas" value={haccp.acciones_pendientes ?? 0} sub="Pendientes de resolver" color="bg-gradient-to-r from-rose-500 to-red-500" />
        <StatCard icon={Wrench} label="Mantenimientos Pendientes" value={equipment.mantenimientos_pendientes ?? 0} sub={`${equipment.ordenes_abiertas ?? 0} órdenes abiertas`} color="bg-gradient-to-r from-amber-500 to-orange-500" />
        <StatCard icon={Truck} label="Lotes por Vencer" value={lots.kpis?.critico_7d ?? 0} sub="Próximos 7 días" color="bg-gradient-to-r from-blue-500 to-indigo-500" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 dark:text-white mb-2">HACCP</h2>
          <p className="text-xs text-slate-500">{haccp.planes_activos ?? 0} planes activos · {haccp.puntos_criticos ?? 0} puntos críticos monitoreados</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 dark:text-white mb-2">Equipos</h2>
          <p className="text-xs text-slate-500">{equipment.equipos_activos ?? 0} de {equipment.total_equipos ?? 0} equipos activos · {equipment.alertas_activas ?? 0} alertas sin resolver</p>
        </div>
      </div>
    </DashboardShell>
  )
}
