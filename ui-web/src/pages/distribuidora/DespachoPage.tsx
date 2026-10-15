import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Truck, Check, AlertTriangle } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { api } from "../../api"
import type { Trip, TripVehicle, PendingOrderForDispatch } from "../../api"

const formatPYG = (n?: number | null) =>
  n != null ? "Gs " + Math.round(n).toLocaleString("es-PY") : "–"

const formatKg = (n: number) => n.toFixed(1) + " kg"

// ─── WeightBar ────────────────────────────────────────────────────────────────
function WeightBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const color = current > max ? "bg-red-500" : current / max > 0.8 ? "bg-yellow-400" : "bg-green-500"
  return (
    <div className="mt-1">
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs mt-0.5 ${current > max ? "text-red-600 font-semibold" : "text-gray-500"}`}>
        {formatKg(current)} / {formatKg(max)}
        {current > max && " ⚠ Sobrepeso"}
      </p>
    </div>
  )
}

// ─── DraggableOrderCard ───────────────────────────────────────────────────────
function OrderCard({ order, dragging }: { order: PendingOrderForDispatch; dragging?: boolean }) {
  return (
    <div className={`bg-white border rounded-lg p-3 shadow-sm text-sm select-none ${dragging ? "opacity-50" : ""}`}>
      <div className="font-medium truncate">{order.customer_name || order.customer_id.slice(0, 8)}</div>
      <div className="text-gray-500 text-xs">{order.numero}</div>
      <div className="flex justify-between mt-1">
        <span className="text-blue-600 font-semibold">{formatPYG(order.total)}</span>
        <span className="text-gray-400">{formatKg(order.peso_kg)}</span>
      </div>
    </div>
  )
}

function SortableOrderCard({ order }: { order: PendingOrderForDispatch }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
    data: { order },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <OrderCard order={order} dragging={isDragging} />
    </div>
  )
}

// ─── DroppableColumn ─────────────────────────────────────────────────────────
function DroppableColumn({
  trip,
  vehicle,
  orders,
}: {
  trip: Trip
  vehicle?: TripVehicle
  orders: PendingOrderForDispatch[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: trip.id })
  const totalWeight = orders.reduce((s, o) => s + (o.peso_kg || 0), 0)
  const maxWeight = vehicle?.max_weight_kg || 0

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col border-2 rounded-xl p-3 min-w-[220px] max-w-[260px] flex-shrink-0 transition-colors ${
        isOver ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-gray-600" />
          <span className="font-semibold text-sm">{trip.patente}</span>
        </div>
        <p className="text-xs text-gray-500 truncate">Cobrador: {trip.cobrador_id.slice(0, 8)}</p>
        {maxWeight > 0 && <WeightBar current={totalWeight} max={maxWeight} />}
        <p className="text-xs text-gray-400 mt-1">{orders.length} pedido(s)</p>
      </div>
      <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1 min-h-[80px]">
          {orders.map((order) => (
            <SortableOrderCard key={order.id} order={order} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── PendingPanel ─────────────────────────────────────────────────────────────
function PendingPanel({ orders }: { orders: PendingOrderForDispatch[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pending" })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col border-2 rounded-xl p-3 w-[240px] flex-shrink-0 transition-colors ${
        isOver ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"
      }`}
    >
      <h2 className="font-semibold text-sm mb-2 text-gray-700">
        Pedidos pendientes ({orders.length})
      </h2>
      <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1 min-h-[80px] max-h-[calc(100vh-200px)] overflow-y-auto">
          {orders.map((order) => (
            <SortableOrderCard key={order.id} order={order} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DespachoPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const companyId = user?.tenant_id || user?.id || ""

  const today = new Date().toISOString().split("T")[0]
  const [fecha, setFecha] = useState(today)
  const [vehicles, setVehicles] = useState<TripVehicle[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [pendingOrders, setPendingOrders] = useState<PendingOrderForDispatch[]>([])
  // tripStops: { [trip_id]: PendingOrderForDispatch[] }
  const [tripStops, setTripStops] = useState<Record<string, PendingOrderForDispatch[]>>({})
  const [activeOrder, setActiveOrder] = useState<PendingOrderForDispatch | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (!companyId) return
    loadAll()
  }, [companyId, fecha])

  async function loadAll() {
    try {
      const [vs, ts, pos] = await Promise.all([
        api.distribuidora.viajes.listVehicles(companyId),
        api.distribuidora.viajes.listTrips(companyId, fecha),
        api.distribuidora.viajes.listPendingOrders(companyId, fecha),
      ])
      setVehicles(vs)
      setTrips(ts)
      setPendingOrders(pos)
      // Inicializar columnas con trips existentes
      const initialStops: Record<string, PendingOrderForDispatch[]> = {}
      ts.forEach((t) => { initialStops[t.id] = [] })
      setTripStops(initialStops)
    } catch (e) {
      setError("Error cargando datos")
    }
  }

  function getVehicle(trip: Trip) {
    return vehicles.find((v) => v.patente === trip.patente)
  }

  function findContainer(orderId: string): string | null {
    if (pendingOrders.find((o) => o.id === orderId)) return "pending"
    for (const [tripId, orders] of Object.entries(tripStops)) {
      if (orders.find((o) => o.id === orderId)) return tripId
    }
    return null
  }

  function onDragStart(e: DragStartEvent) {
    const order = (e.active.data.current as any)?.order as PendingOrderForDispatch
    setActiveOrder(order || null)
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveOrder(null)
    const { active, over } = e
    if (!over) return

    const fromContainer = findContainer(active.id as string)
    if (!fromContainer) return

    const toContainer = over.id as string
    if (fromContainer === toContainer) {
      // Reorder within same container
      if (toContainer === "pending") {
        setPendingOrders((prev) => {
          const oldIdx = prev.findIndex((o) => o.id === active.id)
          const newIdx = prev.findIndex((o) => o.id === over.id)
          if (oldIdx === -1 || newIdx === -1) return prev
          return arrayMove(prev, oldIdx, newIdx)
        })
      } else {
        setTripStops((prev) => {
          const list = [...(prev[toContainer] || [])]
          const oldIdx = list.findIndex((o) => o.id === active.id)
          const newIdx = list.findIndex((o) => o.id === over.id)
          if (oldIdx === -1 || newIdx === -1) return prev
          return { ...prev, [toContainer]: arrayMove(list, oldIdx, newIdx) }
        })
      }
      return
    }

    // Move between containers
    const order = [
      ...pendingOrders,
      ...Object.values(tripStops).flat(),
    ].find((o) => o.id === active.id)
    if (!order) return

    if (fromContainer === "pending") {
      setPendingOrders((prev) => prev.filter((o) => o.id !== active.id))
    } else {
      setTripStops((prev) => ({
        ...prev,
        [fromContainer]: (prev[fromContainer] || []).filter((o) => o.id !== active.id),
      }))
    }

    if (toContainer === "pending") {
      setPendingOrders((prev) => [...prev, order])
    } else if (tripStops.hasOwnProperty(toContainer)) {
      setTripStops((prev) => ({
        ...prev,
        [toContainer]: [...(prev[toContainer] || []), order],
      }))
    }
  }

  function hasOverweight() {
    return trips.some((t) => {
      const vehicle = getVehicle(t)
      if (!vehicle) return false
      const totalKg = (tripStops[t.id] || []).reduce((s, o) => s + (o.peso_kg || 0), 0)
      return totalKg > vehicle.max_weight_kg
    })
  }

  async function confirmDespacho() {
    setConfirming(true)
    setError(null)
    try {
      for (const trip of trips) {
        const stops = tripStops[trip.id] || []
        if (stops.length === 0) continue
        await api.distribuidora.viajes.updateTripStops(
          trip.id,
          stops.map((o, i) => ({ sales_order_id: o.id, customer_id: o.customer_id, orden_visita: i + 1 })),
          companyId,
        )
        await api.distribuidora.viajes.confirmTrip(trip.id, companyId)
      }
      await loadAll()
    } catch (e: any) {
      setError(e?.message || "Error al confirmar despacho")
    } finally {
      setConfirming(false)
    }
  }

  const overweight = hasOverweight()

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Truck className="h-5 w-5" /> Armado de Despacho
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
          <button
            onClick={confirmDespacho}
            disabled={confirming || overweight || trips.length === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {confirming ? (
              "Confirmando..."
            ) : overweight ? (
              <><AlertTriangle className="h-4 w-4" /> Sobrepeso</>
            ) : (
              <><Check className="h-4 w-4" /> Confirmar despacho</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {trips.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
          No hay camiones asignados para esta fecha. Cree los viajes primero desde la gestión de rutas.
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          <PendingPanel orders={pendingOrders} />
          {trips.map((trip) => (
            <DroppableColumn
              key={trip.id}
              trip={trip}
              vehicle={getVehicle(trip)}
              orders={tripStops[trip.id] || []}
            />
          ))}
        </div>
        <DragOverlay>
          {activeOrder && <OrderCard order={activeOrder} />}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
