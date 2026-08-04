import { useState, useEffect, useCallback, useMemo } from "react"
import { Target, TrendingUp, Users, Trophy, ChevronLeft, ChevronRight, RefreshCw, Sparkles, UserCog } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { api, SalesRep, RepProgress, CascadeStatus, SuggestedTarget } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { formatPYG, formatNumber } from "../../utils/format"

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec2e6d"]

type PeriodoTipo = "semanal" | "quincenal" | "mensual"

function computePeriodo(tipo: PeriodoTipo, ref: Date): { inicio: string; fin: string; label: string } {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const d = ref.getDate()
  const iso = (dt: Date) => dt.toISOString().slice(0, 10)

  if (tipo === "mensual") {
    const inicio = new Date(y, m, 1)
    const fin = new Date(y, m + 1, 0)
    return { inicio: iso(inicio), fin: iso(fin), label: inicio.toLocaleDateString("es-PY", { month: "long", year: "numeric" }) }
  }
  if (tipo === "quincenal") {
    if (d <= 15) {
      return { inicio: iso(new Date(y, m, 1)), fin: iso(new Date(y, m, 15)), label: `1ra quincena ${ref.toLocaleDateString("es-PY", { month: "long" })}` }
    }
    return { inicio: iso(new Date(y, m, 16)), fin: iso(new Date(y, m + 1, 0)), label: `2da quincena ${ref.toLocaleDateString("es-PY", { month: "long" })}` }
  }
  // semanal: lunes a domingo
  const dow = (ref.getDay() + 6) % 7
  const lunes = new Date(y, m, d - dow)
  const domingo = new Date(y, m, d - dow + 6)
  return { inicio: iso(lunes), fin: iso(domingo), label: `Semana del ${lunes.toLocaleDateString("es-PY")}` }
}

function ProgressBar({ pct, cumplido }: { pct: number; cumplido: boolean }) {
  const w = Math.min(100, Math.max(0, pct))
  return (
    <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${cumplido ? "bg-emerald-500" : pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-red-400"}`}
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color = "primary" }: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg bg-${color}/10 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-${color}`} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function PeriodoSelector({ tipo, setTipo, ref, setRef, label }: { tipo: PeriodoTipo; setTipo: (t: PeriodoTipo) => void; ref: Date; setRef: (d: Date) => void; label: string }) {
  const shift = (dir: number) => {
    const d = new Date(ref)
    if (tipo === "mensual") d.setMonth(d.getMonth() + dir)
    else if (tipo === "quincenal") d.setDate(d.getDate() + dir * 15)
    else d.setDate(d.getDate() + dir * 7)
    setRef(d)
  }
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {(["semanal", "quincenal", "mensual"] as PeriodoTipo[]).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition ${tipo === t ? "bg-white dark:bg-gray-700 shadow text-primary" : "text-gray-500"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold capitalize min-w-[160px] text-center">{label}</span>
        <button onClick={() => shift(1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function RepRow({ p }: { p: RepProgress }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{p.nombre}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1"><ProgressBar pct={p.pct_gs} cumplido={p.cumplido} /></div>
          <span className="text-xs font-bold text-gray-500 w-12 text-right">{formatNumber(p.pct_gs, 0)}%</span>
        </div>
      </div>
      <div className="text-right w-32">
        <p className="text-xs font-mono">{formatPYG(p.venta_gs)}</p>
        <p className="text-[10px] text-gray-400">meta {formatPYG(p.meta_gs)}</p>
      </div>
      {p.cumplido && <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />}
    </div>
  )
}

// ── Vista Vendedor ──────────────────────────────────────────────────────

function VendedorView({ rep, periodo }: { rep: SalesRep; periodo: { inicio: string; fin: string } }) {
  const [progress, setProgress] = useState<RepProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.salesTargets.getRepProgress(rep.id, periodo.inicio, periodo.fin).then(setProgress).finally(() => setLoading(false))
  }, [rep.id, periodo.inicio, periodo.fin])

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>
  if (!progress) return null

  const falta = Math.max(0, progress.meta_gs - progress.venta_gs)
  const chartData = [
    { name: "Alcanzado", value: Math.min(progress.venta_gs, progress.meta_gs) },
    { name: "Falta", value: falta },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={Target} label="Meta del período" value={formatPYG(progress.meta_gs)} />
        <KpiCard icon={TrendingUp} label="Venta real" value={formatPYG(progress.venta_gs)} color={progress.cumplido ? "emerald-500" : "primary"} />
        <KpiCard icon={Sparkles} label="Avance" value={`${formatNumber(progress.pct_gs, 1)}%`} sub={progress.cumplido ? "¡Meta cumplida! 🎉" : `Faltan ${formatPYG(falta)}`} color={progress.cumplido ? "emerald-500" : "amber-500"} />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Tu progreso</h3>
          <span className="text-xs text-gray-400">{formatNumber(progress.unidades, 0)} / {formatNumber(progress.meta_unidades, 0)} unidades</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} startAngle={90} endAngle={-270}>
                  <Cell fill={progress.cumplido ? "#10b981" : "#6366f1"} />
                  <Cell fill="#e5e7eb" />
                </Pie>
                <Tooltip formatter={(v: number) => formatPYG(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <ProgressBar pct={progress.pct_gs} cumplido={progress.cumplido} />
            <p className="text-sm text-gray-500 mt-3">
              Llevás vendido <strong>{formatPYG(progress.venta_gs)}</strong> de una meta de <strong>{formatPYG(progress.meta_gs)}</strong>.
            </p>
            {progress.cumplido ? (
              <p className="text-sm text-emerald-600 font-bold mt-2">¡Superaste tu meta este período!</p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">Te faltan <strong>{formatPYG(falta)}</strong> para llegar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Vista Supervisor ─────────────────────────────────────────────────────

function SupervisorView({ rep, periodo }: { rep: SalesRep; periodo: { inicio: string; fin: string } }) {
  const [cascade, setCascade] = useState<CascadeStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.salesTargets.getCascadeStatus(rep.id, periodo.inicio, periodo.fin).then(setCascade).finally(() => setLoading(false))
  }, [rep.id, periodo.inicio, periodo.fin])

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>
  if (!cascade) return null

  const totalVenta = cascade.equipo.reduce((s, p) => s + p.venta_gs, 0)
  const totalMeta = cascade.equipo.reduce((s, p) => s + p.meta_gs, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Equipo activo" value={String(cascade.equipo_total)} />
        <KpiCard icon={Trophy} label="Cumplieron meta" value={`${cascade.equipo_cumplieron}/${cascade.equipo_total}`} />
        <KpiCard icon={TrendingUp} label="% equipo al día" value={`${formatNumber(cascade.pct_equipo_cumplio, 0)}%`} sub={`umbral ${formatNumber(cascade.umbral_pct, 0)}%`} />
        <KpiCard
          icon={Target}
          label="Estado cascada"
          value={cascade.cascada_cumplida ? "Cumplida" : "Pendiente"}
          color={cascade.cascada_cumplida ? "emerald-500" : "amber-500"}
        />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold">Total del equipo</h3>
          <span className="text-xs font-mono text-gray-400">{formatPYG(totalVenta)} / {formatPYG(totalMeta)}</span>
        </div>
        <ProgressBar pct={totalMeta > 0 ? (totalVenta / totalMeta) * 100 : 0} cumplido={totalVenta >= totalMeta && totalMeta > 0} />
      </div>

      <div className="card p-6">
        <h3 className="font-bold mb-3">Mi equipo</h3>
        {cascade.equipo.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Todavía no tenés vendedores asignados.</p>
        ) : (
          [...cascade.equipo].sort((a, b) => b.pct_gs - a.pct_gs).map((p) => <RepRow key={p.sales_rep_id} p={p} />)
        )}
      </div>
    </div>
  )
}

// ── Vista Gerente Comercial ───────────────────────────────────────────────

function GerenteView({ reps, periodo }: { reps: SalesRep[]; periodo: { inicio: string; fin: string } }) {
  const supervisores = useMemo(() => reps.filter((r) => r.rol === "supervisor" && r.activo), [reps])
  const [cascades, setCascades] = useState<CascadeStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all(supervisores.map((s) => api.salesTargets.getCascadeStatus(s.id, periodo.inicio, periodo.fin)))
      .then(setCascades)
      .finally(() => setLoading(false))
  }, [supervisores.map((s) => s.id).join(","), periodo.inicio, periodo.fin])

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>

  const totalVenta = cascades.reduce((s, c) => s + c.equipo.reduce((s2, p) => s2 + p.venta_gs, 0), 0)
  const totalMeta = cascades.reduce((s, c) => s + c.equipo.reduce((s2, p) => s2 + p.meta_gs, 0), 0)
  const totalVendedores = cascades.reduce((s, c) => s + c.equipo_total, 0)
  const cumplieron = cascades.reduce((s, c) => s + c.equipo_cumplieron, 0)
  const supervisoresCumplidos = cascades.filter((c) => c.cascada_cumplida).length

  const porRama = ["mix", "paresa"].map((rama) => {
    const repsRama = reps.filter((r) => r.rama === rama && r.rol === "vendedor" && r.activo)
    return { name: rama.toUpperCase(), value: repsRama.length }
  })

  const barData = cascades.map((c) => ({
    nombre: c.lider_nombre.split(" ").slice(0, 2).join(" "),
    pct: c.pct_equipo_cumplio,
  }))

  if (supervisores.length === 0) {
    return (
      <div className="card p-8 text-center">
        <UserCog className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Todavía no hay supervisores cargados. Andá a la pestaña de Administración para armar la estructura.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Venta total" value={formatPYG(totalVenta)} sub={`meta ${formatPYG(totalMeta)}`} />
        <KpiCard icon={Users} label="Vendedores" value={`${cumplieron}/${totalVendedores}`} sub="cumplieron su meta" />
        <KpiCard icon={UserCog} label="Supervisores" value={`${supervisoresCumplidos}/${supervisores.length}`} sub="cascada cumplida" />
        <KpiCard icon={Sparkles} label="Avance global" value={totalMeta > 0 ? `${formatNumber((totalVenta / totalMeta) * 100, 1)}%` : "—"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-bold mb-4">Vendedores activos por rama</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porRama} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => `${e.name} (${e.value})`}>
                  {porRama.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-bold mb-4">% de equipo cumplido por supervisor</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${formatNumber(v, 0)}%`} />
                <Bar dataKey="pct" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {cascades.map((c) => (
          <div key={c.lider_id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-bold">{c.lider_nombre}</h4>
                {c.cascada_cumplida && <Trophy className="w-4 h-4 text-amber-400" />}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.cascada_cumplida ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {formatNumber(c.pct_equipo_cumplio, 0)}% del equipo ({c.equipo_cumplieron}/{c.equipo_total})
              </span>
            </div>
            {c.equipo.slice(0, 5).map((p) => <RepRow key={p.sales_rep_id} p={p} />)}
            {c.equipo.length > 5 && <p className="text-xs text-gray-400 text-center pt-2">+{c.equipo.length - 5} más</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Vista Admin ───────────────────────────────────────────────────────────

function AdminView({ reps, onReload }: { reps: SalesRep[]; onReload: () => void }) {
  const [tab, setTab] = useState<"estructura" | "forecast">("estructura")
  const [saving, setSaving] = useState<string | null>(null)
  const supervisoresYGerente = reps.filter((r) => r.rol === "supervisor" || r.rol === "gerente_comercial")

  const [newRep, setNewRep] = useState({ nombre: "", rol: "supervisor", rama: "mix" })
  const [creating, setCreating] = useState(false)

  const [suggestions, setSuggestions] = useState<SuggestedTarget[] | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [ajuste, setAjuste] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState("")

  const now = new Date()
  const mesRef = now.getMonth() + 1
  const periodo = computePeriodo("mensual", now)

  const assignSupervisor = async (repId: string, supervisorId: string | null) => {
    setSaving(repId)
    try {
      await api.salesTargets.updateRep(repId, { supervisor_id: supervisorId })
      onReload()
    } finally {
      setSaving(null)
    }
  }

  const toggleActivo = async (rep: SalesRep) => {
    setSaving(rep.id)
    try {
      await api.salesTargets.updateRep(rep.id, { activo: !rep.activo })
      onReload()
    } finally {
      setSaving(null)
    }
  }

  const createRep = async () => {
    if (!newRep.nombre.trim()) return
    setCreating(true)
    try {
      await api.salesTargets.createRep(newRep)
      setNewRep({ nombre: "", rol: "supervisor", rama: "mix" })
      onReload()
    } finally {
      setCreating(false)
    }
  }

  const runSuggest = async () => {
    setSuggesting(true)
    try {
      const data = await api.salesTargets.suggestTargets({
        periodo_tipo: "mensual", periodo_inicio: periodo.inicio, periodo_fin: periodo.fin,
        mes_referencia: mesRef, ajuste_manual_pct: ajuste,
      })
      setSuggestions(data)
    } finally {
      setSuggesting(false)
    }
  }

  const runPublish = async () => {
    setPublishing(true)
    setPublishMsg("")
    try {
      const res = await api.salesTargets.publishTargets({
        periodo_tipo: "mensual", periodo_inicio: periodo.inicio, periodo_fin: periodo.fin,
        mes_referencia: mesRef, ajuste_manual_pct: ajuste,
      })
      setPublishMsg(`${res.metas_publicadas} metas publicadas para ${periodo.label}.`)
      setSuggestions(null)
    } catch (e) {
      setPublishMsg("No se pudo publicar (¿ya existen metas para este período?)")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        <button onClick={() => setTab("estructura")} className={`px-4 py-2 text-sm font-bold rounded-lg ${tab === "estructura" ? "bg-white dark:bg-gray-700 shadow text-primary" : "text-gray-500"}`}>
          Estructura organizacional
        </button>
        <button onClick={() => setTab("forecast")} className={`px-4 py-2 text-sm font-bold rounded-lg ${tab === "forecast" ? "bg-white dark:bg-gray-700 shadow text-primary" : "text-gray-500"}`}>
          Forecast y publicación de metas
        </button>
      </div>

      {tab === "estructura" && (
        <>
          <div className="card p-6">
            <h3 className="font-bold mb-4">Alta de supervisor / gerente</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="input-label">Nombre</label>
                <input className="input-field" value={newRep.nombre} onChange={(e) => setNewRep({ ...newRep, nombre: e.target.value })} placeholder="Nombre completo" />
              </div>
              <div>
                <label className="input-label">Rol</label>
                <select className="input-field" value={newRep.rol} onChange={(e) => setNewRep({ ...newRep, rol: e.target.value })}>
                  <option value="supervisor">Supervisor</option>
                  <option value="gerente_comercial">Gerente Comercial</option>
                </select>
              </div>
              <div>
                <label className="input-label">Rama</label>
                <select className="input-field" value={newRep.rama} onChange={(e) => setNewRep({ ...newRep, rama: e.target.value })}>
                  <option value="mix">MIX</option>
                  <option value="paresa">PARESA</option>
                </select>
              </div>
              <button onClick={createRep} disabled={creating} className="btn-primary">
                {creating ? "..." : "Agregar"}
              </button>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-4">Vendedores — asignar supervisor / activar-desactivar</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 dark:border-gray-800">
                    <th className="py-2">Nombre</th>
                    <th>Rama</th>
                    <th>Supervisor</th>
                    <th>Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.filter((r) => r.rol === "vendedor").map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-2 font-medium">{r.nombre}</td>
                      <td><span className="text-xs uppercase text-gray-400">{r.rama}</span></td>
                      <td>
                        <select
                          className="input-field text-xs py-1"
                          value={r.supervisor_id || ""}
                          disabled={saving === r.id}
                          onChange={(e) => assignSupervisor(r.id, e.target.value || null)}
                        >
                          <option value="">Sin asignar</option>
                          {supervisoresYGerente.filter((s) => s.rol === "supervisor").map((s) => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleActivo(r)}
                          disabled={saving === r.id}
                          className={`px-2 py-1 rounded-full text-xs font-bold ${r.activo ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {r.activo ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "forecast" && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-bold mb-2">Generar metas sugeridas — {periodo.label}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Prorratea el forecast estadístico (14 años de venta real) entre los vendedores según su participación histórica por línea.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="input-label">Ajuste manual (%)</label>
                <input type="number" className="input-field w-32" value={ajuste} onChange={(e) => setAjuste(Number(e.target.value))} />
              </div>
              <button onClick={runSuggest} disabled={suggesting} className="btn-outline flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${suggesting ? "animate-spin" : ""}`} /> Generar preview
              </button>
              {suggestions && (
                <button onClick={runPublish} disabled={publishing} className="btn-primary">
                  {publishing ? "Publicando..." : `Publicar ${suggestions.length} metas`}
                </button>
              )}
            </div>
            {publishMsg && <p className="text-sm text-emerald-600 mt-3">{publishMsg}</p>}
          </div>

          {suggestions && (
            <div className="card p-6">
              <h4 className="font-bold mb-3">Preview ({suggestions.length} sugerencias)</h4>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 dark:border-gray-800">
                      <th className="py-2">Vendedor</th>
                      <th>Línea</th>
                      <th className="text-right">Meta (Gs)</th>
                      <th className="text-right">Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.slice(0, 200).map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                        <td className="py-1.5">{s.nombre}</td>
                        <td className="text-xs text-gray-400">{s.linea_nombre}</td>
                        <td className="text-right font-mono">{formatPYG(s.monto_gs)}</td>
                        <td className="text-right font-mono">{formatNumber(s.cantidad_unidades, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {suggestions.length > 200 && <p className="text-xs text-gray-400 text-center pt-2">Mostrando 200 de {suggestions.length}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

export default function SalesTargetsPage() {
  const { user } = useAuth()
  const [reps, setReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensual")
  const [periodoRef, setPeriodoRef] = useState(new Date())

  const loadReps = useCallback(() => {
    setLoading(true)
    api.salesTargets.listReps().then(setReps).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadReps() }, [loadReps])

  const periodo = useMemo(() => computePeriodo(periodoTipo, periodoRef), [periodoTipo, periodoRef])

  const rol = user?.rol
  const isAdmin = rol === "admin" || rol === "super_admin" || user?.is_superadmin
  const isGerente = rol === "gerente_comercial"
  const isSupervisor = rol === "supervisor"

  const ownRep = useMemo(() => reps.find((r) => r.user_id === user?.id) || reps[0], [reps, user?.id])

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Cargando módulo de metas...</div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-7 h-7 text-primary" /> Metas de Venta
          </h1>
          <p className="text-sm text-gray-400">Casa Gonzalito — seguimiento en tiempo real</p>
        </div>
        {!isAdmin && (
          <PeriodoSelector tipo={periodoTipo} setTipo={setPeriodoTipo} ref={periodoRef} setRef={setPeriodoRef} label={periodo.label} />
        )}
      </div>

      {isAdmin ? (
        <AdminView reps={reps} onReload={loadReps} />
      ) : isGerente ? (
        <GerenteView reps={reps} periodo={periodo} />
      ) : isSupervisor && ownRep ? (
        <SupervisorView rep={ownRep} periodo={periodo} />
      ) : ownRep ? (
        <VendedorView rep={ownRep} periodo={periodo} />
      ) : (
        <div className="card p-8 text-center text-gray-400">No se encontró tu perfil de vendedor.</div>
      )}
    </div>
  )
}
