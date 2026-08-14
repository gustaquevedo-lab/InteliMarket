import { useState, useEffect } from "react"
import { Bot, Sparkles, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { api, type FinanceRecommendation, type FinanceAgentRun } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import { formatDateTime } from "../../utils/format"

const TIPO_LABEL: Record<string, string> = {
  cobranza: "Cobranza",
  pago_proveedor: "Pago a proveedor",
  alerta_presupuesto: "Presupuesto",
  arqueo_caja: "Arqueo de caja",
  deposito_pendiente: "Depósito pendiente",
  divergencia_saldo: "Divergencia de saldo",
  reduccion_gasto: "Reducción de gasto",
  otro: "Otro",
}

const PAGE_SIZE = 50

export default function FinanceAgentPage() {
  const [recs, setRecs] = useState<FinanceRecommendation[]>([])
  const [counts, setCounts] = useState<{ tipo: string; cantidad: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [running, setRunning] = useState(false)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [bulkDeciding, setBulkDeciding] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("pending")
  const [filterTipo, setFilterTipo] = useState<string>("todos")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastRun, setLastRun] = useState<FinanceAgentRun | null>(null)
  const toast = useToast()
  const { user } = useAuth()

  const fetchRecs = async (offset = 0) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true)
    try {
      const status = filterStatus === "todos" ? undefined : filterStatus
      const tipo = filterTipo === "todos" ? undefined : filterTipo
      const [data, countsData] = await Promise.all([
        api.financeAgent.recommendations(status, tipo, PAGE_SIZE, offset),
        offset === 0 ? api.financeAgent.countByTipo(status) : Promise.resolve(counts),
      ])
      setRecs(offset === 0 ? data : [...recs, ...data])
      setHasMore(data.length === PAGE_SIZE)
      if (offset === 0) setCounts(countsData)
    } catch {
      if (offset === 0) setRecs([])
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }

  useEffect(() => { setSelected(new Set()); fetchRecs(0) }, [filterStatus, filterTipo])

  const runDiagnosis = async () => {
    setRunning(true)
    try {
      const run = await api.financeAgent.run()
      setLastRun(run)
      if (run.status === "error") {
        toast.error(run.error_message || "El Gerente IA no pudo completar el diagnóstico")
      } else {
        toast.success("Diagnóstico generado")
      }
      await fetchRecs(0)
    } catch (e: any) {
      toast.error(e.message || "Error al correr el diagnóstico")
    } finally { setRunning(false) }
  }

  const decide = async (id: string, approve: boolean) => {
    if (!user) return
    setDeciding(id)
    try {
      await (approve ? api.financeAgent.approve(id, user.id) : api.financeAgent.reject(id, user.id))
      toast.success(approve ? "Recomendación aprobada" : "Recomendación rechazada")
      await fetchRecs(0)
    } catch (e: any) {
      toast.error(e.message || "No se pudo registrar la decisión")
    } finally { setDeciding(null) }
  }

  const toggleSelected = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleSelectAll = () => {
    const visiblePending = recs.filter(r => r.status === "pending").map(r => r.id)
    setSelected(prev => prev.size === visiblePending.length ? new Set() : new Set(visiblePending))
  }

  const bulkDecide = async (approve: boolean) => {
    if (!user || selected.size === 0) return
    setBulkDeciding(true)
    try {
      const result = await api.financeAgent.bulkDecide(approve, Array.from(selected), user.id)
      toast.success(approve ? "Aprobadas en lote" : "Rechazadas en lote", `${result.decididas} recomendaciones`)
      setSelected(new Set())
      await fetchRecs(0)
    } catch (e: any) {
      toast.error(e.message || "No se pudo aplicar la decisión en lote")
    } finally { setBulkDeciding(false) }
  }

  const visiblePendingCount = recs.filter(r => r.status === "pending").length
  const totalPending = counts.reduce((s, c) => s + c.cantidad, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white">
            <Bot size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gerente Financiero IA</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Diagnóstico y recomendaciones — vos aprobás, nunca actúa solo</p>
          </div>
        </div>
        <button className="btn-secondary" onClick={runDiagnosis} disabled={running}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {running ? "Analizando…" : "Analizar ahora"}
        </button>
      </div>

      {lastRun?.diagnostico && (
        <div className="card p-5">
          <div className="input-label mb-2">Último diagnóstico</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{lastRun.diagnostico}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {["pending", "approved", "rejected", "todos"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${filterStatus === s ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}
            >
              {s === "pending" ? `Pendientes${totalPending ? ` (${totalPending})` : ""}` : s === "approved" ? "Aprobadas" : s === "rejected" ? "Rechazadas" : "Todas"}
            </button>
          ))}
        </div>
        <select className="input-field w-fit text-sm" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          {counts.map(c => (
            <option key={c.tipo} value={c.tipo}>{(TIPO_LABEL[c.tipo] || c.tipo)} ({c.cantidad})</option>
          ))}
        </select>
      </div>

      {filterStatus === "pending" && visiblePendingCount > 0 && (
        <div className="card p-3 flex items-center gap-3 flex-wrap bg-gray-50 dark:bg-slate-800/50">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={selected.size === visiblePendingCount && visiblePendingCount > 0} onChange={toggleSelectAll} />
            Seleccionar visibles ({visiblePendingCount})
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-gray-400">{selected.size} seleccionadas</span>
              <button onClick={() => bulkDecide(true)} disabled={bulkDeciding} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50">
                {bulkDeciding ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Aprobar seleccionadas
              </button>
              <button onClick={() => bulkDecide(false)} disabled={bulkDeciding} className="btn-outline !px-3 !py-1.5 text-xs disabled:opacity-50">
                <XCircle size={12} /> Rechazar seleccionadas
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
      ) : recs.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
          No hay recomendaciones {filterStatus === "pending" ? "pendientes" : "en este estado"}. Corré "Analizar ahora" para generar el primer diagnóstico.
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-700/50">
          {recs.map(r => (
            <div key={r.id} className="p-4 flex items-start gap-4">
              {r.status === "pending" && (
                <input type="checkbox" className="mt-1.5" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-info">{TIPO_LABEL[r.tipo] || r.tipo}</span>
                  <span className="text-xs text-gray-400">{formatDateTime(r.created_at)}</span>
                </div>
                <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{r.titulo}</div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.descripcion}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  {r.entidad_relacionada && <span>👤 {r.entidad_relacionada}</span>}
                  {r.monto_relacionado && <span className="font-mono font-bold">{r.monto_relacionado}</span>}
                </div>
                {r.comments && <p className="text-xs text-gray-400 mt-1 italic">Nota: {r.comments}</p>}
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2 flex-none">
                  <button className="btn-secondary !px-3 !py-2" disabled={deciding === r.id} onClick={() => decide(r.id, true)}>
                    {deciding === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Aprobar
                  </button>
                  <button className="btn-outline !px-3 !py-2" disabled={deciding === r.id} onClick={() => decide(r.id, false)}>
                    <XCircle size={14} /> Rechazar
                  </button>
                </div>
              ) : (
                <span className={r.status === "approved" ? "badge-success" : "badge-danger"}>
                  {r.status === "approved" ? "Aprobada" : "Rechazada"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={() => fetchRecs(0)} className="btn-ghost text-xs">
          <RefreshCw size={12} /> Actualizar lista
        </button>
        {hasMore && recs.length > 0 && (
          <button onClick={() => fetchRecs(recs.length)} disabled={loadingMore} className="btn-ghost text-xs disabled:opacity-50">
            {loadingMore ? <Loader2 size={12} className="animate-spin" /> : null} Cargar más
          </button>
        )}
      </div>
    </div>
  )
}
