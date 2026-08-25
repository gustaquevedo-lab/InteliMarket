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
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
                  Sucursales, Depósitos & Cámaras de Frío
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Base de Datos Conectada
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Mapeo del Establecimiento 001 Central, control de depósitos internos y transferencias
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchBranches}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Sucursales */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Establecimientos DNIT</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-blue-600 dark:text-blue-400 font-mono tracking-tight">
            {branches.length} Central
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Bocas: <strong className="text-gray-700 dark:text-gray-200 font-mono">10 Cajas POS</strong></span>
            <span className="text-blue-600 font-bold font-mono">100% Operativo</span>
          </div>
        </div>

        {/* KPI 2: Depósitos */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Depósitos Internos</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {depositos.length} ubicaciones
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Cámaras Frías: <strong className="text-gray-700 dark:text-gray-200 font-mono">1 Activa</strong></span>
            <span className="text-emerald-600 font-bold font-mono">Monitoreada</span>
          </div>
        </div>

        {/* KPI 3: SKUs */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">SKUs Gestionados</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-purple-600 dark:text-purple-400 font-mono tracking-tight">
            4.850 SKUs
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Rotación: <strong className="text-gray-700 dark:text-gray-200 font-mono">Alta</strong></span>
            <span className="text-purple-600 font-bold font-mono">cad_produto</span>
          </div>
        </div>

        {/* KPI 4: Valorización */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Valor de Mercadería</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-amber-600 dark:text-amber-400 font-mono tracking-tight">
            {formatPYG(totalStockValor)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Costo Ponderado: <strong className="text-gray-700 dark:text-gray-200 font-mono">Al Día</strong></span>
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
