import { useState, useEffect } from "react"
import { Plus, Search, Loader2, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, DollarSign, CheckCircle, XCircle, AlertCircle, CreditCard } from "lucide-react"
import { api, type CashRegister, type CashSession } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

const registerStatusMap: Record<string, string> = {
  activa: "badge-success",
  cerrada: "badge-danger",
}

export default function CajaPage() {
  const [activeTab, setActiveTab] = useState<"registers" | "sessions">("registers")
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null)
  const [selectedRegister, setSelectedRegister] = useState<string>("")
  const [montoApertura, setMontoApertura] = useState("0")
  const [montoCierre, setMontoCierre] = useState("0")
  const [observacionesCierre, setObservacionesCierre] = useState("")
  const [newRegisterName, setNewRegisterName] = useState("")
  const [newRegisterType, setNewRegisterType] = useState("principal")
  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [regsData, sessionsData] = await Promise.allSettled([
        api.caja.registers.list(),
        api.caja.sessions.list({ estado: "abierta" }),
      ])
      if (regsData.status === "fulfilled") setRegisters(regsData.value)
      if (sessionsData.status === "fulfilled") setSessions(sessionsData.value)
      if (regsData.status === "rejected") toast.info("Datos demo", "Conectá el backend para ver datos reales")
    } catch {
      toast.error("Error", "No se pudo cargar")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filteredRegisters = registers.filter(r =>
    !search || r.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const filteredSessions = sessions.filter(s =>
    !search || (s.estado || "").toLowerCase().includes(search.toLowerCase())
  )

  const totalRegisters = registers.length
  const openSessions = sessions.filter(s => s.estado === "abierta").length
  const totalApertura = sessions.reduce((a, s) => a + Number(s.monto_apertura || 0), 0)

  const handleOpenSession = async () => {
    if (!selectedRegister) {
      toast.error("Error", "Seleccioná una caja")
      return
    }
    try {
      await api.caja.sessions.create({
        cash_register_id: selectedRegister,
        user_id: "00000000-0000-0000-0000-000000000000",
        monto_apertura: parseFloat(montoApertura) || 0,
      })
      toast.success("Caja abierta", "Sesión de caja iniciada correctamente")
      setShowOpenModal(false)
      setMontoApertura("0")
      setSelectedRegister("")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo abrir la caja")
    }
  }

  const handleCloseSession = async () => {
    if (!selectedSession) return
    try {
      await api.caja.sessions.close(selectedSession.id, {
        monto_cierre_real: parseFloat(montoCierre) || 0,
        observaciones: observacionesCierre,
      })
      toast.success("Caja cerrada", "Sesión cerrada correctamente")
      setShowCloseModal(false)
      setMontoCierre("0")
      setObservacionesCierre("")
      setSelectedSession(null)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo cerrar la caja")
    }
  }

  const handleCreateRegister = async () => {
    if (!newRegisterName) {
      toast.error("Error", "Ingresá un nombre")
      return
    }
    try {
      await api.caja.registers.create({
        branch_id: "00000000-0000-0000-0000-000000000001",
        nombre: newRegisterName,
        tipo: newRegisterType,
      })
      toast.success("Caja creada", "Caja registrada correctamente")
      setShowCreateModal(false)
      setNewRegisterName("")
      setNewRegisterType("principal")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la caja")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de cajas y sesiones de cobro</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="btn-outline">
            <Plus className="w-4 h-4" />
            Nueva caja
          </button>
          <button onClick={() => setShowOpenModal(true)} className="btn-primary">
            <Wallet className="w-4 h-4" />
            Abrir sesión
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cajas activas</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRegisters}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sesiones abiertas</span></div>
          <p className="text-2xl font-bold text-green-500">{openSessions}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-secondary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Monto apertura</span></div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPYG(totalApertura)}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("registers")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "registers" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Cajas</button>
        <button onClick={() => setActiveTab("sessions")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "sessions" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Sesiones</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input-field pl-10" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {activeTab === "registers" ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Nombre</th>
                <th className="table-cell">Tipo</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell">Fecha creación</th>
                <th className="table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredRegisters.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No se encontraron cajas</td></tr>
              ) : (
                filteredRegisters.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td font-bold text-gray-900 dark:text-white">{r.nombre}</td>
                    <td className="table-td capitalize">{r.tipo || "-"}</td>
                    <td className="table-td"><StatusBadge status={r.activo ? "activa" : "cerrada"} map={registerStatusMap} /></td>
                    <td className="table-td text-sm text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString("es-PY") : "-"}</td>
                    <td className="table-td">
                      <button onClick={() => { setSelectedRegister(r.id); setShowOpenModal(true) }} className="btn-ghost text-xs">Abrir sesión</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Caja</th>
                <th className="table-cell">Apertura</th>
                <th className="table-cell text-right">Monto</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredSessions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No hay sesiones abiertas</td></tr>
              ) : (
                filteredSessions.map((s) => (
                  <tr key={s.id} className="table-row">
                    <td className="table-td font-bold text-gray-900 dark:text-white">{s.cash_register?.nombre || s.caja?.nombre || "Caja"}</td>
                    <td className="table-td text-sm">{s.fecha_apertura ? new Date(s.fecha_apertura).toLocaleString("es-PY") : "-"}</td>
                    <td className="table-td text-right font-mono font-bold">{formatPYG(s.monto_apertura)}</td>
                    <td className="table-td"><StatusBadge status={s.estado || "-"} map={{ abierta: "badge-success", cerrada: "badge-danger" }} /></td>
                    <td className="table-td">
                      {s.estado === "abierta" && (
                        <button onClick={() => { setSelectedSession(s); setMontoCierre("0"); setShowCloseModal(true) }} className="btn-ghost text-xs">Cerrar</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Register Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nueva caja</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input-field" placeholder="Caja principal" value={newRegisterName} onChange={(e) => setNewRegisterName(e.target.value)} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input-field" value={newRegisterType} onChange={(e) => setNewRegisterType(e.target.value)}>
                  <option value="principal">Principal</option>
                  <option value="secundaria">Secundaria</option>
                  <option value="express">Express</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCreateRegister}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open Session Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowOpenModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Abrir sesión de caja</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Caja</label>
                <select className="input-field" value={selectedRegister} onChange={(e) => setSelectedRegister(e.target.value)}>
                  <option value="">Seleccionar caja</option>
                  {registers.filter(r => r.activo).map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Monto de apertura (₲)</label>
                <input className="input-field" type="number" placeholder="0" value={montoApertura} onChange={(e) => setMontoApertura(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowOpenModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleOpenSession}>Abrir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Session Modal */}
      {showCloseModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCloseModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Cerrar sesión</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Caja</span><span className="font-bold">{selectedSession.cash_register?.nombre || selectedSession.caja?.nombre || "-"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Monto apertura</span><span className="font-mono font-bold">{formatPYG(selectedSession.monto_apertura)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Apertura</span><span className="font-bold">{selectedSession.fecha_apertura ? new Date(selectedSession.fecha_apertura).toLocaleString("es-PY") : "-"}</span></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Monto de cierre (₲)</label>
                <input className="input-field" type="number" placeholder="0" value={montoCierre} onChange={(e) => setMontoCierre(e.target.value)} />
              </div>
              <div>
                <label className="label">Observaciones</label>
                <textarea className="input-field" placeholder="Notas de cierre..." value={observacionesCierre} onChange={(e) => setObservacionesCierre(e.target.value)} rows={3} />
              </div>
              {parseFloat(montoCierre) !== 0 && (
                <div className={`p-3 rounded-xl text-sm ${parseFloat(montoCierre) >= (selectedSession.monto_apertura || 0) ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                  <p className="font-bold">{parseFloat(montoCierre) >= (selectedSession.monto_apertura || 0) ? "Sin diferencia" : "Diferencia negativa"}</p>
                </div>
              )}
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowCloseModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCloseSession}>Cerrar caja</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
