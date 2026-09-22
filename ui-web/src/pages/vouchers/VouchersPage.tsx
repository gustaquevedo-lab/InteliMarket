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
  ArrowRight
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

  const fetchSummary = async () => {
    try {
      setLoading(true)
      const data = await api.vouchers.summary("Universidad del Pacífico")
      setSummary(data)
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

        <div className="flex items-center gap-3">
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
            Univ. del Pacífico • PJC
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
              placeholder="Escanee o digite código para verificar (ej: 001, VALE 001)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={checkingQuick || !quickCode.trim()}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
          >
            {checkingQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Verificar Estado
          </button>
        </form>

        {/* Resultado del Check Rápido */}
        {quickResult && (
          <div
            className={`mt-4 p-4 rounded-xl border flex items-center justify-between ${
              quickResult.es_valido
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {quickResult.es_valido ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
              )}
              <div>
                <p className="font-black text-sm">{quickResult.mensaje}</p>
                <p className="text-xs opacity-80 mt-0.5 font-mono">
                  Vale N°: {quickResult.numero_vale} • Convenio: {quickResult.convenio_nombre} • Vencimiento: {quickResult.fecha_vencimiento}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                quickResult.es_valido ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
              }`}
            >
              {quickResult.estado}
            </span>
          </div>
        )}
      </div>

      {/* Tabla de Vales */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setFilterState("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterState === "ALL"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Todos ({summary?.total_emitidos || 0})
            </button>
            <button
              onClick={() => setFilterState("ACTIVO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterState === "ACTIVO"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Activos ({summary?.total_activos || 0})
            </button>
            <button
              onClick={() => setFilterState("CANJEADO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterState === "CANJEADO"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              Canjeados ({summary?.total_canjeados || 0})
            </button>
          </div>

          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por N°, código, caja..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 font-bold text-slate-500">
                <th className="py-3 px-4">N° Vale</th>
                <th className="py-3 px-4">Código de Barras</th>
                <th className="py-3 px-4">Monto</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Canjeado Fecha/Hora</th>
                <th className="py-3 px-4">Caja</th>
                <th className="py-3 px-4">Beneficiario</th>
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
                      {v.beneficiario_nombre || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
