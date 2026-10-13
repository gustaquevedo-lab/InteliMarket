import React, { useState, useEffect, useCallback } from "react"
import {
  Warehouse, Plus, CheckCircle2, Clock, Printer, FileText, Search,
  X, Check, AlertCircle, ShoppingCart, UserCheck, ShieldAlert,
  ChevronRight, RefreshCw, Loader2, ArrowRight, DollarSign, Package
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatDateTime } from "../../utils/format"

interface RequisitionItem {
  producto_id: string
  producto_nombre: string
  cantidad: number
  unidad_medida: string
  costo_unitario?: number
  precio_salon?: number
  notas?: string
}

interface Requisition {
  id: string
  company_id: string
  branch_id?: string
  numero_requisicion: string
  area_destino: "panaderia" | "rotiseria" | "carniceria" | "verduleria"
  solicitante_id?: string
  solicitante_nombre: string
  motivo?: string
  orden_produccion_id?: string
  receta_id?: string
  estado: "BORRADOR" | "PENDIENTE_APROBACION" | "APROBADA" | "DESCARGADA_VENTA" | "COMPENSADA" | "ANULADA"
  fecha_solicitud: string
  aprobado_por?: string
  fecha_aprobacion?: string
  sale_id?: string
  numero_factura_pos?: string
  total_costo_estimado?: number
  items?: RequisitionItem[]
  created_at: string
}

const AREAS = [
  { id: "panaderia", label: "🥖 Panadería & Confitería", icon: "🥖", color: "amber" },
  { id: "rotiseria", label: "🍗 Rotisería & Cocina", icon: "🍗", color: "orange" },
  { id: "carniceria", label: "🥩 Carnicería & Desposte", icon: "🥩", color: "rose" },
  { id: "verduleria", label: "🥬 Fraccionamiento Verdulería", icon: "🥬", color: "emerald" },
]

export default function RequisitionsSubTab() {
  const toast = useToast()
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterArea, setFilterArea] = useState("")
  const [filterEstado, setFilterEstado] = useState("")

  // Modal Nueva Requisición
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newArea, setNewArea] = useState<"panaderia" | "rotiseria" | "carniceria" | "verduleria">("panaderia")
  const [newSolicitante, setNewSolicitante] = useState("")
  const [newMotivo, setNewMotivo] = useState("")
  const [newItems, setNewItems] = useState<RequisitionItem[]>([])

  // Buscador de productos para agregar ítem
  const [prodSearch, setProdSearch] = useState("")
  const [prodResults, setProdResults] = useState<any[]>([])
  const [searchingProds, setSearchingProds] = useState(false)
  const [selectedProd, setSelectedProd] = useState<any | null>(null)
  const [itemQty, setItemQty] = useState<number>(1)
  const [itemUnidad, setItemUnidad] = useState("UN")

  // Modal Aprobación
  const [approvingReq, setApprovingReq] = useState<Requisition | null>(null)
  const [approverName, setApproverName] = useState("")
  const [approving, setApproving] = useState(false)

  // Modal Ticket Térmico
  const [ticketModal, setTicketModal] = useState<{ open: boolean; numero: string; text: string }>({
    open: false,
    numero: "",
    text: "",
  })

  // Modal Vincular Venta POS
  const [linkingReq, setLinkingReq] = useState<Requisition | null>(null)
  const [linkFactura, setLinkFactura] = useState("")
  const [linkSaleId, setLinkSaleId] = useState("")
  const [linking, setLinking] = useState(false)

  const loadRequisitions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.supermer.requisitions.list({
        area_destino: filterArea || undefined,
        estado: filterEstado || undefined,
        limit: 100,
      })
      if (Array.isArray(res)) {
        setRequisitions(res)
      }
    } catch (e: any) {
      toast.error("Error al cargar requisiciones", e.message || "No se pudieron obtener los vales")
    } finally {
      setLoading(false)
    }
  }, [filterArea, filterEstado, toast])

  useEffect(() => {
    loadRequisitions()
  }, [loadRequisitions])

  // Búsqueda asistida de productos del salón
  useEffect(() => {
    if (!prodSearch || prodSearch.trim().length < 2) {
      setProdResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingProds(true)
      try {
        const res = await api.products.list({ search: prodSearch.trim(), limit: 12 })
        setProdResults(Array.isArray(res) ? res : [])
      } catch {
        setProdResults([])
      } finally {
        setSearchingProds(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [prodSearch])

  const handleAddItem = () => {
    if (!selectedProd) return
    const exists = newItems.find(it => it.producto_id === selectedProd.id)
    if (exists) {
      setNewItems(prev => prev.map(it => it.producto_id === selectedProd.id ? { ...it, cantidad: it.cantidad + itemQty } : it))
    } else {
      newItems.push({
        producto_id: selectedProd.id,
        producto_nombre: selectedProd.nombre || selectedProd.descripcion || "Producto",
        cantidad: itemQty,
        unidad_medida: itemUnidad || selectedProd.unidad_medida || "UN",
        costo_unitario: Number(selectedProd.costo || selectedProd.precio_costo || 0),
        precio_salon: Number(selectedProd.precio_venta || selectedProd.precio || 0),
      })
      setNewItems([...newItems])
    }
    setSelectedProd(null)
    setProdSearch("")
    setItemQty(1)
  }

  const handleRemoveItem = (idx: number) => {
    setNewItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newItems.length === 0) {
      toast.error("Atención", "Debe agregar al menos un producto a la requisición")
      return
    }
    if (!newSolicitante.trim()) {
      toast.error("Atención", "Especifique el nombre del personal solicitante (ej: Juan Panadero)")
      return
    }

    setCreating(true)
    try {
      const payload = {
        area_destino: newArea,
        solicitante_nombre: newSolicitante.trim(),
        motivo: newMotivo.trim() || undefined,
        items: newItems.map(it => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          unidad_medida: it.unidad_medida,
          costo_unitario: it.costo_unitario || 0,
          precio_salon: it.precio_salon || 0,
        })),
      }
      await api.supermer.requisitions.create(payload)
      toast.success("Requisición creada", "Registrada con estado PENDIENTE DE APROBACIÓN")
      setShowCreateModal(false)
      setNewItems([])
      setNewSolicitante("")
      setNewMotivo("")
      loadRequisitions()
    } catch (err: any) {
      toast.error("Error al registrar", err.message || "No se pudo guardar la requisición")
    } finally {
      setCreating(false)
    }
  }

  const handleApproveRequisition = async () => {
    if (!approvingReq) return
    if (!approverName.trim()) {
      toast.error("Requerido", "Ingrese el nombre del Encargado de Salón que autoriza la salida")
      return
    }

    setApproving(true)
    try {
      const res = await api.supermer.requisitions.approve(approvingReq.id, approverName.trim())
      toast.success("Requisición aprobada", `Vale ${res.requisition?.numero_requisicion || approvingReq.numero_requisicion} listo para imprimir`)
      setApprovingReq(null)
      setApproverName("")
      loadRequisitions()

      if (res.ticket_text) {
        setTicketModal({
          open: true,
          numero: res.requisition?.numero_requisicion || approvingReq.numero_requisicion,
          text: res.ticket_text,
        })
      }
    } catch (err: any) {
      toast.error("Error al aprobar", err.message || "No se pudo autorizar el vale")
    } finally {
      setApproving(false)
    }
  }

  const handleViewTicket = async (req: Requisition) => {
    try {
      const res = await api.supermer.requisitions.getTicket(req.id)
      setTicketModal({
        open: true,
        numero: res.numero_requisicion,
        text: res.ticket_text,
      })
    } catch (e: any) {
      toast.error("Error al cargar ticket", e.message)
    }
  }

  const handleLinkSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkingReq) return
    if (!linkFactura.trim()) {
      toast.error("Requerido", "Ingrese el número de factura emitida en caja POS")
      return
    }

    setLinking(true)
    try {
      await api.supermer.requisitions.linkSale(linkingReq.id, {
        sale_id: linkSaleId.trim() || linkingReq.id,
        numero_factura: linkFactura.trim(),
      })
      toast.success("Factura vinculada", `Vale ${linkingReq.numero_requisicion} marcado como DESCARGADO POR VENTA`)
      setLinkingReq(null)
      setLinkFactura("")
      setLinkSaleId("")
      loadRequisitions()
    } catch (err: any) {
      toast.error("Error al vincular", err.message)
    } finally {
      setLinking(false)
    }
  }

  // Filtrado reactivo en memoria
  const filtered = requisitions.filter(r => {
    if (search.trim()) {
      const s = search.toLowerCase()
      const matchNum = r.numero_requisicion?.toLowerCase().includes(s)
      const matchSol = r.solicitante_nombre?.toLowerCase().includes(s)
      const matchMot = r.motivo?.toLowerCase().includes(s)
      const matchFac = r.numero_factura_pos?.toLowerCase().includes(s)
      const matchItem = r.items?.some(it => it.producto_nombre?.toLowerCase().includes(s))
      if (!matchNum && !matchSol && !matchMot && !matchFac && !matchItem) return false
    }
    return true
  })

  // KPIs
  const totalReqs = requisitions.length
  const pendientes = requisitions.filter(r => r.estado === "PENDIENTE_APROBACION").length
  const aprobadas = requisitions.filter(r => r.estado === "APROBADA" || r.estado === "DESCARGADA_VENTA").length
  const compensadas = requisitions.filter(r => r.estado === "COMPENSADA").length
  const totalCostoCompensado = requisitions
    .filter(r => r.estado === "COMPENSADA")
    .reduce((acc, r) => acc + (Number(r.total_costo_estimado) || 0), 0)

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* 🌟 LUXURY COMMAND DECK MINI HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 border border-indigo-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                <Warehouse className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Circuito de Consumo Interno a Producción
              </span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Requisiciones de Salón & Vales de Producción
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Retiro de materias primas e insumos de góndola para Panadería, Rotisería o Carnicería.
              Garantiza descarga precisa de stock y reasigna el costo a CMV Materia Prima.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewItems([])
              setNewSolicitante("")
              setNewMotivo("")
              setShowCreateModal(true)
            }}
            className="self-start md:self-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-extrabold transition shadow-lg shadow-amber-500/25 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Requisición de Salón
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-indigo-900/60 text-xs">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Solicitadas</span>
            <span className="text-xl font-black font-mono text-white">{totalReqs}</span>
          </div>
          <div className="bg-amber-500/10 rounded-2xl p-3 border border-amber-500/20">
            <span className="text-[10px] text-amber-300 font-bold uppercase block">Pendientes Salón</span>
            <span className="text-xl font-black font-mono text-amber-400">{pendientes}</span>
          </div>
          <div className="bg-indigo-500/10 rounded-2xl p-3 border border-indigo-500/20">
            <span className="text-[10px] text-indigo-300 font-bold uppercase block">Aprobadas / En Proceso</span>
            <span className="text-xl font-black font-mono text-indigo-300">{aprobadas}</span>
          </div>
          <div className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-300 font-bold uppercase block">Compensadas en P&L</span>
            <span className="text-xl font-black font-mono text-emerald-400">{compensadas}</span>
            <span className="text-[10px] text-emerald-300/80 font-mono block mt-0.5">{formatPYG(totalCostoCompensado)}</span>
          </div>
        </div>
      </div>

      {/* 🧭 FILTROS & BUSCADOR */}
      <div className="card p-4 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input-field pl-9 text-xs w-full"
              placeholder="Buscar por n° de vale, solicitante, producto o factura..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div>
            <select
              className="input-field text-xs w-full"
              value={filterArea}
              onChange={e => setFilterArea(e.target.value)}
            >
              <option value="">Todas las Áreas</option>
              <option value="panaderia">🥖 Panadería</option>
              <option value="rotiseria">🍗 Rotisería</option>
              <option value="carniceria">🥩 Carnicería</option>
              <option value="verduleria">🥬 Verdulería</option>
            </select>
          </div>

          <div>
            <select
              className="input-field text-xs w-full"
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
            >
              <option value="">Todos los Estados</option>
              <option value="PENDIENTE_APROBACION">⏳ Pendiente Aprobación</option>
              <option value="APROBADA">✅ Aprobada</option>
              <option value="DESCARGADA_VENTA">🧾 Descargada Venta (POS)</option>
              <option value="COMPENSADA">⚖️ Compensada en P&L</option>
              <option value="ANULADA">❌ Anulada</option>
            </select>
          </div>
        </div>
      </div>

      {/* 📋 TABLA DE REQUISICIONES */}
      <div className="card p-0 overflow-hidden bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/90 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                <th className="p-3.5">N° Requisición</th>
                <th className="p-3.5">Fecha</th>
                <th className="p-3.5">Área Destino</th>
                <th className="p-3.5">Solicitante & Motivo</th>
                <th className="p-3.5">Ítems Solicitados</th>
                <th className="p-3.5 font-right text-right">Costo Estimado</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5">Control Salón / POS</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Cargando vales y requisiciones de producción...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    No se encontraron requisiciones registradas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map(req => {
                  const areaInfo = AREAS.find(a => a.id === req.area_destino) || AREAS[0]
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {req.numero_requisicion}
                      </td>
                      <td className="p-3.5 text-gray-500 whitespace-nowrap font-mono">
                        {formatDateTime(req.fecha_solicitud || req.created_at)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {areaInfo.label}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <p className="font-bold text-gray-900 dark:text-white">{req.solicitante_nombre}</p>
                        {req.motivo && <p className="text-[11px] text-gray-500 truncate">{req.motivo}</p>}
                      </td>
                      <td className="p-3.5 max-w-sm">
                        <div className="flex flex-wrap gap-1">
                          {(req.items || []).map((it, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-[10px] font-medium border border-slate-200 dark:border-slate-600"
                            >
                              {it.cantidad} {it.unidad_medida} • {it.producto_nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-right text-gray-900 dark:text-white whitespace-nowrap">
                        {formatPYG(req.total_costo_estimado || 0)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          req.estado === "COMPENSADA"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                            : req.estado === "DESCARGADA_VENTA"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200"
                            : req.estado === "APROBADA"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200"
                            : req.estado === "PENDIENTE_APROBACION"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 animate-pulse"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}>
                          {req.estado === "PENDIENTE_APROBACION" && <Clock className="w-3 h-3" />}
                          {req.estado === "APROBADA" && <Check className="w-3 h-3" />}
                          {req.estado === "COMPENSADA" && <CheckCircle2 className="w-3 h-3" />}
                          {req.estado}
                        </span>
                      </td>
                      <td className="p-3.5 text-[11px] text-gray-500 max-w-xs">
                        {req.aprobado_por ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-emerald-500" /> {req.aprobado_por}
                            </span>
                            {req.numero_factura_pos && (
                              <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 block">
                                Fac: {req.numero_factura_pos}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 italic">Sin autorizar</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Imprimir Ticket Térmico */}
                          <button
                            type="button"
                            onClick={() => handleViewTicket(req)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition"
                            title="Ver e imprimir ticket térmico 80mm"
                          >
                            <Printer className="w-3.5 h-3.5 text-indigo-500" />
                          </button>

                          {/* Botón Aprobar Encargado */}
                          {req.estado === "PENDIENTE_APROBACION" && (
                            <button
                              type="button"
                              onClick={() => {
                                setApprovingReq(req)
                                setApproverName("")
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition flex items-center gap-1 shadow-sm"
                            >
                              <Check className="w-3 h-3" />
                              Aprobar
                            </button>
                          )}

                          {/* Botón Vincular Factura POS */}
                          {(req.estado === "APROBADA" && !req.numero_factura_pos) && (
                            <button
                              type="button"
                              onClick={() => {
                                setLinkingReq(req)
                                setLinkFactura("")
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] transition flex items-center gap-1 shadow-sm"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              Vincular Factura
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🌟 MODAL NUEVA REQUISICIÓN */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Warehouse className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    Nueva Requisición de Salón (Consumo a Producción)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Registra los productos retirados de góndola para ser transformados en cocina o panadería
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="space-y-4 text-xs">
              {/* Sector Destino */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Sector de Producción Solicitante:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AREAS.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setNewArea(a.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        newArea === a.id
                          ? "bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-950/60 dark:border-amber-600 dark:text-amber-100 font-bold shadow-sm"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-slate-50"
                      }`}
                    >
                      <div className="text-xs">{a.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Solicitante y Motivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del Solicitante (Cocinero / Panadero): *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Marcelo Gómez (Panadería)"
                    className="input-field text-xs w-full"
                    value={newSolicitante}
                    onChange={e => setNewSolicitante(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Motivo / Orden de Producción:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Retiro para salsa blanca y relleno de empanadas"
                    className="input-field text-xs w-full"
                    value={newMotivo}
                    onChange={e => setNewMotivo(e.target.value)}
                  />
                </div>
              </div>

              {/* Agregar Ítems */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <span className="font-bold text-gray-900 dark:text-white text-xs block">
                  Buscar y Agregar Productos del Salón:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-6 relative">
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código de barra (ej: Leche Trébol)..."
                      className="input-field text-xs w-full"
                      value={prodSearch}
                      onChange={e => setProdSearch(e.target.value)}
                    />
                    {searchingProds && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}

                    {/* Desplegable de resultados */}
                    {prodResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                        {prodResults.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProd(p)
                              setProdSearch(p.nombre)
                              setProdResults([])
                            }}
                            className="w-full text-left p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-700/50 flex items-center justify-between transition"
                          >
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white text-xs">{p.nombre}</div>
                              <div className="text-[10px] text-gray-400 font-mono">
                                Barcode: {p.codigo_barra || p.codigo || "—"} • Costo: {formatPYG(p.costo || p.precio_costo || 0)}
                              </div>
                            </div>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Seleccionar</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      className="input-field text-xs w-full font-mono text-center"
                      value={itemQty}
                      onChange={e => setItemQty(Number(e.target.value))}
                      placeholder="Cant."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <select
                      className="input-field text-xs w-full"
                      value={itemUnidad}
                      onChange={e => setItemUnidad(e.target.value)}
                    >
                      <option value="UN">UN</option>
                      <option value="KG">KG</option>
                      <option value="L">L</option>
                      <option value="PAQ">PAQ</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProd}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-bold transition flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                </div>

                {/* Lista de ítems añadidos */}
                {newItems.length > 0 && (
                  <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-700 border-t border-slate-200 dark:border-slate-700/60 pt-2">
                    {newItems.map((it, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {it.cantidad} {it.unidad_medida}
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{it.producto_nombre}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-gray-500">
                            Estimado: {formatPYG((it.costo_unitario || 0) * it.cantidad)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || newItems.length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold transition flex items-center gap-2 shadow-md shadow-amber-600/25"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Emitir Requisición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 MODAL APROBACIÓN POR ENCARGADO DE SALÓN */}
      {approvingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  Autorización Encargado de Salón
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Requisición: {approvingReq.numero_requisicion}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400">
              Al autorizar, el sistema genera el <strong>Vale Térmico Oficial</strong> con código de barras para ser presentado en la caja del salón y descontar el inventario.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                Nombre del Encargado de Salón que Autoriza: *
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Ej: Laura Benítez (Jefa de Salón)"
                className="input-field text-xs w-full"
                value={approverName}
                onChange={e => setApproverName(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setApprovingReq(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApproveRequisition}
                disabled={approving || !approverName.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-emerald-600/25"
              >
                {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                Autorizar & Imprimir Vale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL TICKET TÉRMICO 80MM */}
      {ticketModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-white font-mono">
                  Vale Térmico 80mm: {ticketModal.numero}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTicketModal({ open: false, numero: "", text: "" })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulación papel térmico */}
            <div className="p-4 bg-amber-50/50 dark:bg-slate-950 rounded-2xl border border-amber-200 dark:border-slate-800 max-h-96 overflow-y-auto">
              <pre className="text-[11px] font-mono leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {ticketModal.text}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-gray-500">
                Imprime este vale y anexalo a la factura de caja
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const printWin = window.open("", "_blank")
                    if (printWin) {
                      printWin.document.write(`<pre style="font-family: monospace; font-size: 12px; margin: 20px;">${ticketModal.text}</pre>`)
                      printWin.document.close()
                      printWin.focus()
                      printWin.print()
                      printWin.close()
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir en Térmica
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL VINCULAR FACTURA POS */}
      {linkingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <ShoppingCart className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  Vincular Factura Emitida en Caja
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  Requisición: {linkingReq.numero_requisicion}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400">
              Registra el número de comprobante con el cual la cajera facturó estos productos a nombre de Extra Supermercado para compensar en Cuentas por Cobrar.
            </p>

            <form onSubmit={handleLinkSale} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Número de Factura POS (ej: 001-001-0004520): *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="001-001-0004520"
                  className="input-field text-xs w-full font-mono"
                  value={linkFactura}
                  onChange={e => setLinkFactura(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setLinkingReq(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={linking || !linkFactura.trim()}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-purple-600/25"
                >
                  {linking && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar Vinculación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
