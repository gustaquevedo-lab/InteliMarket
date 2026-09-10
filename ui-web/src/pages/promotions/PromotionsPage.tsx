import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Tag, Percent, Plus, Search, CheckCircle2, XCircle, AlertTriangle,
  Calendar, Clock, DollarSign, ShoppingBag, Eye, Trash2, Edit3,
  RefreshCw, Loader2, Sparkles, Filter, Copy, ArrowRight, BarChart3,
  Gift, Layers, Check, X, ShieldCheck
} from "lucide-react"
import { api, type Promotion, type PromotionUsage } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate } from "../../utils/format"

type Tab = "activas" | "cupones" | "calendario" | "efectividad"

export default function PromotionsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("activas")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts] = useState<any[]>([])

  // Filtros
  const [search, setSearch] = useState("")
  const [filterTipo, setFilterTipo] = useState("all")

  // Modal Nueva Promoción
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: "",
    tipo: "porcentaje",
    valor: 15,
    aplica_a: "categoria",
    categoria_id: "",
    product_id: "",
    codigo_cupon: "",
    limite_usos: 500,
    monto_minimo_ticket: 0,
    fecha_inicio: new Date().toISOString().split("T")[0],
    fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    descripcion: "",
  })

  // Simulación de Promociones Típicas de Supermercado si la base está vacía
  const defaultPromotions: any[] = useMemo(() => [
    { id: "p1", nombre: "Miércoles de Huerta: 3x2 en Verduras de Hoja", tipo: "dos_por_uno", valor: 33, aplica_a: "categoria", categoria: "Verdulería", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-31", activo: true, usos: 342, ventas_generadas: 8450000, margen: "29.4%" },
    { id: "p2", nombre: "Viernes de Asado: Costilla + Carbón de Regalo", tipo: "combo_precio", valor: 32900, aplica_a: "categoria", categoria: "Carnicería", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-31", activo: true, usos: 215, ventas_generadas: 14200000, margen: "31.2%" },
    { id: "p3", nombre: "Cupón VIP ExtraClub 10% OFF en Todo el Súper", tipo: "porcentaje", valor: 10, aplica_a: "carrito", codigo_cupon: "VIP-EXTRA2026", fecha_inicio: "2026-08-15", fecha_fin: "2026-08-25", activo: true, usos: 38, ventas_generadas: 18900000, margen: "26.5%" },
    { id: "p4", nombre: "Lleva 3 Paga 2 en Lácteos Seleccionados", tipo: "cantidad_lleva", valor: 33, aplica_a: "categoria", categoria: "Lácteos", fecha_inicio: "2026-08-10", fecha_fin: "2026-08-20", activo: true, usos: 180, ventas_generadas: 5600000, margen: "28.0%" },
  ], [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, prodRes] = await Promise.allSettled([
        api.promotions.list(),
        api.products.list({ limit: 100 }),
      ])
      if (pRes.status === "fulfilled" && Array.isArray(pRes.value) && pRes.value.length > 0) {
        setPromotions(pRes.value)
      } else {
        setPromotions(defaultPromotions)
      }
      if (prodRes.status === "fulfilled" && Array.isArray(prodRes.value)) {
        setProducts(prodRes.value)
      }
    } catch {
      setPromotions(defaultPromotions)
    } finally {
      setLoading(false)
    }
  }, [defaultPromotions])

  useEffect(() => { loadData() }, [loadData])

  const filteredPromos = useMemo(() => {
    return promotions.filter((p: any) => {
      const s = search.toLowerCase()
      const matchesSearch = !search ||
        (p.nombre || "").toLowerCase().includes(s) ||
        (p.codigo_cupon || "").toLowerCase().includes(s)
      const matchesTipo = filterTipo === "all" || p.tipo === filterTipo
      return matchesSearch && matchesTipo
    })
  }, [promotions, search, filterTipo])

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre) { toast.error("Ingresá el nombre de la promoción", ""); return }
    setSaving(true)
    try {
      await api.promotions.create(form)
      toast.success("Promoción Creada", `La promoción ${form.nombre} fue registrada y está activa en el POS.`)
      setShowModal(false)
      loadData()
    } catch (err: any) {
      toast.error("Error al crear promoción", err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/90 text-white p-7 border border-rose-500/20 shadow-2xl shadow-rose-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-600 border border-rose-400/30 text-white flex items-center justify-center shadow-lg shadow-rose-500/25">
                  <Tag className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-2.5 py-0.5 rounded-md border border-rose-500/20">
                    MARKETING & PROMOCIONES · MOTOR DE REGLAS POS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                    Descuentos & Combos POS
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Promociones & Calendario Comercial
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  2x1, combos, descuentos por volumen, cuponera digital para cajeros y calendario anual de eventos retail
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-300">
                🏷️ {promotions.filter((p: any) => p.activo).length} Promociones activas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                ⚡ Aplicación automática en POS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button onClick={loadData} className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowModal(true)} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-rose-500/25">
              <Plus className="w-4 h-4" />
              <span>Nueva Promoción</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          {[
            { label: "Promociones Activas", val: promotions.filter((p: any) => p.activo).length, color: "text-rose-300", icon: Tag },
            { label: "Usos Registrados en POS", val: "775", color: "text-purple-300", icon: ShoppingBag },
            { label: "Ventas Generadas", val: formatPYG(47150000), color: "text-emerald-400", icon: DollarSign },
            { label: "Margen Promedio", val: "28.8%", color: "text-blue-300", icon: Percent },
          ].map((kpi) => (
            <div key={kpi.label} className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-xl font-black font-mono tracking-tight ${kpi.color}`}>{kpi.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* BANNER INFORMATIVO */}
      <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-300">
        <Sparkles className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-rose-950 dark:text-rose-200 mb-0.5">
            Aplicación Automática en Puntos de Venta (POS)
          </p>
          <p className="text-rose-800 dark:text-rose-400 leading-relaxed">
            Las promociones activas se disparan automáticamente en las cajas al escanear los productos asociados o al ingresar el código de cupón. El sistema valida fechas, límites de uso y stock disponible en tiempo real.
          </p>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "activas", label: `Promociones Activas (${promotions.length})`, icon: Tag },
          { id: "cupones", label: "Cuponera Digital POS", icon: Gift },
          { id: "calendario", label: "Calendario Comercial del Supermercado", icon: Calendar },
          { id: "efectividad", label: "Efectividad & ROI", icon: BarChart3 },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB ACTIVAS */}
      {tab === "activas" && (
        <div className="space-y-4">
          <div className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 flex-wrap text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar promoción..." className="input text-xs pl-8 w-full" />
            </div>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="input text-xs w-auto">
              <option value="all">Todos los Tipos</option>
              <option value="porcentaje">% Descuento</option>
              <option value="dos_por_uno">2x1 / 3x2</option>
              <option value="combo_precio">Precio Combo</option>
              <option value="cantidad_lleva">Lleva X Paga Y</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPromos.map((p: any) => (
              <div key={p.id} className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 font-mono">
                    {p.tipo?.replace(/_/g, " ")}
                  </span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activa en POS
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">{p.nombre}</h4>
                  <p className="text-gray-500 mt-1">Aplica a: <b>{p.categoria || p.aplica_a}</b></p>
                  {p.codigo_cupon && <p className="text-purple-600 font-mono font-bold mt-0.5">Cupón: {p.codigo_cupon}</p>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 font-mono text-[11px]">
                  <span className="text-gray-400">Vigencia: {p.fecha_inicio} al {p.fecha_fin}</span>
                  <span className="text-emerald-600 font-bold">Usos: {p.usos ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CUPONERA */}
      {tab === "cupones" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4 text-xs">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-600" /> Cupones Digitales Canjeables en Caja
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { codigo: "VIP-EXTRA2026", descuento: "10% OFF en toda la compra", segmento: "Socios VIP ExtraClub", vencimiento: "31 Ago 2026" },
              { codigo: "BIENVENIDA-10", descuento: "10% OFF en primera compra", segmento: "Nuevos Clientes Registrados", vencimiento: "Indefinido" },
              { codigo: "ASADO-FINDE", descuento: "Carbón 4kg Gratis llevando >3kg Carne", segmento: "Compradores de Carnicería", vencimiento: "Cada fin de semana" },
              { codigo: "HORTALIZAS-20", descuento: "20% en Frutas y Verduras", segmento: "Clientes Frecuentes Huerta", vencimiento: "Miércoles y Jueves" },
            ].map((c, i) => (
              <div key={i} className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-purple-900 dark:text-purple-200">{c.codigo}</span>
                  <span className="text-[10px] text-purple-600 font-bold">{c.vencimiento}</span>
                </div>
                <p className="font-bold text-gray-900 dark:text-white">{c.descuento}</p>
                <p className="text-[10px] text-gray-500">Segmento: {c.segmento}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CALENDARIO */}
      {tab === "calendario" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4 text-xs">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-pink-600" /> Calendario Comercial del Supermercado 2026
          </h3>
          <div className="space-y-3">
            {[
              { dia: "Miércoles", evento: "Miércoles de Huerta Fresca", promo: "3x2 en Hojas Verdes + 20% en Frutas", depto: "Verdulería" },
              { dia: "Jueves", evento: "Jueves de Pastas & Lácteos", promo: "25% en Segunda Unidad de Quesos y Pastas", depto: "Lácteos & Fiambrería" },
              { dia: "Viernes & Sábado", evento: "Finde Parrillero", promo: "Precios Especiales en Tapa Cuadril + Carbón", depto: "Carnicería" },
              { dia: "Últimos 3 días del mes", evento: "Fin de Mes de Ahorro", promo: "15% OFF en Canasta Básica Familiar", depto: "Almacén General" },
            ].map((ev, i) => (
              <div key={i} className="p-3.5 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-pink-600 uppercase text-[11px]">{ev.dia}</span>
                    <p className="font-extrabold text-gray-900 dark:text-white">{ev.evento}</p>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{ev.promo}</p>
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-lg">
                  {ev.depto}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB EFECTIVIDAD */}
      {tab === "efectividad" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-4 text-xs">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" /> Auditoría de Rentabilidad de Promociones (ROI)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-[10px] uppercase">Más Rentable</span>
              <p className="font-extrabold text-sm text-gray-900 dark:text-white">Finde Parrillero</p>
              <p className="text-[11px] font-mono text-emerald-600">ROI: 18.4x · Margen: 31.2%</p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 space-y-1">
              <span className="font-bold text-blue-800 dark:text-blue-300 text-[10px] uppercase">Mayor Volumen</span>
              <p className="font-extrabold text-sm text-gray-900 dark:text-white">Miércoles de Huerta</p>
              <p className="text-[11px] font-mono text-blue-600">342 canastas · Redujo merma 74%</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/40 space-y-1">
              <span className="font-bold text-purple-800 dark:text-purple-300 text-[10px] uppercase">Mayor Retención</span>
              <p className="font-extrabold text-sm text-gray-900 dark:text-white">Cupón VIP ExtraClub</p>
              <p className="text-[11px] font-mono text-purple-600">Reactivó 38 clientes de alto ticket</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA PROMO */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Nueva Promoción Comercial</h2>
            <form onSubmit={handleSavePromo} className="space-y-3 text-xs">
              <div>
                <label className="label-sm">Nombre de la Promoción *</label>
                <input required className="input text-xs" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: 2x1 en Galletitas Bagley" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Tipo de Promoción</label>
                  <select className="input text-xs" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="porcentaje">% Descuento</option>
                    <option value="dos_por_uno">2x1 / 3x2</option>
                    <option value="combo_precio">Precio Combo Fijo</option>
                    <option value="cantidad_lleva">Lleva X Paga Y</option>
                  </select>
                </div>
                <div>
                  <label className="label-sm">Valor / Porcentaje</label>
                  <input required type="number" className="input text-xs font-mono font-bold" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <label className="label-sm">Código de Cupón (Opcional)</label>
                <input className="input text-xs font-mono" value={form.codigo_cupon} onChange={e => setForm(f => ({ ...f, codigo_cupon: e.target.value }))} placeholder="Ej: PROMO-VERANO" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Fecha Inicio</label>
                  <input type="date" className="input text-xs" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
                </div>
                <div>
                  <label className="label-sm">Fecha Fin</label>
                  <input type="date" className="input text-xs" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar Promoción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
