import { useEntityLookup, getProductName, getSupplierName } from "../../hooks/useEntityLookup"
import { useState, useEffect } from "react"
import { MapPin, ClipboardList, RotateCcw, Layers, Truck, Bell, PackageSearch } from "lucide-react"
import { advInvApi } from "../../api/advancedInventory"
import { api, type PackBarcode } from "../../api"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

function apiGet(e: string) {
  const token = localStorage.getItem("access_token")
  return fetch(`${API_BASE}/v1/advanced-inventory${e}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })
}

function apiPost(e: string, d?: any) {
  const token = localStorage.getItem("access_token")
  return fetch(`${API_BASE}/v1/advanced-inventory${e}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: d ? JSON.stringify(d) : undefined,
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })
}

function apiPut(e: string, d: any) {
  const token = localStorage.getItem("access_token")
  return fetch(`${API_BASE}/v1/advanced-inventory${e}`, {
    method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(d),
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })
}


export default function InventoryAdvancedPage() {
  useEntityLookup()
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Control de Inventario Avanzado</h1>
          <p className="text-sm text-gray-500 mt-1">Ubicaciones, Picking, Conteo Cíclico, FIFO, Consignación</p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard", label: "Dashboard", icon: PackageSearch },
            { key: "locations", label: "Ubicaciones", icon: MapPin },
            { key: "picking", label: "Picking", icon: ClipboardList },
            { key: "cycles", label: "Conteo Cíclico", icon: RotateCcw },
            { key: "lots", label: "Lotes / FIFO", icon: Layers },
            { key: "consignment", label: "Consignación", icon: Truck },
            { key: "replenish", label: "Reabastecimiento", icon: Bell },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab === t.key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "locations" && <LocationsTab />}
      {tab === "picking" && <PickingTab />}
      {tab === "cycles" && <CycleCountTab />}
      {tab === "lots" && <LotsTab />}
      {tab === "consignment" && <ConsignmentTab />}
      {tab === "replenish" && <ReplenishTab />}
    </div>
  )
}

/* ── Dashboard ────────────────────────────────────────────────── */
function DashboardTab() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { apiGet("/dashboard").then(setData).catch(() => {}) }, [])

  if (!data) return <div className="text-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ubicaciones", value: data.total_locations, color: "text-blue-600" },
          { label: "Picking Activos", value: data.active_picking_lists, color: "text-green-600" },
          { label: "Conteos Abiertos", value: data.open_cycle_counts, color: "text-purple-600" },
          { label: "Items Consignación", value: data.consignment_items, color: "text-amber-600" },
          { label: "Alertas Stock Bajo", value: data.low_stock_alerts, color: "text-red-600" },
          { label: "Lotes por Vencer", value: data.lots_expiring_soon, color: "text-orange-600" },
          { label: "Picks Pendientes", value: data.pending_picks, color: "text-indigo-600" },
          { label: "Discrepancias", value: data.total_discrepancies, color: "text-rose-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className={`text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Picking lists recent */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Picking Lists Recientes</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-60 overflow-y-auto">
            {(data.recent_picking_lists || []).map((pl: any) => (
              <div key={pl.id} className="px-5 py-3 text-sm">
                <span className="font-medium">{pl.numero}</span>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${pl.estado === "completado" ? "bg-green-100 text-green-700" : pl.estado === "asignado" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>{pl.estado}</span>
                <p className="text-xs text-gray-400 mt-0.5">{pl.picked_items}/{pl.total_items} items</p>
              </div>
            ))}
            {(!data.recent_picking_lists || data.recent_picking_lists.length === 0) && <p className="px-5 py-6 text-center text-gray-400 text-sm">Sin picking lists</p>}
          </div>
        </div>

        {/* Lots expiring */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Lotes Próximos a Vencer (30 días)</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-60 overflow-y-auto">
            {(data.expiring_lots || []).map((l: any) => (
              <div key={l.id} className="px-5 py-3 text-sm flex justify-between">
                <div>
                  <span className="font-medium">{l.referencia || "—"}</span>
                  <span className="text-gray-400 ml-2">{getProductName(l.product_id)}</span>
                </div>
                <span className="text-red-500 font-medium">{l.cantidad_disponible} uds · {l.fecha_vencimiento ? new Date(l.fecha_vencimiento).toLocaleDateString("es-PY") : "—"}</span>
              </div>
            ))}
            {(!data.expiring_lots || data.expiring_lots.length === 0) && <p className="px-5 py-6 text-center text-gray-400 text-sm">Sin lotes próximos a vencer</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Locations ───────────────────────────────────────────────── */
function LocationsTab() {
  const [locs, setLocs] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ warehouse_id: "", codigo: "", pasillo: "", estante: "", posicion: "", capacidad_maxima: "" })
  useEffect(() => { apiGet("/locations").then(setLocs).catch(() => {}) }, [])

  const create = async () => {
    try {
      await apiPost("/locations", { ...form, capacidad_maxima: parseFloat(form.capacidad_maxima) || null })
      setShowForm(false); setForm({ warehouse_id: "", codigo: "", pasillo: "", estante: "", posicion: "", capacidad_maxima: "" })
      setLocs(await apiGet("/locations"))
    } catch {}
  }

  const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Ubicaciones de Almacén</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">{showForm ? "Cancelar" : "+ Nueva Ubicación"}</button>
      </div>
      {showForm && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="ID Almacén" value={form.warehouse_id} onChange={f("warehouse_id")} className="input-field" />
            <input placeholder="Código (ej: A-01-01)" value={form.codigo} onChange={f("codigo")} className="input-field" />
            <input placeholder="Pasillo" value={form.pasillo} onChange={f("pasillo")} className="input-field" />
            <input placeholder="Estante" value={form.estante} onChange={f("estante")} className="input-field" />
            <input placeholder="Posición" value={form.posicion} onChange={f("posicion")} className="input-field" />
            <input type="number" placeholder="Capacidad máxima" value={form.capacidad_maxima} onChange={f("capacidad_maxima")} className="input-field" />
          </div>
          <button onClick={create} className="btn-primary px-6">Crear</button>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr><th className="text-left px-5 py-3 text-gray-500 font-medium">Código</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Pasillo</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Estante</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Posición</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Capacidad</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Almacén</th></tr>
          </thead>
          <tbody>
            {locs.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-medium">{l.codigo}</td><td className="px-5 py-3">{l.pasillo || "—"}</td>
                <td className="px-5 py-3">{l.estante || "—"}</td><td className="px-5 py-3">{l.posicion || "—"}</td>
                <td className="px-5 py-3 text-right">{l.capacidad_maxima || "—"}</td><td className="px-5 py-3 font-mono text-xs">{l.warehouse_id?.slice(0, 8)}</td>
              </tr>
            ))}
            {locs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Sin ubicaciones</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Picking Lists ────────────────────────────────────────────── */
function PickingTab() {
  const [lists, setLists] = useState<any[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ warehouse_id: "", numero: "", items: "" })
  useEffect(() => { apiGet("/picking-lists").then(setLists).catch(() => {}) }, [])

  const loadDetail = async (id: string) => {
    try { const d = await apiGet(`/picking-lists/${id}`); setDetail(d); setSelected(id) } catch {}
  }

  const create = async () => {
    try {
      const items = form.items.split("\n").filter(Boolean).map((line) => {
        const [pid, cant, nombre] = line.split(",")
        return { product_id: pid.trim(), cantidad: parseFloat(cant.trim()), product_nombre: nombre?.trim() }
      })
      await apiPost("/picking-lists", { warehouse_id: form.warehouse_id, numero: form.numero, items })
      setShowForm(false); setForm({ warehouse_id: "", numero: "", items: "" })
      setLists(await apiGet("/picking-lists"))
    } catch {}
  }

  const handleAssign = async (id: string) => {
    try { await apiPost(`/picking-lists/${id}/assign`, {}); loadDetail(id); setLists(await apiGet("/picking-lists")) } catch {}
  }

  const handlePick = async (plId: string, itemId: string) => {
    const q = prompt("Cantidad a pickear:") || "0"
    const lot = prompt("ID de lote (FIFO):") || ""
    try {
      await apiPost(`/picking-lists/${plId}/items/${itemId}/pick`, { cantidad: parseFloat(q), lot_id: lot || null })
      loadDetail(plId); setLists(await apiGet("/picking-lists"))
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Picking Lists</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">{showForm ? "Cancelar" : "+ Nueva"}</button>
      </div>
      {showForm && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="ID Almacén" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className="input-field" />
            <input placeholder="Número (ej: PK-20260531-001)" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="input-field" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Items (una por línea: product_id,cantidad,nombre)</p>
            <textarea value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} rows={4} className="input-field w-full font-mono text-xs" placeholder="uuid-producto-1,10,Producto A&#10;uuid-producto-2,5,Producto B" />
          </div>
          <button onClick={create} className="btn-primary px-6">Crear Picking List</button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700"><h3 className="font-semibold text-sm">Lista</h3></div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
            {lists.length === 0 ? <p className="px-5 py-8 text-center text-gray-400">Sin picking lists</p> : lists.map((pl) => (
              <div key={pl.id} className={`px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition ${selected === pl.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`} onClick={() => loadDetail(pl.id)}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{pl.numero}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${pl.estado === "completado" ? "bg-green-100 text-green-700" : pl.estado === "asignado" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>{pl.estado}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{pl.picked_items}/{pl.total_items} items</p>
                {pl.estado === "pendiente" && <button onClick={(e) => { e.stopPropagation(); handleAssign(pl.id) }} className="mt-1 text-xs bg-blue-500 text-white px-2 py-1 rounded">Asignar</button>}
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          {!detail ? <p className="text-gray-400 text-center py-12">Seleccioná una lista</p> : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div><h3 className="font-semibold">{detail.numero}</h3><span className={`px-2 py-0.5 rounded-full text-xs ${detail.estado === "completado" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{detail.estado}</span></div>
              </div>
              <div className="space-y-2">
                {(detail.items || []).map((i: any) => (
                  <div key={i.id} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{i.product_nombre || i.product_id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">Sol: {i.cantidad_solicitada} · Pic: {i.cantidad_pickeada} · {i.lot_id ? `Lote: ${i.lot_id.slice(0, 8)}` : ""}</p>
                    </div>
                    {i.estado !== "completado" && <button onClick={() => handlePick(detail.id, i.id)} className="text-xs bg-blue-500 text-white px-3 py-1 rounded">Pickear</button>}
                    {i.estado === "completado" && <span className="text-xs text-green-600 font-medium">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Cycle Counts ─────────────────────────────────────────────── */
function CycleCountTab() {
  const [counts, setCounts] = useState<any[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [whId, setWhId] = useState("")
  const [addItem, setAddItem] = useState({ product_id: "", cantidad_sistema: "0" })
  const [packBarcodesByProduct, setPackBarcodesByProduct] = useState<Map<string, PackBarcode[]>>(new Map())
  useEffect(() => { apiGet("/cycle-counts").then(setCounts).catch(() => {}) }, [])
  useEffect(() => {
    api.products.packBarcodes.list().then((list) => {
      const map = new Map<string, PackBarcode[]>()
      for (const pb of list || []) {
        if (!pb.activo) continue
        const arr = map.get(pb.product_id) || []
        arr.push(pb)
        map.set(pb.product_id, arr)
      }
      setPackBarcodesByProduct(map)
    }).catch(() => {})
  }, [])

  const loadDetail = async (id: string) => {
    try { setDetail(await apiGet(`/cycle-counts/${id}`)); setSelected(id) } catch {}
  }

  const create = async () => {
    try { await apiPost("/cycle-counts", { warehouse_id: whId }); setShowForm(false); setWhId(""); setCounts(await apiGet("/cycle-counts")) } catch {}
  }

  const addCountItem = async () => {
    if (!detail) return
    try {
      await apiPost(`/cycle-counts/${detail.id}/items`, { product_id: addItem.product_id, cantidad_sistema: parseFloat(addItem.cantidad_sistema) })
      loadDetail(detail.id); setAddItem({ product_id: "", cantidad_sistema: "0" })
    } catch {}
  }

  const record = async (itemId: string, productId: string) => {
    const packs = packBarcodesByProduct.get(productId) || []
    let cantidadFisica: number
    if (packs.length > 0) {
      const opciones = packs.map(p => `${p.etiqueta} (x${p.unidades_por_paquete})`).join(" | ")
      const presentacion = (prompt(`Presentación contada (dejar vacío = unidad suelta)\nOpciones: ${opciones}`) || "").trim().toLowerCase()
      const cantidadStr = prompt("Cantidad en esa presentación:") || "0"
      const cantidad = parseFloat(cantidadStr) || 0
      const pack = packs.find(p => p.etiqueta.trim().toLowerCase() === presentacion)
      cantidadFisica = pack ? cantidad * Number(pack.unidades_por_paquete) : cantidad
    } else {
      cantidadFisica = parseFloat(prompt("Cantidad física:") || "0")
    }
    try { await apiPost(`/cycle-counts/${detail.id}/items/${itemId}/count`, { cantidad_fisica: cantidadFisica }); loadDetail(detail.id) } catch {}
  }

  const complete = async () => {
    if (!detail) return
    if (!confirm("¿Completar conteo? Se aplicarán diferencias al stock.")) return
    try { await apiPost(`/cycle-counts/${detail.id}/complete`); setDetail(null); setSelected(null); setCounts(await apiGet("/cycle-counts")) } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Conteo Cíclico</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">{showForm ? "Cancelar" : "+ Nuevo Conteo"}</button>
      </div>
      {showForm && (
        <div className="card p-5 flex gap-3 items-end">
          <div className="flex-1"><label className="text-xs text-gray-500">ID Almacén</label><input value={whId} onChange={(e) => setWhId(e.target.value)} className="input-field w-full mt-1" /></div>
          <button onClick={create} className="btn-primary">Crear</button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700"><h3 className="font-semibold text-sm">Conteos</h3></div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
            {counts.length === 0 ? <p className="px-5 py-8 text-center text-gray-400">Sin conteos</p> : counts.map((cc) => (
              <div key={cc.id} className={`px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 ${selected === cc.id ? "bg-blue-50" : ""}`} onClick={() => loadDetail(cc.id)}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{cc.numero}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${cc.estado === "completado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{cc.estado}</span>
                </div>
                <p className="text-xs text-gray-500">{cc.conteo_completado}/{cc.conteo_total} · {cc.discrepancias} discrepancias</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          {!detail ? <p className="text-gray-400 text-center py-12">Seleccioná un conteo</p> : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div><h3 className="font-semibold">{detail.numero}</h3><span className="text-xs text-gray-500">{detail.tipo}</span></div>
                {detail.estado === "abierto" && <button onClick={complete} className="text-xs bg-green-500 text-white px-3 py-1 rounded">Completar</button>}
              </div>
              {/* Add item */}
              {detail.estado === "abierto" && (
                <div className="flex gap-2">
                  <input placeholder="ID Producto" value={addItem.product_id} onChange={(e) => setAddItem({ ...addItem, product_id: e.target.value })} className="input-field flex-1 text-xs" />
                  <input type="number" placeholder="Stock sist." value={addItem.cantidad_sistema} onChange={(e) => setAddItem({ ...addItem, cantidad_sistema: e.target.value })} className="input-field w-24 text-xs" />
                  <button onClick={addCountItem} className="text-xs bg-blue-500 text-white px-2 rounded">+</button>
                </div>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(detail.items || []).map((i: any) => (
                  <div key={i.id} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{i.product_nombre || i.product_id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-500">Sist: {i.cantidad_sistema} · Fis: {i.cantidad_fisica ?? "—"} · Diff: {i.diferencia != null ? (i.diferencia > 0 ? `+${i.diferencia}` : i.diferencia) : "—"}</p>
                      </div>
                      {i.estado !== "contado" && <button onClick={() => record(i.id, i.product_id)} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Contar</button>}
                      {i.estado === "contado" && <span className={`text-xs font-medium ${i.diferencia !== 0 ? "text-red-500" : "text-green-500"}`}>{i.diferencia !== 0 ? "Discrepancia" : "✓ OK"}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Lots / FIFO ──────────────────────────────────────────────── */
function LotsTab() {
  const [lots, setLots] = useState<any[]>([])
  const [filter, setFilter] = useState({ product_id: "", expiring_days: "0" })
  const [allocate, setAllocate] = useState({ product_id: "", warehouse_id: "", cantidad: "" })
  const [allocResult, setAllocResult] = useState<any>(null)

  const load = () => {
    apiGet(`/lots?product_id=${filter.product_id}&expiring_soon_days=${filter.expiring_days}&warehouse_id=`).then(setLots).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const handleAllocate = async () => {
    try {
      const r = await apiPost("/lots/allocate", { product_id: allocate.product_id, warehouse_id: allocate.warehouse_id, cantidad: parseFloat(allocate.cantidad) })
      setAllocResult(r); load()
    } catch (e: any) { alert(e.message || "Error") }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-sm mb-3">Asignación FIFO</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div><label className="text-xs text-gray-500">Producto</label><input value={allocate.product_id} onChange={(e) => setAllocate({ ...allocate, product_id: e.target.value })} className="input-field mt-1" /></div>
          <div><label className="text-xs text-gray-500">Almacén</label><input value={allocate.warehouse_id} onChange={(e) => setAllocate({ ...allocate, warehouse_id: e.target.value })} className="input-field mt-1" /></div>
          <div><label className="text-xs text-gray-500">Cantidad</label><input type="number" value={allocate.cantidad} onChange={(e) => setAllocate({ ...allocate, cantidad: e.target.value })} className="input-field mt-1" /></div>
          <button onClick={handleAllocate} className="btn-primary">Asignar FIFO</button>
        </div>
        {allocResult && (
          <div className="mt-3 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-sm">
            <p className="font-medium text-green-700">Asignado: {allocResult.total_allocated} unidades</p>
            {allocResult.allocations?.map((a: any, i: number) => (
              <p key={i} className="text-xs text-green-600">Lote {a.lot_id?.slice(0, 8)}: {a.cantidad} uds · Vence: {a.fecha_vencimiento ? new Date(a.fecha_vencimiento).toLocaleDateString() : "—"}</p>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex gap-3 items-center mb-4">
          <h3 className="font-semibold text-sm">Lotes</h3>
          <input placeholder="ID Producto" value={filter.product_id} onChange={(e) => setFilter({ ...filter, product_id: e.target.value })} className="input-field flex-1 text-xs" />
          <select value={filter.expiring_days} onChange={(e) => setFilter({ ...filter, expiring_days: e.target.value })} className="input-field text-xs">
            <option value="0">Todos</option><option value="7">Vencen en 7 días</option><option value="15">Vencen en 15 días</option><option value="30">Vencen en 30 días</option>
          </select>
          <button onClick={load} className="btn-primary text-xs px-3 py-1">Filtrar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr><th className="text-left px-4 py-2 text-gray-500 font-medium">Producto</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Ref.</th><th className="text-right px-4 py-2 text-gray-500 font-medium">Disp.</th><th className="text-right px-4 py-2 text-gray-500 font-medium">Total</th><th className="text-right px-4 py-2 text-gray-500 font-medium">Costo</th><th className="text-left px-4 py-2 text-gray-500 font-medium">Vencimiento</th></tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-2 font-mono text-xs">{getProductName(l.product_id)}</td>
                  <td className="px-4 py-2">{l.referencia || "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{l.cantidad_disponible}</td>
                  <td className="px-4 py-2 text-right">{l.cantidad}</td>
                  <td className="px-4 py-2 text-right">{l.costo_unitario ? `Gs. ${l.costo_unitario.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-2">
                    {l.fecha_vencimiento ? (
                      <span className={`${new Date(l.fecha_vencimiento) < new Date() ? "text-red-500 font-bold" : new Date(l.fecha_vencimiento) < new Date(Date.now() + 30*86400000) ? "text-orange-500" : ""}`}>
                        {new Date(l.fecha_vencimiento).toLocaleDateString("es-PY")}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {lots.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin lotes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Consignment ──────────────────────────────────────────────── */
function ConsignmentTab() {
  const [items, setItems] = useState<any[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ warehouse_id: "", product_id: "", supplier_id: "", supplier_nombre: "", cantidad: "", costo_acordado: "", moneda: "PYG", notas: "" })

  useEffect(() => { apiGet("/consignment").then(setItems).catch(() => {}) }, [])

  const loadDetail = async (id: string) => {
    try { setDetail(await apiGet(`/consignment`).then((all) => all.find((i: any) => i.id === id) || null)); setSelected(id) } catch {}
  }

  const create = async () => {
    try {
      await apiPost("/consignment", { ...form, cantidad: parseFloat(form.cantidad), costo_acordado: parseFloat(form.costo_acordado) || null })
      setShowForm(false); setForm({ warehouse_id: "", product_id: "", supplier_id: "", supplier_nombre: "", cantidad: "", costo_acordado: "", moneda: "PYG", notas: "" })
      setItems(await apiGet("/consignment"))
    } catch {}
  }

  const recordMovement = async (consId: string, tipo: string) => {
    const cant = prompt("Cantidad:") || "0"
    try {
      await apiPost(`/consignment/${consId}/movements`, { tipo, cantidad: parseFloat(cant) })
      setItems(await apiGet("/consignment"))
      setDetail(null)
    } catch {}
  }

  const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Mercadería en Consignación</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">{showForm ? "Cancelar" : "+ Nueva"}</button>
      </div>
      {showForm && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="ID Almacén" value={form.warehouse_id} onChange={f("warehouse_id")} className="input-field" />
            <input placeholder="ID Producto" value={form.product_id} onChange={f("product_id")} className="input-field" />
            <input placeholder="ID Proveedor" value={form.supplier_id} onChange={f("supplier_id")} className="input-field" />
            <input placeholder="Nombre Proveedor" value={form.supplier_nombre} onChange={f("supplier_nombre")} className="input-field" />
            <input type="number" placeholder="Cantidad" value={form.cantidad} onChange={f("cantidad")} className="input-field" />
            <input type="number" placeholder="Costo acordado" value={form.costo_acordado} onChange={f("costo_acordado")} className="input-field" />
          </div>
          <textarea placeholder="Notas" value={form.notas} onChange={f("notas")} className="input-field w-full" rows={2} />
          <button onClick={create} className="btn-primary px-6">Crear</button>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr><th className="text-left px-5 py-3 text-gray-500 font-medium">Proveedor</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Producto</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Cant.</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Costo</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Vence</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Acción</th></tr>
          </thead>
          <tbody>
            {items.map((cs) => (
              <tr key={cs.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3">{cs.supplier_nombre || getSupplierName(cs.supplier_id)}</td>
                <td className="px-5 py-3 font-mono text-xs">{getProductName(cs.product_id)}</td>
                <td className="px-5 py-3 text-right font-medium">{cs.cantidad}</td>
                <td className="px-5 py-3 text-right">{cs.costo_acordado ? `Gs. ${cs.costo_acordado.toLocaleString()}` : "—"}</td>
                <td className="px-5 py-3">{cs.fecha_vencimiento ? new Date(cs.fecha_vencimiento).toLocaleDateString("es-PY") : "—"}</td>
                <td className="px-5 py-3 text-right space-x-1">
                  <button onClick={() => recordMovement(cs.id, "venta")} className="text-xs bg-green-500 text-white px-2 py-1 rounded">Vender</button>
                  <button onClick={() => recordMovement(cs.id, "devolucion")} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Devolver</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Sin items en consignación</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Replenish / Alerts ───────────────────────────────────────── */
function ReplenishTab() {
  const [rules, setRules] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ product_id: "", warehouse_id: "", stock_minimo: "", stock_seguridad: "0", cantidad_reorden: "", lead_time_dias: "1", supplier_id: "", auto_generar_oc: false })

  const load = () => {
    apiGet("/replenish-rules").then(setRules).catch(() => {})
    apiGet("/alerts").then(setAlerts).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    try {
      await apiPost("/replenish-rules", { ...form, stock_minimo: parseFloat(form.stock_minimo), stock_seguridad: parseFloat(form.stock_seguridad), cantidad_reorden: parseFloat(form.cantidad_reorden) || null, lead_time_dias: parseInt(form.lead_time_dias), supplier_id: form.supplier_id || null })
      setShowForm(false); setForm({ product_id: "", warehouse_id: "", stock_minimo: "", stock_seguridad: "0", cantidad_reorden: "", lead_time_dias: "1", supplier_id: "", auto_generar_oc: false })
      load()
    } catch {}
  }

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">⚠️ {alerts.length} alerta(s) de stock bajo</h3>
          <div className="space-y-1">
            {alerts.map((a: any, i: number) => (
              <p key={i} className="text-sm text-red-600 dark:text-red-300">Producto {getProductName(a.product_id)}: stock actual {a.current_stock} (mínimo: {a.stock_minimo}) · Sugerido: {a.cantidad_reorden} uds</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Reglas de Reabastecimiento</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">{showForm ? "Cancelar" : "+ Nueva Regla"}</button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="ID Producto" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="input-field" />
            <input placeholder="ID Almacén" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className="input-field" />
            <input type="number" placeholder="Stock mínimo" value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} className="input-field" />
            <input type="number" placeholder="Stock seguridad" value={form.stock_seguridad} onChange={(e) => setForm({ ...form, stock_seguridad: e.target.value })} className="input-field" />
            <input type="number" placeholder="Cant. reorden" value={form.cantidad_reorden} onChange={(e) => setForm({ ...form, cantidad_reorden: e.target.value })} className="input-field" />
            <input type="number" placeholder="Lead time (días)" value={form.lead_time_dias} onChange={(e) => setForm({ ...form, lead_time_dias: e.target.value })} className="input-field" />
            <input placeholder="ID Proveedor (opc)" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input-field" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.auto_generar_oc} onChange={(e) => setForm({ ...form, auto_generar_oc: e.target.checked })} /> Auto generar O/C</label>
          </div>
          <button onClick={create} className="btn-primary px-6">Crear Regla</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr><th className="text-left px-5 py-3 text-gray-500 font-medium">Producto</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Stock Mín.</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Seguridad</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Reorden</th><th className="text-right px-5 py-3 text-gray-500 font-medium">Lead Time</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Auto OC</th><th className="text-left px-5 py-3 text-gray-500 font-medium">Últ. Alerta</th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-mono text-xs">{getProductName(r.product_id)}</td>
                <td className="px-5 py-3 text-right font-medium">{r.stock_minimo}</td>
                <td className="px-5 py-3 text-right">{r.stock_seguridad}</td>
                <td className="px-5 py-3 text-right">{r.cantidad_reorden || "—"}</td>
                <td className="px-5 py-3 text-right">{r.lead_time_dias} días</td>
                <td className="px-5 py-3">{r.auto_generar_oc ? <span className="text-green-600 font-medium">Sí</span> : "No"}</td>
                <td className="px-5 py-3 text-xs">{r.ultima_alerta_at ? new Date(r.ultima_alerta_at).toLocaleDateString("es-PY") : "—"}</td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Sin reglas configuradas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
