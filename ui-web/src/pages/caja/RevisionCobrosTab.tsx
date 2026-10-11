import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, RefreshCw, Check, Calendar } from "lucide-react"
import { api, type RevisionCobrosTipo, type RevisionCobrosItems } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDateTime } from "../../utils/format"

type Tipo = RevisionCobrosTipo
type Item = RevisionCobrosItems[Tipo]

const SUBTABS: { key: Tipo; label: string }[] = [
  { key: "no_cuadran", label: "Pagos que no cuadran" },
  { key: "huerfanos", label: "Cobros sin venta" },
  { key: "multi_proveedor", label: "Varios proveedores" },
]

const MOTIVOS: Record<string, string> = {
  enlace_invalido: "Cobro sin enlace válido",
  no_cuadran: "Los pagos no cuadran",
  no_verificable: "No verificable (moneda extranjera)",
}

export default function RevisionCobrosTab() {
  const toast = useToast()
  const [tipo, setTipo] = useState<Tipo>("no_cuadran")
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const reqId = useRef(0)

  const load = useCallback(async () => {
    const my = ++reqId.current
    setLoading(true)
    setError(null)
    try {
      const res = await api.caja.revisionCobros.list(tipo, {
        desde: desde ? `${desde}T00:00:00-03:00` : undefined,
        hasta: hasta ? `${hasta}T23:59:59.999-03:00` : undefined,
      })
      if (my !== reqId.current) return
      setItems(Array.isArray(res) ? res : [])
    } catch (err: any) {
      if (my !== reqId.current) return
      setItems([])
      setError(err?.message || "No se pudo cargar la revisión de cobros.")
    } finally {
      if (my === reqId.current) setLoading(false)
    }
  }, [tipo, desde, hasta])

  useEffect(() => { load() }, [load])

  const revisar = async (id: string) => {
    if (!confirm("¿Querés marcar este ítem como revisado? Va a desaparecer de la lista.")) return
    setBusyId(id)
    try {
      await api.caja.revisionCobros.revisar(tipo, id)
      toast.success("Marcado como revisado", "El ítem se quitó de la lista.")
      await load()
    } catch (err: any) {
      toast.error("Error al marcar revisado", err?.message || "No se pudo completar la operación.")
    } finally {
      setBusyId(null)
    }
  }

  const headers: string[] =
    tipo === "no_cuadran" ? ["Venta", "Fecha", "Total", "Motivo", "Diferencia"]
    : tipo === "huerfanos" ? ["Fecha", "Operación", "Monto", "Punto de emisión", "Tarjeta", "Autorización", "Estado"]
    : ["Venta", "Fecha", "Total", "Proveedores"]

  const cell = "p-3.5 text-gray-800 dark:text-gray-200"

  const renderRow = (raw: Item) => {
    const it = raw as any
    if (tipo === "no_cuadran") {
      return (
        <>
          <td className={`${cell} font-mono font-bold`}>{it.numero}</td>
          <td className={cell}>{formatDateTime(it.fecha)}</td>
          <td className={`${cell} font-mono`}>{formatPYG(it.total)}</td>
          <td className={cell}>{MOTIVOS[it.pagos_revision] || it.pagos_revision}</td>
          <td className={`${cell} font-mono`}>{it.pagos_diferencia == null ? "—" : formatPYG(it.pagos_diferencia)}</td>
        </>
      )
    }
    if (tipo === "huerfanos") {
      return (
        <>
          <td className={cell}>{formatDateTime(it.fecha)}</td>
          <td className={cell}>{it.tipo_operacion || "—"}</td>
          <td className={`${cell} font-mono`}>{formatPYG(it.monto)}</td>
          <td className={cell}>{it.punto_emision || "—"}</td>
          <td className={cell}>{it.nombre_tarjeta || "—"}</td>
          <td className={`${cell} font-mono`}>{it.codigo_autorizacion || "—"}</td>
          <td className={cell}>
            {it.requiere_conciliacion ? "Requiere conciliación" : it.exitosa ? "Aprobado, sin venta" : "Rechazado"}
          </td>
        </>
      )
    }
    return (
      <>
        <td className={`${cell} font-mono font-bold`}>{it.numero}</td>
        <td className={cell}>{formatDateTime(it.fecha)}</td>
        <td className={`${cell} font-mono`}>{formatPYG(it.total)}</td>
        <td className={cell}>{Array.isArray(it.proveedores) ? it.proveedores.join(", ") : "—"}</td>
      </>
    )
  }

  return (
    <div className="card overflow-hidden space-y-0 animate-fade-in">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
            {SUBTABS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setTipo(s.key)}
                className={`px-3 py-1 rounded font-medium transition ${
                  tipo === s.key
                    ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 font-bold shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">Desde:</span>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 outline-none" />
              <span className="text-[11px] font-bold text-slate-500">Hasta:</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 outline-none" />
            </div>
            <button onClick={() => load()} disabled={loading} className="btn-ghost text-xs flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refrescar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="p-10 text-center text-xs text-red-600 dark:text-red-400">{error}</div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-xs text-gray-500 dark:text-gray-400">No hay ítems pendientes de revisión. ¡Todo al día!</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
              <tr>
                {headers.map(h => <th key={h} className="p-3.5">{h}</th>)}
                <th className="p-3.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map(it => (
                <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  {renderRow(it)}
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => revisar(it.id)}
                      disabled={busyId === it.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                    >
                      {busyId === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Marcar revisado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
