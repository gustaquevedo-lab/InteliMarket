import { useState, useEffect, useCallback, useMemo } from "react"
import {
  CreditCard, Search, Plus, Filter, Download, Eye, CheckCircle2,
  XCircle, AlertTriangle, Clock, Calendar, RefreshCw, Loader2,
  Building2, Landmark, User, FileText, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Check, X, FileSpreadsheet, History, Info, Sparkles, DollarSign
} from "lucide-react"
import { api } from "../../api"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG, formatDate, formatCurrency } from "../../utils/format"

type ChequeTab = "cartera" | "emitidos" | "depositados" | "rechazados" | "dashboard"
type ChequeTipo = "recibido" | "emitido"

const BANCOS_PARAGUAY = [
  "BANCO ITAÚ PARAGUAY", "BANCO CONTINENTAL", "BANCO GNB PARAGUAY",
  "BANCO ATLAS", "BANCOP", "BANCO SUDAMERIS", "BANCO BASA",
  "BANCO FAMILIAR", "BANCO INTERFISA", "BANCO NACIONAL DE FOMENTO (BNF)",
  "SOLAR BANCO", "UENO BANK", "ZETA BANCO"
]

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  en_cartera: { label: "En Cartera", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-900/50" },
  depositado: { label: "Depositado / En Compensación", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-900/50" },
  cobrado: { label: "Cobrado / Efectivizado", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900/50" },
  entregado: { label: "Entregado a Proveedor", bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-900/50" },
  rechazado: { label: "Rechazado / Sin Fondos", bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-900/50" },
  anulado: { label: "Anulado", bg: "bg-gray-100 dark:bg-slate-800", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-slate-700" },
}

export default function ChequesPage() {
  const toast = useToast()
  const [tab, setTab] = useState<ChequeTab>("dashboard")
  const [loading, setLoading] = useState(true)

  // Datos reales
  const [cheques, setCheques] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  // Filtros
  const [search, setSearch] = useState("")
  const [filterBanco, setFilterBanco] = useState("all")
  const [filterEstado, setFilterEstado] = useState("all")
  const [filterTipo, setFilterTipo] = useState<string>("all")

  // Modal Nuevo Cheque
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    numero: "",
    banco_emisor: BANCOS_PARAGUAY[0],
    bank_account_id: "",
    beneficiario: "",
    supplier_id: "",
    monto: "",
    moneda: "PYG",
    fecha_emision: new Date().toISOString().split("T")[0],
    fecha_pago: new Date().toISOString().split("T")[0],
    fecha_entrega: "",
    tipo: "emitido",
    diferido: false,
    cruzado: true,
    no_a_la_orden: false,
    observaciones: "",
  })

  // Modal Historial
  const [selectedCheque, setSelectedCheque] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [chqRes, supRes, bnkRes] = await Promise.allSettled([
        api.cheques.list(),
        api.purchases.listSuppliers(),
        api.financial.banks.list(),
      ])

      if (chqRes.status === "fulfilled" && Array.isArray(chqRes.value)) setCheques(chqRes.value)
      if (supRes.status === "fulfilled" && Array.isArray(supRes.value)) setSuppliers(supRes.value)
      if (bnkRes.status === "fulfilled" && Array.isArray(bnkRes.value)) setBankAccounts(bnkRes.value)
    } catch (e: any) {
      toast.error("Error al cargar cartera de cheques", e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {}
    suppliers.forEach((s: any) => { map[s.id] = s.razon_social || s.nombre || s.ruc })
    return map
  }, [suppliers])

  // KPIs
  const analytics = useMemo(() => {
    const enCartera = cheques.filter(c => c.estado === "en_cartera")
    const depositados = cheques.filter(c => c.estado === "depositado")
    const cobrados = cheques.filter(c => c.estado === "cobrado")
    const rechazados = cheques.filter(c => c.estado === "rechazado")
    const emitidos = cheques.filter(c => c.tipo === "emitido" || c.bank_account_id)

    const montoCartera = enCartera.reduce((s, c) => s + Number(c.monto || 0), 0)
    const montoCobrado = cobrados.reduce((s, c) => s + Number(c.monto || 0), 0)
    const montoRechazado = rechazados.reduce((s, c) => s + Number(c.monto || 0), 0)
    const montoEmitidos = emitidos.reduce((s, c) => s + Number(c.monto || 0), 0)

    const tasaRechazo = cheques.length > 0 ? ((rechazados.length / cheques.length) * 100).toFixed(1) : "0.0"

    return {
      totalCheques: cheques.length,
      enCarteraCount: enCartera.length,
      montoCartera,
      depositadosCount: depositados.length,
      cobradosCount: cobrados.length,
      montoCobrado,
      rechazadosCount: rechazados.length,
      montoRechazado,
      emitidosCount: emitidos.length,
      montoEmitidos,
      tasaRechazo
    }
  }, [cheques])

  const filteredCheques = useMemo(() => {
    return cheques.filter(c => {
      const matchesSearch = !search ||
        (c.numero || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.beneficiario || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.banco_emisor || "").toLowerCase().includes(search.toLowerCase()) ||
        (supplierMap[c.supplier_id] || "").toLowerCase().includes(search.toLowerCase())

      const matchesBanco = filterBanco === "all" || c.banco_emisor === filterBanco
      const matchesEstado = filterEstado === "all" || c.estado === filterEstado
      const matchesTipo = filterTipo === "all" || (filterTipo === "emitido" ? (c.tipo === "emitido" || c.bank_account_id) : (c.tipo === "recibido" || !c.bank_account_id))

      // Tab matching
      if (tab === "cartera" && c.estado !== "en_cartera") return false
      if (tab === "depositados" && c.estado !== "depositado") return false
      if (tab === "rechazados" && c.estado !== "rechazado") return false
      if (tab === "emitidos" && c.tipo !== "emitido" && !c.bank_account_id) return false

      return matchesSearch && matchesBanco && matchesEstado && matchesTipo
    })
  }, [cheques, search, filterBanco, filterEstado, filterTipo, tab, supplierMap])

  const handleUpdateEstado = async (id: string, nuevoEstado: string) => {
    const notas = prompt(`Confirmar cambio de estado a "${nuevoEstado.toUpperCase()}". Ingresá observaciones (opcional):`) || undefined
    try {
      await api.cheques.updateEstado(id, { estado: nuevoEstado, notas })
      toast.success("Estado de Cheque Actualizado", `El cheque pasó a estado ${nuevoEstado}.`)
      loadData()
    } catch (e: any) {
      toast.error("Error al actualizar estado", e.message)
    }
  }

  const handleVerHistorial = async (cheque: any) => {
    setSelectedCheque(cheque)
    setLoadingHistorial(true)
    try {
      const res = await api.cheques.historial(cheque.id)
      setHistorial(Array.isArray(res) ? res : [])
    } catch {
      setHistorial([])
    } finally {
      setLoadingHistorial(false)
    }
  }

  const handleSaveCheque = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.numero) { toast.error("Ingresá el número de cheque", ""); return }
    if (!form.monto || parseFloat(form.monto) <= 0) { toast.error("Ingresá un monto válido", ""); return }
    setSaving(true)
    try {
      await api.cheques.create({
        ...form,
        monto: parseFloat(form.monto),
        supplier_id: form.supplier_id || undefined,
        bank_account_id: form.bank_account_id || undefined,
        estado: form.tipo === "emitido" ? "entregado" : "en_cartera",
      })
      toast.success("Cheque Registrado", `El cheque N° ${form.numero} fue guardado en cartera.`)
      setShowModal(false)
      setForm({
        numero: "", banco_emisor: BANCOS_PARAGUAY[0], bank_account_id: "", beneficiario: "",
        supplier_id: "", monto: "", moneda: "PYG", fecha_emision: new Date().toISOString().split("T")[0],
        fecha_pago: new Date().toISOString().split("T")[0], fecha_entrega: "", tipo: "emitido",
        diferido: false, cruzado: true, no_a_la_orden: false, observaciones: ""
      })
      loadData()
    } catch (err: any) {
      toast.error("Error al registrar cheque", err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── BANNER HERO EJECUTIVO GESTIÓN DE CHEQUES ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-80 h-80 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-blue-400 shadow-inner">
                <CreditCard className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  Clearing Bancario & Cheques Diferidos
                </span>
                <h1 className="text-2xl sm:text-lg sm:text-xl xl:text-xl 2xl:text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono tracking-tight truncate tracking-tight text-white">
                  Gestión de Cheques & Cartera
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium">
              Custodia física de cheques de clientes, compensación en cámara compensadora bancaria, cheques diferidos emitidos y control de rechazos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Cheques en Cartera
              </span>
              <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate font-mono text-emerald-400 leading-tight">
                {formatPYG(analytics.montoCartera)}
              </div>
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                {analytics.enCarteraCount} cheques en custodia física
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition shadow-xs"
                title="Actualizar datos en vivo"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => api.cheques.downloadPdf()}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4 text-red-400" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => api.cheques.downloadExcel()}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-400/30 text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black transition flex items-center gap-2 shadow-md shadow-primary/30"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Cheque</span>
              </button>
            </div>
          </div>
        </div>
      </div>

{/* BANNER EXPLICATIVO */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-300">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase text-[11px] tracking-wider text-blue-950 dark:text-blue-200 mb-0.5">
            Ciclo Operativo de Cheques en el Supermercado
          </p>
          <p className="text-blue-800 dark:text-blue-400 leading-relaxed">
            1) <b>Cheques Recibidos (Clientes / Mayoristas):</b> Ingresan en estado <i>En Cartera</i> en la caja o tesorería. Al enviarse al banco se marcan como <i>Depositados</i> hasta su compensación efectiva. 2) <b>Cheques Emitidos (Proveedores):</b> Se emiten con fecha diferida contra cuentas bancarias del supermercado para optimizar el capital de trabajo (DPO).
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="card p-4 border-blue-200/60 dark:border-blue-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Cheques en Base</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-blue-600 font-mono tracking-tight truncate">{analytics.totalCheques.toLocaleString("es-PY")}</p>
          <span className="text-xs text-gray-400 mt-1 block">Historial registrado</span>
        </div>

        <div className="card p-4 border-purple-200/60 dark:border-purple-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Monto en Cartera</span>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-purple-600 font-mono tracking-tight truncate">{formatPYG(analytics.montoCartera)}</p>
          <span className="text-xs text-purple-600 font-bold mt-1 block">{analytics.enCarteraCount} en custodia</span>
        </div>

        <div className="card p-4 border-emerald-200/60 dark:border-emerald-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Total Cobrado</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-emerald-600 font-mono tracking-tight truncate">{formatPYG(analytics.montoCobrado)}</p>
          <span className="text-xs text-emerald-600 font-bold mt-1 block">{analytics.cobradosCount} compensados</span>
        </div>

        <div className="card p-4 border-indigo-200/60 dark:border-indigo-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Emitidos Prov.</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-indigo-600 font-mono tracking-tight truncate">{formatPYG(analytics.montoEmitidos)}</p>
          <span className="text-xs text-gray-400 mt-1 block">{analytics.emitidosCount} diferidos</span>
        </div>

        <div className="card p-4 border-rose-200/60 dark:border-rose-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Rechazados</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-rose-600 font-mono tracking-tight truncate">{analytics.rechazadosCount}</p>
          <span className="text-xs text-rose-600 font-bold mt-1 block font-mono">{formatPYG(analytics.montoRechazado)}</span>
        </div>

        <div className="card p-4 border-amber-200/60 dark:border-amber-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Tasa de Rechazo</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black text-amber-600 font-mono tracking-tight truncate">{analytics.tasaRechazo}%</p>
          <span className="text-xs text-gray-400 mt-1 block">Tolerancia &lt; 2%</span>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { id: "dashboard", label: "Torre de Control", icon: Sparkles },
            { id: "cartera", label: "Cheques de Clientes en Cartera", icon: CreditCard, count: analytics.enCarteraCount },
            { id: "depositados", label: "Depositados / Clearing", icon: Landmark, count: analytics.depositadosCount },
            { id: "emitidos", label: "Emitidos a Proveedores", icon: Building2, count: analytics.emitidosCount },
            { id: "rechazados", label: "Rechazados / En Mora", icon: AlertTriangle, count: analytics.rechazadosCount },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as ChequeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.id
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  tab === t.id ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="card p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 flex-wrap text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por número, beneficiario, proveedor o banco..." className="input text-xs pl-8 w-full" />
        </div>
        <select value={filterBanco} onChange={e => setFilterBanco(e.target.value)} className="input text-xs w-auto">
          <option value="all">Todos los Bancos</option>
          {BANCOS_PARAGUAY.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="input text-xs w-auto">
          <option value="all">Todos los Estados</option>
          <option value="en_cartera">En Cartera</option>
          <option value="depositado">Depositado</option>
          <option value="cobrado">Cobrado</option>
          <option value="entregado">Entregado</option>
          <option value="rechazado">Rechazado</option>
          <option value="anulado">Anulado</option>
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="input text-xs w-auto">
          <option value="all">Todos los Tipos</option>
          <option value="recibido">Recibidos de Clientes</option>
          <option value="emitido">Emitidos a Proveedores</option>
        </select>
      </div>

      {/* TABLA PRINCIPAL DE CHEQUES */}
      <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando {cheques.length || "..."} cheques de tesorería...
          </div>
        ) : filteredCheques.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-xs">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No se encontraron cheques con los filtros seleccionados</p>
            <p className="mt-1">Probá cambiando los criterios de búsqueda o registrá un nuevo cheque.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[850px]">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 text-left">N° Cheque / Banco</th>
                  <th className="p-3.5 text-left">Beneficiario / Proveedor</th>
                  <th className="p-3.5 text-left">Emisión & Cobro</th>
                  <th className="p-3.5 text-right">Monto</th>
                  <th className="p-3.5 text-center">Tipo</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {filteredCheques.slice(0, 100).map((c: any) => {
                  const cfg = statusConfig[c.estado] || statusConfig.en_cartera
                  const esEmitido = c.tipo === "emitido" || c.bank_account_id
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <p className="font-extrabold text-gray-900 dark:text-white font-mono flex items-center gap-1.5">
                          {c.numero}
                          {c.cruzado && <span className="text-[9px] px-1 py-0.2 bg-gray-200 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-300 font-sans">Cruzado</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 font-semibold">{c.banco_emisor || "Banco Local"}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-gray-800 dark:text-gray-200">{c.beneficiario || c.supplier_nombre || supplierMap[c.supplier_id] || "Al Portador"}</p>
                        {c.supplier_id && <p className="text-[10px] text-gray-400">Prov: {supplierMap[c.supplier_id] || "Registrado"}</p>}
                      </td>
                      <td className="p-3.5">
                        <p className="font-mono text-gray-700 dark:text-gray-300">Pago: {c.fecha_pago ? formatDate(c.fecha_pago) : "Al día"}</p>
                        <p className="text-[10px] text-gray-400">Emisión: {c.fecha_emision ? formatDate(c.fecha_emision) : "—"}</p>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white text-sm">
                        {formatCurrency(c.monto, c.moneda)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${esEmitido ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"}`}>
                          {esEmitido ? "Emitido" : "Recibido"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleVerHistorial(c)} className="btn-secondary text-[10px] p-1.5" title="Ver Historial">
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {c.estado === "en_cartera" && (
                            <button onClick={() => handleUpdateEstado(c.id, "depositado")} className="btn-secondary text-[10px] px-2 py-1 text-blue-600 border-blue-200 hover:bg-blue-50">
                              Depositar
                            </button>
                          )}
                          {c.estado === "depositado" && (
                            <button onClick={() => handleUpdateEstado(c.id, "cobrado")} className="btn-primary text-[10px] px-2 py-1 bg-emerald-600 hover:bg-emerald-700">
                              Efectivizar
                            </button>
                          )}
                          {(c.estado === "depositado" || c.estado === "en_cartera") && (
                            <button onClick={() => handleUpdateEstado(c.id, "rechazado")} className="btn-secondary text-[10px] px-2 py-1 text-red-600 border-red-200 hover:bg-red-50">
                              Rechazar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredCheques.length > 100 && (
              <div className="p-3 bg-gray-50 dark:bg-slate-800 text-center text-xs text-gray-500 border-t border-gray-100 dark:border-slate-700">
                Mostrando los primeros 100 de {filteredCheques.length.toLocaleString("es-PY")} cheques. Utilizá los filtros para acotar los resultados.
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL REGISTRAR NUEVO CHEQUE */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Registrar Cheque en Tesorería</h2>
            <form onSubmit={handleSaveCheque} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Tipo de Operación *</label>
                  <select className="input text-xs" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="emitido">Cheque Emitido a Proveedor</option>
                    <option value="recibido">Cheque Recibido de Cliente</option>
                  </select>
                </div>
                <div>
                  <label className="label-sm">Número de Cheque *</label>
                  <input required className="input text-xs font-mono" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="Ej: 00482910" />
                </div>
                <div className="col-span-2">
                  <label className="label-sm">Banco Emisor *</label>
                  <select className="input text-xs" value={form.banco_emisor} onChange={e => setForm(f => ({ ...f, banco_emisor: e.target.value }))}>
                    {BANCOS_PARAGUAY.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {form.tipo === "emitido" && (
                  <div className="col-span-2">
                    <label className="label-sm">Cuenta Bancaria Origen</label>
                    <select className="input text-xs" value={form.bank_account_id} onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                      <option value="">Seleccionar cuenta...</option>
                      {bankAccounts.map((ba: any) => <option key={ba.id} value={ba.id}>{ba.banco} — {ba.numero_cuenta} ({ba.moneda})</option>)}
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="label-sm">Beneficiario / Proveedor *</label>
                  <select className="input text-xs mb-1" value={form.supplier_id} onChange={e => {
                    const sup = suppliers.find(s => s.id === e.target.value)
                    setForm(f => ({ ...f, supplier_id: e.target.value, beneficiario: sup?.razon_social || sup?.nombre || f.beneficiario }))
                  }}>
                    <option value="">Seleccionar proveedor registrado...</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.razon_social || s.nombre}</option>)}
                  </select>
                  <input required className="input text-xs" value={form.beneficiario} onChange={e => setForm(f => ({ ...f, beneficiario: e.target.value }))} placeholder="O escribir nombre del beneficiario..." />
                </div>

                <div>
                  <label className="label-sm">Monto *</label>
                  <input required type="number" step="1" className="input text-xs font-mono font-bold" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="Ej: 5000000" />
                </div>
                <div>
                  <label className="label-sm">Moneda</label>
                  <select className="input text-xs" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                    <option value="PYG">PYG (Gs.)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="label-sm">Fecha de Emisión *</label>
                  <input type="date" required className="input text-xs" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} />
                </div>
                <div>
                  <label className="label-sm">Fecha de Cobro / Pago *</label>
                  <input type="date" required className="input text-xs" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form.cruzado} onChange={e => setForm(f => ({ ...f, cruzado: e.target.checked }))} className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="font-bold text-gray-700 dark:text-gray-300">Cruzado</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form.no_a_la_orden} onChange={e => setForm(f => ({ ...f, no_a_la_orden: e.target.checked }))} className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="font-bold text-gray-700 dark:text-gray-300">No a la Orden</span>
                </label>
              </div>

              <div>
                <label className="label-sm">Observaciones / Concepto</label>
                <textarea className="input text-xs h-14" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Facturas asociadas, entrega en mano, etc." />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs px-4 py-2">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE CHEQUE */}
      {selectedCheque && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="font-extrabold text-base text-gray-900 dark:text-white uppercase">Historial del Cheque N° {selectedCheque.numero}</h2>
                <p className="text-[11px] text-gray-400">{selectedCheque.banco_emisor} · {formatPYG(selectedCheque.monto)}</p>
              </div>
              <button onClick={() => setSelectedCheque(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            {loadingHistorial ? (
              <div className="flex items-center justify-center py-8 text-xs text-gray-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando bitácora...</div>
            ) : historial.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                <p>Sin transiciones intermedias registradas.</p>
                <p className="mt-1 font-bold text-gray-600 dark:text-gray-300">Estado actual: {selectedCheque.estado}</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {historial.map((h: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold uppercase text-blue-600 dark:text-blue-400">{h.estado_nuevo || h.estado}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{h.created_at ? formatDate(h.created_at) : "—"}</span>
                    </div>
                    {h.notas && <p className="text-gray-500">{h.notas}</p>}
                    <p className="text-[10px] text-gray-400">Por: {h.usuario_nombre || "Sistema"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
