import { useState, useEffect, useCallback, useRef } from "react"
import { Percent, Plus, Trash2, Loader2, TrendingUp, CircleCheck, CircleAlert, Search, X } from "lucide-react"
import { api, type Supplier, type SupplierKpiPeriod, type SupplierKpiSummary, type SupplierKpiIndicator } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function SupplierKpisPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState("")
  const [supplierSearch, setSupplierSearch] = useState("")
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)
  const supplierBoxRef = useRef<HTMLDivElement>(null)
  const [mes, setMes] = useState(currentMonthStr())
  const [periods, setPeriods] = useState<SupplierKpiPeriod[]>([])
  const [summary, setSummary] = useState<SupplierKpiSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingRebatePct, setSavingRebatePct] = useState(false)
  const [newIndicator, setNewIndicator] = useState({ codigo: "", nombre: "", peso_pct: "" })
  const [addingIndicator, setAddingIndicator] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.purchases.suppliers().then(setSuppliers).catch(() => toast.error("Error", "No se pudieron cargar los proveedores"))
  }, [toast])

  const loadSummary = useCallback(async (periodId: string) => {
    setLoading(true)
    try {
      setSummary(await api.supplierKpis.getSummary(periodId))
    } catch {
      toast.error("Error", "No se pudo cargar el resumen del período")
    } finally {
      setLoading(false)
    }
  }, [toast])

  const openPeriod = useCallback(async () => {
    if (!supplierId || !mes) return
    setLoading(true)
    setSummary(null)
    try {
      const list = await api.supplierKpis.listPeriods(supplierId)
      setPeriods(list)
      const periodo = `${mes}-01`
      let match = list.find(p => p.periodo.slice(0, 7) === mes)
      if (!match) {
        match = await api.supplierKpis.createPeriod({ supplier_id: supplierId, periodo, rebate_pct_objetivo: 4.5 })
      }
      await loadSummary(match.id)
    } catch {
      toast.error("Error", "No se pudo abrir el período")
      setLoading(false)
    }
  }, [supplierId, mes, loadSummary, toast])

  useEffect(() => { if (supplierId && mes) openPeriod() }, [supplierId, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(e.target as Node)) setSupplierDropdownOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const selectedSupplier = suppliers.find(s => s.id === supplierId)
  const supplierMatches = supplierSearch.trim().length === 0
    ? []
    : suppliers
        .filter(s => s.razon_social?.toLowerCase().includes(supplierSearch.toLowerCase()) || s.ruc?.includes(supplierSearch))
        .slice(0, 30)

  const pickSupplier = (s: Supplier) => {
    setSupplierId(s.id)
    setSupplierSearch("")
    setSupplierDropdownOpen(false)
  }

  const clearSupplier = () => {
    setSupplierId("")
    setSupplierSearch("")
    setSummary(null)
  }

  const handleIndicatorField = (id: string, field: keyof SupplierKpiIndicator, value: string) => {
    if (!summary) return
    setSummary({
      ...summary,
      indicadores: summary.indicadores.map(i => i.id === id ? { ...i, [field]: value === "" ? null : Number(value) } : i),
    })
  }

  const saveIndicator = async (ind: SupplierKpiIndicator) => {
    try {
      await api.supplierKpis.updateIndicator(ind.id, {
        peso_pct: ind.peso_pct, meta: ind.meta ?? null, resultado: ind.resultado ?? null, piso_minimo_pct: ind.piso_minimo_pct ?? null,
      })
      if (summary) await loadSummary(summary.period.id)
      toast.success("Guardado", `${ind.nombre} actualizado`)
    } catch {
      toast.error("Error", "No se pudo guardar el indicador")
    }
  }

  const deleteIndicator = async (ind: SupplierKpiIndicator) => {
    if (!summary) return
    try {
      await api.supplierKpis.deleteIndicator(ind.id)
      await loadSummary(summary.period.id)
    } catch {
      toast.error("Error", "No se pudo eliminar el indicador")
    }
  }

  const addIndicator = async () => {
    if (!summary || !newIndicator.codigo || !newIndicator.nombre || !newIndicator.peso_pct) return
    setAddingIndicator(true)
    try {
      await api.supplierKpis.addIndicator(summary.period.id, {
        codigo: newIndicator.codigo, nombre: newIndicator.nombre, peso_pct: Number(newIndicator.peso_pct),
      })
      setNewIndicator({ codigo: "", nombre: "", peso_pct: "" })
      await loadSummary(summary.period.id)
    } catch {
      toast.error("Error", "No se pudo agregar el indicador")
    } finally {
      setAddingIndicator(false)
    }
  }

  const saveRebatePct = async (value: string) => {
    if (!summary || value === "") return
    setSavingRebatePct(true)
    try {
      await api.supplierKpis.updatePeriod(summary.period.id, { rebate_pct_objetivo: Number(value) })
      await loadSummary(summary.period.id)
    } catch {
      toast.error("Error", "No se pudo guardar el % de rebate")
    } finally {
      setSavingRebatePct(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Percent className="text-primary" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Rebates de Proveedores</h1>
          <p className="text-sm text-secondary">Cumplimiento de indicadores y cálculo del rebate mensual (ej. PARESA 4,5%)</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div ref={supplierBoxRef} className="relative">
          <label className="text-xs text-secondary block mb-1">Proveedor</label>
          {selectedSupplier ? (
            <div className="input flex items-center justify-between gap-2 min-w-64">
              <span className="truncate">{selectedSupplier.razon_social}</span>
              <button className="btn-icon" onClick={clearSupplier} title="Cambiar proveedor">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary" size={14} />
              <input
                className="input pl-7 min-w-64"
                placeholder="Buscar por nombre o RUC..."
                value={supplierSearch}
                onChange={e => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true) }}
                onFocus={() => setSupplierDropdownOpen(true)}
              />
              {supplierDropdownOpen && supplierSearch.trim().length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto card shadow-lg">
                  {supplierMatches.length === 0 ? (
                    <div className="p-3 text-sm text-secondary">Sin resultados</div>
                  ) : (
                    supplierMatches.map(s => (
                      <button
                        key={s.id}
                        className="w-full text-left px-3 py-2 hover:bg-hover text-sm border-b border-default last:border-0"
                        onClick={() => pickSupplier(s)}
                      >
                        <div className="font-medium">{s.razon_social}</div>
                        {s.ruc && <div className="text-xs text-secondary">RUC {s.ruc}</div>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-secondary block mb-1">Período</label>
          <input type="month" className="input" value={mes} onChange={e => setMes(e.target.value)} />
        </div>
        {loading && <Loader2 className="animate-spin text-secondary" size={20} />}
      </div>

      {!supplierId && (
        <div className="card p-8 text-center text-secondary">Elegí un proveedor y un período para empezar a cargar indicadores.</div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-xs text-secondary mb-1">% Cumplimiento ponderado</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {summary.pct_cumplimiento_total.toFixed(1)}%
                {summary.meta_alcanzada
                  ? <CircleCheck className="text-success" size={20} />
                  : <CircleAlert className="text-warning" size={20} />}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary mb-1">Venta base (sin IVA)</div>
              <div className="text-2xl font-bold">{formatPYG(summary.venta_base_sin_iva)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-secondary mb-1">% Rebate objetivo</div>
              <input
                type="number" step="0.01" className="input text-2xl font-bold w-28"
                defaultValue={summary.period.rebate_pct_objetivo}
                onBlur={e => saveRebatePct(e.target.value)}
                disabled={savingRebatePct}
              />
            </div>
            <div className="card p-4 bg-primary/5 border-primary/20">
              <div className="text-xs text-secondary mb-1 flex items-center gap-1"><TrendingUp size={14} /> Rebate calculado</div>
              <div className="text-2xl font-bold text-primary">{formatPYG(summary.monto_rebate_calculado)}</div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-default flex items-center justify-between">
              <h2 className="font-semibold">Indicadores — {summary.supplier_razon_social} — {mes}</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-secondary border-b border-default">
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Peso %</th>
                  <th className="p-3">Meta</th>
                  <th className="p-3">Resultado</th>
                  <th className="p-3">Piso mín. %</th>
                  <th className="p-3">% Cumpl.</th>
                  <th className="p-3">Aporte %</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {summary.indicadores.map(ind => (
                  <tr key={ind.id} className="border-b border-default last:border-0">
                    <td className="p-3 text-secondary">{ind.codigo}</td>
                    <td className="p-3">{ind.nombre}</td>
                    <td className="p-3">
                      <input type="number" step="0.01" className="input w-20"
                        value={ind.peso_pct} onChange={e => handleIndicatorField(ind.id, "peso_pct", e.target.value)}
                        onBlur={() => saveIndicator(summary.indicadores.find(i => i.id === ind.id)!)} />
                    </td>
                    <td className="p-3">
                      <input type="number" step="0.01" className="input w-24"
                        value={ind.meta ?? ""} onChange={e => handleIndicatorField(ind.id, "meta", e.target.value)}
                        onBlur={() => saveIndicator(summary.indicadores.find(i => i.id === ind.id)!)} />
                    </td>
                    <td className="p-3">
                      <input type="number" step="0.01" className="input w-24"
                        value={ind.resultado ?? ""} onChange={e => handleIndicatorField(ind.id, "resultado", e.target.value)}
                        onBlur={() => saveIndicator(summary.indicadores.find(i => i.id === ind.id)!)} />
                    </td>
                    <td className="p-3">
                      <input type="number" step="0.01" className="input w-20"
                        value={ind.piso_minimo_pct ?? ""} onChange={e => handleIndicatorField(ind.id, "piso_minimo_pct", e.target.value)}
                        onBlur={() => saveIndicator(summary.indicadores.find(i => i.id === ind.id)!)} />
                    </td>
                    <td className="p-3 font-medium">{ind.pct_cumplimiento?.toFixed(1) ?? "0.0"}%</td>
                    <td className="p-3 font-medium text-primary">{ind.aporte_ponderado_pct?.toFixed(2) ?? "0.00"}%</td>
                    <td className="p-3">
                      <button className="btn-icon text-danger" onClick={() => deleteIndicator(ind)} title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="p-3">
                    <input className="input w-full" placeholder="codigo" value={newIndicator.codigo}
                      onChange={e => setNewIndicator(v => ({ ...v, codigo: e.target.value }))} />
                  </td>
                  <td className="p-3">
                    <input className="input w-full" placeholder="Nombre" value={newIndicator.nombre}
                      onChange={e => setNewIndicator(v => ({ ...v, nombre: e.target.value }))} />
                  </td>
                  <td className="p-3">
                    <input type="number" step="0.01" className="input w-20" placeholder="Peso" value={newIndicator.peso_pct}
                      onChange={e => setNewIndicator(v => ({ ...v, peso_pct: e.target.value }))} />
                  </td>
                  <td colSpan={4}></td>
                  <td className="p-3">
                    <button className="btn-primary btn-sm flex items-center gap-1" onClick={addIndicator} disabled={addingIndicator}>
                      <Plus size={14} /> Agregar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-secondary">
            La venta base se calcula sola a partir de las ventas reales de los productos de este proveedor (sin IVA, notas de crédito ya netas).
            El rebate se prorratea por el % de cumplimiento ponderado — si PARESA paga todo-o-nada en vez de prorrateado, avisá para ajustar la fórmula.
          </p>
        </>
      )}
    </div>
  )
}
