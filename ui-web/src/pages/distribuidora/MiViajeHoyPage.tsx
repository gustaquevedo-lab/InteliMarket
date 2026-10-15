import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, CheckCircle, XCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { api } from "../../api"
import type { Trip, TripStop, TripStopItem } from "../../api"

const formatPYG = (n?: number | null) =>
  n != null ? "Gs " + Math.round(n).toLocaleString("es-PY") : "–"

type StopEstado = TripStop["estado"]

function estadoBadge(estado: StopEstado) {
  const map: Record<StopEstado, { label: string; cls: string }> = {
    pendiente: { label: "Pendiente", cls: "bg-gray-100 text-gray-600" },
    entregado: { label: "Entregado", cls: "bg-green-100 text-green-700" },
    rechazado_parcial: { label: "Rchazo parcial", cls: "bg-orange-100 text-orange-700" },
    rechazado_total: { label: "Rchazo total", cls: "bg-red-100 text-red-700" },
    faltante: { label: "Faltante", cls: "bg-yellow-100 text-yellow-700" },
  }
  const { label, cls } = map[estado] || { label: estado, cls: "bg-gray-100 text-gray-600" }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

function estadoIcon(estado: StopEstado) {
  if (estado === "entregado") return <CheckCircle className="h-5 w-5 text-green-500" />
  if (estado === "rechazado_total") return <XCircle className="h-5 w-5 text-red-500" />
  if (estado === "rechazado_parcial" || estado === "faltante")
    return <AlertCircle className="h-5 w-5 text-orange-400" />
  return <Clock className="h-5 w-5 text-gray-400" />
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────
function ItemRow({
  item,
  value,
  onChange,
}: {
  item: TripStopItem
  value: { entregada: string; rechazada: string; faltante: string }
  onChange: (v: { entregada: string; rechazada: string; faltante: string }) => void
}) {
  const asignada = Number(item.cantidad_asignada)
  const entregada = Number(value.entregada) || 0
  const diferencia = asignada - entregada

  function setEntregada(v: string) {
    const n = Math.min(Number(v) || 0, asignada)
    const diff = asignada - n
    onChange({ entregada: String(n), rechazada: value.rechazada, faltante: String(diff) })
  }

  return (
    <div className="border rounded-lg p-3 mb-2">
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medium text-gray-700">{item.product_id.slice(0, 12)}…</span>
        <span className="text-gray-500">Asig: {asignada}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 w-20">Entregado</label>
        <input
          type="number"
          min={0}
          max={asignada}
          step={0.001}
          value={value.entregada}
          onChange={(e) => setEntregada(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-24 text-right"
        />
      </div>
      {diferencia > 0 && (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-red-600 font-medium">Diferencia: {diferencia.toFixed(3)}</span>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                name={`diff-${item.id}`}
                checked={Number(value.rechazada) > 0}
                onChange={() => onChange({ entregada: value.entregada, rechazada: String(diferencia), faltante: "0" })}
              />
              Rechazo
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="radio"
                name={`diff-${item.id}`}
                checked={Number(value.faltante) > 0 && Number(value.rechazada) === 0}
                onChange={() => onChange({ entregada: value.entregada, rechazada: "0", faltante: String(diferencia) })}
              />
              Faltante
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StopModal ────────────────────────────────────────────────────────────────
function StopModal({
  stop,
  trip,
  companyId,
  onClose,
  onConfirmed,
}: {
  stop: TripStop
  trip: Trip
  companyId: string
  onClose: () => void
  onConfirmed: () => void
}) {
  const items = stop.items || []
  const [itemInputs, setItemInputs] = useState<Record<string, { entregada: string; rechazada: string; faltante: string }>>(
    () => Object.fromEntries(items.map((i) => [i.id, { entregada: String(i.cantidad_asignada), rechazada: "0", faltante: "0" }]))
  )
  const [firmado, setFirmado] = useState(false)
  const [obs, setObs] = useState("")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function confirm() {
    setSaving(true)
    setErr(null)
    try {
      await api.distribuidora.viajes.confirmStop(trip.id, stop.id, companyId, {
        items: items.map((item) => {
          const v = itemInputs[item.id] || { entregada: "0", rechazada: "0", faltante: "0" }
          return {
            stop_item_id: item.id,
            cantidad_entregada: Number(v.entregada) || 0,
            cantidad_rechazada: Number(v.rechazada) || 0,
            cantidad_faltante: Number(v.faltante) || 0,
          }
        }),
        firmado,
        observaciones: obs || undefined,
      })
      setToast("Parada confirmada")
      setTimeout(() => { onConfirmed() }, 800)
    } catch (e: any) {
      setErr(e?.message || "Error al confirmar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-base">Confirmar parada</h2>
            <p className="text-xs text-gray-500">Pedido {stop.sales_order_id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {toast && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-2 mb-3 text-sm text-center">
              {toast}
            </div>
          )}
          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 mb-3 text-sm">{err}</div>
          )}

          {items.length === 0 ? (
            <p className="text-sm text-gray-500">Sin ítems cargados.</p>
          ) : (
            items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                value={itemInputs[item.id] || { entregada: "0", rechazada: "0", faltante: "0" }}
                onChange={(v) => setItemInputs((prev) => ({ ...prev, [item.id]: v }))}
              />
            ))
          )}

          <label className="flex items-center gap-2 mt-3 text-sm">
            <input type="checkbox" checked={firmado} onChange={(e) => setFirmado(e.target.checked)} />
            Firmado por cliente
          </label>

          <textarea
            placeholder="Observaciones (opcional)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="mt-3 w-full border rounded-lg px-3 py-2 text-sm resize-none h-20"
          />
        </div>

        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Confirmar parada"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MiViajeHoyPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const companyId = user?.tenant_id || user?.id || ""

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStop, setSelectedStop] = useState<TripStop | null>(null)
  const [km, setKm] = useState("")
  const [showKmInput, setShowKmInput] = useState(false)
  const [kmMode, setKmMode] = useState<"salida" | "llegada">("salida")
  const [savingKm, setSavingKm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (companyId) loadTrip()
  }, [companyId])

  async function loadTrip() {
    setLoading(true)
    try {
      const t = await api.distribuidora.viajes.getMiViajeHoy(companyId)
      setTrip(t || null)
    } catch {
      setError("Error cargando viaje")
    } finally {
      setLoading(false)
    }
  }

  async function handleSalida() {
    if (!trip || !km) return
    setSavingKm(true)
    try {
      const updated = await api.distribuidora.viajes.registerSalida(trip.id, Number(km), companyId)
      setTrip(updated)
      setShowKmInput(false)
      setKm("")
    } catch (e: any) {
      setError(e?.message || "Error")
    } finally {
      setSavingKm(false)
    }
  }

  async function handleLlegada() {
    if (!trip || !km) return
    setSavingKm(true)
    try {
      await api.distribuidora.viajes.registerLlegada(trip.id, Number(km), companyId)
      navigate("/distribuidora/rendiciones")
    } catch (e: any) {
      setError(e?.message || "Error")
      setSavingKm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando…</p>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <h1 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Mi Viaje de Hoy
        </h1>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm">
          No tenés viaje asignado para hoy.
        </div>
      </div>
    )
  }

  const stops = [...(trip.stops || [])].sort((a, b) => a.orden_visita - b.orden_visita)
  const completadas = stops.filter((s) => s.estado !== "pendiente").length
  const totalStops = stops.length
  const allDone = completadas === totalStops && totalStops > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" /> Mi Viaje
            </h1>
            <p className="text-xs text-gray-500">{trip.patente} · {new Date().toLocaleDateString("es-PY")}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-blue-700">{completadas}/{totalStops}</p>
            <p className="text-xs text-gray-400">paradas</p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${totalStops > 0 ? (completadas / totalStops) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
        )}

        {/* Banner km salida */}
        {trip.estado === "listo" && !trip.km_salida && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">Registrá el km de salida para iniciar el viaje</p>
            {showKmInput ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Km odómetro"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1"
                />
                <button
                  onClick={handleSalida}
                  disabled={savingKm || !km}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {savingKm ? "…" : "Salir"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowKmInput(true)}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium w-full"
              >
                Ingresar km y salir
              </button>
            )}
          </div>
        )}

        {/* Lista de paradas */}
        {stops.map((stop) => (
          <button
            key={stop.id}
            disabled={stop.estado !== "pendiente" || trip.estado !== "en_ruta"}
            onClick={() => setSelectedStop(stop)}
            className="w-full bg-white border rounded-xl p-4 text-left flex items-start gap-3 shadow-sm disabled:opacity-80 hover:shadow-md transition-shadow"
          >
            <div className="mt-0.5">{estadoIcon(stop.estado)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">
                  Parada {stop.orden_visita} · {stop.customer_id.slice(0, 8)}
                </span>
                {estadoBadge(stop.estado)}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Pedido {stop.sales_order_id.slice(0, 8)}</p>
              {stop.visited_at && (
                <p className="text-xs text-gray-400">
                  Confirmado {new Date(stop.visited_at).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </button>
        ))}

        {/* Cerrar viaje */}
        {allDone && trip.estado === "en_ruta" && !trip.km_llegada && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-800 font-medium mb-2">
              ¡Todas las paradas completadas! Registrá la llegada.
            </p>
            {showKmInput && kmMode === "llegada" ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Km final"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1"
                />
                <button
                  onClick={handleLlegada}
                  disabled={savingKm || !km}
                  className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {savingKm ? "…" : "Cerrar"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setKmMode("llegada"); setShowKmInput(true) }}
                className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium w-full"
              >
                Cerrar viaje
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de parada */}
      {selectedStop && trip && (
        <StopModal
          stop={selectedStop}
          trip={trip}
          companyId={companyId}
          onClose={() => setSelectedStop(null)}
          onConfirmed={async () => {
            setSelectedStop(null)
            await loadTrip()
          }}
        />
      )}
    </div>
  )
}
