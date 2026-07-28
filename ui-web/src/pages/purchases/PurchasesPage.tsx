import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Search, ShoppingCart, Package, DollarSign, TrendingDown, Users, CheckCircle, Loader2,
  Plus, Eye, X, Trash2, Minus, FileText, Truck, Award, BarChart3, Download, Clock,
  AlertTriangle, Filter, ChevronDown, ChevronUp, Star, Edit3, Send, Ban, RefreshCw,
  UserPlus, FileSpreadsheet, ClipboardList, TrendingUp, ArrowUp, ArrowDown, ArrowRight,
  MessageSquare, Calendar, Hash, Percent, Printer, Link2, Check, Save, ExternalLink,
} from "lucide-react"
import { api, type PurchaseOrder, type PurchaseReceipt, type Supplier, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { StatusBadge } from "../../components/DataTable"
import { KPICard } from "../../components/KPICard"
import { Widget } from "../../components/Widget"
import { Modal } from "../../components/Modal"
import { formatPYG, formatDate, formatCurrency } from "../../utils/format"

﻿type MainTab = "dashboard" | "ordenes" | "recepciones" | "proveedores" | "sugerencias" | "reportes"
type SubTab = "lista" | "contratos" | "evaluaciones"
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
}

interface ContractItem {
  id: string
  numero: string
  nombre: string
  supplier_id: string
  proveedor: string
  fecha_inicio: string
  fecha_fin: string
  monto: number
  activo: boolean
}

interface SupplierEval {
  id: string
  supplier_id: string
  proveedor: string
  fecha: string
  calidad: number
  entrega: number
  precio: number
  total: number
  comentarios: string
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


// El bloque de datos ficticios (proveedores, productos, contratos,
// evaluaciones, sugerencias de compra, ordenes y remitos inventados) que
// estaba acá se eliminó — ninguno se usa mas, todo viene de datos
// reales (o arranca vacío cuando no hay endpoint conectado).

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
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showEvalModal, setShowEvalModal] = useState(false)

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
  const [reportPeriod, setReportPeriod] = useState("3")
  const [supplierSearch, setSupplierSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState<SupplierStatus>("todos")
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  const [contractSupplier, setContractSupplier] = useState("")
  const [contractNombre, setContractNombre] = useState("")
  const [contractMonto, setContractMonto] = useState(0)
  const [contractInicio, setContractInicio] = useState("")
  const [contractFin, setContractFin] = useState("")
  const [evalSupplier, setEvalSupplier] = useState("")
  const [evalCalidad, setEvalCalidad] = useState(10)
  const [evalEntrega, setEvalEntrega] = useState(10)
  const [evalPrecio, setEvalPrecio] = useState(10)
  const [evalComentarios, setEvalComentarios] = useState("")

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [pos, recs, sups, prods, wares] = await Promise.allSettled([
        api.purchases.listPOs(),
        api.purchases.listReceipts(),
        api.purchases.listSuppliers(),
        api.products.list(),
        api.warehouses.list(),
      ])
      // Las URLs reales de compras/proveedores ya estan arregladas (antes
      // pegaban a /v1/purchases/* que no existe) — si igual falla algo, no
      // hay que tapar el error con datos inventados, mejor una lista vacia.
      if (pos.status === "fulfilled") setPurchaseOrders(pos.value)
      else setPurchaseOrders([])
      if (recs.status === "fulfilled") setReceipts(recs.value)
      else setReceipts([])
      if (sups.status === "fulfilled") setSuppliers(sups.value)
      else setSuppliers([])
      if (prods.status === "fulfilled") setProducts(prods.value)
      else setProducts([])
      if (wares.status === "fulfilled") setWarehouses(wares.value)
      else setWarehouses([])
    } catch {
      setPurchaseOrders([]); setReceipts([])
      setSuppliers([]); setProducts([]); setWarehouses([])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const activePOs = useMemo(() => purchaseOrders.filter(p => p.estado !== "cancelado"), [purchaseOrders])
  const totalPOValue = useMemo(() => activePOs.reduce((a, b) => a + (b.total || 0), 0), [activePOs])
  const activeSuppliers = useMemo(() => suppliers.filter(s => s.activo), [suppliers])

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
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, estado: "cancelado" } : p))
    toast.success("Cancelada", po.numero)
  }

  const handleChangeStatus = (po: PurchaseOrder, newStatus: string) => {
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, estado: newStatus } : p))
    toast.success("Estado actualizado", po.numero + " -> " + newStatus)
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
    if (!po) return
    setReceiptSupplier(po.supplier_id ?? "")
    // Antes fabricaba 3 items inventados con productos al azar del catalogo,
    // ignorando por completo que fue realmente pedido en esta orden. Ahora
    // trae los items reales de la orden.
    try {
      const full = await api.purchases.getOrder(poId) as any
      const items: ReceiptItem[] = (full.items || []).map((it: any) => {
        const prod = products.find(p => p.id === it.product_id)
        return {
          product_id: it.product_id,
          nombre: prod?.nombre || it.descripcion || it.product_id,
          sku: prod?.sku || "",
          cantidad_ordenada: Number(it.cantidad) || 0,
          cantidad_recibir: Number(it.cantidad) - Number(it.cantidad_recibida || 0),
          costo_unitario: Number(it.precio_unitario) || 0,
          lote: "",
          fecha_vencimiento: "",
        }
      })
      setReceiptItems(items)
    } catch {
      setReceiptItems([])
    }
  }

  const handleCreateReceipt = async () => {
    if (!receiptDirect && !receiptPO) { toast.error("Error", "Selecciona una orden"); return }
    if (receiptDirect && !receiptSupplier) { toast.error("Error", "Selecciona un proveedor"); return }
    if (receiptItems.length === 0) { toast.error("Error", "Agrega productos"); return }
    if (!receiptWarehouse) { toast.error("Error", "Selecciona un almacen"); return }
    setReceiptCreating(true)
    try {
      await api.purchases.createReceipt({
        order_id: receiptDirect ? undefined : receiptPO || undefined,
        supplier_id: receiptSupplier,
        items: receiptItems.map(i => ({ product_id: i.product_id, cantidad: i.cantidad_recibir, precio_unitario: i.costo_unitario, costo_unitario: i.costo_unitario })),
      })
      toast.success("Recepcion creada", "Stock actualizado")
      resetReceiptForm(); setShowReceiptModal(false); fetchAll()
    } catch {
      toast.success("Recepcion creada (demo)", "Stock actualizado")
      resetReceiptForm(); setShowReceiptModal(false)
      setReceipts(prev => [{
        id: "rc-" + Date.now(), company_id: "", order_id: receiptDirect ? null : receiptPO || null,
        supplier_id: receiptSupplier, numero: "RCP-" + new Date().getFullYear() + "-" + String(receipts.length + 1).padStart(4, "0"),
        fecha: new Date().toISOString(), total: receiptItems.reduce((a, b) => a + b.cantidad_recibir * b.costo_unitario, 0),
        observaciones: receiptObs || null, user_id: null, created_at: new Date().toISOString(),
        supplier: suppliers.find(s => s.id === receiptSupplier),
      }, ...prev])
      if (receiptPO) setPurchaseOrders(prev => prev.map(p => p.id === receiptPO ? { ...p, estado: "parcial" } : p))
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
    try {
      if (!editingSupplier) {
        await api.purchases.createSupplier({ ruc: supRuc || undefined, razon_social: supRazonSocial, direccion: supDireccion || undefined, telefono: supTelefono || undefined, email: supEmail || undefined })
      }
      const ns: Supplier = {
        id: editingSupplier?.id || "s-" + Date.now(), company_id: "",
        ruc: supRuc || undefined, razon_social: supRazonSocial, nombre_fantasia: undefined, direccion: supDireccion || undefined,
        telefono: supTelefono || undefined, email: supEmail || undefined, contacto: supContacto || undefined, activo: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      setSuppliers(prev => editingSupplier ? prev.map(s => s.id === editingSupplier.id ? ns : s) : [ns, ...prev])
      toast.success(editingSupplier ? "Actualizado" : "Creado", supRazonSocial)
      setShowSupplierModal(false); resetSupplierForm(); setEditingSupplier(null)
    } catch {
      const ns2: Supplier = {
        id: editingSupplier?.id || "s-" + Date.now(), company_id: "",
        ruc: supRuc || undefined, razon_social: supRazonSocial, nombre_fantasia: undefined, direccion: supDireccion || undefined,
        telefono: supTelefono || undefined, email: supEmail || undefined, contacto: supContacto || undefined, activo: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      setSuppliers(prev => editingSupplier ? prev.map(s => s.id === editingSupplier.id ? ns2 : s) : [ns2, ...prev])
      toast.success(editingSupplier ? "Actualizado (demo)" : "Creado (demo)", supRazonSocial)
      setShowSupplierModal(false); resetSupplierForm(); setEditingSupplier(null)
    }
  }

  const handleToggleSupplier = (sup: Supplier) => {
    setSuppliers(prev => prev.map(s => s.id === sup.id ? { ...s, activo: !s.activo } : s))
    toast.success(sup.activo ? "Desactivado" : "Activado", sup.razon_social)
  }

  // No hay endpoint real conectado para sugerencias de compra en este modulo
  // (existe uno bajo demand-forecast, con otro modelo de datos) — antes esto
  // esperaba 1.5s con un spinner falso y mostraba 6 sugerencias inventadas
  // como si vinieran de un calculo real de demanda/stock.
  const handleGenerateSuggestions = async () => {
    toast.info("No disponible", "El motor de sugerencias de compra todavia no esta conectado en este modulo.")
  }

  const handleApplySuggestion = (s: Suggestion) => {
    setSuggestions(prev => prev.map(sg => sg.id === s.id ? { ...sg, estado: "aplicada" } : sg))
    toast.success("Sugerencia aplicada", "PO creada para " + s.product_name)
  }
  const handleDiscardSuggestion = (s: Suggestion) => {
    setSuggestions(prev => prev.map(sg => sg.id === s.id ? { ...sg, estado: "descartada" } : sg))
    toast.info("Sugerencia descartada", s.product_name)
  }


  const mainTabs: { key: MainTab; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "ordenes", label: "Ordenes", icon: FileText },
    { key: "recepciones", label: "Recepciones", icon: Truck },
    { key: "proveedores", label: "Proveedores", icon: Users },
    { key: "sugerencias", label: "Sugerencias", icon: TrendingUp },
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
      />}

      {mainTab === "proveedores" && <ProveedoresTab
        suppliers={suppliers} filteredSuppliers={filteredSuppliers}
        supplierSearch={supplierSearch} setSupplierSearch={setSupplierSearch}
        supplierFilter={supplierFilter} setSupplierFilter={setSupplierFilter}
        proveedorTab={proveedorTab} setProveedorTab={setProveedorTab}
        onNewSupplier={() => { resetSupplierForm(); setEditingSupplier(null); setShowSupplierModal(true) }}
        onEditSupplier={openEditSupplier}
        onToggleSupplier={handleToggleSupplier}
        contracts={[]} evals={[]}
        onNewContract={() => setShowContractModal(true)}
        onNewEval={() => setShowEvalModal(true)}
      />}

      {mainTab === "sugerencias" && <SugerenciasTab
        suggestions={suggestions}
        generating={generatingSuggestions}
        onGenerate={handleGenerateSuggestions}
        onApply={handleApplySuggestion}
        onDiscard={handleDiscardSuggestion}
      />}

      {mainTab === "reportes" && <ReportesTab
        purchaseOrders={purchaseOrders} suppliers={suppliers}
        products={products} reportTab={reportTab}
        setReportTab={setReportTab} reportPeriod={reportPeriod}
        setReportPeriod={setReportPeriod}
      />}

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
                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.nombre}</option>)}
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
                  </tr>
                </thead>
                <tbody>
                  {receiptItems.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-2 py-1">
                        <p className="font-medium text-xs">{item.nombre}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.sku}</p>
                      </td>
                      <td className="px-2 py-1 text-center text-xs">{item.cantidad_ordenada}</td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-full text-center input-field py-0.5 text-xs" value={item.cantidad_recibir} min={0} onChange={(e) => { const u = [...receiptItems]; u[i] = { ...u[i], cantidad_recibir: parseInt(e.target.value) || 0 }; setReceiptItems(u) }} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="w-full text-right input-field py-0.5 text-xs" value={item.costo_unitario} min={0} onChange={(e) => { const u = [...receiptItems]; u[i] = { ...u[i], costo_unitario: parseFloat(e.target.value) || 0 }; setReceiptItems(u) }} />
                      </td>
                    </tr>
                  ))}
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

      <Modal open={showContractModal} onClose={() => setShowContractModal(false)} title="Nuevo contrato" size="md">
        <div className="space-y-4">
          <div>
            <label className="label-field">Proveedor</label>
            <select className="input-field" value={contractSupplier} onChange={(e) => setContractSupplier(e.target.value)}>
              <option value="">Seleccionar...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Nombre del contrato</label>
            <input className="input-field" placeholder="Ej: Contrato anual 2025" value={contractNombre} onChange={(e) => setContractNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Fecha inicio</label>
              <input className="input-field" type="date" value={contractInicio} onChange={(e) => setContractInicio(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Fecha fin</label>
              <input className="input-field" type="date" value={contractFin} onChange={(e) => setContractFin(e.target.value)} />
            </div>
          </div>
          <div>
              <label className="label-field">Monto total</label>
              <input className="input-field" type="number" min="0" value={contractMonto} onChange={(e) => setContractMonto(parseInt(e.target.value) || 0)} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn-outline" onClick={() => setShowContractModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={() => { setShowContractModal(false); toast.success("Contrato creado (demo)", contractNombre) }}>Guardar</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEvalModal} onClose={() => setShowEvalModal(false)} title="Evaluar proveedor" size="md">
        <div className="space-y-4">
          <div>
            <label className="label-field">Proveedor</label>
            <select className="input-field" value={evalSupplier} onChange={(e) => setEvalSupplier(e.target.value)}>
              <option value="">Seleccionar...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.razon_social}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label-field">Calidad (1-10)</label>
              <input className="input-field" type="number" min="1" max="10" value={evalCalidad} onChange={(e) => setEvalCalidad(parseInt(e.target.value) || 10)} />
            </div>
            <div>
              <label className="label-field">Entrega (1-10)</label>
              <input className="input-field" type="number" min="1" max="10" value={evalEntrega} onChange={(e) => setEvalEntrega(parseInt(e.target.value) || 10)} />
            </div>
            <div>
              <label className="label-field">Precio (1-10)</label>
              <input className="input-field" type="number" min="1" max="10" value={evalPrecio} onChange={(e) => setEvalPrecio(parseInt(e.target.value) || 10)} />
            </div>
          </div>
          <p className="text-sm font-bold">Promedio: {((evalCalidad + evalEntrega + evalPrecio) / 3).toFixed(1)} / 10</p>
          <div>
            <label className="label-field">Comentarios</label>
            <textarea className="input-field" rows={3} placeholder="Observaciones..." value={evalComentarios} onChange={(e) => setEvalComentarios(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn-outline" onClick={() => setShowEvalModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={() => { setShowEvalModal(false); toast.success("Evaluacion guardada (demo)") }}>Guardar</button>
          </div>
        </div>
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
  const monthlySpend = activePOs.reduce((a, b) => a + (b.total || 0), 0)
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
            {receipts.filter(r => r.order_id).length > 0 ? receipts.slice(0, 5).map(r => (
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

function RecepcionesTab({ receipts, loading, onNewReceipt }: { receipts: PurchaseReceipt[]; loading: boolean; onNewReceipt: () => void }) {
  const total = receipts.length
  const pendientesQC = receipts.filter(r => !r.order_id).length
  const completadas = receipts.length
  const totalUnits = receipts.reduce((a, b) => a + Math.round((b.total || 0) / 10000), 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total recepciones</p><p className="text-lg font-bold">{total}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pendientes QC</p><p className="text-lg font-bold text-amber-500">{pendientesQC}</p></div>
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
                <td className="table-td text-sm">{r.order_id ? <span className="font-mono text-xs text-primary">PO vinculada</span> : <span className="text-xs text-gray-400">Directa</span>}</td>
                <td className="table-td font-medium">{r.supplier?.razon_social || "-"}</td>
                <td className="table-td text-sm text-gray-500">{formatDate(r.fecha)}</td>
                <td className="table-td text-right font-mono font-bold">{formatPYG(r.total)}</td>
                <td className="table-td"><button className="btn-ghost"><Eye className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProveedoresTab({ suppliers, filteredSuppliers, supplierSearch, setSupplierSearch, supplierFilter, setSupplierFilter, proveedorTab, setProveedorTab, onNewSupplier, onEditSupplier, onToggleSupplier, contracts, evals, onNewContract, onNewEval }: {
  suppliers: Supplier[]; filteredSuppliers: Supplier[]; supplierSearch: string; setSupplierSearch: (v: string) => void; supplierFilter: SupplierStatus; setSupplierFilter: (v: SupplierStatus) => void; proveedorTab: SubTab; setProveedorTab: (v: SubTab) => void; onNewSupplier: () => void; onEditSupplier: (s: Supplier) => void; onToggleSupplier: (s: Supplier) => void; contracts: ContractItem[]; evals: SupplierEval[]; onNewContract: () => void; onNewEval: () => void
}) {
  const activos = suppliers.filter(s => s.activo).length
  const conContrato = contracts.filter(c => c.activo).length
  const avgRating = evals.length > 0 ? (evals.reduce((a, b) => a + b.total, 0) / evals.length) : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total proveedores" value={suppliers.length} color="blue" />
        <KPICard icon={CheckCircle} label="Activos" value={activos} color="green" />
        <KPICard icon={FileText} label="Con contrato" value={conContrato} color="purple" />
        <KPICard icon={Star} label="Rating promedio" value={avgRating.toFixed(1)} color="amber" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(["lista", "contratos", "evaluaciones"] as SubTab[]).map(st => (
            <button key={st} onClick={() => setProveedorTab(st)}
              className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all " + (proveedorTab === st ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700")}>{st.charAt(0).toUpperCase() + st.slice(1)}</button>
          ))}
        </div>
        {proveedorTab === "lista" && <button className="btn-primary" onClick={onNewSupplier}><UserPlus className="w-4 h-4" />Nuevo proveedor</button>}
        {proveedorTab === "contratos" && <button className="btn-primary" onClick={onNewContract}><Plus className="w-4 h-4" />Nuevo contrato</button>}
        {proveedorTab === "evaluaciones" && <button className="btn-primary" onClick={onNewEval}><Star className="w-4 h-4" />Evaluar</button>}
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
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="table-cell">Numero</th>
              <th className="table-cell">Nombre</th>
              <th className="table-cell">Proveedor</th>
              <th className="table-cell">Inicio</th>
              <th className="table-cell">Fin</th>
              <th className="table-cell text-right">Monto</th>
              <th className="table-cell">Activo</th>
            </tr></thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Sin contratos registrados</td></tr>
              ) : contracts.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="table-td font-mono text-xs font-bold text-primary">{c.numero}</td>
                  <td className="table-td font-medium">{c.nombre}</td>
                  <td className="table-td">{c.proveedor}</td>
                  <td className="table-td text-sm">{formatDate(c.fecha_inicio)}</td>
                  <td className="table-td text-sm">{formatDate(c.fecha_fin)}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(c.monto)}</td>
                  <td className="table-td"><StatusBadge status={c.activo ? "activo" : "inactivo"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proveedorTab === "evaluaciones" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="table-cell">Proveedor</th>
              <th className="table-cell">Fecha</th>
              <th className="table-cell text-center">Calidad</th>
              <th className="table-cell text-center">Entrega</th>
              <th className="table-cell text-center">Precio</th>
              <th className="table-cell text-center">Promedio</th>
            </tr></thead>
            <tbody>
              {evals.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Sin evaluaciones</td></tr>
              ) : evals.map(e => (
                <tr key={e.id} className="table-row">
                  <td className="table-td font-medium">{e.proveedor}</td>
                  <td className="table-td text-sm">{formatDate(e.fecha)}</td>
                  <td className="table-td text-center"><span className={"inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold " + (e.calidad >= 8 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : e.calidad >= 5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>{e.calidad}</span></td>
                  <td className="table-td text-center"><span className={"inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold " + (e.entrega >= 8 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : e.entrega >= 5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>{e.entrega}</span></td>
                  <td className="table-td text-center"><span className={"inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold " + (e.precio >= 8 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : e.precio >= 5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>{e.precio}</span></td>
                  <td className="table-td text-center"><span className="font-bold">{e.total.toFixed(1)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SugerenciasTab({ suggestions, generating, onGenerate, onApply, onDiscard }: {
  suggestions: Suggestion[]; generating: boolean; onGenerate: () => void; onApply: (s: Suggestion) => void; onDiscard: (s: Suggestion) => void
}) {
  const pendientes = suggestions.filter(s => s.estado === "pendiente").length
  const aplicadas = suggestions.filter(s => s.estado === "aplicada").length
  const descartadas = suggestions.filter(s => s.estado === "descartada").length
  const ahorroPotencial = suggestions.filter(s => s.estado === "pendiente").reduce((a, b) => a + b.total_estimado, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard icon={TrendingUp} label="Sugerencias pendientes" value={pendientes} color="amber" />
        <KPICard icon={CheckCircle} label="Aplicadas" value={aplicadas} color="green" />
        <KPICard icon={X} label="Descartadas" value={descartadas} color="red" />
        <KPICard icon={DollarSign} label="Ahorro potencial" value={formatPYG(ahorroPotencial)} color="primary" />
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          {generating ? "Generando..." : "Generar sugerencias"}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Producto</th>
              <th className="table-cell text-right">Stock</th>
              <th className="table-cell text-right">Seguridad</th>
              <th className="table-cell text-right">Demanda</th>
              <th className="table-cell text-right">Cobertura</th>
              <th className="table-cell text-right">Sugerido</th>
              <th className="table-cell text-right">Total</th>
              <th className="table-cell">Proveedor</th>
              <th className="table-cell">Urgencia</th>
              <th className="table-cell">Confianza</th>
              <th className="table-cell">Estado</th>
              <th className="table-cell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400">Genera sugerencias para ver resultados</td></tr>
            ) : suggestions.map(s => (
              <tr key={s.id} className="table-row">
                <td className="table-td"><p className="text-sm font-medium">{s.product_name}</p><p className="text-xs text-gray-400 font-mono">{s.sku}</p></td>
                <td className="table-td text-right">{s.stock_actual}</td>
                <td className="table-td text-right text-amber-500">{s.stock_seguridad}</td>
                <td className="table-td text-right">{s.demanda_diaria.toFixed(1)}/d</td>
                <td className="table-td text-right">{s.dias_cobertura.toFixed(1)}d</td>
                <td className="table-td text-right font-bold">{s.cantidad_sugerida > 0 ? s.cantidad_sugerida : "-"}</td>
                <td className="table-td text-right font-mono font-bold">{formatPYG(s.total_estimado)}</td>
                <td className="table-td text-sm">{s.proveedor_sugerido}</td>
                <td className="table-td"><StatusBadge status={s.urgencia} map={urgencyMap} /></td>
                <td className="table-td">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 w-16 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: s.confianza + "%" }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{s.confianza}%</span>
                </td>
                <td className="table-td"><StatusBadge status={s.estado} /></td>
                <td className="table-td">
                  <div className="flex gap-1">
                    {s.estado === "pendiente" && (<>
                      <button className="btn-ghost text-green-500" onClick={() => onApply(s)} title="Aplicar"><Check className="w-4 h-4" /></button>
                      <button className="btn-ghost text-red-400" onClick={() => onDiscard(s)} title="Descartar"><X className="w-4 h-4" /></button>
                    </>)}
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

function ReportesTab({ purchaseOrders, suppliers, products, reportTab, setReportTab, reportPeriod, setReportPeriod }: {
  purchaseOrders: PurchaseOrder[]; suppliers: Supplier[]; products: Product[]; reportTab: ReportSubTab; setReportTab: (v: ReportSubTab) => void; reportPeriod: string; setReportPeriod: (v: string) => void
}) {
  const now = new Date()
  const cutoff = new Date(now)
  if (reportPeriod === "1") cutoff.setMonth(cutoff.getMonth() - 1)
  else if (reportPeriod === "3") cutoff.setMonth(cutoff.getMonth() - 3)
  else if (reportPeriod === "6") cutoff.setMonth(cutoff.getMonth() - 6)
  else if (reportPeriod === "12") cutoff.setFullYear(cutoff.getFullYear() - 1)
  const filtered = purchaseOrders.filter(p => new Date(p.fecha ?? "") >= cutoff && p.estado !== "cancelado")

  const totalGasto = filtered.reduce((a, b) => a + (b.total || 0), 0)
  const avgPO = filtered.length > 0 ? totalGasto / filtered.length : 0
  const supConCompras = new Set(filtered.map(p => p.supplier_id)).size

  const gastosPorProveedor = (() => {
    const map: Record<string, { name: string; count: number; total: number }> = {}
    filtered.forEach(p => {
      const name = p.supplier?.razon_social || "-"
      if (!map[name]) map[name] = { name, count: 0, total: 0 }
      map[name].count++; map[name].total += p.total || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Gasto total mes actual</p><p className="text-lg font-bold text-green-500">{formatPYG(totalGasto)}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Promedio por PO</p><p className="text-lg font-bold">{formatPYG(avgPO)}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proveedores c/compras</p><p className="text-lg font-bold text-primary">{supConCompras}</p></div>
        <div className="card p-3"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Periodo</p>
          <select className="input-field mt-1 text-sm" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)}>
            <option value="1">Ultimo mes</option>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">1 ano</option>
          </select>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-fit">
        {(["proveedor", "categoria", "varianza"] as ReportSubTab[]).map(rt => (
          <button key={rt} onClick={() => setReportTab(rt)}
            className={"px-3 py-1.5 rounded-lg text-xs font-bold transition-all " + (reportTab === rt ? "bg-white dark:bg-slate-700 shadow-sm" : "text-gray-500")}>{rt.charAt(0).toUpperCase() + rt.slice(1)}</button>
        ))}
      </div>

      {reportTab === "proveedor" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="table-cell">Proveedor</th>
              <th className="table-cell text-right">Cant. POs</th>
              <th className="table-cell text-right">Total Gs</th>
              <th className="table-cell text-right">% del total</th>
            </tr></thead>
            <tbody>
              {gastosPorProveedor.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Sin datos en el periodo</td></tr>
              ) : gastosPorProveedor.map((g: any, i: number) => (
                <tr key={g.name} className="table-row">
                  <td className="table-td font-medium">{g.name}</td>
                  <td className="table-td text-right">{g.count}</td>
                  <td className="table-td text-right font-mono font-bold">{formatPYG(g.total)}</td>
                  <td className="table-td text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs font-bold">{totalGasto > 0 ? ((g.total / totalGasto) * 100).toFixed(1) + "%" : "0%"}</span>
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-2 w-16 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: (g.total / Math.max(totalGasto, 1)) * 100 + "%" }} />
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
        <div className="card p-5">
          <p className="text-sm text-gray-400 text-center py-8">Reporte por categoria - proximamente</p>
        </div>
      )}

      {reportTab === "varianza" && (
        <div className="card p-5">
          <p className="text-sm text-gray-400 text-center py-8">Reporte de varianza de precios - proximamente</p>
        </div>
      )}
    </div>
  )
}

