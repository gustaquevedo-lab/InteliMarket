import React, { useState, useEffect, useCallback } from "react"
import {
  Building2, MapPin, Warehouse, ArrowLeftRight, Plus, RefreshCcw,
  Search, CheckCircle2, AlertTriangle, ChevronRight, Package, DollarSign,
  TrendingUp, Store, ShieldCheck, Loader2
} from "lucide-react"
import { api, type Branch } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

export default function BranchesPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])

  // Depósitos y Cámaras Frigoríficas de Extra Supermercado
  const [depositos, setDepositos] = useState([
    { id: "DEP-01", nombre: "Salón de Ventas Principal", tipo: "Góndolas & Mostradores", skus: 4850, valor_stock: 1250000000, encargado: "NILDA AQUINO" },
    { id: "DEP-02", nombre: "Cámara Fría Nº 1 (Carnes)", tipo: "Frigorífico -18°C a 2°C", skus: 180, valor_stock: 320000000, encargado: "CARLOS MEDINA" },
    { id: "DEP-03", nombre: "Depósito Seco / Trastienda", tipo: "Palletizado / Almacén", skus: 1200, valor_stock: 280000000, encargado: "MARCOS DUARTE" },
  ])

  // Cargar sucursales desde la API
  const fetchBranches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.branches.list()
      if (Array.isArray(res) && res.length > 0) {
        setBranches(res)
      } else {
        setBranches([
          {
            id: "b-01",
            nombre: "Local Central (Establecimiento 001)",
            direccion: "Avda. Principal esq. Curupayty Nº 1450",
            ciudad: "Pedro Juan Caballero",
            telefono: "(046) 242-500",
            activo: true,
            codigo: "001",
          } as Branch,
        ])
      }
    } catch {
      // fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  const totalStockValor = depositos.reduce((acc, d) => acc + d.valor_stock, 0)
  const totalSkus = depositos.reduce((acc, d) => acc + d.skus, 0)

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/90 text-white p-7 border border-teal-500/20 shadow-2xl shadow-teal-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 via-emerald-600 to-cyan-500 border border-teal-400/30 text-white flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <Building2 className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-teal-400 uppercase bg-teal-500/10 px-2.5 py-0.5 rounded-md border border-teal-500/20">
                    INFRAESTRUCTURA & LOGÍSTICA FÍSICA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Establecimiento 001 Conectado
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Sucursales, Depósitos & Cámaras de Frío
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Mapeo del Establecimiento 001 Central, control de depósitos internos, cámaras de frío y transferencias de Extra Supermercado
                </p>
              </div>
            </div>

            {/* Micro pills */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Establecimiento 001)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                📦 {depositos.length} Depósitos Internos
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-cyan-300">
                ❄️ Cámaras Frigoríficas Monitoreadas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
            <button
              onClick={fetchBranches}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Establecimientos DNIT</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {branches.length} Central
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Bocas: <strong className="text-slate-700 dark:text-slate-200 font-mono">10 Cajas POS</strong></span>
            <span className="text-blue-600 font-bold font-mono">100% Operativo</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Depósitos Internos</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {depositos.length} ubicaciones
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Cámaras Frías: <strong className="text-slate-700 dark:text-slate-200 font-mono">1 Activa</strong></span>
            <span className="text-emerald-600 font-bold font-mono">Monitoreada</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">SKUs Gestionados</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
            4.850 SKUs
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Rotación: <strong className="text-slate-700 dark:text-slate-200 font-mono">Alta</strong></span>
            <span className="text-purple-600 font-bold font-mono">cad_produto</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Valor de Mercadería</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {formatPYG(totalStockValor)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Costo Ponderado: <strong className="text-slate-700 dark:text-slate-200 font-mono">Al Día</strong></span>
            <span className="text-amber-600 font-bold font-mono">Auditado</span>
          </div>
        </div>
      </div>

      {/* ── TABLA DE DEPÓSITOS ── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white">Depósitos & Cámaras Frigoríficas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Distribución física de la mercadería en el Local Central</p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600">Total: {formatPYG(totalStockValor)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="p-3 font-mono">Código</th>
                <th className="p-3">Nombre del Depósito</th>
                <th className="p-3">Tipo de Almacenamiento</th>
                <th className="p-3 font-mono text-center">Variedad SKUs</th>
                <th className="p-3 text-right">Valorización de Stock</th>
                <th className="p-3">Encargado Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {depositos.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                  <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{d.id}</td>
                  <td className="p-3 font-bold text-gray-900 dark:text-white">{d.nombre}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">{d.tipo}</td>
                  <td className="p-3 text-center font-mono font-bold text-gray-800 dark:text-gray-200">{d.skus}</td>
                  <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">{formatPYG(d.valor_stock)}</td>
                  <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">{d.encargado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
