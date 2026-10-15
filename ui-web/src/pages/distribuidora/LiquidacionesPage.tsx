import { useState, useEffect } from "react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { RouteLiquidation } from "../../api"
import { Loader2, CheckCircle, XCircle, Eye, AlertCircle } from "lucide-react"

const today = new Date().toISOString().split("T")[0]

const formatPYG = (n?: number | null) => {
  if (n == null) return "Gs 0"
  return `Gs ${Number(n).toLocaleString("es-PY")}`
}

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    pendiente: "bg-yellow-100 text-yellow-800",
    autorizada: "bg-green-100 text-green-800",
    observada: "bg-orange-100 text-orange-800",
    rechazada: "bg-red-100 text-red-800",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[estado] || "bg-gray-100 text-gray-700"}`}>
      {estado}
    </span>
  )
}

export default function LiquidacionesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const companyId = user?.tenant_id || user?.id || ""

  const [liquidations, setLiquidations] = useState<RouteLiquidation[]>([])
  const [loading, setLoading] = useState(true)
  const [fecha, setFecha] = useState(today)
  const [selected, setSelected] = useState<RouteLiquidation | null>(null)
  const [observaciones, setObservaciones] = useState("")
  const [acting, setActing] = useState(false)

  const load = async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const sessions = await api.distribuidora.rutaCaja.listSessions({
        company_id: companyId,
        fecha,
      })
      const liqs: RouteLiquidation[] = []
      for (const s of sessions || []) {
        if (s.liquidation) liqs.push(s.liquidation)
      }
      setLiquidations(liqs)
    } catch {
      setLiquidations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [companyId, fecha])

  const handleAction = async (action: "authorize" | "observe" | "reject") => {
    if (!selected) return
    setActing(true)
    try {
      if (action === "authorize") {
        await api.distribuidora.rutaCaja.authorizeLiquidation(selected.id)
        toast.success("Liquidación autorizada")
      } else if (action === "observe") {
        await api.distribuidora.rutaCaja.observeLiquidation(selected.id, observaciones)
        toast.success("Liquidación marcada con observación")
      } else {
        await api.distribuidora.rutaCaja.rejectLiquidation(selected.id, observaciones)
        toast.success("Liquidación rechazada")
      }
      setSelected(null)
      setObservaciones("")
      load()
    } catch (e: any) {
      toast.error(e?.message || "Error")
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Liquidaciones del día</h1>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-gray-400 w-7 h-7" />
        </div>
      ) : liquidations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-gray-500 text-sm">
          No hay liquidaciones para esta fecha.
        </div>
      ) : (
        <div className="space-y-2">
          {liquidations.map(liq => (
            <div key={liq.id} className="rounded-lg border p-4 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  {estadoBadge(liq.estado)}
                  <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Declarado</p>
                      <p className="font-semibold">{formatPYG(liq.efectivo_declarado)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Esperado</p>
                      <p className="font-semibold">{formatPYG(liq.efectivo_esperado)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Diferencia</p>
                      <p className={`font-bold ${Number(liq.diferencia) < 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatPYG(liq.diferencia)}
                      </p>
                    </div>
                  </div>
                  {liq.cheques_declarado > 0 && (
                    <p className="text-xs text-gray-500">Cheques: {formatPYG(liq.cheques_declarado)} · Pagarés: {formatPYG(liq.pagares_declarado)}</p>
                  )}
                </div>
                {liq.estado === "pendiente" && (
                  <button
                    onClick={() => { setSelected(liq); setObservaciones("") }}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5"
                  >
                    <Eye size={14} /> Revisar
                  </button>
                )}
              </div>
              {liq.observaciones && (
                <div className="mt-2 rounded bg-orange-50 border border-orange-200 p-2 text-xs text-orange-800">
                  {liq.observaciones}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md space-y-4 p-5">
            <h2 className="text-lg font-bold">Revisar liquidación</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Efectivo declarado</p>
                <p className="font-bold">{formatPYG(selected.efectivo_declarado)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Efectivo esperado</p>
                <p className="font-bold text-blue-700">{formatPYG(selected.efectivo_esperado)}</p>
              </div>
              <div className={`rounded-lg p-3 col-span-2 ${Number(selected.diferencia) < 0 ? "bg-red-50" : "bg-green-50"}`}>
                <p className="text-xs text-gray-500">Diferencia</p>
                <p className={`font-bold text-lg ${Number(selected.diferencia) < 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatPYG(selected.diferencia)}
                </p>
              </div>
            </div>
            {selected.items && selected.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Documentos</p>
                <div className="space-y-1">
                  {selected.items.map((it: any) => (
                    <div key={it.id} className="flex justify-between text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="text-gray-500 capitalize">{it.tipo} #{it.numero}</span>
                      <span className="font-medium">{formatPYG(it.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700">Observaciones (opcional)</label>
              <textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                rows={2}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nota para el cobrador..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 border rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAction("observe")}
                disabled={acting || !observaciones.trim()}
                className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <AlertCircle size={14} /> Observar
              </button>
              <button
                onClick={() => handleAction("reject")}
                disabled={acting}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <XCircle size={14} /> Rechazar
              </button>
              <button
                onClick={() => handleAction("authorize")}
                disabled={acting}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Autorizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
