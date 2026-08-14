import { useState, useEffect } from "react"
import { 
  Landmark, ShieldCheck, ArrowDownRight, ArrowUpRight, Truck, Plus, 
  History, AlertTriangle, Search, RefreshCw, X, Check, Wallet, Banknote,
  Building2, ShieldAlert, FileText, Lock, Clock, User
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

export default function BovedaPage() {
  const [summary, setSummary] = useState<any>(null)
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFilter, setTipoFilter] = useState<string>("")
  const [search, setSearch] = useState("")

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showBlindadoModal, setShowBlindadoModal] = useState(false)

  // Drop Cash form
  const [depositCajera, setDepositCajera] = useState("Alicia Gimenez")
  const [depositCaja, setDepositCaja] = useState("Caja Salón 01")
  const [depositSupervisor, setDepositSupervisor] = useState("Joel - Tesorero Central")
  const [depositMonto, setDepositMonto] = useState("")
  const [depositObs, setDepositObs] = useState("Retiro parcial de caja por exceso de límite operativo")

  // Blindado form
  const [blindadoTransportadora, setBlindadoTransportadora] = useState("Prosegur Paraguay")
  const [blindadoBolsa, setBlindadoBolsa] = useState("")
  const [blindadoBanco, setBlindadoBanco] = useState("Banco Itaú Paraguay")
  const [blindadoCuenta, setBlindadoCuenta] = useState("Cta Cte Principal 0019284-01")
  const [blindadoSupervisor, setBlindadoSupervisor] = useState("Joel - Tesorería")
  const [blindadoMonto, setBlindadoMonto] = useState("")
  const [blindadoObs, setBlindadoObs] = useState("Despacho de remesa blindada para depósito bancario")

  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const loadData = async () => {
    setLoading(true)
    try {
      const [sumRes, movRes] = await Promise.allSettled([
        api.caja.vault.summary(),
        api.caja.vault.movements({ tipo: tipoFilter || undefined, limit: 100 }),
      ])
      if (sumRes.status === "fulfilled") setSummary(sumRes.value)
      if (movRes.status === "fulfilled") setMovements(movRes.value || [])
    } catch {
      toast.error("Error", "No se pudo cargar los datos de Bóveda Central")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tipoFilter])

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depositMonto || Number(depositMonto) <= 0) {
      toast.error("Error", "Ingresá un monto válido")
      return
    }
    setSubmitting(true)
    try {
      await api.caja.vault.dropCash({
        caja_nombre: depositCaja,
        cajero: depositCajera,
        supervisor: depositSupervisor,
        monto: Number(depositMonto),
        observaciones: depositObs,
      })
      toast.success("Drop Cash Registrado", `Ingresaron ₲ ${formatPYG(Number(depositMonto))} a Bóveda Central.`)
      setShowDepositModal(false)
      setDepositMonto("")
      loadData()
    } catch {
      toast.error("Error", "No se pudo registrar el ingreso a bóveda")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateBlindado = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blindadoMonto || Number(blindadoMonto) <= 0 || !blindadoBolsa) {
      toast.error("Error", "Completá el precinto y monto de la remesa")
      return
    }
    setSubmitting(true)
    try {
      await api.caja.vault.dispatchArmored({
        transportadora: blindadoTransportadora,
        precinto_bolsa: blindadoBolsa,
        banco_destino: blindadoBanco,
        cuenta_banco: blindadoCuenta,
        supervisor: blindadoSupervisor,
        monto: Number(blindadoMonto),
        observaciones: blindadoObs,
      })
      toast.success("Remesa Despachada", `Bolsa de seguridad ${blindadoBolsa} entregada a ${blindadoTransportadora}.`)
      setShowBlindadoModal(false)
      setBlindadoMonto("")
      setBlindadoBolsa("")
      loadData()
    } catch {
      toast.error("Error", "No se pudo despachar la remesa")
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMovements = movements.filter(m => {
    const term = search.toLowerCase()
    return !search || 
      (m.origen_nombre || "").toLowerCase().includes(term) ||
      (m.cajero || "").toLowerCase().includes(term) ||
      (m.supervisor || "").toLowerCase().includes(term) ||
      (m.precinto_bolsa || "").toLowerCase().includes(term) ||
      (m.transportadora || "").toLowerCase().includes(term) ||
      (m.observaciones || "").toLowerCase().includes(term)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary text-[10px] font-black uppercase tracking-widest">
              Tesorería Central
            </span>
            <span className="text-xs text-gray-400 font-mono">Bóveda Física & Caudales</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
            Bóveda Central & Remesas
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Custodia física de efectivo, retiros de cajas POS (Drop Cash) y despachos de remesas blindadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn-ghost p-2" title="Recargar datos">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button 
            onClick={() => {
              setDepositMonto("")
              setShowDepositModal(true)
            }} 
            className="btn-outline flex items-center gap-1.5 text-xs"
          >
            <ArrowDownRight className="w-4 h-4 text-emerald-500" />
            <span>Drop Cash (Retiro POS)</span>
          </button>
          <button 
            onClick={() => {
              setBlindadoBolsa(`BAG-${Math.floor(1000 + Math.random() * 9000)}-PY`)
              setBlindadoMonto("")
              setShowBlindadoModal(true)
            }} 
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <Truck className="w-4 h-4" />
            <span>Despachar Blindado</span>
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 1. Saldo Efectivo en Bóveda */}
        <div className="card p-4 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-slate-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-700 dark:text-emerald-300">Efectivo en Bóveda</span>
            <Lock className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {summary ? `₲ ${formatPYG(summary.saldo_efectivo_boveda)}` : "—"}
          </p>
          <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1 font-mono">
            <span>+{formatPYG(summary?.ingresos_hoy || 0)} hoy</span>
            <span className="text-emerald-600 font-bold">Disponible</span>
          </div>
        </div>

        {/* 2. Cheques en Custodia */}
        <div className="card p-4 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-slate-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-700 dark:text-amber-300">Cheques en Custodia</span>
            <Banknote className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-2">
            {summary ? `₲ ${formatPYG(summary.cheques_custodia_monto)}` : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-1 block font-mono">
            {summary?.cheques_custodia_cant || 0} cheques físicos en cartera
          </span>
        </div>

        {/* 3. Remesas en Tránsito */}
        <div className="card p-4 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-slate-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-blue-700 dark:text-blue-300">Remesas en Tránsito</span>
            <Truck className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-2">
            {summary ? `₲ ${formatPYG(summary.remesas_transito_monto)}` : "—"}
          </p>
          <span className="text-[10px] text-blue-600 mt-1 block font-bold font-mono">
            {summary?.remesas_transito_cant || 0} remesas en caudales blindados
          </span>
        </div>

        {/* 4. Total Valores Custodiados */}
        <div className="card p-4 border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50/60 to-white dark:from-purple-950/20 dark:to-slate-800">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-black tracking-widest text-purple-700 dark:text-purple-300">Total Valores en Custodia</span>
            <Landmark className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-black font-mono text-purple-900 dark:text-purple-200 mt-2">
            {summary ? `₲ ${formatPYG(summary.total_valores_custodia)}` : "—"}
          </p>
          <span className="text-[10px] text-gray-400 mt-1 block font-mono">
            Efectivo + Cartera de Cheques
          </span>
        </div>
      </div>

      {/* POS Cash Limit Alerts Bar */}
      {summary?.alertas_cajas_limite && summary.alertas_cajas_limite.length > 0 && (
        <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Alertas de Exceso de Efectivo en Cajas POS (Límite Operativo: ₲ 3.000.000)
            </h3>
            <span className="text-[10px] text-amber-700 font-mono font-bold">
              {summary.alertas_cajas_limite.length} cajas requieren Drop Cash
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {summary.alertas_cajas_limite.map((a: any) => (
              <div key={a.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-2 shadow-sm">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white capitalize">{a.caja_nombre}</div>
                  <div className="text-[11px] text-gray-500 font-mono">{a.cajero_nombre}</div>
                  <div className="text-xs font-mono font-bold text-red-600 mt-0.5">
                    Saldo: ₲ {formatPYG(a.saldo_actual)} <span className="text-[10px] text-gray-400">(+{formatPYG(a.exceso_monto)})</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setDepositCaja(a.caja_nombre)
                    setDepositCajera(a.cajero_nombre)
                    setDepositMonto(String(Math.floor(a.exceso_monto)))
                    setShowDepositModal(true)
                  }}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px] shadow-sm flex items-center gap-1 flex-shrink-0"
                >
                  <ArrowDownRight className="w-3 h-3" />
                  <span>Retirar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movements Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-2">
        <div className="flex items-center gap-2">
          {[
            { id: "", label: "Todos los Movimientos" },
            { id: "ingreso_caja", label: "📥 Ingresos (Drop Cash / Cajas)" },
            { id: "egreso_remesa_blindado", label: "🚚 Remesas Blindadas" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTipoFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tipoFilter === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9 text-xs font-medium w-full"
            placeholder="Buscar por caja, precinto, transportadora..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Tipo / Operación</th>
                <th className="table-cell">Origen / Destino</th>
                <th className="table-cell">Cajero / Supervisor</th>
                <th className="table-cell">Transportadora & Precinto</th>
                <th className="table-cell">Fecha / Hora</th>
                <th className="table-cell text-right">Monto (₲)</th>
                <th className="table-cell text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Cargando movimientos de Bóveda Central...</td></tr>
              ) : filteredMovements.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No se encontraron movimientos registrados</td></tr>
              ) : (
                filteredMovements.map((m) => {
                  const isIngreso = m.tipo.startsWith("ingreso")
                  return (
                    <tr key={m.id} className="table-row hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="table-td">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isIngreso
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}>
                          {isIngreso ? <ArrowDownRight className="w-3 h-3 text-emerald-500" /> : <Truck className="w-3 h-3 text-blue-500" />}
                          {isIngreso ? "Ingreso a Bóveda" : "Remesa Blindada"}
                        </span>
                        {m.observaciones && (
                          <div className="text-[10px] text-gray-400 mt-0.5 max-w-xs truncate">{m.observaciones}</div>
                        )}
                      </td>
                      <td className="table-td font-medium text-gray-900 dark:text-white">
                        <div>{m.origen_nombre || "Bóveda Central"}</div>
                        {m.banco_destino && (
                          <div className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                            <Building2 className="w-3 h-3" />
                            <span>{m.banco_destino} ({m.cuenta_banco})</span>
                          </div>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="text-gray-800 dark:text-gray-200 font-semibold">{m.supervisor || "Tesorero"}</div>
                        {m.cajero && <div className="text-[10px] text-gray-400">Cajera: {m.cajero}</div>}
                      </td>
                      <td className="table-td font-mono">
                        {m.transportadora ? (
                          <div>
                            <span className="font-bold text-primary">{m.transportadora}</span>
                            <div className="text-[10px] text-gray-500">Precinto: {m.precinto_bolsa || "S/Precinto"}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Custodia Interna</span>
                        )}
                      </td>
                      <td className="table-td font-mono text-gray-500">
                        {formatDate(m.created_at)}
                      </td>
                      <td className={`table-td text-right font-mono font-black text-sm ${
                        isIngreso ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                      }`}>
                        {isIngreso ? `+${formatPYG(m.monto)}` : `-${formatPYG(m.monto)}`}
                      </td>
                      <td className="table-td text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.estado === "confirmado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                          m.estado === "en_transito" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                          "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300"
                        }`}>
                          {m.estado === "en_transito" ? "En Tránsito Blindado" : "Custodiado"}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Drop Cash */}
      {showDepositModal && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-emerald-950 text-white rounded-t-xl">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-emerald-400" />
                Registrar Drop Cash / Retiro de Caja POS
              </h3>
              <p className="text-xs text-emerald-200 mt-1">Traspaso seguro de efectivo desde caja hacia Bóveda Central</p>
            </div>

            <form onSubmit={handleCreateDeposit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Caja / Terminal POS de Origen</label>
                <input
                  type="text"
                  required
                  className="input-field text-xs w-full font-bold"
                  value={depositCaja}
                  onChange={e => setDepositCaja(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Cajero / Operador</label>
                  <input
                    type="text"
                    required
                    className="input-field text-xs w-full"
                    value={depositCajera}
                    onChange={e => setDepositCajera(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Supervisor / Receptor</label>
                  <input
                    type="text"
                    required
                    className="input-field text-xs w-full"
                    value={depositSupervisor}
                    onChange={e => setDepositSupervisor(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Monto Retirado (₲ Guaraníes)</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ej: 3000000"
                  className="input-field font-mono font-bold text-sm w-full text-emerald-600"
                  value={depositMonto}
                  onChange={e => setDepositMonto(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Observaciones</label>
                <input
                  type="text"
                  className="input-field text-xs w-full"
                  value={depositObs}
                  onChange={e => setDepositObs(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowDepositModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
                  Confirmar Ingreso a Bóveda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Despacho Blindado */}
      {showBlindadoModal && (
        <div className="modal-overlay" onClick={() => setShowBlindadoModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-blue-950 text-white rounded-t-xl">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                Despachar Remesa a Blindado
              </h3>
              <p className="text-xs text-blue-200 mt-1">Entrega de bolsa de seguridad a transportadora de caudales</p>
            </div>

            <form onSubmit={handleCreateBlindado} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Transportadora de Caudales</label>
                  <select
                    className="input-field text-xs w-full"
                    value={blindadoTransportadora}
                    onChange={e => setBlindadoTransportadora(e.target.value)}
                  >
                    <option value="Prosegur Paraguay">Prosegur Paraguay</option>
                    <option value="Yrendague S.A.">Yrendague S.A.</option>
                    <option value="Mbarete Seguros">Mbarete Seguros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Precinto / Bolsa de Seguridad</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: BAG-8849-PY"
                    className="input-field font-mono font-bold text-xs w-full text-primary"
                    value={blindadoBolsa}
                    onChange={e => setBlindadoBolsa(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Banco de Destino</label>
                  <input
                    type="text"
                    required
                    className="input-field text-xs w-full"
                    value={blindadoBanco}
                    onChange={e => setBlindadoBanco(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Cuenta Bancaria</label>
                  <input
                    type="text"
                    required
                    className="input-field font-mono text-xs w-full"
                    value={blindadoCuenta}
                    onChange={e => setBlindadoCuenta(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Monto a Despachar (₲ Guaraníes)</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ej: 25000000"
                  className="input-field font-mono font-bold text-sm w-full text-blue-600"
                  value={blindadoMonto}
                  onChange={e => setBlindadoMonto(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Supervisor Autorizante</label>
                <input
                  type="text"
                  required
                  className="input-field text-xs w-full"
                  value={blindadoSupervisor}
                  onChange={e => setBlindadoSupervisor(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setShowBlindadoModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary bg-blue-600 hover:bg-blue-700">
                  Despachar Remesa Blindada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
