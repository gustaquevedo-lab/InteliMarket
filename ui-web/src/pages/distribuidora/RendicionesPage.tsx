import { useState, useEffect } from "react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { RouteSession, RouteLiquidation } from "../../api"
import {
  Loader2, AlertCircle, CheckCircle, Clock, Eye, Plus, Trash2,
} from "lucide-react"

const today = new Date().toISOString().split("T")[0]

const formatPYG = (n?: number | null) => {
  if (n == null) return "Gs 0"
  return `Gs ${Number(n).toLocaleString("es-PY")}`
}

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    abierta: "bg-blue-100 text-blue-800",
    cerrada: "bg-yellow-100 text-yellow-800",
    liquidada: "bg-green-100 text-green-800",
    observada: "bg-orange-100 text-orange-800",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[estado] || "bg-gray-100 text-gray-700"}`}>
      {estado}
    </span>
  )
}

type ItemForm = { tipo: string; numero: string; banco: string; monto: string; vencimiento: string }

export default function RendicionesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const companyId = user?.tenant_id || user?.id || ""
  const cobradorId = user?.id || ""

  const [session, setSession] = useState<RouteSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [efectivo, setEfectivo] = useState("")
  const [cheques, setCheques] = useState("")
  const [pagares, setPagares] = useState("")
  const [items, setItems] = useState<ItemForm[]>([])

  const loadSession = async () => {
    if (!companyId || !cobradorId) return
    setLoading(true)
    try {
      const sessions = await api.distribuidora.rutaCaja.listSessions({
        company_id: companyId,
        fecha: today,
        cobrador_id: cobradorId,
      })
      if (sessions && sessions.length > 0) {
        const detail = await api.distribuidora.rutaCaja.getSession(sessions[0].id)
        setSession(detail)
      } else {
        setSession(null)
      }
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSession() }, [companyId, cobradorId])

  const addItem = () => setItems(prev => [...prev, { tipo: "cheque", numero: "", banco: "", monto: "", vencimiento: "" }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof ItemForm, value: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const handleSubmit = async () => {
    if (!session) return
    setSubmitting(true)
    try {
      await api.distribuidora.rutaCaja.closeSession(session.id, {
        efectivo_declarado: Number(efectivo) || 0,
        cheques_declarado: Number(cheques) || 0,
        pagares_declarado: Number(pagares) || 0,
        nc_aplicadas: 0,
        descuentos_autorizados: 0,
        items: items.filter(it => it.numero && it.monto).map(it => ({
          tipo: it.tipo,
          numero: it.numero,
          banco: it.banco || undefined,
          monto: Number(it.monto),
          vencimiento: it.vencimiento || undefined,
        })),
      })
      toast.success("Rendición enviada al supervisor")
      setShowModal(false)
      loadSession()
    } catch (e: any) {
      toast.error(e?.message || "Error al rendir")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400 w-8 h-8" />
      </div>
    )
  }

  const liq: RouteLiquidation | undefined = session?.liquidation
  const ar = session?.ar_summary

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Mi Rendición</h1>

      {!session ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-500 mt-0.5 flex-shrink-0" size={20} />
          <p className="text-yellow-800 text-sm">No tenés sesión abierta hoy — contactá al supervisor para que te abra una.</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">Sesión del día</span>
              {estadoBadge(session.estado)}
            </div>
            <p className="text-xs text-gray-500">Apertura: {new Date(session.opened_at).toLocaleTimeString("es-PY")}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 bg-gray-50">
              <p className="text-xs text-gray-500">Fondo inicial</p>
              <p className="font-bold text-gray-800">{formatPYG(session.fondo_inicial)}</p>
            </div>
            <div className="rounded-lg border p-3 bg-blue-50">
              <p className="text-xs text-gray-500">Cobrado en AR (efectivo)</p>
              <p className="font-bold text-blue-700">{formatPYG(ar?.total_efectivo)}</p>
            </div>
            <div className="rounded-lg border p-3 bg-purple-50">
              <p className="text-xs text-gray-500">Pagarés del día</p>
              <p className="font-bold text-purple-700">{formatPYG(ar?.total_pagares)}</p>
            </div>
            <div className="rounded-lg border p-3 bg-green-50">
              <p className="text-xs text-gray-500">NCs aplicadas</p>
              <p className="font-bold text-green-700">{formatPYG(ar?.total_nc)}</p>
            </div>
          </div>

          {session.rendicion && (
            <div className="rounded-lg border p-4 space-y-1 text-sm">
              <p className="font-semibold">Qué tenés que entregar</p>
              {([
                ["facturas", "+ Facturas de la carga"], ["credito", "− Crédito (queda por cobrar)"],
                ["cobros", "+ Cobros de deudas"], ["otros_ingresos", "+ Otros ingresos"],
                ["devoluciones", "− Devoluciones / notas de crédito"], ["depositos", "− Depósitos y transferencias de clientes"],
                ["gastos", "− Gastos autorizados"],
              ] as const).map(([k, label]) => (
                <div key={k} className="flex justify-between"><span className="text-gray-600">{label}</span><span>{formatPYG(session.rendicion?.[k])}</span></div>
              ))}
              <div className="flex justify-between border-t pt-1 font-bold"><span>= Efectivo y cheques a entregar</span><span>{formatPYG(session.rendicion.total)}</span></div>
            </div>
          )}

          {liq && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-gray-400" />
                <span className="font-semibold text-sm">Liquidación</span>
                {estadoBadge(liq.estado)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Declarado:</span> <span className="font-medium">{formatPYG(liq.efectivo_declarado)}</span></div>
                <div><span className="text-gray-500">Esperado:</span> <span className="font-medium">{formatPYG(liq.efectivo_esperado)}</span></div>
                <div className="col-span-2">
                  <span className="text-gray-500">Diferencia:</span>{" "}
                  <span className={`font-bold ${Number(liq.diferencia) < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatPYG(liq.diferencia)}
                  </span>
                </div>
              </div>
              {liq.estado === "observada" && liq.observaciones && (
                <div className="rounded bg-orange-50 border border-orange-200 p-2 text-sm text-orange-800">
                  <strong>Nota del supervisor:</strong> {liq.observaciones}
                </div>
              )}
              {liq.estado === "autorizada" && (
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <CheckCircle size={16} /> Liquidación autorizada
                </div>
              )}
            </div>
          )}

          {session.estado === "abierta" && !liq && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Rendir al supervisor
            </button>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 p-5">
            <h2 className="text-lg font-bold">Rendir al supervisor</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Efectivo en mano (Gs)</label>
                <input
                  type="number"
                  value={efectivo}
                  onChange={e => setEfectivo(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Cheques (total, Gs)</label>
                <input
                  type="number"
                  value={cheques}
                  onChange={e => setCheques(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Pagarés (total, Gs)</label>
                <input
                  type="number"
                  value={pagares}
                  onChange={e => setPagares(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Detalle cheques / pagarés</span>
                <button onClick={addItem} className="text-blue-600 text-sm flex items-center gap-1 hover:underline">
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 mb-2 space-y-2 bg-gray-50">
                  <div className="flex gap-2">
                    <select
                      value={item.tipo}
                      onChange={e => updateItem(i, "tipo", e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="cheque">Cheque</option>
                      <option value="pagare">Pagaré</option>
                    </select>
                    <input
                      placeholder="Número"
                      value={item.numero}
                      onChange={e => updateItem(i, "numero", e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="Banco (opt)"
                      value={item.banco}
                      onChange={e => updateItem(i, "banco", e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Monto Gs"
                      value={item.monto}
                      onChange={e => updateItem(i, "monto", e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <input
                    type="date"
                    value={item.vencimiento}
                    onChange={e => updateItem(i, "vencimiento", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Enviar rendición
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
