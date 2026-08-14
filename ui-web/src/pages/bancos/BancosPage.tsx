import { useState, useEffect } from "react"
import { api, type BankAccount } from "../../api"
import { formatPYG } from "../../utils/format"
import { useToast } from "../../context/ToastContext"
import { Plus, Loader2, Landmark, CheckCircle, XCircle, Upload, Wand2, AlertTriangle, Settings2, ShieldCheck, ShieldAlert, FileDown } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { useAuth } from "../../context/AuthContext"

type AutoCandidate = { txId: string; descripcion: string; monto: number; fecha?: string; suggestion: any; selected: boolean }

const BANK_CATEGORIA_LABELS: Record<string, { label: string; className: string }> = {
  liquidacion_tarjeta: { label: "Liquidación tarjeta", className: "bg-blue-50 text-blue-600" },
  pago_cheque: { label: "Pago con cheque", className: "bg-purple-50 text-purple-600" },
  pago_proveedor: { label: "Pago a proveedor", className: "bg-orange-50 text-orange-600" },
  deposito_efectivo: { label: "Depósito efectivo", className: "bg-teal-50 text-teal-600" },
  deposito_caja: { label: "Depósito de caja", className: "bg-teal-50 text-teal-600" },
  transferencia_recibida: { label: "Transferencia recibida", className: "bg-indigo-50 text-indigo-600" },
  transferencia_interna: { label: "Transferencia interna", className: "bg-slate-100 text-slate-600" },
  retiro: { label: "Retiro", className: "bg-amber-50 text-amber-600" },
  ingreso_caja: { label: "Ingreso de caja", className: "bg-teal-50 text-teal-600" },
  otros: { label: "Otros", className: "bg-gray-100 text-gray-500" },
}

export default function BancosPage() {
  const [loading, setLoading] = useState(true)
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [bankDashboard, setBankDashboard] = useState<any>(null)
  const [cashPosition, setCashPosition] = useState<any>(null)
  const [outstandingItems, setOutstandingItems] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [selectedBank, setSelectedBank] = useState<string>("")
  const [bankTxns, setBankTxns] = useState<any[]>([])
  const [showBankForm, setShowBankForm] = useState(false)
  const [bankForm, setBankForm] = useState({ banco: "", tipo: "corriente", numero_cuenta: "", moneda: "PYG", saldo_inicial: "", titular: "" })
  const [showImportBank, setShowImportBank] = useState(false)
  const now = new Date()
  const [importForm, setImportForm] = useState<{ mes: number; anio: number; file: File | null }>({ mes: now.getMonth() + 1, anio: now.getFullYear(), file: null })
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [reconcileModal, setReconcileModal] = useState<{ txId: string; suggestions: any[]; loading: boolean } | null>(null)
  const [autoModal, setAutoModal] = useState<{ loading: boolean; candidates: AutoCandidate[] } | null>(null)
  const [umbralModal, setUmbralModal] = useState<{ id: string; valor: string } | null>(null)
  const [corrections, setCorrections] = useState<any[]>([])
  const [correctionModal, setCorrectionModal] = useState<{ id: string; saldo_propuesto: string; motivo: string } | null>(null)
  const toast = useToast()
  const { user } = useAuth()

  // El backend serializa los Decimal como string ("71150882.00", notacion
  // JS/decimal comun) -- formatPYG asume que un string ya viene en formato
  // paraguayo (punto = separador de miles) y le borra el punto, inflando el
  // valor ~100x. Convertimos a number antes para que se parsee como decimal
  // real, no como agrupado.
  const formatGs = (n?: number | string | null) => n != null ? formatPYG(Number(n)) : "-"

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [b, d, cp, oi, recs, corr] = await Promise.all([
        api.financial.banks.list(),
        api.financial.banksDashboard(),
        api.financial.cashPosition(),
        api.financial.outstandingItems(),
        api.financeAgent.recommendations("pending"),
        api.financial.balanceCorrections.list("pendiente"),
      ])
      setBanks(b)
      setBankDashboard(d)
      setCashPosition(cp)
      setOutstandingItems(oi)
      setAlerts(recs.filter((r: any) => r.tipo === "saldo_bajo" || r.tipo === "divergencia_saldo"))
      setCorrections(corr)
    } catch (e: any) {
      if (e.status !== 401 && e.response?.status !== 401) toast.error("Error", e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const handleCreateBank = async () => {
    try {
      await api.financial.banks.create({ ...bankForm, saldo_inicial: Number(bankForm.saldo_inicial) })
      toast.success("Cuenta creada"); setShowBankForm(false); fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleSaveUmbral = async () => {
    if (!umbralModal) return
    try {
      await api.financial.banks.update(umbralModal.id, { saldo_minimo_alerta: umbralModal.valor ? Number(umbralModal.valor) : null })
      toast.success("Umbral de alerta guardado")
      setUmbralModal(null)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDecideAlert = async (id: string, approve: boolean) => {
    try {
      const fn = approve ? api.financeAgent.approve : api.financeAgent.reject
      await fn(id, user?.id || user?.nombre || "sistema")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleVerifyBalance = async (accountId: string) => {
    try {
      await api.financial.banks.verifyBalance(accountId)
      toast.success("Saldo marcado como verificado")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleRequestCorrection = async () => {
    if (!correctionModal) return
    try {
      await api.financial.banks.requestCorrection(correctionModal.id, {
        saldo_propuesto: Number(correctionModal.saldo_propuesto), motivo: correctionModal.motivo,
      })
      toast.success("Corrección solicitada", "Requiere aprobación de Supervisor y Gerente")
      setCorrectionModal(null)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDecideCorrection = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        const r = await api.financial.balanceCorrections.approve(id)
        toast.success(r.completo ? "Corrección aplicada" : "Aprobación registrada", r.completo ? "El saldo fue corregido" : "Falta la segunda aprobación (Supervisor o Gerente)")
      } else {
        await api.financial.balanceCorrections.reject(id)
        toast.success("Corrección rechazada")
      }
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const loadBankTxns = async (bankId: string) => {
    try { const t = await api.financial.banks.transactions(bankId); setBankTxns(t); setSelectedBank(bankId) }
    catch (e: any) { toast.error("Error", e.message) }
  }

  const handlePreviewImport = async () => {
    if (!selectedBank || !importForm.file) return
    setImportLoading(true)
    setImportPreview(null)
    try {
      const preview = await api.financial.banks.previewImportFile(selectedBank, importForm.file, importForm.mes, importForm.anio)
      setImportPreview(preview)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo leer el archivo")
    } finally { setImportLoading(false) }
  }

  const handleConfirmImport = async () => {
    if (!selectedBank || !importForm.file) return
    setImportLoading(true)
    try {
      const r = await api.financial.banks.importFile(selectedBank, importForm.file, importForm.mes, importForm.anio)
      toast.success("Extracto importado", `${r.nuevas} movimientos nuevos, ${r.duplicadas} ya existían`)
      setShowImportBank(false); setImportForm({ ...importForm, file: null }); setImportPreview(null)
      fetchAll()
      if (selectedBank) loadBankTxns(selectedBank)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo importar el archivo")
    } finally { setImportLoading(false) }
  }

  const openReconcileModal = async (txId: string) => {
    setReconcileModal({ txId, suggestions: [], loading: true })
    try {
      const suggestions = await api.financial.suggestions(txId)
      setReconcileModal({ txId, suggestions, loading: false })
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudieron cargar las sugerencias")
      setReconcileModal(null)
    }
  }

  const handleReconcile = async (txId: string, matchedType: string, matchedId?: string) => {
    try {
      await api.financial.reconcile(txId, { matched_type: matchedType, matched_id: matchedId })
      toast.success(matchedType === "cheque" ? "Conciliado — el cheque pasó a cobrado" : "Conciliado")
      setReconcileModal(null)
      if (selectedBank) loadBankTxns(selectedBank)
      api.financial.banksDashboard().then(setBankDashboard)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo conciliar")
    }
  }

  const handleUnreconcile = async (txId: string) => {
    try {
      await api.financial.unreconcile(txId)
      toast.success("Conciliación revertida")
      if (selectedBank) loadBankTxns(selectedBank)
      api.financial.banksDashboard().then(setBankDashboard)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo revertir")
    }
  }

  const openAutoReconcile = async () => {
    if (!selectedBank) return
    setAutoModal({ loading: true, candidates: [] })
    try {
      const pendientes = await api.financial.banks.transactions(selectedBank, { conciliado: false, limit: 50 })
      const results = await Promise.all(
        pendientes.map(async (t: any) => {
          const suggestions = await api.financial.suggestions(t.id)
          const mejor = suggestions.find((s: any) => s.confidence === "alta")
          return mejor ? { txId: t.id, descripcion: t.descripcion || "-", monto: t.monto, fecha: t.fecha, suggestion: mejor, selected: true } as AutoCandidate : null
        })
      )
      setAutoModal({ loading: false, candidates: results.filter((c): c is AutoCandidate => c !== null) })
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo buscar coincidencias")
      setAutoModal(null)
    }
  }

  const toggleAutoCandidate = (txId: string) => {
    if (!autoModal) return
    setAutoModal({ ...autoModal, candidates: autoModal.candidates.map(c => c.txId === txId ? { ...c, selected: !c.selected } : c) })
  }

  const confirmAutoReconcile = async () => {
    if (!autoModal) return
    const seleccionados = autoModal.candidates.filter(c => c.selected)
    if (seleccionados.length === 0) { setAutoModal(null); return }
    try {
      const r = await api.financial.bulkReconcile(
        seleccionados.map(c => ({ transaction_id: c.txId, matched_type: c.suggestion.tipo, matched_id: c.suggestion.id }))
      )
      toast.success("Conciliación automática", `${r.conciliadas} movimientos conciliados`)
      setAutoModal(null)
      if (selectedBank) loadBankTxns(selectedBank)
      api.financial.banksDashboard().then(setBankDashboard)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo conciliar en lote")
    }
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bancos</h1><p className="text-sm text-gray-500">Cuentas bancarias, movimientos y conciliación</p></div>
        <button onClick={() => setShowBankForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Cuenta</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div>
          {alerts.length > 0 && (
            <div className="space-y-2 mb-6">
              {alerts.map(a => (
                <div key={a.id} className="card p-4 border-amber-300 dark:border-amber-800 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-sm">{a.titulo}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{a.descripcion}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleDecideAlert(a.id, true)} className="btn-outline text-xs">Reconocer</button>
                    <button onClick={() => handleDecideAlert(a.id, false)} className="btn-ghost text-xs">Descartar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {corrections.length > 0 && (
            <div className="space-y-2 mb-6">
              {corrections.map(c => {
                const acct = banks.find(b => b.id === c.bank_account_id)
                const tieneSupervisor = !!c.aprobado_supervisor_id
                const tieneGerente = !!c.aprobado_gerente_id
                return (
                  <div key={c.id} className="card p-4 border-blue-300 dark:border-blue-800 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">Corrección de saldo pendiente — {acct?.banco || "Cuenta"} ({acct?.numero_cuenta})</div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.motivo}</div>
                        <div className="text-xs mt-1">{formatGs(c.saldo_actual)} → <span className="font-semibold">{formatGs(c.saldo_propuesto)}</span></div>
                        <div className="text-[11px] text-gray-400 mt-1">
                          Aprobaciones: {tieneSupervisor ? "✓ Supervisor" : "· Supervisor"} · {tieneGerente ? "✓ Gerente" : "· Gerente"} (requiere ambas)
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleDecideCorrection(c.id, true)} className="btn-outline text-xs">Aprobar</button>
                      <button onClick={() => handleDecideCorrection(c.id, false)} className="btn-ghost text-xs">Rechazar</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {cashPosition && (
            <div className="card p-6 mb-6 min-w-0 overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Posición de Caja Consolidada</h3>
                  <div className="text-3xl font-bold mt-1 tabular-nums">{formatGs(cashPosition.total_pyg_equivalente)}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Object.entries(cashPosition.por_moneda || {}).map(([m, v]: [string, any]) => `${formatPYG(Number(v))} ${m}`).join("  ·  ")}
                  </p>
                </div>
                <button
                  onClick={() => api.financial.downloadCashPositionPdf().catch((e: any) => toast.error("Error", e.message))}
                  className="btn-outline text-xs flex items-center gap-2 shrink-0"
                >
                  <FileDown className="w-3.5 h-3.5" />PDF
                </button>
              </div>
              {cashPosition.tendencia?.length > 1 && (() => {
                // El dominio automatico de recharts ajusta el eje Y exacto al
                // min/max de los datos -- el pico mas alto queda pegado al
                // borde superior del grafico sin ningun margen, y se ve
                // "cortado" contra el borde de la tarjeta. Se calcula un
                // dominio con 10% de aire arriba/abajo a mano.
                const saldos = cashPosition.tendencia.map((t: any) => Number(t.saldo))
                const dataMin = Math.min(...saldos)
                const dataMax = Math.max(...saldos)
                const pad = Math.max((dataMax - dataMin) * 0.1, 1)
                const yDomain: [number, number] = [Math.floor(dataMin - pad), Math.ceil(dataMax + pad)]
                return (
                  <div className="h-64 w-full min-w-0 mt-4 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <AreaChart data={cashPosition.tendencia} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="cashPositionFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
                        <XAxis
                          dataKey="fecha" tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-400"
                          tickFormatter={(v: string) => new Date(v).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit" })}
                          interval="preserveStartEnd" minTickGap={40} axisLine={false} tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-400" width={52}
                          tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false}
                          domain={yDomain}
                        />
                        <Tooltip
                          formatter={(v: number) => [formatGs(v), "Saldo"]}
                          labelFormatter={(v: string) => new Date(v).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                          contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
                        />
                        <Area type="monotone" dataKey="saldo" stroke="#4f46e5" strokeWidth={2.5} fill="url(#cashPositionFill)" dot={false} activeDot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}
            </div>
          )}

          {outstandingItems && (outstandingItems.cheques_pendientes.length > 0 || outstandingItems.depositos_sin_conciliar.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {outstandingItems.cheques_pendientes.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold text-sm mb-2">Cheques emitidos pendientes de cobro</h3>
                  <div className="text-lg font-bold text-amber-600 mb-2">{formatGs(outstandingItems.total_cheques_pendientes)}</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {outstandingItems.cheques_pendientes.map((c: any) => (
                      <div key={c.id} className="flex justify-between text-xs"><span className="text-gray-500">N° {c.numero} — {c.beneficiario}</span><span className="font-semibold">{formatGs(c.monto)}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {outstandingItems.depositos_sin_conciliar.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-semibold text-sm mb-2">Depósitos de caja sin conciliar</h3>
                  <div className="text-lg font-bold text-amber-600 mb-2">{formatGs(outstandingItems.total_depositos_sin_conciliar)}</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {outstandingItems.depositos_sin_conciliar.slice(0, 20).map((d: any) => (
                      <div key={d.id} className="flex justify-between text-xs"><span className="text-gray-500">{new Date(d.fecha).toLocaleDateString("es-PY")} — {d.descripcion}</span><span className="font-semibold">{formatGs(d.monto)}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {bankDashboard && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="card p-4 text-center"><div className="text-sm text-gray-500">Saldo Total</div><div className="text-xl font-bold">{formatGs(bankDashboard.saldo_total)}</div></div>
              <div className="card p-4 text-center"><div className="text-sm text-gray-500">Movimientos</div><div className="text-xl font-bold">{bankDashboard.total_transactions}</div></div>
              <div className="card p-4 text-center"><div className="text-sm text-gray-500">Conciliados</div><div className="text-xl font-bold text-green-600">{bankDashboard.conciliadas} <span className="text-xs text-gray-400">({bankDashboard.total_transactions > 0 ? Math.round(bankDashboard.conciliadas / bankDashboard.total_transactions * 100) : 0}%)</span></div></div>
              <div className="card p-4 text-center"><div className="text-sm text-gray-500">Pendientes</div><div className="text-xl font-bold text-amber-600">{bankDashboard.pendientes}</div></div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {banks.map(b => {
              const acctStats = bankDashboard?.accounts?.find((a: any) => a.id === b.id)
              return (
                <div key={b.id} className={`card p-5 cursor-pointer hover:shadow-md transition-shadow ${selectedBank === b.id ? "ring-2 ring-primary" : ""}`} onClick={() => loadBankTxns(b.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{b.banco}</h3>
                    <div className="flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); setUmbralModal({ id: b.id, valor: b.saldo_minimo_alerta != null ? String(b.saldo_minimo_alerta) : "" }) }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Umbral de alerta de saldo bajo">
                        <Settings2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <Landmark className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{b.numero_cuenta}</div>
                  <div className="text-lg font-bold mt-2">{formatGs(b.saldo_actual)}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-gray-400 capitalize">{b.tipo} · {b.moneda}</div>
                    {acctStats && acctStats.pendientes > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600">{acctStats.pendientes} sin conciliar</span>
                    )}
                  </div>
                  {b.saldo_minimo_alerta != null && (
                    <div className="text-[11px] text-gray-400 mt-1">Alerta si baja de {formatGs(b.saldo_minimo_alerta)}</div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {b.saldo_verificado_manualmente ? (
                      <span className="text-[11px] text-green-600 flex items-center gap-1" title={b.saldo_verificado_at ? `Verificado ${new Date(b.saldo_verificado_at).toLocaleString("es-PY")}` : ""}>
                        <ShieldCheck className="w-3.5 h-3.5" />Saldo verificado
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" />Autocalculado</span>
                    )}
                    <div className="flex gap-2">
                      {!b.saldo_verificado_manualmente && (
                        <button onClick={e => { e.stopPropagation(); handleVerifyBalance(b.id) }} className="text-[11px] text-primary font-semibold hover:underline">Marcar verificado</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setCorrectionModal({ id: b.id, saldo_propuesto: String(b.saldo_actual ?? ""), motivo: "" }) }} className="text-[11px] text-gray-500 hover:underline">Corregir saldo</button>
                    </div>
                  </div>
                </div>
              )
            })}
            {banks.length === 0 && <div className="col-span-3 text-center py-12 text-gray-500">Sin cuentas bancarias</div>}
          </div>
          {selectedBank && bankTxns.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <h3 className="font-semibold">Movimientos</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const hoy = new Date()
                      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
                      api.financial.downloadReconciliationPdf(selectedBank, { desde, hasta: hoy.toISOString().slice(0, 10) }).catch((e: any) => toast.error("Error", e.message))
                    }}
                    className="btn-outline text-xs flex items-center gap-2"
                  >
                    <FileDown className="w-3.5 h-3.5" />Conciliación (mes actual)
                  </button>
                  <button onClick={openAutoReconcile} className="btn-outline text-xs flex items-center gap-2"><Wand2 className="w-3.5 h-3.5" />Conciliar automáticamente</button>
                </div>
              </div>
              <table className="w-full">
                <thead><tr className="bg-gray-50 dark:bg-slate-800 text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="p-3">Fecha</th><th className="p-3">Tipo</th><th className="p-3">Categoría</th><th className="p-3">Monto</th><th className="p-3">Descripción</th><th className="p-3">Referencia</th><th className="p-3">Conciliado</th><th className="p-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {bankTxns.map(t => (
                    <tr key={t.id} className="table-row">
                      <td className="p-3 text-sm">{t.fecha ? new Date(t.fecha).toLocaleDateString("es-PY") : "-"}</td>
                      <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.tipo === "credito" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{t.tipo === "credito" ? "Ingreso" : "Egreso"}</span></td>
                      <td className="p-3">{(() => {
                        const cat = BANK_CATEGORIA_LABELS[t.categoria as string] || BANK_CATEGORIA_LABELS.otros
                        return <span className={`text-xs font-medium px-2 py-1 rounded-full ${cat.className}`}>{cat.label}</span>
                      })()}</td>
                      <td className="p-3 font-semibold">{formatGs(t.monto)}</td>
                      <td className="p-3 text-sm text-gray-500">{t.descripcion || "-"}</td>
                      <td className="p-3 text-xs text-gray-400">{t.referencia || "-"}</td>
                      <td className="p-3">{t.conciliado ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}</td>
                      <td className="p-3">
                        {t.conciliado ? (
                          <button onClick={() => handleUnreconcile(t.id)} className="text-xs text-gray-500 hover:underline">Desconciliar</button>
                        ) : (
                          <button onClick={() => openReconcileModal(t.id)} className="text-xs text-primary font-semibold hover:underline">Conciliar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button onClick={() => setShowImportBank(true)} className="btn-ghost flex items-center gap-2 mt-4"><Upload className="w-4 h-4" />Importar extracto bancario</button>
        </div>
      )}

      {/* Reconcile modal */}
      {reconcileModal && (
        <div className="modal-overlay" onClick={() => setReconcileModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Conciliar movimiento</h3><p className="text-xs text-gray-500 mt-1">Sugerencias reales por monto y fecha cercana</p></div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {reconcileModal.loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : reconcileModal.suggestions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Sin sugerencias automáticas. Podés marcarlo como conciliación manual.</p>
              ) : (
                reconcileModal.suggestions.map((s: any) => (
                  <div key={`${s.tipo}-${s.id}`} className="card p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{s.descripcion}</div>
                      <div className="text-xs text-gray-500">{formatGs(s.monto)} · {s.fecha ? new Date(s.fecha).toLocaleDateString("es-PY") : "-"} · {s.diferencia_dias === 0 ? "mismo día" : `±${s.diferencia_dias} días`}</div>
                    </div>
                    <button onClick={() => handleReconcile(reconcileModal.txId, s.tipo, s.id)} className="btn-primary text-xs">Conciliar</button>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t flex justify-between">
              <button onClick={() => handleReconcile(reconcileModal.txId, "manual")} className="btn-ghost text-sm">Marcar manual (sin contraparte)</button>
              <button onClick={() => setReconcileModal(null)} className="btn-outline">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-reconcile modal */}
      {autoModal && (
        <div className="modal-overlay" onClick={() => setAutoModal(null)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Conciliación automática</h3>
              <p className="text-xs text-gray-500 mt-1">Revisá los movimientos con coincidencia de alta confianza (mismo monto y fecha cercana) antes de conciliar en lote.</p>
            </div>
            <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {autoModal.loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : autoModal.candidates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No se encontraron coincidencias de alta confianza entre los movimientos pendientes.</p>
              ) : (
                autoModal.candidates.map(c => (
                  <label key={c.txId} className="card p-3 flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={c.selected} onChange={() => toggleAutoCandidate(c.txId)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c.descripcion}</div>
                      <div className="text-xs text-gray-500">{formatGs(c.monto)} · {c.fecha ? new Date(c.fecha).toLocaleDateString("es-PY") : "-"} → {c.suggestion.descripcion}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setAutoModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={confirmAutoReconcile} disabled={autoModal.loading || autoModal.candidates.every(c => !c.selected)} className="btn-primary disabled:opacity-50">
                Conciliar {autoModal.candidates.filter(c => c.selected).length} movimientos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Umbral de alerta modal */}
      {umbralModal && (
        <div className="modal-overlay" onClick={() => setUmbralModal(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Umbral de alerta de saldo bajo</h3></div>
            <div className="p-6 space-y-3">
              <div><label className="label-field">Avisar si el saldo baja de</label>
                <input className="input-field" type="number" value={umbralModal.valor} onChange={e => setUmbralModal({ ...umbralModal, valor: e.target.value })} placeholder="Dejar vacío para desactivar" />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setUmbralModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={handleSaveUmbral} className="btn-primary">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Corregir saldo modal */}
      {correctionModal && (
        <div className="modal-overlay" onClick={() => setCorrectionModal(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Corregir saldo bancario</h3>
              <p className="text-xs text-gray-500 mt-1">Requiere aprobación de Supervisor y Gerente antes de aplicarse.</p>
            </div>
            <div className="p-6 space-y-3">
              <div><label className="label-field">Saldo correcto (según extracto real)</label>
                <input className="input-field" type="number" value={correctionModal.saldo_propuesto} onChange={e => setCorrectionModal({ ...correctionModal, saldo_propuesto: e.target.value })} />
              </div>
              <div><label className="label-field">Motivo</label>
                <textarea className="input-field" rows={3} value={correctionModal.motivo} onChange={e => setCorrectionModal({ ...correctionModal, motivo: e.target.value })} placeholder="Ej: diferencia detectada al contrastar contra el extracto de agosto" />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setCorrectionModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={handleRequestCorrection} disabled={!correctionModal.saldo_propuesto || !correctionModal.motivo.trim()} className="btn-primary disabled:opacity-50">Solicitar corrección</button>
            </div>
          </div>
        </div>
      )}

      {/* Bank form modal */}
      {showBankForm && (
        <div className="modal-overlay" onClick={() => setShowBankForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Nueva cuenta bancaria</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Banco</label><input className="input-field" value={bankForm.banco} onChange={e => setBankForm({ ...bankForm, banco: e.target.value })} /></div>
              <div><label className="label-field">N° cuenta</label><input className="input-field" value={bankForm.numero_cuenta} onChange={e => setBankForm({ ...bankForm, numero_cuenta: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Tipo</label><select className="input-field" value={bankForm.tipo} onChange={e => setBankForm({ ...bankForm, tipo: e.target.value })}><option value="corriente">Corriente</option><option value="ahorro">Ahorro</option></select></div>
                <div><label className="label-field">Moneda</label><select className="input-field" value={bankForm.moneda} onChange={e => setBankForm({ ...bankForm, moneda: e.target.value })}><option value="PYG">PYG</option><option value="USD">USD</option><option value="BRL">BRL</option></select></div>
              </div>
              <div><label className="label-field">Saldo inicial</label><input className="input-field" type="number" value={bankForm.saldo_inicial} onChange={e => setBankForm({ ...bankForm, saldo_inicial: e.target.value })} /></div>
              <div><label className="label-field">Titular</label><input className="input-field" value={bankForm.titular} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowBankForm(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreateBank} disabled={!bankForm.banco || !bankForm.numero_cuenta} className="btn-primary disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Import bank statement modal */}
      {showImportBank && (
        <div className="modal-overlay" onClick={() => { setShowImportBank(false); setImportPreview(null) }}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Importar extracto bancario</h3>
              <p className="text-xs text-gray-500 mt-1">Subí el Excel tal cual lo entrega el banco. Podés resubir el mismo mes sin miedo: los movimientos ya cargados se detectan y no se duplican.</p>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="label-field">Cuenta bancaria</label>
                <select className="input-field" value={selectedBank} onChange={e => { setSelectedBank(e.target.value); setImportPreview(null) }}>
                  <option value="">Seleccionar...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.banco} - {b.numero_cuenta}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Mes</label>
                  <select className="input-field" value={importForm.mes} onChange={e => { setImportForm({ ...importForm, mes: Number(e.target.value) }); setImportPreview(null) }}>
                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label-field">Año</label>
                  <input className="input-field" type="number" value={importForm.anio} onChange={e => { setImportForm({ ...importForm, anio: Number(e.target.value) }); setImportPreview(null) }} />
                </div>
              </div>
              <div><label className="label-field">Archivo (.xlsx)</label>
                <input className="input-field" type="file" accept=".xlsx,.xls" onChange={e => { setImportForm({ ...importForm, file: e.target.files?.[0] || null }); setImportPreview(null) }} />
              </div>
              {!importPreview && (
                <button onClick={handlePreviewImport} disabled={!selectedBank || !importForm.file || importLoading} className="btn-outline w-full disabled:opacity-50 flex items-center justify-center gap-2">
                  {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Vista previa
                </button>
              )}
              {importPreview && (
                <div className="card p-4 bg-gray-50 dark:bg-slate-800 space-y-1">
                  <div className="text-sm font-semibold">Hoja detectada: {importPreview.sheet_matched}</div>
                  <div className="text-sm">{importPreview.total_detectadas} movimientos en el archivo</div>
                  <div className="text-sm text-green-600 font-semibold">{importPreview.nuevas} nuevos</div>
                  {importPreview.duplicadas > 0 && <div className="text-sm text-gray-500">{importPreview.duplicadas} ya estaban cargados (se saltean)</div>}
                  {importPreview.closing_from_totals != null && (
                    <div className="text-xs text-gray-400 mt-2">Saldo de cierre según el extracto: {formatGs(importPreview.closing_from_totals)}</div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowImportBank(false); setImportPreview(null) }} className="btn-ghost">Cancelar</button>
              <button onClick={handleConfirmImport} disabled={!importPreview || importLoading} className="btn-primary disabled:opacity-50 flex items-center gap-2">
                {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {importPreview ? `Importar ${importPreview.nuevas} movimientos` : "Importar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
