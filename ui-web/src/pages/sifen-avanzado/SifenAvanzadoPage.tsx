import { useState, useEffect } from "react"
import {
  BarChart3, FileText, BookOpen, ReceiptText, Truck, FileScan, ShieldCheck,
  Plus, Search, Loader2, CheckCircle, XCircle, Download, Upload,
  ExternalLink, FileSpreadsheet,
} from "lucide-react"
import { api } from "../../api/index"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

export default function SifenAvanzadoPage() {
  const [tab, setTab] = useState("dashboard")

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cumplimiento DNIT/SIFEN Avanzado</h1>
          <p className="text-sm text-gray-500 mt-1">Facturación Distribuidora, Libros IVA, Retenciones, DGR, e-Kuatia, CDC</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto px-4 border-b border-gray-100 dark:border-gray-700">
          {[
            { key: "dashboard",     label: "Dashboard",      icon: BarChart3 },
            { key: "facturacion",   label: "Facturación",    icon: FileText },
            { key: "libros",        label: "Libros IVA",     icon: BookOpen },
            { key: "retenciones",   label: "Retenciones",    icon: ReceiptText },
            { key: "dgr",           label: "DGR Vehículos",  icon: Truck },
            { key: "ekuatia",       label: "e-Kuatia Docs",  icon: FileScan },
            { key: "cdc",           label: "CDC",             icon: ShieldCheck },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition
                ${tab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard"    && <DashboardTab />}
      {tab === "facturacion"  && <FacturacionTab />}
      {tab === "libros"       && <LibrosTab />}
      {tab === "retenciones"  && <RetencionesTab />}
      {tab === "dgr"          && <DgrTab />}
      {tab === "ekuatia"      && <EkuatiaTab />}
      {tab === "cdc"          && <CdcTab />}
    </div>
  )
}

function Spinner() { return <Loader2 className="w-4 h-4 animate-spin" /> }

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════ DASHBOARD ═══════════════════════

function DashboardTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.sifenAvanzado?.getDashboard(COMPANY_ID).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (!data) return <p className="text-center text-gray-500 py-12">Configure la integración SIFEN para ver el dashboard</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={FileText} label="Facturas del Mes" value={data.total_facturas_mes} color="blue" />
        <KpiCard icon={ShieldCheck} label="Con CDC" value={data.facturas_con_cdc} sub={`${data.total_facturas_mes > 0 ? Math.round(data.facturas_con_cdc / data.total_facturas_mes * 100) : 0}%`} color="green" />
        <KpiCard icon={XCircle} label="Pendientes SIFEN" value={data.facturas_pendientes_sifen} color="yellow" />
        <KpiCard icon={XCircle} label="Rechazadas" value={data.facturas_rechazadas} color="red" />
        <KpiCard icon={FileScan} label="Docs. e-Kuatia" value={data.documentos_ekuatia} color="indigo" />
        <KpiCard icon={Truck} label="Vehículos DGR" value={data.vehiculos_registrados} color="purple" />
        <KpiCard icon={ShieldCheck} label="CDC Válidos" value={data.cdc_validados} color="green" />
        <KpiCard icon={CheckCircle} label="Compliance" value={`${data.compliance_score}%`} color={data.compliance_score >= 80 ? "green" : data.compliance_score >= 50 ? "yellow" : "red"} />
      </div>
    </div>
  )
}

// ═══════════════════════ FACTURACIÓN ═══════════════════════

function FacturacionTab() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [form, setForm] = useState({
    customer_id: "", condicion: "credito", plazo_dias: 30, cuotas: 1,
    items: [{ product_id: "", descripcion: "", cantidad: 1, precio_unitario: 0, iva_tasa: 10 }],
  })

  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: "", descripcion: "", cantidad: 1, precio_unitario: 0, iva_tasa: 10 }] })

  const submit = async () => {
    setLoading(true)
    try {
      const res = await api.sifenAvanzado?.sendDistribuidoraInvoice({ ...form, company_id: COMPANY_ID })
      setResult(res)
    } catch { setResult({ error: "Error al emitir factura" }) }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">Nueva Factura Distribuidora</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div><label className="block text-xs text-gray-500 mb-1">Cliente ID</label>
            <input value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Condición</label>
            <select value={form.condicion} onChange={(e) => setForm({ ...form, condicion: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
              <option value="credito">Crédito</option>
              <option value="contado">Contado</option>
              <option value="exportacion">Exportación</option>
            </select>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Plazo (días)</label>
            <input type="number" value={form.plazo_dias} onChange={(e) => setForm({ ...form, plazo_dias: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
        </div>

        <h4 className="text-sm font-medium text-gray-600 mb-2">Items</h4>
        {form.items.map((item: any, i: number) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input value={item.descripcion} onChange={(e) => {
              const items = [...form.items]; items[i].descripcion = e.target.value; setForm({ ...form, items })
            }} placeholder="Descripción" className="col-span-2 px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            <input type="number" value={item.cantidad} onChange={(e) => {
              const items = [...form.items]; items[i].cantidad = Number(e.target.value); setForm({ ...form, items })
            }} placeholder="Cant." className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            <input type="number" value={item.precio_unitario} onChange={(e) => {
              const items = [...form.items]; items[i].precio_unitario = Number(e.target.value); setForm({ ...form, items })
            }} placeholder="Precio" className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            <input type="number" value={item.iva_tasa} onChange={(e) => {
              const items = [...form.items]; items[i].iva_tasa = Number(e.target.value); setForm({ ...form, items })
            }} placeholder="IVA %" className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <button onClick={addItem} className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200">+ Item</button>
          <button onClick={submit} disabled={loading} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Spinner /> : "Emitir Factura"}
          </button>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-xl border ${result.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <p className="font-medium">{result.error ? `Error: ${result.error}` : `Factura ${result.numero} emitida`}</p>
          {result.cdc && <p className="text-sm mt-1">CDC: <span className="font-mono">{result.cdc}</span></p>}
          {result.sifen_estado && <p className="text-sm">SIFEN: {result.sifen_estado}</p>}
          {result.total && <p className="text-sm font-bold">Total: ${Intl.NumberFormat().format(result.total)}</p>}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════ LIBROS IVA ═══════════════════════

function LibrosTab() {
  const [tipo, setTipo] = useState("ventas")
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.sifenAvanzado?.getIvaBook(tipo, COMPANY_ID, periodo)
      setData(res)
    } catch { setData(null) }
    setLoading(false)
  }

  const download = () => {
    window.open(`/api/v1/sifen-avanzado/iva-books/${tipo}/export?company_id=${COMPANY_ID}&periodo=${periodo}`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-end gap-3 mb-4">
          <div><label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
              <option value="ventas">Libro IVA Ventas</option>
              <option value="compras">Libro IVA Compras</option>
            </select>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Período</label>
            <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="YYYY-MM" className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <button onClick={load} disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Spinner /> : "Consultar"}
          </button>
          {data && (
            <button onClick={download} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Download className="w-4 h-4" />CSV DNIT
            </button>
          )}
        </div>

        {data && (
          <>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
              <KpiCard icon={FileSpreadsheet} label="Base 5%" value={`$${Intl.NumberFormat().format(data.total_base_5)}`} color="blue" />
              <KpiCard icon={FileSpreadsheet} label="Base 10%" value={`$${Intl.NumberFormat().format(data.total_base_10)}`} color="indigo" />
              <KpiCard icon={FileSpreadsheet} label="Exenta" value={`$${Intl.NumberFormat().format(data.total_exenta)}`} color="purple" />
              <KpiCard icon={FileSpreadsheet} label="IVA 5%" value={`$${Intl.NumberFormat().format(data.total_iva_5)}`} color="yellow" />
              <KpiCard icon={FileSpreadsheet} label="IVA 10%" value={`$${Intl.NumberFormat().format(data.total_iva_10)}`} color="green" />
              <KpiCard icon={FileSpreadsheet} label="Total" value={`$${Intl.NumberFormat().format(data.total_general)}`} color="red" />
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 border-b">
                  <th className="text-left px-3 py-2 font-medium">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium">Nro.</th>
                  <th className="text-left px-3 py-2 font-medium">RUC</th>
                  <th className="text-left px-3 py-2 font-medium">Razón Social</th>
                  <th className="text-right px-3 py-2 font-medium">Base 5%</th>
                  <th className="text-right px-3 py-2 font-medium">Base 10%</th>
                  <th className="text-right px-3 py-2 font-medium">Exenta</th>
                  <th className="text-right px-3 py-2 font-medium">IVA 5%</th>
                  <th className="text-right px-3 py-2 font-medium">IVA 10%</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr></thead>
                <tbody>
                  {data.entries?.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 text-xs">{e.fecha}</td>
                      <td className="px-3 py-2 font-mono text-xs">{e.numero_documento}</td>
                      <td className="px-3 py-2 text-xs">{e.ruc}</td>
                      <td className="px-3 py-2 text-xs">{e.razon_social}</td>
                      <td className="px-3 py-2 text-right text-xs">{Intl.NumberFormat().format(e.base_gravada_5)}</td>
                      <td className="px-3 py-2 text-right text-xs">{Intl.NumberFormat().format(e.base_gravada_10)}</td>
                      <td className="px-3 py-2 text-right text-xs">{Intl.NumberFormat().format(e.exenta)}</td>
                      <td className="px-3 py-2 text-right text-xs">{Intl.NumberFormat().format(e.iva_5)}</td>
                      <td className="px-3 py-2 text-right text-xs">{Intl.NumberFormat().format(e.iva_10)}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium">{Intl.NumberFormat().format(e.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════ RETENCIONES ═══════════════════════

function RetencionesTab() {
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.sifenAvanzado?.getRetentionBook(COMPANY_ID, periodo)
      setData(res)
    } catch { setData(null) }
    setLoading(false)
  }

  const download = () => {
    window.open(`/api/v1/sifen-avanzado/retention-books/export?company_id=${COMPANY_ID}&periodo=${periodo}`, "_blank")
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-end gap-3 mb-4">
          <div><label className="block text-xs text-gray-500 mb-1">Período</label>
            <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <button onClick={load} disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Spinner /> : "Consultar"}
          </button>
          {data && (
            <button onClick={download} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Download className="w-4 h-4" />CSV DNIT
            </button>
          )}
        </div>

        {data && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <KpiCard icon={ReceiptText} label="Retenido IVA" value={`$${Intl.NumberFormat().format(data.total_retenido_iva)}`} color="blue" />
              <KpiCard icon={ReceiptText} label="Retenido IRP" value={`$${Intl.NumberFormat().format(data.total_retenido_irp)}`} color="yellow" />
              <KpiCard icon={ReceiptText} label="Total Retenido" value={`$${Intl.NumberFormat().format(data.total_general)}`} color="red" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 border-b">
                  <th className="text-left px-3 py-2 font-medium">Nro.</th>
                  <th className="text-left px-3 py-2 font-medium">RUC</th>
                  <th className="text-left px-3 py-2 font-medium">Proveedor</th>
                  <th className="text-center px-3 py-2 font-medium">Tipo</th>
                  <th className="text-right px-3 py-2 font-medium">Base</th>
                  <th className="text-right px-3 py-2 font-medium">Tasa</th>
                  <th className="text-right px-3 py-2 font-medium">Monto</th>
                  <th className="text-center px-3 py-2 font-medium">CDC</th>
                </tr></thead>
                <tbody>
                  {data.entries?.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-3 py-2 text-xs">{e.numero_documento || "—"}</td>
                      <td className="px-3 py-2 text-xs">{e.ruc_proveedor}</td>
                      <td className="px-3 py-2 text-xs">{e.nombre_proveedor}</td>
                      <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">{e.tipo_retencion}</span></td>
                      <td className="px-3 py-2 text-right text-xs">{Intl.NumberFormat().format(e.base_imponible)}</td>
                      <td className="px-3 py-2 text-right text-xs">{e.tasa}%</td>
                      <td className="px-3 py-2 text-right text-xs font-medium">{Intl.NumberFormat().format(e.monto_retenido)}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs">{e.cdc?.slice(0, 12) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════ DGR ═══════════════════════

function DgrTab() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    const [v, r] = await Promise.all([
      api.sifenAvanzado?.listDgrVehicles(COMPANY_ID).catch(() => []),
      api.sifenAvanzado?.listDgrReports(COMPANY_ID).catch(() => []),
    ])
    setVehicles(v || [])
    setReports(r || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const generateReport = async () => {
    const periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
    await api.sifenAvanzado?.generateDgrReport(COMPANY_ID, periodo)
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Vehículos Registrados ({vehicles.length})</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />Nuevo Vehículo
          </button>
          <button onClick={generateReport} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            <Download className="w-4 h-4" />Generar Reporte DGR
          </button>
        </div>
      </div>

      {showNew && <NewVehicleForm onDone={() => { setShowNew(false); load() }} />}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500">
              <th className="text-left px-4 py-3 font-medium">Patente</th>
              <th className="text-left px-4 py-3 font-medium">Marca</th>
              <th className="text-left px-4 py-3 font-medium">Modelo</th>
              <th className="text-center px-4 py-3 font-medium">Año</th>
              <th className="text-center px-4 py-3 font-medium">Tipo</th>
              <th className="text-right px-4 py-3 font-medium">Cap. (Tn)</th>
              <th className="text-center px-4 py-3 font-medium">Estado</th>
            </tr></thead>
            <tbody>
              {vehicles.map((v: any) => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-bold">{v.patente}</td>
                  <td className="px-4 py-3">{v.marca}</td>
                  <td className="px-4 py-3">{v.modelo}</td>
                  <td className="px-4 py-3 text-center">{v.anio}</td>
                  <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded text-xs bg-gray-100">{v.tipo}</span></td>
                  <td className="px-4 py-3 text-right">{v.capacidad_toneladas || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${v.activo ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                      {v.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin vehículos registrados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {reports.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Reportes Generados</h4>
          {reports.map((r: any) => (
            <div key={r.id} className="flex justify-between py-2 border-b text-sm">
              <span>DGR {r.tipo} - {r.periodo}</span>
              <span className="text-gray-500">{r.cantidad_vehiculos} vehículos</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewVehicleForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ patente: "", marca: "", modelo: "", anio: 2024, tipo: "camioneta", chasis: "", motor: "", capacidad_toneladas: 0, propietario: "", color: "" })
  const submit = async () => {
    await api.sifenAvanzado?.createDgrVehicle({ ...form, company_id: COMPANY_ID })
    onDone()
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className="block text-xs text-gray-500 mb-1">Patente</label>
          <input value={form.patente} onChange={(e) => setForm({ ...form, patente: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Marca</label>
          <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Modelo</label>
          <input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Año</label>
          <input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600">
            <option value="camioneta">Camioneta</option>
            <option value="camion">Camión</option>
            <option value="furgon">Furgón</option>
            <option value="motocicleta">Motocicleta</option>
            <option value="automovil">Automóvil</option>
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Capacidad (Tn)</label>
          <input type="number" value={form.capacidad_toneladas} onChange={(e) => setForm({ ...form, capacidad_toneladas: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={submit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Registrar</button>
        <button onClick={onDone} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300">Cancelar</button>
      </div>
    </div>
  )
}

// ═══════════════════════ e-KUATIA ═══════════════════════

function EkuatiaTab() {
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const d = await api.sifenAvanzado?.listEkuatiaDocuments(COMPANY_ID).catch(() => [])
    setDocs(d || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const verify = async (id: string) => {
    await api.sifenAvanzado?.verifyEkuatiaDocument(id)
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Documentos Digitalizados ({docs.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500">
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Nombre</th>
              <th className="text-center px-3 py-2 font-medium">Validez Legal</th>
              <th className="text-left px-3 py-2 font-medium">Digitalizado</th>
            </tr></thead>
            <tbody>
              {docs.map((d: any) => (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600">{d.tipo_documento}</span></td>
                  <td className="px-3 py-2 text-xs">{d.nombre_original}</td>
                  <td className="px-3 py-2 text-center">
                    {d.validez_legal
                      ? <span className="text-green-600 text-xs flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" />Válido</span>
                      : <button onClick={() => verify(d.id)} className="px-2 py-0.5 text-xs bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100">Verificar</button>
                    }
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{d.fecha_digitalizacion ? new Date(d.fecha_digitalizacion).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">Sin documentos digitalizados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════ CDC ═══════════════════════

function CdcTab() {
  const [saleId, setSaleId] = useState("")
  const [cdc, setCdc] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const validate = async () => {
    if (!saleId || !cdc) return
    setLoading(true)
    try {
      const res = await api.sifenAvanzado?.validateCdc(COMPANY_ID, saleId, cdc)
      setResult(res)
    } catch { setResult({ valido: false, mensaje: "Error de conexión" }) }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">Validación de CDC contra DNIT</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div><label className="block text-xs text-gray-500 mb-1">Venta ID</label>
            <input value={saleId} onChange={(e) => setSaleId(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div className="md:col-span-2"><label className="block text-xs text-gray-500 mb-1">CDC (44 caracteres)</label>
            <input value={cdc} onChange={(e) => setCdc(e.target.value)} maxLength={44} placeholder="CDC de 44 caracteres alfanuméricos" className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono" />
          </div>
        </div>
        <button onClick={validate} disabled={loading || !saleId || !cdc}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Spinner /> : <ShieldCheck className="w-4 h-4" />}
          Validar CDC
        </button>

        {result && (
          <div className={`mt-4 p-4 rounded-xl border ${result.valido ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2">
              {result.valido ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
              <span className="font-medium">{result.mensaje}</span>
            </div>
            {result.cdc && <p className="text-xs font-mono mt-1 text-gray-500">{result.cdc}</p>}
            {result.fecha_consulta && <p className="text-xs text-gray-400 mt-1">Consulta: {new Date(result.fecha_consulta).toLocaleString()}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
