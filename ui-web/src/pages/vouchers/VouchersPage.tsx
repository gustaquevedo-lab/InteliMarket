import { useState, useEffect } from "react"
import {
  Ticket,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  FileText,
  Copy,
  Plus,
  Check,
  X,
  ExternalLink,
  Info
} from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDateTime } from "../../utils/format"

interface VoucherItem {
  id: string
  numero_vale: string
  codigo_barras: string
  monto_inicial: number
  saldo_disponible: number
  estado: "ACTIVO" | "CANJEADO" | "ANULADO" | "VENCIDO"
  canjeado_at?: string | null
  canjeado_caja_numero?: string | null
  canjeado_en_sale_id?: string | null
  beneficiario_nombre?: string | null
}

interface ConvenioSummary {
  convenio_nombre: string
  total_emitidos: number
  total_canjeados: number
  total_activos: number
  monto_total_emitido: number
  monto_total_canjeado: number
  monto_saldo_calle: number
  factura_emision_numero?: string | null
  cliente_ruc?: string | null
  cliente_razon_social?: string | null
  vales: VoucherItem[]
}

export default function VouchersPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ConvenioSummary | null>(null)
  const [search, setSearch] = useState("")
  const [filterState, setFilterState] = useState<"ALL" | "ACTIVO" | "CANJEADO">("ALL")
  const [seeding, setSeeding] = useState(false)

  // Consultar en vivo un vale
  const [quickCode, setQuickCode] = useState("")
  const [quickResult, setQuickResult] = useState<any>(null)
  const [checkingQuick, setCheckingQuick] = useState(false)

  // Facturación del Convenio
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceNumberInput, setInvoiceNumberInput] = useState("")
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [copiedData, setCopiedData] = useState(false)

  // Modal Nuevo Lote
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchForm, setBatchForm] = useState({
    convenio_nombre: "Universidad del Pacífico",
    cliente_ruc: "80024467-2",
    cliente_razon_social: "UNIVERSIDAD DEL PACÍFICO",
    total_vales: 25,
    monto_por_vale: 100000,
    fecha_vencimiento: "2026-12-31",
    factura_numero: "",
    prefijo_codigo: "UP-",
  })
  const [savingBatch, setSavingBatch] = useState(false)

  const fetchSummary = async () => {
    try {
      setLoading(true)
      const data = await api.vouchers.summary("Universidad del Pacífico")
      setSummary(data)
      if (data?.factura_emision_numero) {
        setInvoiceNumberInput(data.factura_emision_numero)
      }
    } catch (err: any) {
      toast.error("Error al cargar vales", err?.message || "No se pudo obtener el resumen de convenios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const handleSeedUP = async () => {
    try {
      setSeeding(true)
      const res = await api.vouchers.seedUP({
        total_vales: 75,
        monto_por_vale: 100000,
        fecha_vencimiento: "2026-12-31",
      })
      toast.success(
        "Lote UP Inicializado",
        `Se sembraron ${res.creados} vales nuevos (${res.existentes} ya existían).`
      )
      fetchSummary()
    } catch (err: any) {
      toast.error("Error al sembrar vales", err?.message || "Error del servidor")
    } finally {
      setSeeding(false)
    }
  }

  const handleQuickCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!quickCode.trim()) return

    try {
      setCheckingQuick(true)
      setQuickResult(null)
      const res = await api.vouchers.check(quickCode.trim())
      setQuickResult(res)
    } catch (err: any) {
      toast.error("Error al validar", err?.message || "Error al conectar con la API")
    } finally {
      setCheckingQuick(false)
    }
  }

  const handleLinkInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceNumberInput.trim()) {
      toast.warning("Falta Nº de Factura", "Ingrese el número de factura timbrada emitida a la UP.")
      return
    }

    try {
      setSavingInvoice(true)
      const res = await api.vouchers.linkInvoice({
        convenio_nombre: summary?.convenio_nombre || "Universidad del Pacífico",
        factura_numero: invoiceNumberInput.trim(),
      })
      toast.success(
        "Factura Vinculada",
        `Factura N° ${res.factura_numero} vinculada exitosamente a ${res.vales_actualizados} vales.`
      )
      setShowInvoiceModal(false)
      fetchSummary()
    } catch (err: any) {
      toast.error("Error al vincular factura", err?.message || "Error del servidor")
    } finally {
      setSavingInvoice(false)
    }
  }

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchForm.convenio_nombre.trim() || batchForm.total_vales <= 0 || batchForm.monto_por_vale <= 0) {
      toast.warning("Campos Requeridos", "Complete el nombre del convenio, cantidad y monto.")
      return
    }

    try {
      setSavingBatch(true)
      const res = await api.vouchers.createBatch(batchForm)
      toast.success(
        "Lote de Vales Creado",
        `Se crearon ${res.creados} vales para '${res.convenio}' por un total de Gs. ${res.monto_total.toLocaleString("es-PY")}.`
      )
      setShowBatchModal(false)
      fetchSummary()
    } catch (err: any) {
      toast.error("Error al crear lote", err?.message || "Error del servidor")
    } finally {
      setSavingBatch(false)
    }
  }

  const handleCopyBillingData = () => {
    const text = `DATOS PARA EMISIÓN DE FACTURA A UNIVERSIDAD DEL PACÍFICO:
Razón Social: UNIVERSIDAD DEL PACÍFICO
RUC: 80024467-2
Condición: CONTADO
Concepto: VALES DE COMPRA PREPAGO - CONVENIO INSTITUCIONAL
Cantidad: 75
Precio Unitario: Gs. 100.000
Total: Gs. 7.500.000
Tasa IVA: EXENTA (0% IVA)
Observación: Anticipo de fondos prepago según Convenio Interinstitucional Extra Supermercado. El IVA de las mercaderías se liquida en cajas de cobranza al momento del canje.`
    navigator.clipboard.writeText(text)
    setCopiedData(true)
    toast.success("Copiado al Portapapeles", "Datos fiscales listos para pegar en el emisor de facturas.")
    setTimeout(() => setCopiedData(false), 3000)
  }

  const filteredVales = (summary?.vales || []).filter((v) => {
    const matchesSearch =
      v.numero_vale.toLowerCase().includes(search.toLowerCase()) ||
      v.codigo_barras.toLowerCase().includes(search.toLowerCase()) ||
      (v.beneficiario_nombre && v.beneficiario_nombre.toLowerCase().includes(search.toLowerCase())) ||
      (v.canjeado_caja_numero && v.canjeado_caja_numero.toLowerCase().includes(search.toLowerCase()))

    if (filterState === "ALL") return matchesSearch
    return matchesSearch && v.estado === filterState
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <Ticket className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Vales Corporativos & Convenios
              </h1>
              <span className="bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Convenio UP
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Control unitario, trazabilidad de canje en cajas y arqueo de vales institucionales
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <FileText className="w-4 h-4 text-blue-500" />
            {summary?.factura_emision_numero ? `Factura: ${summary.factura_emision_numero}` : "Datos de Facturación Legal"}
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo Lote
          </button>

          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>

          {(!summary || summary.total_emitidos === 0) && (
            <button
              onClick={handleSeedUP}
              disabled={seeding}
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Sembrar Lote UP (001 - 075)
            </button>
          )}
        </div>
      </div>

      {/* Banner Resumen Legal de Facturación a la UP */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">UNIVERSIDAD DEL PACÍFICO</span>
              <span className="font-mono text-xs text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60">
                RUC: 80024467-2
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Facturación en <span className="text-amber-400 font-bold">EXENTA (0% IVA)</span> por Gs. 7.500.000 (75 vales × Gs. 100.000). El IVA de mercaderías se liquida en cajas de cobro al canjear.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyBillingData}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
          >
            {copiedData ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            {copiedData ? "Copiado" : "Copiar Datos Fiscales"}
          </button>
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            {summary?.factura_emision_numero ? "Editar Factura" : "Vincular Factura"}
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Estado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Emitidos</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {summary?.total_emitidos || 0}
            </span>
            <span className="text-xs text-slate-500">vales (Gs. 100k)</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Monto Total: {formatPYG(summary?.monto_total_emitido || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <span>Canjeados en Caja</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {summary?.total_canjeados || 0}
            </span>
            <span className="text-xs text-emerald-600/80">utilizados</span>
          </div>
          <p className="text-xs font-bold text-emerald-600 mt-1">
            Recaudado: {formatPYG(summary?.monto_total_canjeado || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold uppercase tracking-wider">
            <span>Pendientes / En Calle</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {summary?.total_activos || 0}
            </span>
            <span className="text-xs text-amber-600/80">sin usar</span>
          </div>
          <p className="text-xs font-bold text-amber-600 mt-1">
            Saldo por canjear: {formatPYG(summary?.monto_saldo_calle || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 text-xs font-bold uppercase tracking-wider">
            <span>Vigencia Convenio</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">
              31/12/2026
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {summary?.factura_emision_numero ? `Factura: ${summary.factura_emision_numero}` : "Univ. del Pacífico • PJC"}
          </p>
        </div>
      </div>

      {/* Probador / Verificador Rápido de Código de Barras */}
      <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent p-5 rounded-2xl border border-orange-500/30">
        <form onSubmit={handleQuickCheck} className="flex flex-col md:flex-row gap-3 items-center">
          <div className="flex-1 w-full relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
              placeholder="Escanee o digite código para verificar (ej: 001, VALE 001, VALE-075)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={checkingQuick || !quickCode.trim()}
            className="w-full md:w-auto px-6 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {checkingQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Verificar Vale
          </button>
        </form>

        {quickResult && (
          <div
            className={`mt-4 p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
              quickResult.es_valido
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-300 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {quickResult.es_valido ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div>
                <p className="font-black text-sm">{quickResult.mensaje}</p>
                <p className="font-normal opacity-80 mt-0.5">
                  Convenio: {quickResult.convenio_nombre} • Vencimiento: {quickResult.fecha_vencimiento} • Saldo: {formatPYG(quickResult.saldo_disponible)}
                </p>
              </div>
            </div>
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-black/10">
              ESTADO: {quickResult.estado}
            </span>
          </div>
        )}
      </div>

      {/* Tabla de Vales Institucionales */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Barra de Filtros */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              Listado de Vales ({filteredVales.length})
            </h2>
            {summary?.factura_emision_numero && (
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                Factura N° {summary.factura_emision_numero}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Control de Filtro */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterState("ALL")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterState === "ALL"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Todos ({summary?.vales?.length || 0})
              </button>
              <button
                onClick={() => setFilterState("ACTIVO")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterState === "ACTIVO"
                    ? "bg-white dark:bg-slate-900 text-amber-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Activos ({summary?.total_activos || 0})
              </button>
              <button
                onClick={() => setFilterState("CANJEADO")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterState === "CANJEADO"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Canjeados ({summary?.total_canjeados || 0})
              </button>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vale (001, 075, caja)..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono outline-none focus:border-orange-500 w-48"
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Vale N.º</th>
                <th className="py-3 px-4">Código de Barras</th>
                <th className="py-3 px-4">Monto Facial</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Fecha/Hora Canje</th>
                <th className="py-3 px-4">Caja Canje</th>
                <th className="py-3 px-4">Beneficiario / Venta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                    Cargando vales institucionales...
                  </td>
                </tr>
              ) : filteredVales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No se encontraron vales con el criterio seleccionado.
                  </td>
                </tr>
              ) : (
                filteredVales.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-black font-mono text-slate-900 dark:text-white">
                      VALE N.º {v.numero_vale}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {v.codigo_barras}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {formatPYG(v.monto_inicial)}
                    </td>
                    <td className="py-3 px-4">
                      {v.estado === "ACTIVO" ? (
                        <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
                          Activo
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
                          Canjeado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {v.canjeado_at ? formatDateTime(v.canjeado_at) : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {v.canjeado_caja_numero || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {v.beneficiario_nombre || (v.canjeado_en_sale_id ? `Venta #${v.canjeado_en_sale_id.slice(0, 8)}` : "—")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Facturación Legal del Convenio */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Facturación Legal a la Universidad del Pacífico
                  </h3>
                  <p className="text-xs text-slate-500">
                    Datos fiscales oficiales y vinculación de comprobante timbrado
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ficha Resumen Fiscal */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Razón Social Cliente:</span>
                  <span className="font-bold text-slate-900 dark:text-white">UNIVERSIDAD DEL PACÍFICO</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">RUC Cliente:</span>
                  <span className="font-bold font-mono text-blue-600 dark:text-blue-400">80024467-2</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Concepto a Facturar:</span>
                  <span className="font-bold text-slate-900 dark:text-white">VALES DE COMPRA PREPAGO - CONVENIO UP</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tasa de IVA Aplicable:</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">EXENTA (0% IVA)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Cantidad / Unitario:</span>
                  <span className="font-bold text-slate-900 dark:text-white">75 vales × Gs. 100.000</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total a Facturar:</span>
                  <span className="font-black text-slate-900 dark:text-white">Gs. 7.500.000</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-500">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>
                  <strong>¿Por qué EXENTA?</strong> Porque se trata de un anticipo de fondos / medio de pago prepago. El IVA de las mercaderías se liquida y factura en las cajas cuando los beneficiarios canjean los productos. La UP deduce el 100% en IRE con esta factura.
                </p>
              </div>
            </div>

            {/* Formulario de Vinculación */}
            <form onSubmit={handleLinkInvoice} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Número de Factura Emitida a la UP (*):
                </label>
                <input
                  type="text"
                  value={invoiceNumberInput}
                  onChange={(e) => setInvoiceNumberInput(e.target.value)}
                  placeholder="Ej: 001-002-0001234 o número timbrado SIFEN..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Este número quedará asociado a los 75 vales en la base de datos para trazabilidad y auditoría fiscal.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleCopyBillingData}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Ficha Fiscal
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={savingInvoice || !invoiceNumberInput.trim()}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {savingInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Guardar Vinculación
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Lote / Convenio */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Registrar Nuevo Lote de Vales
                  </h3>
                  <p className="text-xs text-slate-500">
                    Emisión de vales de compra corporativos con código de barras
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nombre del Convenio / Institución (*):
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.convenio_nombre}
                  onChange={(e) => setBatchForm({ ...batchForm, convenio_nombre: e.target.value })}
                  placeholder="Ej: Universidad del Pacífico, Hospital Regional..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    RUC Cliente:
                  </label>
                  <input
                    type="text"
                    value={batchForm.cliente_ruc}
                    onChange={(e) => setBatchForm({ ...batchForm, cliente_ruc: e.target.value })}
                    placeholder="80024467-2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Razón Social:
                  </label>
                  <input
                    type="text"
                    value={batchForm.cliente_razon_social}
                    onChange={(e) => setBatchForm({ ...batchForm, cliente_razon_social: e.target.value })}
                    placeholder="UNIVERSIDAD DEL PACÍFICO"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cantidad de Vales (*):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={batchForm.total_vales}
                    onChange={(e) => setBatchForm({ ...batchForm, total_vales: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Monto por Vale (Gs.) (*):
                  </label>
                  <input
                    type="number"
                    step={1000}
                    required
                    value={batchForm.monto_por_vale}
                    onChange={(e) => setBatchForm({ ...batchForm, monto_por_vale: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Fecha de Vencimiento (*):
                  </label>
                  <input
                    type="date"
                    required
                    value={batchForm.fecha_vencimiento}
                    onChange={(e) => setBatchForm({ ...batchForm, fecha_vencimiento: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Prefijo Código (Opcional):
                  </label>
                  <input
                    type="text"
                    value={batchForm.prefijo_codigo}
                    onChange={(e) => setBatchForm({ ...batchForm, prefijo_codigo: e.target.value })}
                    placeholder="Ej: UP- (genera UP-076...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200 flex items-center justify-between">
                <span>Total a Emitir:</span>
                <span className="font-black text-sm">
                  {formatPYG(batchForm.total_vales * batchForm.monto_por_vale)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBatch}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {savingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Generar Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
