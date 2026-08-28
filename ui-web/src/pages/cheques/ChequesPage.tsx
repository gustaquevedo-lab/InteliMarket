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
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/90 text-white p-7 border border-purple-500/20 shadow-2xl shadow-purple-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/30 text-white flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <CreditCard className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-purple-400 uppercase bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                    FINANZAS & TESORERÍA · CARTERA DE CHEQUES & CLEARING BANCARIO
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    {analytics.enCarteraCount} Cheques en Cartera
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Gestión de Cheques & Cartera
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Custodia de cheques de clientes, clearing compensador bancario, cheques diferidos a proveedores y control de rechazos
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                💼 {formatPYG(analytics.montoCartera)} en custodia
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                ✅ {formatPYG(analytics.montoCobrado)} compensados
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-400" : ""}`} />
            </button>
            <button
              onClick={() => api.cheques.downloadPdf()}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4 text-rose-400" />
              <span>PDF</span>
            </button>
            <button
              onClick={() => api.cheques.downloadExcel()}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-purple-500/25"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Cheque</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cheques en Base</span>
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {analytics.totalCheques.toLocaleString("es-PY")}
            </p>
            <p className="text-[11px] text-slate-400">Historial registrado</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monto en Cartera</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-purple-300">
              {formatPYG(analytics.montoCartera)}
            </p>
            <p className="text-[11px] text-purple-300 font-bold">{analytics.enCarteraCount} en custodia</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Cobrado</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(analytics.montoCobrado)}
            </p>
            <p className="text-[11px] text-slate-400">{analytics.cobradosCount} compensados</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Emitidos Prov.</span>
              <ArrowUpRight className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-indigo-300">
              {formatPYG(analytics.montoEmitidos)}
            </p>
            <p className="text-[11px] text-slate-400">{analytics.emitidosCount} diferidos</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rechazados</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-rose-400">
              {analytics.rechazadosCount}
            </p>
            <p className="text-[11px] text-rose-400 font-mono font-bold">{formatPYG(analytics.montoRechazado)}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tasa Rechazo</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {analytics.tasaRechazo}%
            </p>
            <p className="text-[11px] text-slate-400">Tolerancia &lt; 2%</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "dashboard", label: "Torre de Control", icon: Sparkles },
          { id: "cartera", label: "Cheques en Cartera", icon: CreditCard, count: analytics.enCarteraCount },
          { id: "depositados", label: "Depositados / Clearing", icon: Landmark, count: analytics.depositadosCount },
          { id: "emitidos", label: "Emitidos a Proveedores", icon: Building2, count: analytics.emitidosCount },
          { id: "rechazados", label: "Rechazados / En Mora", icon: AlertTriangle, count: analytics.rechazadosCount },
        ].map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as ChequeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
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
