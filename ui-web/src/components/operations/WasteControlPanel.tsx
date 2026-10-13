import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Trash2, Plus, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Search, X, DollarSign, Package,
} from "lucide-react"
import { api } from "../../api"
import type { SupermerWaste, Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { usePermissions } from "../../context/PermissionsContext"
import { formatPYG, formatDateTime, debounce } from "../../utils/format"

const TIPOS_MERMA = [
  { value: "rotura", label: "Rotura / Daño físico" },
  { value: "vencimiento", label: "Vencimiento" },
  { value: "merma_natural", label: "Merma natural / deshidratación" },
  { value: "produccion", label: "Pérdida en proceso de producción" },
  { value: "devolucion", label: "Devolución" },
  { value: "otros", label: "Otros" },
]

function presetRange(days: number) {
  const hasta = new Date()
  const desde = new Date()
  desde.setDate(desde.getDate() - days)
  return { desde: desde.toISOString().split("T")[0], hasta: hasta.toISOString().split("T")[0] }
}

const ESTADO_STYLE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  aprobada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  rechazada: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
}

interface AreaOption { value: string; label: string }

export default function WasteControlPanel({ areas }: { areas: AreaOption[] }) {
  const toast = useToast()
  const { hasPermission } = usePermissions()
  const canApprove = hasPermission("mermas:approve")

  const [area, setArea] = useState(areas[0].value)
  const areaLabel = areas.find((a) => a.value === area)?.label || areas[0].label

  const [{ desde, hasta }, setRange] = useState(presetRange(30))
  const [preset, setPreset] = useState<"7" | "30" | "custom">("30")
  const [wastes, setWastes] = useState<SupermerWaste[]>([])
  const [loading, setLoading] = useState(true)
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [productQuery, setProductQuery] = useState("")
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [cantidad, setCantidad] = useState("")
  const [tipoMerma, setTipoMerma] = useState("rotura")
  const [motivo, setMotivo] = useState("")

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState("")

  useEffect(() => {
    api.warehouses.list()
      .then((whs: any[]) => {
        const principal = whs.find((w) => w.tipo === "principal") || whs[0]
        if (principal) setDefaultWarehouseId(principal.id)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.supermer.waste.list({ area, desde, hasta, limit: 500 })
      setWastes(Array.isArray(res) ? res : [])
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudieron cargar las mermas.")
    } finally {
      setLoading(false)
    }
  }, [area, desde, hasta, toast])

  useEffect(() => { load() }, [load])

  const searchProducts = useMemo(
    () => debounce((q: string) => {
      if (!q || q.trim().length < 2) { setProductResults([]); return }
      setSearchingProducts(true)
      api.products.list({ search: q, activo: true, limit: 15 })
        .then(setProductResults)
        .catch(() => setProductResults([]))
        .finally(() => setSearchingProducts(false))
    }, 350),
    [],
  )

  useEffect(() => { searchProducts(productQuery) }, [productQuery, searchProducts])

  const resumen = useMemo(() => {
    const aprobadas = wastes.filter((w) => w.estado === "aprobada")
    const pendientes = wastes.filter((w) => w.estado === "pendiente")
    const totalUnidades = aprobadas.reduce((acc, w) => acc + Number(w.cantidad || 0), 0)
    const totalCosto = aprobadas.reduce((acc, w) => acc + Number(w.costo_total || 0), 0)
    const porTipo: Record<string, { cantidad: number; costo: number }> = {}
    for (const w of aprobadas) {
      const t = w.tipo_merma || "otros"
      if (!porTipo[t]) porTipo[t] = { cantidad: 0, costo: 0 }
      porTipo[t].cantidad += Number(w.cantidad || 0)
      porTipo[t].costo += Number(w.costo_total || 0)
    }
    return { aprobadas: aprobadas.length, pendientes: pendientes.length, totalUnidades, totalCosto, porTipo }
  }, [wastes])

  const resetForm = () => {
    setSelectedProduct(null)
    setProductQuery("")
    setProductResults([])
    setCantidad("")
    setTipoMerma("rotura")
    setMotivo("")
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) { toast.warning("Producto requerido", "Buscá y seleccioná el producto."); return }
    const cant = parseFloat(cantidad.replace(",", "."))
    if (!cant || cant <= 0) { toast.warning("Cantidad inválida", "Ingresá una cantidad mayor a cero."); return }
    if (!defaultWarehouseId) { toast.error("Error", "No se pudo determinar el depósito."); return }

    setSaving(true)
    try {
      await api.supermer.waste.create({
        area,
        warehouse_id: defaultWarehouseId,
        producto_id: selectedProduct.id,
        cantidad: cant,
        tipo_merma: tipoMerma,
        motivo: motivo.trim() || undefined,
        costo_unitario: (selectedProduct as any).costo_promedio || (selectedProduct as any).ultimo_costo || 0,
      })
      toast.success("Merma registrada", "Queda pendiente de aprobación del Gerente.")
      setShowForm(false)
      resetForm()
      load()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo registrar la merma.")
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (w: SupermerWaste) => {
    try {
      await api.supermer.waste.approve(w.id)
      toast.success("Merma aprobada", `Se descontaron ${w.cantidad} un. de ${w.producto_nombre} del stock.`)
      load()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo aprobar la merma.")
    }
  }

  const handleReject = async (w: SupermerWaste) => {
    if (!rejectMotivo.trim()) { toast.warning("Motivo requerido", "Indicá el motivo del rechazo."); return }
    try {
      await api.supermer.waste.reject(w.id, rejectMotivo.trim())
      toast.success("Merma rechazada", "No afectará el stock.")
      setRejectingId(null)
      setRejectMotivo("")
      load()
    } catch (err: any) {
      toast.error("Error", err.message || "No se pudo rechazar la merma.")
    }
  }

  return (
    <div className="space-y-5">
      {/* Filtros de rango + resumen */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-500" />
            Control de Mermas — {areaLabel}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {areas.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mr-1">
                {areas.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setArea(a.value)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      area === a.value ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            {(["7", "30"] as const).map((d) => (
              <button
                key={d}
                onClick={() => { setPreset(d); setRange(presetRange(Number(d))) }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  preset === d
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {d} días
              </button>
            ))}
            <input
              type="date"
              value={desde}
              onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, desde: e.target.value })) }}
              className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <span className="text-xs text-slate-400 font-bold">al</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, hasta: e.target.value })) }}
              className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={() => setShowForm(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar Merma
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-3">
            <div className="text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Pendientes</div>
            <div className="text-xl font-black text-amber-700 dark:text-amber-300">{resumen.pendientes}</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-3">
            <div className="text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Aprobadas</div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">{resumen.aprobadas}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1"><Package className="w-3 h-3" /> Unidades perdidas</div>
            <div className="text-xl font-black text-slate-700 dark:text-slate-200">{resumen.totalUnidades.toLocaleString("es-PY")}</div>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-3">
            <div className="text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Costo confirmado</div>
            <div className="text-xl font-black text-rose-700 dark:text-rose-300">{formatPYG(resumen.totalCosto)}</div>
          </div>
        </div>

        {Object.keys(resumen.porTipo).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(resumen.porTipo).map(([tipo, v]) => (
              <div key={tipo} className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                {TIPOS_MERMA.find((t) => t.value === tipo)?.label || tipo}: {v.cantidad.toLocaleString("es-PY")} un. · {formatPYG(v.costo)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulario de alta */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">Nueva Merma — {areaLabel}</h4>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Producto</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-100">{selectedProduct.nombre}</span>
                <button type="button" onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Buscar producto por nombre o SKU..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                {searchingProducts && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
                {productResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {productResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => { setSelectedProduct(p); setProductResults([]) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100"
                      >
                        {p.nombre} <span className="text-slate-400 text-xs">({p.sku})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Cantidad</label>
              <input
                type="text"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Tipo de Merma</label>
              <select
                value={tipoMerma}
                onChange={(e) => setTipoMerma(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {TIPOS_MERMA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Motivo / Observación</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Caída durante reposición, corte de luz en cámara..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Registrar (queda pendiente de aprobación)
          </button>
        </form>
      )}

      {/* Listado detallado */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : wastes.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No hay mermas registradas en este rango de fechas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-3 text-left">Fecha</th>
                  <th className="p-3 text-left">Producto</th>
                  <th className="p-3 text-right">Cantidad</th>
                  <th className="p-3 text-left">Tipo</th>
                  <th className="p-3 text-right">Costo</th>
                  <th className="p-3 text-left">Registrado por</th>
                  <th className="p-3 text-center">Estado</th>
                  {canApprove && <th className="p-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {wastes.map((w) => (
                  <>
                    <tr key={w.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="p-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(w.fecha)}</td>
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-100">
                        {w.producto_nombre}
                        {w.motivo && <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">{w.motivo}</div>}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-200">{w.cantidad}</td>
                      <td className="p-3 text-xs text-slate-500 dark:text-slate-400">{TIPOS_MERMA.find((t) => t.value === w.tipo_merma)?.label || w.tipo_merma}</td>
                      <td className="p-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{formatPYG(w.costo_total)}</td>
                      <td className="p-3 text-xs text-slate-500 dark:text-slate-400">{w.registrado_por_nombre || "—"}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${ESTADO_STYLE[w.estado || "pendiente"]}`}>
                          {w.estado === "aprobada" ? <CheckCircle2 className="w-3 h-3" /> : w.estado === "rechazada" ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {w.estado}
                        </span>
                      </td>
                      {canApprove && (
                        <td className="p-3 text-right">
                          {w.estado === "pendiente" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => handleApprove(w)} className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/40">
                                Aprobar
                              </button>
                              <button onClick={() => setRejectingId(rejectingId === w.id ? null : w.id)} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700">
                                Rechazar
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    {rejectingId === w.id && (
                      <tr key={`${w.id}-reject`} className="bg-slate-50 dark:bg-slate-800/40">
                        <td colSpan={canApprove ? 8 : 7} className="p-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <input
                              type="text"
                              value={rejectMotivo}
                              onChange={(e) => setRejectMotivo(e.target.value)}
                              placeholder="Motivo del rechazo..."
                              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <button onClick={() => handleReject(w)} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">
                              Confirmar Rechazo
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
