import { useState, useEffect } from "react"
import { useToast } from "../../context/ToastContext"
import { api, type Customer, type LoyaltyConfig, type LoyaltyReward, type LoyaltyPoints } from "../../api"
import {
  Users, Gift, Coins, Plus, Search, Trash2, Edit, Settings, Loader2, History, Info,
} from "lucide-react"
import { formatPYG, formatDate } from "../../utils/format"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function CrmPage() {
  const toast = useToast()
  const [tab, setTab] = useState<"members" | "rewards" | "config">("members")

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [balance, setBalance] = useState<{ total_puntos: number; puntos_por_vencer: number } | null>(null)
  const [history, setHistory] = useState<LoyaltyPoints[]>([])
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [pointsToAdd, setPointsToAdd] = useState(100)
  const [pointsDesc, setPointsDesc] = useState("")

  const [rewards, setRewards] = useState<LoyaltyReward[]>([])
  const [loadingRewards, setLoadingRewards] = useState(false)
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null)
  const [rwNombre, setRwNombre] = useState("")
  const [rwDescripcion, setRwDescripcion] = useState("")
  const [rwPuntos, setRwPuntos] = useState(100)
  const [rwTipo, setRwTipo] = useState("descuento")
  const [rwValor, setRwValor] = useState<number | "">("")
  const [rwStock, setRwStock] = useState<number | "">("")

  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    if (tab === "members") loadCustomers()
    if (tab === "rewards") loadRewards()
    if (tab === "config") loadConfig()
  }, [tab])

  useEffect(() => {
    if (tab !== "members") return
    const t = setTimeout(loadCustomers, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const c = await api.customers.list({ search: customerSearch || undefined, activo: true })
      setCustomers(c)
    } catch {
      toast.error("Error", "No se pudo cargar la lista de clientes")
    } finally {
      setLoadingCustomers(false)
    }
  }

  const loadRewards = async () => {
    setLoadingRewards(true)
    try {
      setRewards(await api.loyalty.rewards(COMPANY_ID))
    } catch {
      toast.error("Error", "No se pudieron cargar las recompensas")
    } finally {
      setLoadingRewards(false)
    }
  }

  const loadConfig = async () => {
    setLoadingConfig(true)
    try {
      setConfig(await api.loyalty.getConfig(COMPANY_ID))
    } catch {
      toast.error("Error", "No se pudo cargar la configuracion")
    } finally {
      setLoadingConfig(false)
    }
  }

  const openCustomer = async (c: Customer) => {
    setSelectedCustomer(c)
    setBalance(null)
    setHistory([])
    setLoadingBalance(true)
    try {
      const [b, h] = await Promise.all([
        api.loyalty.balance(c.id, COMPANY_ID),
        api.loyalty.history(c.id, COMPANY_ID, 20),
      ])
      setBalance(b)
      setHistory(h)
    } catch {
      toast.error("Error", "No se pudo cargar el saldo de puntos")
    } finally {
      setLoadingBalance(false)
    }
  }

  const handleAddPoints = async () => {
    if (!selectedCustomer || pointsToAdd === 0) return
    try {
      await api.loyalty.addPoints({
        company_id: COMPANY_ID,
        customer_id: selectedCustomer.id,
        tipo: pointsToAdd > 0 ? "ajuste_manual" : "canje_manual",
        puntos: pointsToAdd,
        descripcion: pointsDesc || undefined,
      })
      toast.success("Puntos actualizados", `${pointsToAdd > 0 ? "+" : ""}${pointsToAdd} pts para ${selectedCustomer.nombre}`)
      setPointsDesc("")
      openCustomer(selectedCustomer)
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo actualizar el saldo")
    }
  }

  const resetRewardForm = () => {
    setEditingReward(null); setRwNombre(""); setRwDescripcion(""); setRwPuntos(100); setRwTipo("descuento"); setRwValor(""); setRwStock("")
  }
  const openEditReward = (r: LoyaltyReward) => {
    setEditingReward(r); setRwNombre(r.nombre); setRwDescripcion(r.descripcion || ""); setRwPuntos(r.puntos_requeridos)
    setRwTipo(r.tipo_recompensa); setRwValor(r.valor_recompensa ?? ""); setRwStock(r.stock ?? "")
    setShowRewardModal(true)
  }

  const handleSaveReward = async () => {
    if (!rwNombre || rwPuntos <= 0) { toast.error("Error", "Nombre y puntos requeridos son obligatorios"); return }
    const payload = {
      nombre: rwNombre, descripcion: rwDescripcion || undefined, puntos_requeridos: rwPuntos,
      tipo_recompensa: rwTipo, valor_recompensa: rwValor === "" ? undefined : Number(rwValor),
      stock: rwStock === "" ? undefined : Number(rwStock),
    }
    try {
      if (editingReward) {
        await api.loyalty.updateReward(editingReward.id, payload)
      } else {
        await api.loyalty.createReward({ company_id: COMPANY_ID, ...payload })
      }
      toast.success(editingReward ? "Recompensa actualizada" : "Recompensa creada", rwNombre)
      setShowRewardModal(false); resetRewardForm(); loadRewards()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar la recompensa")
    }
  }

  const handleToggleReward = async (r: LoyaltyReward) => {
    try {
      await api.loyalty.updateReward(r.id, { activo: !r.activo })
      toast.success(r.activo ? "Desactivada" : "Activada", r.nombre)
      loadRewards()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo actualizar la recompensa")
    }
  }

  const handleDeleteReward = async (r: LoyaltyReward) => {
    if (!confirm(`Eliminar "${r.nombre}"?`)) return
    try {
      await api.loyalty.deleteReward(r.id)
      toast.success("Eliminada", r.nombre)
      loadRewards()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo eliminar la recompensa")
    }
  }

  const handleSaveConfig = async () => {
    if (!config) return
    setSavingConfig(true)
    try {
      const updated = await api.loyalty.updateConfig(COMPANY_ID, {
        puntos_por_guarani: config.puntos_por_guarani,
        guarani_por_punto: config.guarani_por_punto,
        vencimiento_dias: config.vencimiento_dias,
        canje_minimo_puntos: config.canje_minimo_puntos,
        bienvenida_puntos: config.bienvenida_puntos,
        cumpleanos_puntos: config.cumpleanos_puntos,
        crear_en_venta: config.crear_en_venta,
        activo: config.activo,
      })
      setConfig(updated)
      toast.success("Configuracion guardada", "")
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar la configuracion")
    } finally {
      setSavingConfig(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Club de Fidelidad
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Puntos y recompensas reales sobre la base de clientes real ({customers.length > 0 ? "4.088+ clientes" : "cargando..."}).
        </p>
      </div>

      {!config?.activo && tab !== "config" && (
        <div className="card p-4 border-amber-300 bg-amber-50 dark:bg-amber-900/10 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            El programa de fidelidad todavia no esta activo. Podes revisar clientes y armar el catalogo de recompensas ya mismo,
            pero para que los puntos se otorguen solos en cada venta hace falta activarlo en la pestana Configuracion.
          </p>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([["members", "Clientes", Users], ["rewards", "Recompensas", Gift], ["config", "Configuracion", Settings]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${tab === key ? "text-primary border-primary" : "text-gray-400 border-transparent hover:text-gray-600"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar cliente por nombre, CI o telefono..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr className="table-header"><th className="table-cell">Cliente</th><th className="table-cell">CI</th><th className="table-cell">Telefono</th></tr></thead>
                <tbody>
                  {loadingCustomers ? (
                    <tr><td colSpan={3} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                  ) : customers.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-12 text-gray-400">{customerSearch ? "Sin resultados" : "Escribi para buscar entre los clientes reales"}</td></tr>
                  ) : customers.map(c => (
                    <tr key={c.id} onClick={() => openCustomer(c)} className={`table-row cursor-pointer ${selectedCustomer?.id === c.id ? "bg-primary/5" : ""}`}>
                      <td className="table-td font-medium">{c.nombre}</td>
                      <td className="table-td text-sm text-gray-500 font-mono">{c.ci || "-"}</td>
                      <td className="table-td text-sm text-gray-500">{c.telefono || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-1">
            {!selectedCustomer ? (
              <div className="card p-6 text-center text-gray-400 py-12 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800">
                <Coins className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Selecciona un cliente para ver su saldo de puntos</p>
              </div>
            ) : (
              <div className="card p-6 space-y-5 sticky top-6 border border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-start">
                  <div><h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedCustomer.nombre}</h3><p className="text-xs text-gray-400">{selectedCustomer.ci}</p></div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">Cerrar</button>
                </div>

                {loadingBalance ? (
                  <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                ) : (
                  <>
                    <div className="bg-gray-50 dark:bg-slate-800/40 p-4 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-gray-400 uppercase font-black tracking-wider">Saldo actual</span>
                      <span className="text-xl font-bold text-primary">{balance?.total_puntos ?? 0} pts</span>
                    </div>

                    <div className="space-y-2">
                      <label className="input-label">Ajustar puntos (+ otorga, - descuenta)</label>
                      <div className="flex gap-2">
                        <input type="number" className="input-field w-28" value={pointsToAdd} onChange={e => setPointsToAdd(parseInt(e.target.value) || 0)} />
                        <input className="input-field flex-1" placeholder="Motivo (opcional)" value={pointsDesc} onChange={e => setPointsDesc(e.target.value)} />
                      </div>
                      <button className="btn-primary w-full" onClick={handleAddPoints}><Coins className="w-4 h-4" /> Aplicar</button>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Historial</h4>
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {history.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">Sin movimientos todavia</p>
                        ) : history.map(h => (
                          <div key={h.id} className="flex justify-between items-center text-xs p-2 bg-gray-50 dark:bg-slate-800/60 rounded-lg">
                            <div><p className="text-gray-700 dark:text-gray-300">{h.descripcion || h.tipo}</p><p className="text-[10px] text-gray-400">{formatDate(h.created_at)}</p></div>
                            <span className={`font-bold font-mono ${h.puntos >= 0 ? "text-green-600" : "text-red-500"}`}>{h.puntos >= 0 ? "+" : ""}{h.puntos}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "rewards" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => { resetRewardForm(); setShowRewardModal(true) }}><Plus className="w-4 h-4" /> Nueva recompensa</button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr className="table-header"><th className="table-cell">Recompensa</th><th className="table-cell text-right">Puntos</th><th className="table-cell">Tipo</th><th className="table-cell text-right">Stock</th><th className="table-cell">Estado</th><th className="table-cell">Acciones</th></tr></thead>
              <tbody>
                {loadingRewards ? (
                  <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : rewards.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">Sin recompensas cargadas todavia</td></tr>
                ) : rewards.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td"><p className="font-medium">{r.nombre}</p>{r.descripcion && <p className="text-xs text-gray-400">{r.descripcion}</p>}</td>
                    <td className="table-td text-right font-mono font-bold">{r.puntos_requeridos}</td>
                    <td className="table-td text-sm">{r.tipo_recompensa}</td>
                    <td className="table-td text-right font-mono">{r.stock ?? "∞"}</td>
                    <td className="table-td"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.activo ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}>{r.activo ? "Activa" : "Inactiva"}</span></td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        <button className="btn-ghost" title="Editar" onClick={() => openEditReward(r)}><Edit className="w-3.5 h-3.5" /></button>
                        <button className="btn-ghost" title={r.activo ? "Desactivar" : "Activar"} onClick={() => handleToggleReward(r)}>{r.activo ? "⏸" : "▶"}</button>
                        <button className="btn-ghost text-red-400" title="Eliminar" onClick={() => handleDeleteReward(r)}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="card p-6 max-w-xl space-y-4">
          {loadingConfig || !config ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : (
            <>
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
                <input type="checkbox" checked={config.activo} onChange={e => setConfig({ ...config, activo: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm font-bold">Programa activo</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="input-label">Puntos por guarani gastado</label><input type="number" className="input-field" value={config.puntos_por_guarani} onChange={e => setConfig({ ...config, puntos_por_guarani: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="input-label">Guaranies por punto (al canjear)</label><input type="number" className="input-field" value={config.guarani_por_punto} onChange={e => setConfig({ ...config, guarani_por_punto: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="input-label">Vencimiento (dias)</label><input type="number" className="input-field" value={config.vencimiento_dias} onChange={e => setConfig({ ...config, vencimiento_dias: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="input-label">Canje minimo (puntos)</label><input type="number" className="input-field" value={config.canje_minimo_puntos} onChange={e => setConfig({ ...config, canje_minimo_puntos: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="input-label">Bienvenida (puntos)</label><input type="number" className="input-field" value={config.bienvenida_puntos} onChange={e => setConfig({ ...config, bienvenida_puntos: parseInt(e.target.value) || 0 })} /></div>
                <div><label className="input-label">Cumpleanos (puntos)</label><input type="number" className="input-field" value={config.cumpleanos_puntos} onChange={e => setConfig({ ...config, cumpleanos_puntos: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/40 rounded-xl">
                <input type="checkbox" checked={config.crear_en_venta} onChange={e => setConfig({ ...config, crear_en_venta: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm">Otorgar puntos automaticamente en cada venta</span>
              </label>
              <button className="btn-primary w-full" onClick={handleSaveConfig} disabled={savingConfig}>{savingConfig ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Guardar configuracion"}</button>
            </>
          )}
        </div>
      )}

      {showRewardModal && (
        <div className="modal-overlay" onClick={() => setShowRewardModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Gift className="w-5 h-5 text-primary" /> {editingReward ? "Editar" : "Nueva"} recompensa</h3>
              <div><label className="input-label label-required">Nombre</label><input className="input-field" value={rwNombre} onChange={e => setRwNombre(e.target.value)} /></div>
              <div><label className="input-label">Descripcion</label><input className="input-field" value={rwDescripcion} onChange={e => setRwDescripcion(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="input-label label-required">Puntos requeridos</label><input type="number" className="input-field" value={rwPuntos} onChange={e => setRwPuntos(parseInt(e.target.value) || 0)} /></div>
                <div><label className="input-label">Tipo</label>
                  <select className="input-field" value={rwTipo} onChange={e => setRwTipo(e.target.value)}>
                    <option value="descuento">Descuento</option>
                    <option value="producto">Producto gratis</option>
                    <option value="cashback">Cashback</option>
                  </select>
                </div>
                <div><label className="input-label">Valor (Gs, si aplica)</label><input type="number" className="input-field" value={rwValor} onChange={e => setRwValor(e.target.value === "" ? "" : parseFloat(e.target.value))} /></div>
                <div><label className="input-label">Stock (vacio = ilimitado)</label><input type="number" className="input-field" value={rwStock} onChange={e => setRwStock(e.target.value === "" ? "" : parseInt(e.target.value))} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn-outline flex-1" onClick={() => setShowRewardModal(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleSaveReward}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
