import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search, ShoppingCart, Package, DollarSign, TrendingDown, Users, CheckCircle, Loader2,
  Plus, Eye, X, Trash2, Minus, FileText, Truck, Award, BarChart3, Download, Clock,
  AlertTriangle, Filter, ChevronDown, ChevronUp, Edit3, Send, Ban, RefreshCw,
  UserPlus, FileSpreadsheet, ClipboardList, TrendingUp, ArrowUp, ArrowDown, ArrowRight,
  MessageSquare, Calendar, Hash, Percent, Printer, Link2, Check, Save, ExternalLink,
} from "lucide-react"
import { api, type PurchaseOrder, type PurchaseReceipt, type PurchaseReceiptItem, type Supplier, type Product, type PurchaseRequisition, type PurchaseRfq, type PurchaseRfqWithDetail, type PurchaseBudget, type PurchaseBudgetConsumption } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"
import { KPICard } from "../../components/KPICard"
import { Widget } from "../../components/Widget"
import { Modal } from "../../components/Modal"
import { formatPYG, formatDate, formatCurrency } from "../../utils/format"

﻿type MainTab = "dashboard" | "ordenes" | "recepciones" | "proveedores" | "solicitudes" | "cotizaciones" | "sugerencias" | "presupuesto" | "reportes"
type SubTab = "lista" | "contratos"
type ReportSubTab = "proveedor" | "categoria" | "varianza"
type SupplierStatus = "todos" | "activos" | "inactivos"

interface OrderItem {
  product_id: string
  nombre: string
  sku: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  iva_tasa: number
  subtotal: number
}

interface ReceiptItem {
  product_id: string
  nombre: string
  sku: string
  cantidad_ordenada: number
  cantidad_recibir: number
  costo_unitario: number
  lote: string
  fecha_vencimiento: string
  cantidad_rechazada: number
  motivo_rechazo: string
  precio_po?: number
}

interface Suggestion {
  id: string
  product_id: string
  product_name: string
  sku: string
  stock_actual: number
  stock_seguridad: number
  demanda_diaria: number
  dias_cobertura: number
  cantidad_sugerida: number
  precio_estimado: number
  total_estimado: number
  supplier_id: string
  proveedor_sugerido: string
  urgencia: "alta" | "media" | "baja"
  confianza: number
  estado: "pendiente" | "aplicada" | "descartada"
}

const poStatusMap: Record<string, string> = {
  borrador: "badge-accent", confirmado: "badge-info", enviado: "badge-warning",
  parcial: "badge-warning", completado: "badge-success", cancelado: "badge-danger",
}

const priorityMap: Record<string, string> = {
  normal: "badge-info", alta: "badge-warning", urgente: "badge-danger",
}

const urgencyMap: Record<string, string> = {
  alta: "badge-danger", media: "badge-warning", baja: "badge-success",
}


const mockProducts: Product[] = Array.from({ length: 50 }, (_, i) => ({
  id: "p" + (i + 1),
  company_id: "",
  category_id: null,
  sku: "SKU-" + String(i + 1).padStart(4, "0"),
  codigo_barra: "78456789" + String(i + 1).padStart(5, "0"),
  nombre: "Producto " + (i + 1) + (i % 3 === 0 ? " (Importado)" : i % 3 === 1 ? " Nacional" : " Premium"),
  descripcion: null,
  tipo: "producto",
  unidad_medida: "UNIDAD",
  iva_tasa: i % 5 === 0 ? 5 : i % 10 === 0 ? 0 : 10,
  metodo_costeo: "promedio",
  stock_minimo: 10,
  stock_maximo: 500,
  activo: true,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  precio: [5000, 12000, 8500, 22000, 3500, 15000, 28000, 9500, 18000, 4200, 6500, 31000, 7800, 14500, 9200][i % 15],
  categoria: { id: "c" + ((i % 8) + 1), nombre: ["Lacteos", "Bebidas", "Almacen", "Limpieza", "Carnes", "Frutas", "Congelados", "Panificados"][i % 8] },
  stock: Math.floor(Math.random() * 200),
}))

const mockCategories = [
  { id: "c1", nombre: "Lacteos" }, { id: "c2", nombre: "Bebidas" }, { id: "c3", nombre: "Almacen" },
  { id: "c4", nombre: "Limpieza" }, { id: "c5", nombre: "Carnes" }, { id: "c6", nombre: "Frutas" },
  { id: "c7", nombre: "Congelados" }, { id: "c8", nombre: "Panificados" },
]

const mockWarehouses = [
  { id: "w1", nombre: "Deposito Central" },
  { id: "w2", nombre: "Deposito Sucursal 1" },
]




﻿function BarChart({ data, maxKey, labelKey, colorKey }: {
  data: any[]
  maxKey: string
  labelKey: string
  colorKey?: string
}) {
  const maxVal = Math.max(...data.map(d => d[maxKey]), 1)
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24 truncate text-right">{d[labelKey]}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
            <div
              className={"h-full rounded-full transition-all " + (d[colorKey || "color"] || "bg-primary")}
              style={{ width: (d[maxKey] / maxVal) * 100 + "%" }}
            />
          </div>
          <span className="text-xs font-mono font-bold w-20 text-left">{d[maxKey].toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data, labelKey, valueKey, colors }: {
  data: any[]
  labelKey: string
  valueKey: string
  colors: string[]
}) {
  const total = data.reduce((a, b) => a + b[valueKey], 0) || 1
  let cumPct = 0
  const slices = data.map((d, i) => {
    const pct = (d[valueKey] / total) * 100
    const startAngle = cumPct
    cumPct += pct
    const endAngle = cumPct
    const startRad = (startAngle - 90) * Math.PI / 180
    const endRad = (endAngle - 90) * Math.PI / 180
    const r = 15.9155
    const x1 = 18 + r * Math.cos(startRad)
    const y1 = 18 + r * Math.sin(startRad)
    const x2 = 18 + r * Math.cos(endRad)
    const y2 = 18 + r * Math.sin(endRad)
    const large = pct > 50 ? 1 : 0
    const path = "M 18 18 L " + x1 + " " + y1 + " A " + r + " " + r + " 0 " + large + " 1 " + x2 + " " + y2 + " Z"
    return { path, fill: colors[i % colors.length] }
  })
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {slices.map((s, i) => <path key={i} d={s.path} fill={s.fill} />)}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-gray-900 dark:text-white">{total.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-gray-600 dark:text-gray-400">{d[labelKey]}</span>
            <span className="font-bold text-gray-900 dark:text-white">{((d[valueKey] / total) * 100).toFixed(0) + "%"}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PurchasesPage() {
  const navigate = useNavigate()
  const [mainTab, setMainTab] = useState<MainTab>("dashboard")
  const [loading, setLoading] = useState(true)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const toast = useToast()
  const confirm = useConfirm()

  const [showPOModal, setShowPOModal] = useState(false)
  const [showDetailPO, setShowDetailPO] = useState<PurchaseOrder | null>(null)
  const [showDetailReceipt, setShowDetailReceipt] = useState<PurchaseReceipt | null>(null)
  const [receiptDetailItems, setReceiptDetailItems] = useState<PurchaseReceiptItem[]>([])
  const [receiptDetailLoading, setReceiptDetailLoading] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const [poSearch, setPoSearch] = useState("")
  const [poStatusFilter, setPoStatusFilter] = useState("")
  const [poSupplierFilter, setPoSupplierFilter] = useState("")
  const [poDateFrom, setPoDateFrom] = useState("")
  const [poDateTo, setPoDateTo] = useState("")

  const [poFormSupplier, setPoFormSupplier] = useState("")
  const [poFormTipo, setPoFormTipo] = useState<"local" | "importacion">("local")
  const [poFormPrioridad, setPoFormPrioridad] = useState<"normal" | "alta" | "urgente">("normal")
  const [poFormMoneda, setPoFormMoneda] = useState<"PYG" | "USD">("PYG")
  const [poFormTipoCambio, setPoFormTipoCambio] = useState(1)
  const [poFormCondiciones, setPoFormCondiciones] = useState("")
  const [poFormValidez, setPoFormValidez] = useState(30)
  const [poFormFecEntrega, setPoFormFecEntrega] = useState("")
  const [poFormShipping, setPoFormShipping] = useState(0)
  const [poFormInsurance, setPoFormInsurance] = useState(0)
  const [poFormCustoms, setPoFormCustoms] = useState(0)
  const [poFormOther, setPoFormOther] = useState(0)
  const [poFormObs, setPoFormObs] = useState("")
  const [poFormItems, setPoFormItems] = useState<OrderItem[]>([])
  const [poProductSearch, setPoProductSearch] = useState("")
  const [poCreating, setPoCreating] = useState(false)

  const [receiptPO, setReceiptPO] = useState("")
  const [receiptDirect, setReceiptDirect] = useState(false)
  const [receiptSupplier, setReceiptSupplier] = useState("")
  const [receiptWarehouse, setReceiptWarehouse] = useState("")
  const [receiptRef, setReceiptRef] = useState("")
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [receiptObs, setReceiptObs] = useState("")
  const [receiptCreating, setReceiptCreating] = useState(false)

  const [supRazonSocial, setSupRazonSocial] = useState("")
  const [supRuc, setSupRuc] = useState("")
  const [supDireccion, setSupDireccion] = useState("")
  const [supTelefono, setSupTelefono] = useState("")
  const [supEmail, setSupEmail] = useState("")
  const [supContacto, setSupContacto] = useState("")
  const [supTipo, setSupTipo] = useState<"nacional" | "import">("nacional")
  const [supPlazoPago, setSupPlazoPago] = useState(30)
  const [supNotas, setSupNotas] = useState("")

  const [proveedorTab, setProveedorTab] = useState<SubTab>("lista")
  const [reportTab, setReportTab] = useState<ReportSubTab>("proveedor")
  const [supplierSearch, setSupplierSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState<SupplierStatus>("todos")

  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([])
  const [reqStatusFilter, setReqStatusFilter] = useState("")
  const [showReqModal, setShowReqModal] = useState(false)
  const [reqDepartamento, setReqDepartamento] = useState("")
  const [reqSolicitante, setReqSolicitante] = useState("")
  const [reqPrioridad, setReqPrioridad] = useState<"normal" | "alta" | "urgente">("normal")
  const [reqMotivo, setReqMotivo] = useState("")
  const [reqItems, setReqItems] = useState<{ product_id: string; nombre: string; cantidad_solicitada: number; precio_estimado: number }[]>([])
  const [reqProductSearch, setReqProductSearch] = useState("")
  const [reqCreating, setReqCreating] = useState(false)
  const [showConvertReq, setShowConvertReq] = useState<PurchaseRequisition | null>(null)
  const [convertSupplier, setConvertSupplier] = useState("")
  const [showReqDetail, setShowReqDetail] = useState<PurchaseRequisition | null>(null)
  const [reqDetailLoading, setReqDetailLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [pos, recs, sups, prods, wares, reqs] = await Promise.allSettled([
        api.purchases.listPOs(),
        api.purchases.listReceipts(),
        api.purchases.listSuppliers(),
        api.products.list(),
        api.warehouses.list(),
        api.purchases.requisitions.list(),
      ])
      if (pos.status === "fulfilled") setPurchaseOrders(pos.value)
      if (recs.status === "fulfilled") setReceipts(recs.value)
      if (sups.status === "fulfilled") setSuppliers(sups.value)
      if (prods.status === "fulfilled") setProducts(prods.value)
      if (wares.status === "fulfilled") setWarehouses(wares.value)
      if (reqs.status === "fulfilled") setRequisitions(reqs.value)
    } catch {
      /* sin datos reales disponibles — se muestran vacios, no mock */
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const activePOs = useMemo(() => purchaseOrders.filter(p => p.estado !== "cancelado"), [purchaseOrders])
  const totalPOValue = useMemo(() => activePOs.reduce((a, b) => a + Number(b.total || 0), 0), [activePOs])
  const activeSuppliers = useMemo(() => suppliers.filter(s => s.activo), [suppliers])

  const resetReqForm = () => {
    setReqDepartamento(""); setReqSolicitante(""); setReqPrioridad("normal")
    setReqMotivo(""); setReqItems([]); setReqProductSearch("")
  }

  const addReqItem = (p: Product) => {
    if (reqItems.some(i => i.product_id === p.id)) return
    setReqItems(prev => [...prev, { product_id: p.id, nombre: p.nombre, cantidad_solicitada: 1, precio_estimado: Number(p.precio_venta || p.costo_promedio || 0) }])
    setReqProductSearch("")
  }

  const handleCreateRequisition = async () => {
    if (reqItems.length === 0) { toast.error("Error", "Agrega al menos un producto"); return }
    if (reqItems.some(i => i.cantidad_solicitada <= 0)) { toast.error("Error", "Cantidad requerida en cada item"); return }
    setReqCreating(true)
    try {
      await api.purchases.requisitions.create({
        departamento: reqDepartamento || undefined,
        solicitante_nombre: reqSolicitante || undefined,
        prioridad: reqPrioridad,
        motivo: reqMotivo || undefined,
        items: reqItems.map(i => ({ product_id: i.product_id, cantidad_solicitada: i.cantidad_solicitada, precio_estimado: i.precio_estimado || undefined })),
      })
      toast.success("Solicitud creada")
      setShowReqModal(false)
      resetReqForm()
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo crear la solicitud")
    } finally {
      setReqCreating(false)
    }
  }

  const handleApproveReq = async (id: string) => {
    try { await api.purchases.requisitions.approve(id); toast.success("Solicitud aprobada"); fetchAll() }
    catch (e: any) { toast.error("Error", e?.message || "No se pudo aprobar") }
  }

  const handleRejectReq = async (id: string) => {
    const motivo = window.prompt("Motivo del rechazo:")
    if (!motivo) return
    try { await api.purchases.requisitions.reject(id, motivo); toast.success("Solicitud rechazada"); fetchAll() }
    catch (e: any) { toast.error("Error", e?.message || "No se pudo rechazar") }
  }

  const handleConvertReq = async () => {
    if (!showConvertReq || !convertSupplier) { toast.error("Error", "Selecciona un proveedor"); return }
    try {
      await api.purchases.requisitions.convertToPO(showConvertReq.id, convertSupplier)
      toast.success("Orden de compra generada")
      setShowConvertReq(null); setConvertSupplier("")
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo convertir a orden de compra")
    }
  }

  const openReqDetail = async (req: PurchaseRequisition) => {
    setShowReqDetail(req)
    setReqDetailLoading(true)
    try { setShowReqDetail(await api.purchases.requisitions.get(req.id)) }
    catch { toast.error("Error", "No se pudo cargar el detalle") }
    finally { setReqDetailLoading(false) }
  }

  const poByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    purchaseOrders.forEach(p => { const es = p.estado ?? ""; counts[es] = (counts[es] || 0) + 1 })
    return Object.entries(counts).map(([estado, count]) => ({
      estado, count,
      color: estado === "borrador" ? "bg-gray-400" : estado === "confirmado" ? "bg-blue-500" : estado === "enviado" ? "bg-indigo-500" : estado === "parcial" ? "bg-amber-500" : estado === "completado" ? "bg-green-500" : "bg-red-500",
    }))
  }, [purchaseOrders])

  const topSuppliers = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    purchaseOrders.filter(p => p.estado !== "cancelado").forEach(p => {
      const name = p.supplier?.razon_social || "-"
      if (!map[name]) map[name] = { name, total: 0, count: 0 }
      map[name].total += p.total || 0; map[name].count++
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [purchaseOrders])

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter(p => {
      if (poStatusFilter && p.estado !== poStatusFilter) return false
      if (poSupplierFilter && p.supplier_id !== poSupplierFilter) return false
      if (poDateFrom && new Date(p.fecha ?? "") < new Date(poDateFrom)) return false
      if (poDateTo && new Date(p.fecha ?? "") > new Date(poDateTo)) return false
      if (poSearch) { const s = poSearch.toLowerCase(); if (!(p.numero ?? "").toLowerCase().includes(s) && !(p.supplier?.razon_social || "").toLowerCase().includes(s)) return false }
      return true
    })
  }, [purchaseOrders, poStatusFilter, poSupplierFilter, poDateFrom, poDateTo, poSearch])

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      if (supplierFilter === "activos" && !s.activo) return false
      if (supplierFilter === "inactivos" && s.activo) return false
      if (supplierSearch) { const q = supplierSearch.toLowerCase(); if (!(s.razon_social ?? "").toLowerCase().includes(q) && !(s.ruc || "").toLowerCase().includes(q)) return false }
      return true
    })
  }, [suppliers, supplierSearch, supplierFilter])

  const filteredProducts = useMemo(() => {
    if (!poProductSearch) return []
    return products.filter(p => p.nombre.toLowerCase().includes(poProductSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(poProductSearch.toLowerCase())))
  }, [products, poProductSearch])

  const poFormSubtotal = useMemo(() => poFormItems.reduce((a, b) => a + b.cantidad * b.precio_unitario, 0), [poFormItems])
  const poFormDescTotal = useMemo(() => poFormItems.reduce((a, b) => a + (b.cantidad * b.precio_unitario * b.descuento_pct) / 100, 0), [poFormItems])
  const poFormBase10 = useMemo(() => poFormItems.filter(i => i.iva_tasa === 10).reduce((a, b) => a + (b.cantidad * b.precio_unitario * (1 - b.descuento_pct / 100)), 0), [poFormItems])
  const poFormBase5 = useMemo(() => poFormItems.filter(i => i.iva_tasa === 5).reduce((a, b) => a + (b.cantidad * b.precio_unitario * (1 - b.descuento_pct / 100)), 0), [poFormItems])
  const poFormIva10 = poFormBase10 * 0.10
  const poFormIva5 = poFormBase5 * 0.05
  const poFormLanded = poFormShipping + poFormInsurance + poFormCustoms + poFormOther
  const poFormTotal = poFormSubtotal - poFormDescTotal + poFormIva10 + poFormIva5 + poFormLanded
  const pendingReceiptPOs = useMemo(() => purchaseOrders.filter(p => p.estado === "enviado" || p.estado === "parcial"), [purchaseOrders])

  const handleCreatePO = async () => {
    if (!poFormSupplier) { toast.error("Error", "Selecciona un proveedor"); return }
    if (poFormItems.length === 0) { toast.error("Error", "Agrega al menos un producto"); return }
    if (poFormItems.some(i => i.cantidad <= 0 || i.precio_unitario <= 0)) { toast.error("Error", "Cantidad y precio requeridos"); return }
    setPoCreating(true)
    try {
      await api.purchases.createPO({
        supplier_id: poFormSupplier,
        items: poFormItems.map(i => ({ product_id: i.product_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario })),
      })
      toast.success("Orden creada", "La orden de compra fue registrada")
      resetPOForm(); setShowPOModal(false); fetchAll()
    } catch {
      setPurchaseOrders(prev => [{
        id: "po-" + Date.now(), company_id: "", supplier_id: poFormSupplier,
        numero: "PO-" + new Date().getFullYear() + "-" + String(purchaseOrders.length + 1).padStart(4, "0"),
        fecha: new Date().toISOString(),
        fecha_entrega_estimada: poFormFecEntrega || null, estado: "borrador",
        moneda: poFormMoneda, tipo_cambio: poFormTipoCambio, subtotal: poFormSubtotal,
        descuento_total: poFormDescTotal, iva_10: poFormIva10, iva_5: poFormIva5, total: poFormTotal,
        observaciones: poFormObs || null, user_id: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        supplier: suppliers.find(s => s.id === poFormSupplier),
      }, ...prev])
      toast.success("Orden creada (demo)", "PO registrada")
      resetPOForm(); setShowPOModal(false)
    } finally { setPoCreating(false) }
  }

  const resetPOForm = () => {
    setPoFormSupplier(""); setPoFormTipo("local"); setPoFormPrioridad("normal")
    setPoFormMoneda("PYG"); setPoFormTipoCambio(1); setPoFormCondiciones("")
    setPoFormValidez(30); setPoFormFecEntrega(""); setPoFormShipping(0)
    setPoFormInsurance(0); setPoFormCustoms(0); setPoFormOther(0); setPoFormObs("")
    setPoFormItems([]); setPoProductSearch("")
  }

  const handleConfirmPO = async (po: PurchaseOrder) => {
    const ok = await confirm({ title: "Confirmar orden?", message: "Se confirmara " + po.numero, variant: "info" })
    if (!ok) return
    try {
      await api.purchases.confirmPO(po.id)
      toast.success("Confirmada", po.numero + " confirmada")
      fetchAll()
    } catch {
      setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, estado: "confirmado" } : p))
      toast.success("Confirmada (demo)", po.numero)
    }
  }

  const handleCancelPO = async (po: PurchaseOrder) => {
    const ok = await confirm({ title: "Cancelar orden?", message: "Se cancelara " + po.numero, variant: "danger" })
    if (!ok) return
    try {
      await api.purchases.cancelPO(po.id)
      toast.success("Cancelada", po.numero)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo cancelar la orden")
    }
  }

  const handleChangeStatus = async (po: PurchaseOrder, newStatus: string) => {
    try {
      if (newStatus === "enviado") {
        await api.purchases.sendPO(po.id)
      } else {
        toast.error("No disponible", "El estado " + newStatus + " se aplica automaticamente al recibir mercaderia, no se puede forzar")
        return
      }
      toast.success("Estado actualizado", po.numero + " -> " + newStatus)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo actualizar el estado")
    }
  }

  const handleViewReceipt = async (r: PurchaseReceipt) => {
    setShowDetailReceipt(r)
    setReceiptDetailItems([])
    setReceiptDetailLoading(true)
    try {
      const full = await api.purchases.getReceipt(r.id)
      setReceiptDetailItems(full.items || [])
    } catch {
      toast.error("Error", "No se pudo cargar el detalle de la recepcion")
    } finally {
      setReceiptDetailLoading(false)
    }
  }

  const handleCancelReceipt = async (r: PurchaseReceipt) => {
    const ok = await confirm({ title: "Anular recepcion?", message: "Se revertira el stock ingresado por " + r.numero + ". No se puede deshacer.", variant: "danger" })
    if (!ok) return
    try {
      const updated = await api.purchases.cancelReceipt(r.id)
      toast.success("Recepcion anulada", "Stock revertido")
      setShowDetailReceipt(updated)
      fetchAll()
    } catch (e: any) {
      toast.error("No se pudo anular", e?.message || "Verifica que el stock de esta recepcion no se haya usado todavia")
    }
  }

  const handleAddItemToPO = (product: Product) => {
    if (poFormItems.find(i => i.product_id === product.id)) { toast.info("Ya esta", product.nombre + " ya fue agregado"); return }
    setPoFormItems(prev => [...prev, {
      product_id: product.id, nombre: product.nombre, sku: product.sku || "",
      cantidad: 1, precio_unitario: product.precio || 0, descuento_pct: 0, iva_tasa: product.iva_tasa || 10, subtotal: product.precio || 0,
    }])
    setPoProductSearch("")
  }

  const handleUpdatePOItem = (index: number, field: string, value: number) => {
    setPoFormItems(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; u[index].subtotal = u[index].cantidad * u[index].precio_unitario * (1 - u[index].descuento_pct / 100); return u })
  }
  const handleRemovePOItem = (index: number) => setPoFormItems(prev => prev.filter((_, i) => i !== index))

  const handleSelectPOforReceipt = async (poId: string) => {
    setReceiptPO(poId)
    const po = purchaseOrders.find(p => p.id === poId)
    if (po) {
      setReceiptSupplier(po.supplier_id ?? "")
      try {
        const poItems = await api.purchases.getOrderItems(poId)
        const items: ReceiptItem[] = poItems.map((it: any) => {
          const prod = products.find(p => p.id === it.product_id)
          const ordenada = Number(it.cantidad || 0)
          const yaRecibida = Number(it.cantidad_recibida || 0)
          return {
            product_id: it.product_id,
            nombre: it.descripcion || prod?.nombre || "—",
            sku: prod?.sku || "",
            cantidad_ordenada: ordenada,
            cantidad_recibir: Math.max(ordenada - yaRecibida, 0),
            costo_unitario: Number(it.precio_unitario || it.costo_unitario_estimado || 0),
            lote: "",
            fecha_vencimiento: "",
            cantidad_rechazada: 0,
            motivo_rechazo: "",
            precio_po: Number(it.precio_unitario || 0),
          }
        })
        setReceiptItems(items)
      } catch {
        toast.error("Error", "No se pudieron cargar los items de la orden")
        setReceiptItems([])
      }
    }
  }

  const handleCreateReceipt = async () => {
    if (!receiptDirect && !receiptPO) { toast.error("Error", "Selecciona una orden"); return }
    if (receiptDirect && !receiptSupplier) { toast.error("Error", "Selecciona un proveedor"); return }
    if (receiptItems.length === 0) { toast.error("Error", "Agrega productos"); return }
    if (!receiptWarehouse) { toast.error("Error", "Selecciona un almacen"); return }
    setReceiptCreating(true)
    try {
      const receipt: any = await api.purchases.createReceipt({
        purchase_order_id: receiptDirect ? undefined : receiptPO || undefined,
        supplier_id: receiptSupplier,
        warehouse_id: receiptWarehouse,
        observaciones: receiptObs || undefined,
        items: receiptItems.map(i => ({
          product_id: i.product_id,
          cantidad_ordenada: i.cantidad_ordenada,
          cantidad_recibida: i.cantidad_recibir,
          costo_unitario: i.costo_unitario,
          cantidad_rechazada: i.cantidad_rechazada || undefined,
          motivo_rechazo: i.motivo_rechazo || undefined,
        })),
      } as any)
      if (receipt?.requiere_revision) {
        toast.error("Recepcion creada — requiere revision", receipt.motivo_revision || "Hay desvios de precio o rechazos que necesitan revision antes de facturar.")
      } else if (receipt?.purchase_order_id) {
        try {
          const inv = await api.financial.invoices.byReceipt(receipt.id)
          if (inv.found) {
            toast.success("Recepcion creada", `Stock actualizado. Factura de proveedor ${inv.numero_factura} generada automaticamente (Gs. ${Math.round(inv.total || 0).toLocaleString("es-PY")}).`)
          } else {
            toast.success("Recepcion creada", "Stock actualizado")
          }
        } catch { toast.success("Recepcion creada", "Stock actualizado") }
      } else {
        toast.success("Recepcion creada", "Stock actualizado")
      }
      resetReceiptForm(); setShowReceiptModal(false); fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo crear la recepcion")
    } finally { setReceiptCreating(false) }
  }

  const resetReceiptForm = () => { setReceiptPO(""); setReceiptDirect(false); setReceiptSupplier(""); setReceiptWarehouse(""); setReceiptRef(""); setReceiptItems([]); setReceiptObs("") }

  const resetSupplierForm = () => { setSupRazonSocial(""); setSupRuc(""); setSupDireccion(""); setSupTelefono(""); setSupEmail(""); setSupContacto(""); setSupTipo("nacional"); setSupPlazoPago(30) }

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setSupRuc(supplier.ruc ?? ""); setSupRazonSocial(supplier.razon_social ?? "")
    setSupDireccion(supplier.direccion || ""); setSupTelefono(supplier.telefono || "")
    setSupEmail(supplier.email || ""); setSupContacto(supplier.contacto || ""); setSupTipo("nacional"); setSupPlazoPago(30)
    setShowSupplierModal(true)
  }

  const handleSaveSupplier = async () => {
    if (!supRazonSocial) { toast.error("Error", "Razon social requerida"); return }
    const payload = { ruc: supRuc || undefined, razon_social: supRazonSocial, direccion: supDireccion || undefined, telefono: supTelefono || undefined, email: supEmail || undefined }
    try {
      if (editingSupplier) {
        await api.purchases.updateSupplier(editingSupplier.id, payload)
      } else {
        await api.purchases.createSupplier(payload)
      }
      toast.success(editingSupplier ? "Actualizado" : "Creado", supRazonSocial)
      setShowSupplierModal(false); resetSupplierForm(); setEditingSupplier(null)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar el proveedor")
    }
  }

  const handleToggleSupplier = async (sup: Supplier) => {
    try {
      await api.purchases.updateSupplier(sup.id, { activo: !sup.activo })
      toast.success(sup.activo ? "Desactivado" : "Activado", sup.razon_social)
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo actualizar el proveedor")
    }
  }




  const mainTabs: { key: MainTab; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "ordenes", label: "Ordenes", icon: FileText },
    { key: "recepciones", label: "Recepciones", icon: Truck },
    { key: "proveedores", label: "Proveedores", icon: Users },
    { key: "solicitudes", label: "Solicitudes", icon: Check },
    { key: "cotizaciones", label: "Cotizaciones", icon: Percent },
    { key: "sugerencias", label: "Sugerencias", icon: TrendingUp },
    { key: "presupuesto", label: "Presupuesto", icon: DollarSign },
    { key: "reportes", label: "Reportes", icon: ClipboardList },
  ]

  if (loading && purchaseOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />Compras
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {purchaseOrders.length} ordenes &middot; {formatPYG(totalPOValue)} en compras
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="btn-outline"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 flex-wrap">
        {mainTabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setMainTab(t.key)}
              className={"flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all " + (mainTab === t.key ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      {mainTab === "dashboard" && <DashboardTab
        purchaseOrders={purchaseOrders} activePOs={activePOs} totalPOValue={totalPOValue}
        suppliers={suppliers} activeSuppliers={activeSuppliers} poByStatus={poByStatus}
        topSuppliers={topSuppliers} receipts={receipts}
      />}

      {mainTab === "ordenes" && <OrdenesTab
        purchaseOrders={purchaseOrders} filteredPOs={filteredPOs}
        poSearch={poSearch} setPoSearch={setPoSearch}
        poStatusFilter={poStatusFilter} setPoStatusFilter={setPoStatusFilter}
        poSupplierFilter={poSupplierFilter} setPoSupplierFilter={setPoSupplierFilter}
        poDateFrom={poDateFrom} setPoDateFrom={setPoDateFrom}
        poDateTo={poDateTo} setPoDateTo={setPoDateTo}
        suppliers={suppliers} loading={loading}
        onConfirm={handleConfirmPO} onCancel={handleCancelPO}
        onChangeStatus={handleChangeStatus}
        onViewDetail={setShowDetailPO}
      />}

      {mainTab === "recepciones" && <RecepcionesTab
        receipts={receipts} loading={loading}
        onNewReceipt={() => setShowReceiptModal(true)}
        onViewReceipt={handleViewReceipt}
      />}

      {mainTab === "proveedores" && <ProveedoresTab
        suppliers={suppliers} filteredSuppliers={filteredSuppliers}
        supplierSearch={supplierSearch} setSupplierSearch={setSupplierSearch}
        supplierFilter={supplierFilter} setSupplierFilter={setSupplierFilter}
        proveedorTab={proveedorTab} setProveedorTab={setProveedorTab}
        onNewSupplier={() => { resetSupplierForm(); setEditingSupplier(null); setShowSupplierModal(true) }}
        onEditSupplier={openEditSupplier}
        onToggleSupplier={handleToggleSupplier}
        onGoToContracts={() => navigate("/contratos-proveedores")}
      />}

      {mainTab === "solicitudes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {["", "borrador", "pendiente", "aprobada", "rechazada", "convertida"].map(st => (
                <button key={st} onClick={() => setReqStatusFilter(st)}
                  className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all " + (reqStatusFilter === st ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700")}>
                  {st === "" ? "Todas" : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => { resetReqForm(); setShowReqModal(true) }}><Plus className="w-4 h-4" />Nueva solicitud</button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="table-cell">Numero</th>
                <th className="table-cell">Fecha</th>
                <th className="table-cell">Departamento</th>
                <th className="table-cell">Solicitante</th>
                <th className="table-cell">Prioridad</th>
                <th className="table-cell text-right">Total est.</th>
                <th className="table-cell">Estado</th>
                <th className="table-cell">Acciones</th>
              </tr></thead>
              <tbody>
                {requisitions.filter(r => !reqStatusFilter || r.estado === reqStatusFilter).map(r => (
                  <tr key={r.id} className="table-row cursor-pointer" onClick={() => openReqDetail(r)}>
                    <td className="table-td font-bold">{r.numero}</td>
                    <td className="table-td text-sm">{new Date(r.fecha).toLocaleDateString("es-PY")}</td>
                    <td className="table-td text-sm">{r.departamento || "-"}</td>
                    <td className="table-td text-sm">{r.solicitante_nombre || "-"}</td>
                    <td className="table-td text-sm capitalize">{r.prioridad || "normal"}</td>
                    <td className="table-td text-right font-mono">{formatPYG(r.total)}</td>
                    <td className="table-td"><StatusBadge status={r.estado} /></td>
                    <td className="table-td" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {(r.estado === "borrador" || r.estado === "pendiente") && (
                          <>
                            <button className="btn-ghost !p-1.5 text-green-600" title="Aprobar" onClick={() => handleApproveReq(r.id)}><CheckCircle className="w-4 h-4" /></button>
                            <button className="btn-ghost !p-1.5 text-red-500" title="Rechazar" onClick={() => handleRejectReq(r.id)}><X className="w-4 h-4" /></button>
                          </>
                        )}
                        {r.estado === "aprobada" && (
                          <button className="btn-primary !py-1 !px-2 text-xs" onClick={() => { setShowConvertReq(r); setConvertSupplier("") }}>Generar OC</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {requisitions.filter(r => !reqStatusFilter || r.estado === reqStatusFilter).length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin solicitudes de compra registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mainTab === "sugerencias" && (
        <div className="card p-10 text-center space-y-3">
          <BarChart3 className="w-8 h-8 text-primary mx-auto" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Las sugerencias de compra viven en Forecast de Demanda</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">Motor unico con proveedores comparados por precio y plazo real, neteo contra ordenes abiertas, y cross-docking.</p>
          <button className="btn-primary mx-auto" onClick={() => navigate("/demand-forecast")}><ExternalLink className="w-4 h-4" /> Ir a Forecast de Demanda</button>
        </div>
      )}

      {mainTab === "cotizaciones" && <CotizacionesTab suppliers={activeSuppliers} products={products} />}

      {mainTab === "presupuesto" && <PresupuestoTab />}

      {mainTab === "reportes" && <ReportesTab reportTab={reportTab} setReportTab={setReportTab} />}

      <Modal open={showPOModal} onClose={() => setShowPOModal(false)} title="Nueva orden de compra" size="xl">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Proveedor</label>
              <select className="input-field" value={poFormSupplier} onChange={(e) => setPoFormSupplier(e.target.value)}>
                <option value="">Seleccionar...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Tipo de compra</label>
              <select className="input-field" value={poFormTipo} onChange={(e) => setPoFormTipo(e.target.value as any)}>
                <option value="local">Local</option>
                <option value="importacion">Importacion</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label-field">Prioridad</label>
              <select className="input-field" value={poFormPrioridad} onChange={(e) => setPoFormPrioridad(e.target.value as any)}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label-field">Moneda</label>
              <select className="input-field" value={poFormMoneda} onChange={(e) => { setPoFormMoneda(e.target.value as any); setPoFormTipoCambio(1) }}>
                <option value="PYG">PYG (Guaranies)</option>
                <option value="USD">USD (Dolares)</option>
              </select>
            </div>
            <div>
              <label className="label-field">Tipo de cambio</label>
              <input className="input-field" type="number" min="0" step="0.01" value={poFormTipoCambio} onChange={(e) => setPoFormTipoCambio(parseFloat(e.target.value) || 1)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label-field">Condiciones de pago</label>
              <input className="input-field" placeholder="Ej: 30 dias" value={poFormCondiciones} onChange={(e) => setPoFormCondiciones(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Validez (dias)</label>
              <input className="input-field" type="number" min="1" value={poFormValidez} onChange={(e) => setPoFormValidez(parseInt(e.target.value) || 30)} />
            </div>
            <div>
              <label className="label-field">Fecha entrega estimada</label>
              <input className="input-field" type="date" value={poFormFecEntrega} onChange={(e) => setPoFormFecEntrega(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-field">Agregar productos</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por nombre o SKU..." value={poProductSearch} onChange={(e) => setPoProductSearch(e.target.value)} />
            </div>
            {poProductSearch && (
              <div className="mt-1 max-h-36 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {filteredProducts.slice(0, 8).map(p => (
                  <button key={p.id} type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between items-center border-b border-gray-100 dark:border-gray-800 last:border-0"
                    onClick={() => handleAddItemToPO(p)}>
                    <span className="font-medium">{p.nombre}</span>
                    <span className="text-xs text-gray-400 font-mono">{p.sku} &middot; {formatPYG(p.precio || 0)}</span>
                  </button>
                ))}
                {filteredProducts.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>}
              </div>
            )}
          </div>

          {poFormItems.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">Producto</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-20">Cant</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-24">P.Unit</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-16">Desc%</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-16">IVA</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-24">Subtotal</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {poFormItems.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-2 py-1">
                        <p className="font-medium text-xs">{item.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.sku}</p>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center justify-center gap-0.5">
                          <button className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={() => handleUpdatePOItem(i, "cantidad", Math.max(1, item.cantidad - 1))}><Minus className="w-3 h-3" /></button>
                          <input type="number" className="w-12 text-center input-field py-0.5 text-xs" value={item.cantidad} min={1} onChange={(e) => handleUpdatePOItem(i, "cantidad", parseInt(e.target.value) || 1)} />
                          <button className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={() => handleUpdatePOItem(i, "cantidad", item.cantidad + 1)}><Plus className="w-3 h-3" /></button>
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-full text-right input-field py-0.5 text-xs" value={item.precio_unitario} min={0} onChange={(e) => handleUpdatePOItem(i, "precio_unitario", parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-full text-center input-field py-0.5 text-xs" value={item.descuento_pct} min={0} max={100} onChange={(e) => handleUpdatePOItem(i, "descuento_pct", parseFloat(e.target.value) || 0)} />
                      </td>
                      <td className="px-2 py-1">
                        <select className="input-field py-0.5 text-xs" value={item.iva_tasa} onChange={(e) => handleUpdatePOItem(i, "iva_tasa", parseInt(e.target.value))}>
                          <option value={10}>10%</option>
                          <option value={5}>5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-bold text-xs">{formatCurrency(item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100), poFormMoneda)}</td>
                      <td className="px-2 py-1">
                        <button className="p-0.5 text-red-400 hover:text-red-500" onClick={() => handleRemovePOItem(i)}><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {poFormTipo === "importacion" && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <h4 className="text-sm font-bold mb-2 text-gray-900 dark:text-white">Costos de importacion</h4>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Flete</label>
                  <input className="input-field py-1 text-sm" type="number" min="0" value={poFormShipping} onChange={(e) => setPoFormShipping(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Seguro</label>
                  <input className="input-field py-1 text-sm" type="number" min="0" value={poFormInsurance} onChange={(e) => setPoFormInsurance(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Aduana</label>
                  <input className="input-field py-1 text-sm" type="number" min="0" value={poFormCustoms} onChange={(e) => setPoFormCustoms(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Otros</label>
                  <input className="input-field py-1 text-sm" type="number" min="0" value={poFormOther} onChange={(e) => setPoFormOther(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <p className="text-right text-sm font-bold mt-2">Costo landed: {formatCurrency(poFormLanded, poFormMoneda)}</p>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-mono font-bold">{formatCurrency(poFormSubtotal, poFormMoneda)}</span></div>
            <div className="flex justify-between"><span>Descuento total</span><span className="font-mono text-red-500">-{formatCurrency(poFormDescTotal, poFormMoneda)}</span></div>
            <div className="flex justify-between"><span>IVA 10%</span><span className="font-mono">{formatCurrency(poFormIva10, poFormMoneda)}</span></div>
            <div className="flex justify-between"><span>IVA 5%</span><span className="font-mono">{formatCurrency(poFormIva5, poFormMoneda)}</span></div>
            {poFormTipo === "importacion" && <div className="flex justify-between"><span>Costo landed</span><span className="font-mono">{formatCurrency(poFormLanded, poFormMoneda)}</span></div>}
            <div className="flex justify-between pt-2 border-t border-gray-300 dark:border-gray-600 text-base font-bold"><span>Total</span><span>{formatCurrency(poFormTotal, poFormMoneda)}</span></div>
          </div>

          <div>
            <label className="label-field">Observaciones</label>
            <textarea className="input-field" rows={2} placeholder="Notas internas..." value={poFormObs} onChange={(e) => setPoFormObs(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-outline" onClick={() => setShowPOModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreatePO} disabled={poCreating || poFormItems.length === 0 || !poFormSupplier}>
              {poCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {poCreating ? "Guardando..." : "Crear orden"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showDetailPO} onClose={() => setShowDetailPO(null)} title={showDetailPO ? "Detalle: " + showDetailPO.numero : ""} size="lg">
        {showDetailPO && (() => {
          const po = showDetailPO
          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Proveedor</span><p className="font-bold">{po.supplier?.razon_social || "-"}</p></div>
                <div><span className="text-gray-500">Estado</span><p><StatusBadge status={po.estado ?? ""} map={poStatusMap} /></p></div>
                <div><span className="text-gray-500">Moneda</span><p className="font-bold">{po.moneda}</p></div>
                <div><span className="text-gray-500">Tipo de cambio</span><p className="font-mono">{(po.tipo_cambio ?? 0).toFixed(2)}</p></div>
                <div><span className="text-gray-500">Fecha</span><p>{formatDate(po.fecha)}</p></div>
                <div><span className="text-gray-500">Entrega estimada</span><p>{po.fecha_entrega_estimada ? formatDate(po.fecha_entrega_estimada) : "-"}</p></div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-bold mb-2">Cost Breakdown</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(po.subtotal || 0, po.moneda)}</span></div>
                  <div className="flex justify-between"><span>Descuento</span><span className="font-mono text-red-500">-{formatCurrency(po.descuento_total || 0, po.moneda)}</span></div>
                  <div className="flex justify-between"><span>IVA 10%</span><span className="font-mono">{formatCurrency(po.iva_10 || 0, po.moneda)}</span></div>
                  <div className="flex justify-between"><span>IVA 5%</span><span className="font-mono">{formatCurrency(po.iva_5 || 0, po.moneda)}</span></div>
                  <div className="flex justify-between pt-2 border-t font-bold text-base"><span>Total</span><span>{formatCurrency(po.total || 0, po.moneda)}</span></div>
                </div>
              </div>

              <div className="border-t pt-3 flex gap-2 flex-wrap">
                {po.estado === "borrador" && (<><button className="btn-primary text-sm" onClick={() => { handleConfirmPO(po); setShowDetailPO(null) }}><Check className="w-3.5 h-3.5" /> Confirmar</button><button className="btn-ghost text-red-400 text-sm" onClick={() => { handleCancelPO(po); setShowDetailPO(null) }}><X className="w-3.5 h-3.5" /> Cancelar</button></>)}
                {po.estado === "confirmado" && (<><button className="btn-primary text-sm" onClick={() => { handleChangeStatus(po, "enviado"); setShowDetailPO(null) }}><Send className="w-3.5 h-3.5" /> Enviar</button><button className="btn-ghost text-red-400 text-sm" onClick={() => { handleCancelPO(po); setShowDetailPO(null) }}><Ban className="w-3.5 h-3.5" /> Cancelar</button></>)}
                {po.estado === "enviado" && <button className="btn-primary text-sm" onClick={() => { handleChangeStatus(po, "parcial"); setShowDetailPO(null) }}><Package className="w-3.5 h-3.5" /> Recibir parcial</button>}
                {(po.estado === "completado" || po.estado === "cancelado") && <span className="text-xs text-gray-400 italic">Orden {po.estado === "completado" ? "completada" : "cancelada"} &mdash; solo lectura</span>}
              </div>
            </div>
          )
        })()}
      </Modal>

      <Modal open={!!showDetailReceipt} onClose={() => setShowDetailReceipt(null)} title={showDetailReceipt ? "Recepcion: " + showDetailReceipt.numero : ""} size="lg">
        {showDetailReceipt && (() => {
          const r = showDetailReceipt
          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {r.requiere_revision && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Requiere revision</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">{r.motivo_revision || "Hay diferencias que no se procesaron automaticamente."}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Proveedor</span><p className="font-bold">{r.supplier?.razon_social || "-"}</p></div>
                <div><span className="text-gray-500">Estado</span><p><StatusBadge status={r.estado ?? ""} map={{ completado: "badge-success", pendiente: "badge-warning", cancelado: "badge-danger" }} /></p></div>
                <div><span className="text-gray-500">Origen</span><p>{r.purchase_order_id ? <span className="font-mono text-xs text-primary">PO vinculada</span> : <span className="text-xs text-gray-400">Recepcion directa</span>}</p></div>
                <div><span className="text-gray-500">Fecha</span><p>{formatDate(r.fecha)}</p></div>
                <div><span className="text-gray-500">Referencia proveedor</span><p>{r.proveedor_ref || "-"}</p></div>
                <div><span className="text-gray-500">Observaciones</span><p>{r.observaciones || "-"}</p></div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-bold mb-2">Productos recibidos</h4>
                {receiptDetailLoading ? (
                  <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
                ) : receiptDetailItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sin items registrados</p>
                ) : (
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="table-cell">Producto</th>
                          <th className="table-cell text-right">Ordenado</th>
                          <th className="table-cell text-right">Recibido</th>
                          <th className="table-cell text-right">Costo unit.</th>
                          <th className="table-cell text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiptDetailItems.map((it, i) => (
                          <tr key={it.id || i} className="table-row">
                            <td className="table-td">{products.find(p => p.id === it.product_id)?.nombre || it.product_id}</td>
                            <td className="table-td text-right font-mono text-gray-500">{it.cantidad_ordenada ?? "-"}</td>
                            <td className="table-td text-right font-mono font-bold">{it.cantidad_recibida}</td>
                            <td className="table-td text-right font-mono">{formatPYG(it.costo_unitario)}</td>
                            <td className="table-td text-right font-mono font-bold">{formatPYG(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 dark:border-gray-700 font-bold">
                          <td colSpan={4} className="table-td text-right">Total recepcion</td>
                          <td className="table-td text-right font-mono">{formatPYG(r.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {r.estado !== "cancelado" && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex justify-end">
                  <button className="btn-ghost text-red-500" onClick={() => handleCancelReceipt(r)}>
                    <Trash2 className="w-3.5 h-3.5" /> Anular recepcion
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      <Modal open={showReceiptModal} onClose={() => { setShowReceiptModal(false); resetReceiptForm() }} title="Nueva recepcion" size="lg">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={receiptDirect} onChange={(e) => setReceiptDirect(e.target.checked)} />
              Recepcion directa (sin PO)
            </label>
          </div>

          {!receiptDirect ? (
            <div>
              <label className="label-field">Orden de compra</label>
              <select className="input-field" value={receiptPO} onChange={(e) => handleSelectPOforReceipt(e.target.value)}>
                <option value="">Seleccionar PO...</option>
                {pendingReceiptPOs.map(p => <option key={p.id} value={p.id}>{p.numero} &mdash; {p.supplier?.razon_social} ({p.estado})</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="label-field">Proveedor</label>
              <select className="input-field" value={receiptSupplier} onChange={(e) => setReceiptSupplier(e.target.value)}>
                <option value="">Seleccionar...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Almacen destino</label>
              <select className="input-field" value={receiptWarehouse} onChange={(e) => setReceiptWarehouse(e.target.value)}>
                <option value="">Seleccionar...</option>
                {(warehouses.length > 0 ? warehouses : mockWarehouses).map((w: any) => <option key={w.id} value={w.id}>{w.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Ref. proveedor</label>
              <input className="input-field" placeholder="Factura/Remito..." value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} />
            </div>
          </div>

          {receiptItems.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">Producto</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-16">Ord.</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-20">Recibir</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-gray-600 dark:text-gray-400 w-24">Costo U.</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-600 dark:text-gray-400 w-20">Rechazado</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400 w-40">Motivo rechazo</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptItems.map((item, i) => {
                    const desvio = item.precio_po && item.precio_po > 0 ? Math.abs(item.costo_unitario - item.precio_po) / item.precio_po : 0
                    const fueraDeRango = desvio > 0.05
                    return (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-2 py-1">
                        <p className="font-medium text-xs">{item.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.sku}</p>
                        {fueraDeRango && (
                          <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> {(desvio * 100).toFixed(1)}% vs precio de OC (Gs. {item.precio_po?.toLocaleString("es-PY")}) — quedara para revision
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-1 text-center text-xs">{item.cantidad_ordenada}</td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-full text-center input-field py-0.5 text-xs" value={item.cantidad_recibir} min={0} onChange={(e) => { const u = [...receiptItems]; u[i] = { ...u[i], cantidad_recibir: parseInt(e.target.value) || 0 }; setReceiptItems(u) }} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className={"w-full text-right input-field py-0.5 text-xs" + (fueraDeRango ? " border-amber-400" : "")} value={item.costo_unitario} min={0} onChange={(e) => { const u = [...receiptItems]; u[i] = { ...u[i], costo_unitario: parseFloat(e.target.value) || 0 }; setReceiptItems(u) }} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-full text-center input-field py-0.5 text-xs" value={item.cantidad_rechazada || ""} min={0} onChange={(e) => { const u = [...receiptItems]; u[i] = { ...u[i], cantidad_rechazada: parseInt(e.target.value) || 0 }; setReceiptItems(u) }} />
                      </td>
                      <td className="px-2 py-1">
                        <input className="w-full input-field py-0.5 text-xs" placeholder="Opcional" value={item.motivo_rechazo} onChange={(e) => { const u = [...receiptItems]; u[i] = { ...u[i], motivo_rechazo: e.target.value }; setReceiptItems(u) }} />
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="label-field">Observaciones</label>
            <textarea className="input-field" rows={2} placeholder="Notas..." value={receiptObs} onChange={(e) => setReceiptObs(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-outline" onClick={() => { setShowReceiptModal(false); resetReceiptForm() }}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreateReceipt} disabled={receiptCreating || receiptItems.length === 0 || !receiptWarehouse}>
              {receiptCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              {receiptCreating ? "Procesando..." : "Recibir productos"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showSupplierModal} onClose={() => { setShowSupplierModal(false); resetSupplierForm(); setEditingSupplier(null) }}
        title={editingSupplier ? "Editar proveedor" : "Nuevo proveedor"} size="xl">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">RUC</label>
              <input className="input-field" placeholder="80012345-6" value={supRuc} onChange={(e) => setSupRuc(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Razon social *</label>
              <input className="input-field" placeholder="Razon social" value={supRazonSocial} onChange={(e) => setSupRazonSocial(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Telefono</label>
              <input className="input-field" placeholder="021 123 456" value={supTelefono} onChange={(e) => setSupTelefono(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input className="input-field" placeholder="proveedor@ejemplo.com" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Direccion</label>
              <input className="input-field" placeholder="Direccion" value={supDireccion} onChange={(e) => setSupDireccion(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Contacto</label>
              <input className="input-field" placeholder="Nombre contacto" value={supContacto} onChange={(e) => setSupContacto(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Tipo</label>
              <select className="input-field" value={supTipo} onChange={(e) => setSupTipo(e.target.value as any)}>
                <option value="nacional">Nacional</option>
                <option value="import">Importacion</option>
              </select>
            </div>
            <div>
              <label className="label-field">Plazo pago (dias)</label>
              <input className="input-field" type="number" min="0" value={supPlazoPago} onChange={(e) => setSupPlazoPago(parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div>
            <label className="label-field">Notas</label>
            <textarea className="input-field" rows={2} placeholder="Notas internas..." value={supNotas} onChange={(e) => setSupNotas(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-outline" onClick={() => { setShowSupplierModal(false); resetSupplierForm(); setEditingSupplier(null) }}>Cancelar</button>
            <button className="btn-primary" onClick={handleSaveSupplier} disabled={!supRazonSocial}>
              <Save className="w-4 h-4" /> {editingSupplier ? "Actualizar" : "Crear proveedor"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showReqModal} onClose={() => setShowReqModal(false)} title="Nueva solicitud de compra" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Departamento</label>
              <input className="input-field" value={reqDepartamento} onChange={e => setReqDepartamento(e.target.value)} placeholder="Ej. Panaderia" />
            </div>
            <div>
              <label className="label-field">Solicitante</label>
              <input className="input-field" value={reqSolicitante} onChange={e => setReqSolicitante(e.target.value)} placeholder="Nombre de quien pide" />
            </div>
            <div>
              <label className="label-field">Prioridad</label>
              <select className="input-field" value={reqPrioridad} onChange={e => setReqPrioridad(e.target.value as any)}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label-field">Motivo</label>
              <input className="input-field" value={reqMotivo} onChange={e => setReqMotivo(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div>
            <label className="label-field">Agregar producto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por nombre o SKU..." value={reqProductSearch} onChange={e => setReqProductSearch(e.target.value)} />
            </div>
            {reqProductSearch.length > 1 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg mt-1 max-h-48 overflow-y-auto">
                {products.filter(p => p.nombre?.toLowerCase().includes(reqProductSearch.toLowerCase()) || p.sku?.toLowerCase().includes(reqProductSearch.toLowerCase())).slice(0, 15).map(p => (
                  <div key={p.id} className="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between" onClick={() => addReqItem(p)}>
                    <span>{p.nombre}</span><span className="text-gray-400">{p.sku}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {reqItems.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="table-header">
                  <th className="table-cell">Producto</th>
                  <th className="table-cell text-right">Cantidad</th>
                  <th className="table-cell text-right">Precio est.</th>
                  <th className="table-cell"></th>
                </tr></thead>
                <tbody>
                  {reqItems.map((it, idx) => (
                    <tr key={it.product_id} className="table-row">
                      <td className="table-td">{it.nombre}</td>
                      <td className="table-td text-right">
                        <input type="number" className="input-field w-24 text-right" value={it.cantidad_solicitada}
                          onChange={e => setReqItems(prev => prev.map((x, i) => i === idx ? { ...x, cantidad_solicitada: Number(e.target.value) } : x))} />
                      </td>
                      <td className="table-td text-right">
                        <input type="number" className="input-field w-28 text-right" value={it.precio_estimado}
                          onChange={e => setReqItems(prev => prev.map((x, i) => i === idx ? { ...x, precio_estimado: Number(e.target.value) } : x))} />
                      </td>
                      <td className="table-td"><button className="btn-ghost !p-1" onClick={() => setReqItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4 text-red-500" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-outline" onClick={() => setShowReqModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreateRequisition} disabled={reqCreating}>
              {reqCreating ? "Guardando..." : "Crear solicitud"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showConvertReq} onClose={() => setShowConvertReq(null)} title="Generar orden de compra" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Solicitud {showConvertReq?.numero} — elegi el proveedor para la orden de compra.</p>
          <select className="input-field" value={convertSupplier} onChange={e => setConvertSupplier(e.target.value)}>
            <option value="">Seleccionar proveedor...</option>
            {[...activeSuppliers].sort((a, b) => (a.plazo_entrega_promedio || 999) - (b.plazo_entrega_promedio || 999)).map(s => (
              <option key={s.id} value={s.id}>
                {s.razon_social}{s.plazo_entrega_promedio ? ` — ${s.plazo_entrega_promedio}d entrega` : ""}{s.rating ? ` — ${s.rating}/5` : ""}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-outline" onClick={() => setShowConvertReq(null)}>Cancelar</button>
            <button className="btn-primary" onClick={handleConvertReq} disabled={!convertSupplier}>Generar OC</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showReqDetail} onClose={() => setShowReqDetail(null)} title={showReqDetail ? `Solicitud ${showReqDetail.numero}` : ""} size="md">
        {reqDetailLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : showReqDetail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Departamento:</span> {showReqDetail.departamento || "-"}</div>
              <div><span className="text-gray-400">Solicitante:</span> {showReqDetail.solicitante_nombre || "-"}</div>
              <div><span className="text-gray-400">Prioridad:</span> {showReqDetail.prioridad || "normal"}</div>
              <div><span className="text-gray-400">Estado:</span> <StatusBadge status={showReqDetail.estado} /></div>
              {showReqDetail.motivo && <div className="col-span-2"><span className="text-gray-400">Motivo:</span> {showReqDetail.motivo}</div>}
              {showReqDetail.rechazado_motivo && <div className="col-span-2 text-red-500"><span className="text-gray-400">Motivo de rechazo:</span> {showReqDetail.rechazado_motivo}</div>}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="table-header"><th className="table-cell">Item</th><th className="table-cell text-right">Cant.</th><th className="table-cell text-right">Precio est.</th></tr></thead>
              <tbody>
                {(showReqDetail.items || []).map((it: NonNullable<typeof showReqDetail.items>[number]) => (
                  <tr key={it.id} className="table-row">
                    <td className="table-td">{it.descripcion || it.product_id}</td>
                    <td className="table-td text-right">{it.cantidad_solicitada}</td>
                    <td className="table-td text-right">{formatPYG(it.precio_estimado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

    </div>
  )
}
function DashboardTab({ purchaseOrders, activePOs, totalPOValue, suppliers, activeSuppliers, poByStatus, topSuppliers, receipts }: {
  purchaseOrders: PurchaseOrder[]; activePOs: PurchaseOrder[]; totalPOValue: number; suppliers: Supplier[]; activeSuppliers: Supplier[]; poByStatus: any[]; topSuppliers: any[]; receipts: PurchaseReceipt[]
}) {
  const pendingReceipt = purchaseOrders.filter(p => p.estado === "enviado" || p.estado === "parcial").length
  const completedPOs = purchaseOrders.filter(p => p.estado === "completado").length
  const totalPOs = purchaseOrders.filter(p => p.estado !== "cancelado").length
  const cumplimiento = totalPOs > 0 ? Math.round((completedPOs / totalPOs) * 100) : 0
  const monthlySpend = activePOs.reduce((a, b) => a + Number(b.total || 0), 0)
  const prevMonthSpend = Math.round(monthlySpend * 0.85)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard icon={ShoppingCart} label="Ordenes activas" value={activePOs.length} color="blue" />
        <KPICard icon={Package} label="Pendientes de recibir" value={pendingReceipt} color="amber" />
        <KPICard icon={DollarSign} label="Valor total POs" value={formatPYG(totalPOValue)} color="green" />
        <KPICard icon={TrendingDown} label="Ahorro estimado" value={formatPYG(Math.round(totalPOValue * 0.08))} color="primary" trend={{ direction: "down", value: "8%" }} />
        <KPICard icon={Users} label="Proveedores activos" value={activeSuppliers.length} color="purple" sublabel={"de " + suppliers.length + " totales"} />
        <KPICard icon={CheckCircle} label="Cumplimiento" value={cumplimiento + "%"} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Widget title="Ordenes por estado" size="md" subtitle="Distribucion de POs">
          <BarChart data={poByStatus.map((s: any) => ({ ...s, label: s.estado, value: s.count }))} maxKey="value" labelKey="label" colorKey="color" />
        </Widget>

        <Widget title="Top Proveedores" subtitle="Por monto total" size="sm">
          <div className="space-y-3">
            {topSuppliers.map((s: any, i: number) => {
              const maxVal = topSuppliers.length > 0 ? topSuppliers[0].total : 1
              return (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium truncate">{s.name}</span>
                    <span className="font-mono">{formatPYG(s.total)}</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: (s.total / maxVal) * 100 + "%" }} />
                  </div>
                </div>
              )
            })}
            {topSuppliers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>}
          </div>
        </Widget>

        <Widget title="Gasto mensual" subtitle="Mes actual vs anterior" size="sm">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Este mes</span><span className="font-bold">{formatPYG(monthlySpend)}</span></div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: "100%" }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Mes anterior</span><span className="font-bold">{formatPYG(prevMonthSpend)}</span></div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden"><div className="h-full rounded-full bg-gray-400" style={{ width: (prevMonthSpend / Math.max(monthlySpend, 1)) * 100 + "%" }} /></div>
            </div>
            <div className="text-center text-sm">
              {monthlySpend > prevMonthSpend ?
                <span className="text-red-500 flex items-center justify-center gap-1"><ArrowUp className="w-3.5 h-3.5" />{((monthlySpend / prevMonthSpend - 1) * 100).toFixed(0) + "% vs mes anterior"}</span>
              :
                <span className="text-green-500 flex items-center justify-center gap-1"><ArrowDown className="w-3.5 h-3.5" />{((1 - monthlySpend / prevMonthSpend) * 100).toFixed(0) + "% vs mes anterior"}</span>
              }
            </div>
          </div>
        </Widget>

        <Widget title="Ordenes recientes" size="md" subtitle="Ultimas 5 ordenes">
          <div className="space-y-2">
            {purchaseOrders.slice(0, 5).map(po => (
              <div key={po.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div>
                  <p className="text-xs font-bold">{po.numero}</p>
                  <p className="text-[10px] text-gray-400">{po.supplier?.razon_social || "-"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono font-bold">{formatPYG(po.total || 0)}</p>
                  <StatusBadge status={po.estado ?? ""} map={poStatusMap} className="text-[10px]" />
                </div>
              </div>
            ))}
            {purchaseOrders.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin ordenes</p>}
          </div>
        </Widget>

        <Widget title="Stock en transito" subtitle="Productos pendientes" size="sm">
          <div className="space-y-2">
            {receipts.filter(r => r.purchase_order_id).length > 0 ? receipts.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <Package className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{r.supplier?.razon_social || "-"}</p>
                  <p className="text-[10px] text-gray-400">{r.numero}</p>
                </div>
                <span className="text-xs font-mono font-bold">{formatPYG(r.total)}</span>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-4">Sin stock en transito</p>
            )}
          </div>
        </Widget>
      </div>
    </div>
  )
}

function OrdenesTab({ purchaseOrders, filteredPOs, poSearch, setPoSearch, poStatusFilter, setPoStatusFilter, poSupplierFilter, setPoSupplierFilter, poDateFrom, setPoDateFrom, poDateTo, setPoDateTo, suppliers, loading, onConfirm, onCancel, onChangeStatus, onViewDetail }: {
  purchaseOrders: PurchaseOrder[]; filteredPOs: PurchaseOrder[]; poSearch: string; setPoSearch: (v: string) => void; poStatusFilter: string; setPoStatusFilter: (v: string) => void; poSupplierFilter: string; setPoSupplierFilter: (v: string) => void; poDateFrom: string; setPoDateFrom: (v: string) => void; poDateTo: string; setPoDateTo: (v: string) => void; suppliers: Supplier[]; loading: boolean; onConfirm: (po: PurchaseOrder) => void; onCancel: (po: PurchaseOrder) => void; onChangeStatus: (po: PurchaseOrder, s: string) => void; onViewDetail: (po: PurchaseOrder) => void
}) {
  const total = purchaseOrders.length
  const borrador = purchaseOrders.filter(p => p.estado === "borrador").length
  const confirmadas = purchaseOrders.filter(p => p.estado === "confirmado").length
  const enviadas = purchaseOrders.filter(p => p.estado === "enviado").length
  const completadas = purchaseOrders.filter(p => p.estado === "completado").length
  const canceladas = purchaseOrders.filter(p => p.estado === "cancelado").length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</p><p className="text-lg font-bold">{total}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Borrador</p><p className="text-lg font-bold text-gray-500">{borrador}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Confirmadas</p><p className="text-lg font-bold text-blue-500">{confirmadas}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Enviadas</p><p className="text-lg font-bold text-indigo-500">{enviadas}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Completadas</p><p className="text-lg font-bold text-green-500">{completadas}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Canceladas</p><p className="text-lg font-bold text-red-500">{canceladas}</p></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Buscar por numero o proveedor..." value={poSearch} onChange={(e) => setPoSearch(e.target.value)} />
        </div>
        <select className="input-field w-36" value={poStatusFilter} onChange={(e) => setPoStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {["borrador", "confirmado", "enviado", "parcial", "completado", "cancelado"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field w-44" value={poSupplierFilter} onChange={(e) => setPoSupplierFilter(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
        </select>
        <input type="date" className="input-field w-32" value={poDateFrom} onChange={(e) => setPoDateFrom(e.target.value)} />
        <input type="date" className="input-field w-32" value={poDateTo} onChange={(e) => setPoDateTo(e.target.value)} />
        {(poSearch || poStatusFilter || poSupplierFilter || poDateFrom || poDateTo) && (
          <button className="btn-ghost text-red-500" onClick={() => { setPoSearch(""); setPoStatusFilter(""); setPoSupplierFilter(""); setPoDateFrom(""); setPoDateTo("") }}><X className="w-4 h-4" /></button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Numero</th>
              <th className="table-cell">Proveedor</th>
              <th className="table-cell text-right">Total</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Prioridad</th>
              <th className="table-cell">Fecha</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : filteredPOs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No se encontraron ordenes</td></tr>
            ) : filteredPOs.map(po => (
              <tr key={po.id} className="table-row">
                <td className="table-td font-mono text-xs font-bold text-primary">{po.numero}</td>
                <td className="table-td"><p className="text-sm font-medium">{po.supplier?.razon_social || "-"}</p></td>
                <td className="table-td text-right font-mono font-bold">{formatCurrency(po.total || 0, po.moneda)}</td>
                <td className="table-td"><StatusBadge status={po.estado ?? ""} map={poStatusMap} /></td>
                <td className="table-td"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize badge-info">Normal</span></td>
                <td className="table-td text-sm text-gray-500">{formatDate(po.fecha)}</td>
                <td className="table-td">
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost" title="Ver detalle" onClick={() => onViewDetail(po)}><Eye className="w-4 h-4" /></button>
                    {po.estado === "borrador" && (<>
                      <button className="btn-ghost text-green-500" title="Confirmar" onClick={() => onConfirm(po)}><Check className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400" title="Cancelar" onClick={() => onCancel(po)}><Ban className="w-4 h-4" /></button>
                    </>)}
                    {po.estado === "confirmado" && (<>
                      <button className="btn-ghost text-indigo-500" title="Enviar" onClick={() => onChangeStatus(po, "enviado")}><Send className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400" title="Cancelar" onClick={() => onCancel(po)}><Ban className="w-4 h-4" /></button>
                    </>)}
                    {po.estado === "enviado" && <button className="btn-ghost text-green-500" title="Recibir parcial" onClick={() => onChangeStatus(po, "parcial")}><Package className="w-4 h-4" /></button>}
                    {po.estado === "parcial" && <button className="btn-ghost text-green-500" title="Completar" onClick={() => onChangeStatus(po, "completado")}><Check className="w-4 h-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RecepcionesTab({ receipts, loading, onNewReceipt, onViewReceipt }: { receipts: PurchaseReceipt[]; loading: boolean; onNewReceipt: () => void; onViewReceipt: (r: PurchaseReceipt) => void }) {
  const total = receipts.length
  const directas = receipts.filter(r => !r.purchase_order_id).length
  const completadas = receipts.length
  const totalUnits = receipts.reduce((a, b) => a + Math.round(Number(b.total || 0) / 10000), 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total recepciones</p><p className="text-lg font-bold">{total}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recepciones directas</p><p className="text-lg font-bold text-amber-500">{directas}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Completadas</p><p className="text-lg font-bold text-green-500">{completadas}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Productos recibidos</p><p className="text-lg font-bold text-primary">{totalUnits.toLocaleString()}</p></div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={onNewReceipt}><Plus className="w-4 h-4" />Nueva recepcion</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Numero</th>
              <th className="table-cell">PO origen</th>
              <th className="table-cell">Proveedor</th>
              <th className="table-cell">Fecha</th>
              <th className="table-cell text-right">Total</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : receipts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No hay recepciones registradas</td></tr>
            ) : receipts.map(r => (
              <tr key={r.id} className="table-row">
                <td className="table-td font-mono text-xs font-bold text-primary">{r.numero}</td>
                <td className="table-td text-sm">{r.purchase_order_id ? <span className="font-mono text-xs text-primary">PO vinculada</span> : <span className="text-xs text-gray-400">Directa</span>}</td>
                <td className="table-td font-medium">{r.supplier?.razon_social || "-"}</td>
                <td className="table-td text-sm text-gray-500">{formatDate(r.fecha)}</td>
                <td className="table-td text-right font-mono font-bold">{formatPYG(r.total)}</td>
                <td className="table-td"><button className="btn-ghost" title="Ver detalle" onClick={() => onViewReceipt(r)}><Eye className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProveedoresTab({ suppliers, filteredSuppliers, supplierSearch, setSupplierSearch, supplierFilter, setSupplierFilter, proveedorTab, setProveedorTab, onNewSupplier, onEditSupplier, onToggleSupplier, onGoToContracts }: {
  suppliers: Supplier[]; filteredSuppliers: Supplier[]; supplierSearch: string; setSupplierSearch: (v: string) => void; supplierFilter: SupplierStatus; setSupplierFilter: (v: SupplierStatus) => void; proveedorTab: SubTab; setProveedorTab: (v: SubTab) => void; onNewSupplier: () => void; onEditSupplier: (s: Supplier) => void; onToggleSupplier: (s: Supplier) => void; onGoToContracts: () => void
}) {
  const activos = suppliers.filter(s => s.activo).length
  const [scorecardSupplier, setScorecardSupplier] = useState<Supplier | null>(null)
  const [scorecard, setScorecard] = useState<any>(null)
  const [loadingScorecard, setLoadingScorecard] = useState(false)

  const openScorecard = async (s: Supplier) => {
    setScorecardSupplier(s)
    setScorecard(null)
    setLoadingScorecard(true)
    try {
      setScorecard(await api.purchases.getSupplierPerformance(s.id))
    } finally {
      setLoadingScorecard(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <KPICard icon={Users} label="Total proveedores" value={suppliers.length} color="blue" />
        <KPICard icon={CheckCircle} label="Activos" value={activos} color="green" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(["lista", "contratos"] as SubTab[]).map(st => (
            <button key={st} onClick={() => setProveedorTab(st)}
              className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all " + (proveedorTab === st ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700")}>{st.charAt(0).toUpperCase() + st.slice(1)}</button>
          ))}
        </div>
        {proveedorTab === "lista" && <button className="btn-primary" onClick={onNewSupplier}><UserPlus className="w-4 h-4" />Nuevo proveedor</button>}
      </div>

      {proveedorTab === "lista" && (
        <>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar por nombre o RUC..." value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {(["todos", "activos", "inactivos"] as SupplierStatus[]).map(f => (
                <button key={f} onClick={() => setSupplierFilter(f)}
                  className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all " + (supplierFilter === f ? "bg-white dark:bg-slate-700 shadow-sm" : "text-gray-500")}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="table-cell">Razon social</th>
                <th className="table-cell">RUC</th>
                <th className="table-cell">Telefono</th>
                <th className="table-cell">Email</th>
                <th className="table-cell">Activo</th>
                <th className="table-cell">Acciones</th>
              </tr></thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No se encontraron proveedores</td></tr>
                ) : filteredSuppliers.map(s => (
                  <tr key={s.id} className="table-row">
                    <td className="table-td font-medium">{s.razon_social}</td>
                    <td className="table-td font-mono text-xs">{s.ruc || "-"}</td>
                    <td className="table-td text-sm">{s.telefono || "-"}</td>
                    <td className="table-td text-sm">{s.email || "-"}</td>
                    <td className="table-td"><StatusBadge status={s.activo ? "activo" : "inactivo"} /></td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        <button className="btn-ghost" onClick={() => openScorecard(s)} title="Ficha de desempeño"><Award className="w-4 h-4" /></button>
                        <button className="btn-ghost" onClick={() => onEditSupplier(s)} title="Editar"><Edit3 className="w-4 h-4" /></button>
                        <button className={"btn-ghost " + (s.activo ? "text-red-400" : "text-green-500")} onClick={() => onToggleSupplier(s)}>{s.activo ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {proveedorTab === "contratos" && (
        <div className="card p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-primary mx-auto" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Esta pestana mostraba contratos de ejemplo, no reales</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">La gestion real de contratos con proveedores (aprobar, activar, renovar, cancelar) vive en su propio modulo.</p>
          <button className="btn-primary mx-auto" onClick={onGoToContracts}><ExternalLink className="w-4 h-4" /> Ir a Contratos con Proveedores</button>
        </div>
      )}

      <Modal open={!!scorecardSupplier} onClose={() => setScorecardSupplier(null)} title={scorecardSupplier ? `Ficha de desempeno: ${scorecardSupplier.razon_social}` : ""} size="md">
        {loadingScorecard ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : scorecard && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ordenes de compra</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{scorecard.total_orders}</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total comprado</p>
                <p className="text-lg font-bold text-primary">{formatPYG(scorecard.total_spent)}</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Entregas a tiempo</p>
                <p className={"text-xl font-bold " + (scorecard.on_time_rate == null ? "text-gray-400" : scorecard.on_time_rate >= 80 ? "text-green-500" : scorecard.on_time_rate >= 50 ? "text-amber-500" : "text-red-500")}>
                  {scorecard.on_time_rate != null ? `${scorecard.on_time_rate}%` : "—"}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Calculado a partir del historial real de ordenes de compra de este proveedor (fecha de envio vs. fecha de entrega estimada).</p>

            {scorecard.overall_rating != null ? (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Evaluacion cualitativa (promedio de evaluaciones registradas)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Calidad</span><span className="font-bold">{scorecard.avg_quality_score}/10</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Entrega</span><span className="font-bold">{scorecard.avg_delivery_score}/10</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Precio</span><span className="font-bold">{scorecard.avg_price_score}/10</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Atencion</span><span className="font-bold">{scorecard.avg_attention_score}/10</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Puntaje general</span>
                  <span className="text-2xl font-bold text-primary">{scorecard.overall_rating}/10</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Sin evaluaciones cualitativas registradas todavia para este proveedor.</p>
            )}
          </div>
        )}
      </Modal>

    </div>
  )
}

function ReportesTab({ reportTab, setReportTab }: { reportTab: ReportSubTab; setReportTab: (v: ReportSubTab) => void }) {
  const toast = useToast()
  const [kpis, setKpis] = useState<any>(null)
  const [spendSupplier, setSpendSupplier] = useState<any[]>([])
  const [spendCategory, setSpendCategory] = useState<any[]>([])
  const [variance, setVariance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingSupplier, setExportingSupplier] = useState(false)
  const [exportingVariance, setExportingVariance] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.purchases.reports.kpis(),
      api.purchases.reports.spendBySupplier(),
      api.purchases.reports.spendByCategory(),
      api.purchases.reports.priceVariance(),
    ]).then(([k, sp, sc, v]) => { setKpis(k); setSpendSupplier(sp); setSpendCategory(sc); setVariance(v) })
      .catch(() => toast.error("Error", "No se pudieron cargar los reportes"))
      .finally(() => setLoading(false))
  }, [])

  const handleExportSupplier = async () => {
    setExportingSupplier(true)
    try { await api.purchases.reports.downloadSpendBySupplierPdf() } catch { toast.error("Error", "No se pudo generar el PDF") }
    finally { setExportingSupplier(false) }
  }
  const handleExportVariance = async () => {
    setExportingVariance(true)
    try { await api.purchases.reports.downloadPriceVariancePdf() } catch { toast.error("Error", "No se pudo generar el PDF") }
    finally { setExportingVariance(false) }
  }

  const totalGastoSupplier = spendSupplier.reduce((a, b) => a + Number(b.total_gastado || 0), 0)
  const totalGastoCategory = spendCategory.reduce((a, b) => a + Number(b.total_gastado || 0), 0)

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Gasto total</p><p className="text-lg font-bold text-green-500">{formatPYG(kpis?.total_gastado || 0)}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Promedio por OC</p><p className="text-lg font-bold">{formatPYG(kpis?.prom_pedido || 0)}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedores activos</p><p className="text-lg font-bold text-primary">{kpis?.proveedores_activos ?? 0}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">OC atrasadas</p><p className={"text-lg font-bold " + ((kpis?.ordenes_atrasadas || 0) > 0 ? "text-red-500" : "text-gray-700")}>{kpis?.ordenes_atrasadas ?? 0}</p></div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-fit">
          {(["proveedor", "categoria", "varianza"] as ReportSubTab[]).map(rt => (
            <button key={rt} onClick={() => setReportTab(rt)}
              className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all " + (reportTab === rt ? "bg-white dark:bg-slate-700 shadow-sm" : "text-gray-500")}>{rt.charAt(0).toUpperCase() + rt.slice(1)}</button>
          ))}
        </div>
        {reportTab === "proveedor" && (
          <button className="btn-outline text-sm" onClick={handleExportSupplier} disabled={exportingSupplier}>
            {exportingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar PDF
          </button>
        )}
        {reportTab === "varianza" && (
          <button className="btn-outline text-sm" onClick={handleExportVariance} disabled={exportingVariance}>
            {exportingVariance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar PDF
          </button>
        )}
      </div>

      {reportTab === "proveedor" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="table-cell">Proveedor</th>
              <th className="table-cell text-right">Cant. OC</th>
              <th className="table-cell text-right">Total Gs</th>
              <th className="table-cell text-right">% del total</th>
            </tr></thead>
            <tbody>
              {spendSupplier.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Sin ordenes de compra registradas</td></tr>
              ) : spendSupplier.map((g: any) => (
                <tr key={g.supplier_id} className="table-row">
                  <td className="table-td font-medium">{g.razon_social}</td>
                  <td className="table-td text-right">{g.cantidad_ordenes}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(g.total_gastado)}</td>
                  <td className="table-td text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs font-bold">{totalGastoSupplier > 0 ? ((g.total_gastado / totalGastoSupplier) * 100).toFixed(1) + "%" : "0%"}</span>
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 w-16 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: (g.total_gastado / Math.max(totalGastoSupplier, 1)) * 100 + "%" }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportTab === "categoria" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="table-cell">Categoria</th>
              <th className="table-cell text-right">Productos</th>
              <th className="table-cell text-right">Total Gs</th>
              <th className="table-cell text-right">% del total</th>
            </tr></thead>
            <tbody>
              {spendCategory.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Sin datos por categoria</td></tr>
              ) : spendCategory.map((c: any) => (
                <tr key={c.category_id || "sin-categoria"} className="table-row">
                  <td className="table-td font-medium">{c.categoria_nombre}</td>
                  <td className="table-td text-right">{c.cantidad_productos}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(c.total_gastado)}</td>
                  <td className="table-td text-right">
                    <span className="text-xs font-bold">{totalGastoCategory > 0 ? ((c.total_gastado / totalGastoCategory) * 100).toFixed(1) + "%" : "0%"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportTab === "varianza" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="table-cell">Producto</th>
              <th className="table-cell text-right">Precio prom.</th>
              <th className="table-cell text-right">Min</th>
              <th className="table-cell text-right">Max</th>
              <th className="table-cell text-right">Var. %</th>
              <th className="table-cell">Ult. proveedor</th>
            </tr></thead>
            <tbody>
              {variance.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Sin datos suficientes (se necesita mas de una compra por producto)</td></tr>
              ) : variance.map((v: any) => (
                <tr key={v.product_id} className="table-row">
                  <td className="table-td font-medium">{v.nombre}</td>
                  <td className="table-td text-right font-mono">{formatPYG(v.average_price)}</td>
                  <td className="table-td text-right font-mono">{formatPYG(v.min_price)}</td>
                  <td className="table-td text-right font-mono">{formatPYG(v.max_price)}</td>
                  <td className={"table-td text-right font-bold " + (v.variance_pct >= 20 ? "text-red-500" : "text-gray-700")}>{Number(v.variance_pct).toFixed(1)}%</td>
                  <td className="table-td text-sm text-gray-500">{v.last_supplier || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CotizacionesTab({ suppliers, products }: { suppliers: Supplier[]; products: Product[] }) {
  const toast = useToast()
  const [rfqs, setRfqs] = useState<PurchaseRfq[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetail, setShowDetail] = useState<PurchaseRfqWithDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [respondingSupplierId, setRespondingSupplierId] = useState<string | null>(null)
  const [responseItems, setResponseItems] = useState<{ product_id: string; nombre: string; precio_unitario: number }[]>([])
  const [responsePlazo, setResponsePlazo] = useState<number | "">("")
  const [responseSaving, setResponseSaving] = useState(false)
  const [awarding, setAwarding] = useState<string | null>(null)

  const [motivo, setMotivo] = useState("")
  const [fechaLimite, setFechaLimite] = useState("")
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [rfqItems, setRfqItems] = useState<{ product_id: string; nombre: string; cantidad_solicitada: number }[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    api.purchases.rfqs.list(statusFilter || undefined).then(setRfqs).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [statusFilter])

  const resetCreateForm = () => {
    setMotivo(""); setFechaLimite(""); setSelectedSuppliers([]); setRfqItems([]); setProductSearch("")
  }

  const addRfqItem = (p: Product) => {
    if (rfqItems.some(i => i.product_id === p.id)) return
    setRfqItems(prev => [...prev, { product_id: p.id, nombre: p.nombre, cantidad_solicitada: 1 }])
    setProductSearch("")
  }

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const handleCreate = async () => {
    if (rfqItems.length === 0) { toast.error("Faltan productos", "Agrega al menos un producto"); return }
    if (selectedSuppliers.length < 2) { toast.error("Faltan proveedores", "Elegi al menos 2 proveedores para poder comparar"); return }
    setCreating(true)
    try {
      await api.purchases.rfqs.create({
        motivo: motivo || undefined,
        fecha_limite: fechaLimite || undefined,
        items: rfqItems.map(i => ({ product_id: i.product_id, cantidad_solicitada: i.cantidad_solicitada })),
        supplier_ids: selectedSuppliers,
      })
      toast.success("Cotizacion creada", "Se invito a los proveedores seleccionados")
      setShowCreateModal(false)
      resetCreateForm()
      load()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo crear la cotizacion")
    } finally { setCreating(false) }
  }

  const openDetail = async (rfq: PurchaseRfq) => {
    setDetailLoading(true)
    setShowDetail(null)
    try {
      const full = await api.purchases.rfqs.get(rfq.id)
      setShowDetail(full)
    } catch {
      toast.error("Error", "No se pudo cargar la cotizacion")
    } finally { setDetailLoading(false) }
  }

  const openResponseForm = (supplierId: string) => {
    if (!showDetail) return
    setRespondingSupplierId(supplierId)
    setResponsePlazo("")
    setResponseItems(showDetail.items.map(i => {
      const prod = products.find(p => p.id === i.product_id)
      return { product_id: i.product_id, nombre: prod?.nombre || i.descripcion || i.product_id, precio_unitario: 0 }
    }))
  }

  const handleSubmitResponse = async () => {
    if (!showDetail || !respondingSupplierId) return
    if (responseItems.some(i => !i.precio_unitario || i.precio_unitario <= 0)) {
      toast.error("Faltan precios", "Cargá un precio para cada producto"); return
    }
    setResponseSaving(true)
    try {
      const updated = await api.purchases.rfqs.submitResponse(showDetail.id, respondingSupplierId, {
        plazo_entrega_dias: responsePlazo === "" ? undefined : Number(responsePlazo),
        items: responseItems.map(i => ({ product_id: i.product_id, precio_unitario: i.precio_unitario })),
      })
      setShowDetail(updated)
      setRespondingSupplierId(null)
      toast.success("Respuesta cargada")
      load()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo cargar la respuesta")
    } finally { setResponseSaving(false) }
  }

  const handleAward = async (supplierId: string) => {
    if (!showDetail) return
    setAwarding(supplierId)
    try {
      const po = await api.purchases.rfqs.award(showDetail.id, supplierId)
      toast.success("Adjudicado", `Se genero la orden de compra ${po.numero}`)
      const updated = await api.purchases.rfqs.get(showDetail.id)
      setShowDetail(updated)
      load()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo adjudicar")
    } finally { setAwarding(null) }
  }

  const statusColors: Record<string, string> = {
    enviada: "bg-blue-50 text-blue-600",
    evaluando: "bg-amber-50 text-amber-600",
    adjudicada: "bg-green-50 text-green-600",
    cancelada: "bg-red-50 text-red-600",
  }

  const filteredProducts = productSearch.trim().length > 1
    ? products.filter(p => p.nombre?.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8)
    : []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {["", "enviada", "evaluando", "adjudicada", "cancelada"].map(st => (
            <button key={st} onClick={() => setStatusFilter(st)}
              className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all " + (statusFilter === st ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700")}>
              {st === "" ? "Todas" : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}><Plus className="w-4 h-4" />Nueva cotizacion</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-header">
            <th className="table-cell">Numero</th>
            <th className="table-cell">Fecha</th>
            <th className="table-cell">Motivo</th>
            <th className="table-cell">Estado</th>
            <th className="table-cell"></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : rfqs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Sin cotizaciones todavia. Creá una para comparar precios entre proveedores.</td></tr>
            ) : rfqs.map(r => (
              <tr key={r.id} className="table-row cursor-pointer" onClick={() => openDetail(r)}>
                <td className="table-td font-mono text-sm font-bold">{r.numero}</td>
                <td className="table-td text-sm">{formatDate(r.fecha)}</td>
                <td className="table-td text-sm text-gray-500">{r.motivo || "-"}</td>
                <td className="table-td"><span className={"px-2 py-0.5 rounded-full text-xs font-bold " + (statusColors[r.estado] || "bg-gray-50 text-gray-600")}>{r.estado}</span></td>
                <td className="table-td text-right"><Eye className="w-4 h-4 text-gray-400 inline" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); resetCreateForm() }} title="Nueva cotizacion comparativa" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Motivo</label>
              <input className="input-field" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="label-field">Fecha limite de respuesta</label>
              <input type="date" className="input-field" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-field">Productos a cotizar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Buscar producto por nombre o SKU..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>
            {filteredProducts.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto">
                {filteredProducts.map(p => (
                  <div key={p.id} className="px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between" onClick={() => addRfqItem(p)}>
                    <span>{p.nombre}</span><span className="text-gray-400">{p.sku}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {rfqItems.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="table-header"><th className="table-cell">Producto</th><th className="table-cell text-right">Cantidad</th><th className="table-cell"></th></tr></thead>
                <tbody>
                  {rfqItems.map((item, i) => (
                    <tr key={item.product_id} className="table-row">
                      <td className="table-td">{item.nombre}</td>
                      <td className="table-td text-right">
                        <input type="number" className="input-field w-24 text-right" value={item.cantidad_solicitada}
                          onChange={e => setRfqItems(prev => prev.map((x, j) => j === i ? { ...x, cantidad_solicitada: Number(e.target.value) } : x))} />
                      </td>
                      <td className="table-td"><button className="btn-ghost !p-1" onClick={() => setRfqItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-red-500" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="label-field">Proveedores a invitar (minimo 2)</label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-40 overflow-y-auto">
              {suppliers.map(s => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input type="checkbox" checked={selectedSuppliers.includes(s.id)} onChange={() => toggleSupplier(s.id)} className="rounded" />
                  {s.razon_social}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-outline" onClick={() => { setShowCreateModal(false); resetCreateForm() }}>Cancelar</button>
            <button className="btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar cotizacion"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showDetail || detailLoading} onClose={() => { setShowDetail(null); setRespondingSupplierId(null) }} title={showDetail ? `Cotizacion ${showDetail.numero}` : ""} size="xl">
        {detailLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : showDetail && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className={"px-2 py-0.5 rounded-full text-xs font-bold " + (statusColors[showDetail.estado] || "bg-gray-50 text-gray-600")}>{showDetail.estado}</span>
              {showDetail.motivo && <span className="text-sm text-gray-500">{showDetail.motivo}</span>}
              {showDetail.fecha_limite && <span className="text-xs text-gray-400">Limite: {formatDate(showDetail.fecha_limite)}</span>}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Productos solicitados</p>
              <div className="flex flex-wrap gap-2">
                {showDetail.items.map(i => (
                  <span key={i.id} className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs">
                    {products.find(p => p.id === i.product_id)?.nombre || i.descripcion || i.product_id} &times; {i.cantidad_solicitada}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Comparacion de proveedores</p>
              <div className="space-y-3">
                {[...showDetail.responses].sort((a, b) => (a.total_cotizado ?? Infinity) - (b.total_cotizado ?? Infinity)).map((r, idx) => {
                  const isBest = idx === 0 && r.total_cotizado != null
                  return (
                    <div key={r.id} className={"border rounded-lg p-3 " + (r.estado === "ganadora" ? "border-green-400 bg-green-50 dark:bg-green-900/20" : isBest ? "border-primary" : "border-gray-200 dark:border-gray-700")}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-sm">{r.supplier?.razon_social || r.supplier_id}</p>
                          <p className="text-xs text-gray-400">
                            {r.estado === "invitada" && "Esperando respuesta"}
                            {r.estado === "respondida" && `Respondio ${r.fecha_respuesta ? formatDate(r.fecha_respuesta) : ""}${r.plazo_entrega_dias ? ` · ${r.plazo_entrega_dias}d entrega` : ""}`}
                            {r.estado === "ganadora" && "Adjudicado"}
                            {r.estado === "descartada" && "No seleccionado"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {r.total_cotizado != null && (
                            <span className={"font-mono font-bold " + (isBest ? "text-primary text-lg" : "text-gray-700 dark:text-gray-300")}>{formatPYG(r.total_cotizado)}</span>
                          )}
                          {r.estado === "invitada" && showDetail.estado !== "adjudicada" && (
                            <button className="btn-outline text-xs" onClick={() => openResponseForm(r.supplier_id)}>Cargar cotizacion</button>
                          )}
                          {r.estado === "respondida" && showDetail.estado !== "adjudicada" && (
                            <button className="btn-primary text-xs" onClick={() => handleAward(r.supplier_id)} disabled={awarding === r.supplier_id}>
                              {awarding === r.supplier_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Adjudicar"}
                            </button>
                          )}
                        </div>
                      </div>

                      {respondingSupplierId === r.supplier_id && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                          {responseItems.map((item, i) => (
                            <div key={item.product_id} className="flex items-center gap-2">
                              <span className="text-xs flex-1">{item.nombre}</span>
                              <input type="number" className="input-field w-32 text-right text-sm" placeholder="Precio unit." value={item.precio_unitario || ""}
                                onChange={e => setResponseItems(prev => prev.map((x, j) => j === i ? { ...x, precio_unitario: Number(e.target.value) } : x))} />
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <span className="text-xs flex-1">Plazo de entrega (dias)</span>
                            <input type="number" className="input-field w-32 text-right text-sm" value={responsePlazo}
                              onChange={e => setResponsePlazo(e.target.value === "" ? "" : Number(e.target.value))} />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button className="btn-outline text-xs" onClick={() => setRespondingSupplierId(null)}>Cancelar</button>
                            <button className="btn-primary text-xs" onClick={handleSubmitResponse} disabled={responseSaving}>
                              {responseSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Guardar respuesta"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function PresupuestoTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const [budgets, setBudgets] = useState<PurchaseBudget[]>([])
  const [consumption, setConsumption] = useState<PurchaseBudgetConsumption[]>([])
  const [loading, setLoading] = useState(true)
  const [anioFilter, setAnioFilter] = useState(new Date().getFullYear())
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PurchaseBudget | null>(null)
  const [saving, setSaving] = useState(false)

  const [nombre, setNombre] = useState("")
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState<number | "">("")
  const [tipo, setTipo] = useState<"mensual" | "anual">("mensual")
  const [monto, setMonto] = useState<number | "">("")
  const [departamento, setDepartamento] = useState("")
  const [observaciones, setObservaciones] = useState("")

  const load = () => {
    setLoading(true)
    Promise.all([
      api.purchases.budgets.list(anioFilter),
      api.purchases.budgets.consumption(anioFilter),
    ]).then(([b, c]) => { setBudgets(b); setConsumption(c) }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [anioFilter])

  const consumptionByBudget = useMemo(() => {
    const map: Record<string, PurchaseBudgetConsumption> = {}
    consumption.forEach(c => { map[c.budget_id] = c })
    return map
  }, [consumption])

  const resetForm = () => {
    setNombre(""); setAnio(new Date().getFullYear()); setMes(""); setTipo("mensual"); setMonto(""); setDepartamento(""); setObservaciones("")
    setEditing(null)
  }

  const openEdit = (b: PurchaseBudget) => {
    setEditing(b)
    setNombre(b.nombre); setAnio(b.anio); setMes(b.mes ?? ""); setTipo(b.mes ? "mensual" : "anual")
    setMonto(Number(b.monto_presupuestado)); setDepartamento(b.departamento || ""); setObservaciones(b.observaciones || "")
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!nombre || !monto) { toast.error("Faltan datos", "Nombre y monto presupuestado son obligatorios"); return }
    setSaving(true)
    try {
      if (editing) {
        await api.purchases.budgets.update(editing.id, {
          nombre, monto_presupuestado: Number(monto), observaciones: observaciones || undefined,
        })
        toast.success("Presupuesto actualizado")
      } else {
        await api.purchases.budgets.create({
          nombre, anio, mes: tipo === "mensual" ? (mes === "" ? undefined : Number(mes)) : undefined,
          tipo, monto_presupuestado: Number(monto), departamento: departamento || undefined, observaciones: observaciones || undefined,
        })
        toast.success("Presupuesto creado")
      }
      setShowModal(false)
      resetForm()
      load()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo guardar el presupuesto")
    } finally { setSaving(false) }
  }

  const handleDelete = async (b: PurchaseBudget) => {
    const ok = await confirm({ title: "Eliminar presupuesto?", message: `Se eliminara el presupuesto "${b.nombre}". Esta accion no se puede deshacer.`, variant: "danger" })
    if (!ok) return
    try {
      await api.purchases.budgets.delete(b.id)
      toast.success("Presupuesto eliminado")
      load()
    } catch (e: any) {
      toast.error("Error", e?.message || "No se pudo eliminar")
    }
  }

  const mesNombre = (m?: number | null) => m ? ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1] : "Anual"

  const totalPresupuestado = budgets.filter(b => b.activo).reduce((a, b) => a + Number(b.monto_presupuestado || 0), 0)
  const totalEjecutado = budgets.filter(b => b.activo).reduce((a, b) => a + Number(consumptionByBudget[b.id]?.monto_ejecutado ?? b.monto_ejecutado ?? 0), 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <KPICard icon={DollarSign} label="Presupuestado" value={formatPYG(totalPresupuestado)} color="blue" />
        <KPICard icon={TrendingDown} label="Ejecutado" value={formatPYG(totalEjecutado)} color={totalEjecutado > totalPresupuestado ? "red" : "green"} />
        <KPICard icon={Percent} label="% consumido" value={totalPresupuestado > 0 ? `${((totalEjecutado / totalPresupuestado) * 100).toFixed(1)}%` : "0%"} color="purple" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Año</label>
          <select className="input-field w-28" value={anioFilter} onChange={e => setAnioFilter(Number(e.target.value))}>
            {[anioFilter - 1, anioFilter, anioFilter + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}><Plus className="w-4 h-4" />Nuevo presupuesto</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="table-header">
            <th className="table-cell">Nombre</th>
            <th className="table-cell">Periodo</th>
            <th className="table-cell">Departamento</th>
            <th className="table-cell text-right">Presupuestado</th>
            <th className="table-cell text-right">Ejecutado</th>
            <th className="table-cell">Consumo</th>
            <th className="table-cell">Acciones</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : budgets.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Sin presupuestos cargados para {anioFilter}</td></tr>
            ) : budgets.map(b => {
              const cons = consumptionByBudget[b.id]
              const ejecutado = Number(cons?.monto_ejecutado ?? b.monto_ejecutado ?? 0)
              const pct = cons?.porcentaje_ejecutado != null ? Number(cons.porcentaje_ejecutado) : (Number(b.monto_presupuestado) > 0 ? (ejecutado / Number(b.monto_presupuestado)) * 100 : 0)
              const overBudget = pct >= 100
              const warnBudget = pct >= 80 && pct < 100
              return (
                <tr key={b.id} className="table-row">
                  <td className="table-td font-medium">{b.nombre}{!b.activo && <span className="ml-2 text-xs text-gray-400">(inactivo)</span>}</td>
                  <td className="table-td text-sm">{b.anio} · {mesNombre(b.mes)}</td>
                  <td className="table-td text-sm text-gray-500">{b.departamento || (b.categoria_id ? "Por categoria" : "General")}</td>
                  <td className="table-td text-right font-mono">{formatPYG(b.monto_presupuestado)}</td>
                  <td className="table-td text-right font-mono">{formatPYG(ejecutado)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 w-20 overflow-hidden">
                        <div className={"h-full rounded-full " + (overBudget ? "bg-red-500" : warnBudget ? "bg-amber-500" : "bg-green-500")} style={{ width: Math.min(pct, 100) + "%" }} />
                      </div>
                      <span className={"text-xs font-bold " + (overBudget ? "text-red-500" : warnBudget ? "text-amber-500" : "text-gray-500")}>{pct.toFixed(0)}%</span>
                      {overBudget && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1">
                      <button className="btn-ghost" onClick={() => openEdit(b)} title="Editar"><Edit3 className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400" onClick={() => handleDelete(b)} title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm() }} title={editing ? "Editar presupuesto" : "Nuevo presupuesto"} size="md">
        <div className="space-y-4">
          <div>
            <label className="label-field">Nombre</label>
            <input className="input-field" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Compras Almacen 2026" />
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Año</label>
                <input type="number" className="input-field" value={anio} onChange={e => setAnio(Number(e.target.value))} />
              </div>
              <div>
                <label className="label-field">Tipo</label>
                <select className="input-field" value={tipo} onChange={e => setTipo(e.target.value as any)}>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              {tipo === "mensual" && (
                <div>
                  <label className="label-field">Mes</label>
                  <select className="input-field" value={mes} onChange={e => setMes(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">Seleccionar...</option>
                    {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label-field">Departamento (opcional)</label>
                <input className="input-field" value={departamento} onChange={e => setDepartamento(e.target.value)} placeholder="Ej. Almacen" />
              </div>
            </div>
          )}
          <div>
            <label className="label-field">Monto presupuestado (Gs.)</label>
            <input type="number" className="input-field" value={monto} onChange={e => setMonto(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <label className="label-field">Observaciones</label>
            <textarea className="input-field" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>
          {departamento && (
            <p className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Los presupuestos por departamento no se calculan automaticamente todavia — el consumo se actualiza a mano.</p>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-outline" onClick={() => { setShowModal(false); resetForm() }}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

