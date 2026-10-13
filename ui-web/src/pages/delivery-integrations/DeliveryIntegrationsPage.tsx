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
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/90 text-white p-7 border border-amber-500/20 shadow-2xl shadow-amber-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 border border-amber-400/30 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Truck className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    ECOMMERCE & DELIVERY · CANALES Y RUTEO EN LÍNEA
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    3 Canales Conectados
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Delivery Apps & Canales Online
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Integración de pedidos en vivo, reserva inmediata de stock en POS y ruteo de despachos
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-amber-300">
                🛵 PedidosYa + Rappi + InteliEntregas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                ⚡ Stock & Catálogo Sincronizado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => toast.success("¡Catálogo Sincronizado!", "Se actualizaron precios y stock en PedidosYa y Rappi")}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-amber-500/25"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sincronizar Catálogo & Precios</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pedidos Online Hoy</span>
              <ShoppingBag className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-orange-400">77 pedidos</p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/60 font-mono">
              <span>PedidosYa + Rappi</span>
              <span className="text-orange-400 font-bold">+18% vs ayer</span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturación Online</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-emerald-400">{formatPYG(7420000)}</p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/60 font-mono">
              <span>Ticket Medio: {formatPYG(96360)}</span>
              <span className="text-emerald-400 font-bold">Activo</span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiempo de Picking</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-blue-400">18.4 min</p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/60 font-mono">
              <span>Objetivo: &lt;20 min</span>
              <span className="text-blue-400 font-bold">Eficiente</span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Precisión Catálogo</span>
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-purple-400">99.5%</p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/60 font-mono">
              <span>14 quiebres evitados</span>
              <span className="text-purple-400 font-bold">En Vivo</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "dashboard", label: "Canales Conectados", icon: Smartphone },
          { key: "orders", label: "Pedidos Entrantes en Vivo", icon: ShoppingBag },
        ].map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
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
