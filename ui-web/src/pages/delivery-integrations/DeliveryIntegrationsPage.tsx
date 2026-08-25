import React, { useState } from "react"
import {
  Package, Truck, Check, AlertCircle, RefreshCw, Smartphone, Settings, Clock,
  DollarSign, ShoppingBag, ArrowUpRight, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Filter, Eye, RotateCcw, Link2, ExternalLink, TrendingUp, Zap, Search
} from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

type Tab = "dashboard" | "orders" | "platforms"

export default function DeliveryIntegrationsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("dashboard")
  const [search, setSearch] = useState("")

  const [platforms] = useState([
    { id: "pedidosya", name: "PedidosYa", logo: "🔴", estado: "online", pedidos_hoy: 38, ventas_hoy: 3450000, comision: "14%", sync: "Automática" },
    { id: "rappi", name: "Rappi", logo: "🟠", estado: "online", pedidos_hoy: 15, ventas_hoy: 1820000, comision: "15%", sync: "Automática" },
    { id: "propio", name: "InteliEntregas (Delivery Propio)", logo: "🛵", estado: "online", pedidos_hoy: 24, ventas_hoy: 2150000, comision: "0%", sync: "Directa" },
  ])

  const [orders] = useState([
    { id: "ord-881", canal: "PedidosYa", cliente: "María González", articulos: 4, total: 68000, estado: "Entregado", repartidor: "Juan Cardozo", hora: "17:45" },
    { id: "ord-882", canal: "PedidosYa", cliente: "Carlos Benítez", articulos: 2, total: 45000, estado: "En Camino", repartidor: "Lucas Silva", hora: "17:50" },
    { id: "ord-883", canal: "Rappi", cliente: "Ana Duarte", articulos: 6, total: 120000, estado: "Preparando", repartidor: "Asignando...", hora: "18:02" },
    { id: "ord-884", canal: "InteliEntregas", cliente: "Roberto Giménez", articulos: 8, total: 245000, estado: "En Camino", repartidor: "Delivery Propio #02", hora: "18:10" },
  ])

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
                  Delivery Apps & Canales Online
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  3 Canales Conectados
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Integración de pedidos, reserva inmediata de stock en POS y ruteo de despachos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.success("¡Catálogo Sincronizado!", "Se actualizaron precios y stock en PedidosYa y Rappi")}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl shadow-md shadow-amber-500/25 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sincronizar Catálogo & Precios
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ESTILIZADAS CON ESTÉTICA OFICIAL ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pedidos Online Hoy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Pedidos Online Hoy</span>
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-orange-600 dark:text-orange-400 font-mono tracking-tight">
            77 pedidos
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Canales: <strong className="text-gray-700 dark:text-gray-200 font-mono">PedidosYa + Rappi</strong></span>
            <span className="text-orange-600 font-bold font-mono">+18% vs ayer</span>
          </div>
        </div>

        {/* KPI 2: Facturación Online */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Facturación Online</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
            {formatPYG(7420000)}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Ticket Medio: <strong className="text-gray-700 dark:text-gray-200 font-mono">{formatPYG(96360)}</strong></span>
            <span className="text-emerald-600 font-bold font-mono flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Activo
            </span>
          </div>
        </div>

        {/* KPI 3: Tiempo Medio de Despacho */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Tiempo de Picking</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-blue-600 dark:text-blue-400 font-mono tracking-tight">
            18.4 min
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Objetivo: <strong className="text-gray-700 dark:text-gray-200 font-mono">&lt;20 min</strong></span>
            <span className="text-blue-600 font-bold font-mono">Eficiente</span>
          </div>
        </div>

        {/* KPI 4: Sincronización de Stock */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Precisión Catálogo</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-purple-600 dark:text-purple-400 font-mono tracking-tight">
            99.5%
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span>Quiebres evitados: <strong className="text-gray-700 dark:text-gray-200 font-mono">14 hoy</strong></span>
            <span className="text-purple-600 font-bold font-mono">Stock en Vivo</span>
          </div>
        </div>
      </div>

      {/* ── TABS BAR ── */}
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {[
          { key: "dashboard", label: "Canales Conectados", icon: Smartphone },
          { key: "orders", label: "Pedidos Entrantes en Vivo", icon: ShoppingBag },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              tab === t.key
                ? "bg-white dark:bg-slate-700 shadow-md text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: CANALES ── */}
      {tab === "dashboard" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platforms.map(p => (
            <div key={p.id} className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.logo}</span>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{p.name}</p>
                </div>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {p.estado}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-gray-500">Pedidos Hoy: <strong className="text-gray-900 dark:text-white font-mono">{p.pedidos_hoy}</strong></p>
                <p className="text-gray-500">Facturación: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatPYG(p.ventas_hoy)}</strong></p>
                <p className="text-gray-500">Comisión Canal: <strong className="text-gray-700 dark:text-gray-300 font-mono">{p.comision}</strong></p>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 text-xs">
                <span className="text-gray-400 font-mono text-[11px]">Sync: {p.sync}</span>
                <button
                  onClick={() => toast.info("Configuración de Canal", `Ajustes de API para ${p.name}`)}
                  className="text-xs font-bold text-amber-600 hover:underline"
                >
                  Configurar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: PEDIDOS EN VIVO ── */}
      {tab === "orders" && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                Cola de Pedidos de Delivery en Tiempo Real
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recepción automática desde apps y asignación a expedición
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar pedido o cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-750 text-gray-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50/50 dark:bg-slate-750/50 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                <tr>
                  <th className="p-3">Hora</th>
                  <th className="p-3 font-mono">ID Pedido</th>
                  <th className="p-3">Canal</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-center">Ítems</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Repartidor</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                {orders
                  .filter(o => !search || o.cliente.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search))
                  .map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-slate-750/50">
                      <td className="p-3 font-mono text-gray-500 text-[11px]">{o.hora}</td>
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">{o.id}</td>
                      <td className="p-3 font-bold text-gray-900 dark:text-white">{o.canal}</td>
                      <td className="p-3 text-gray-700 dark:text-gray-300">{o.cliente}</td>
                      <td className="p-3 text-center font-mono font-bold">{o.articulos}</td>
                      <td className="p-3 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(o.total)}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{o.repartidor}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.estado === "Entregado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : o.estado === "En Camino" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {o.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
