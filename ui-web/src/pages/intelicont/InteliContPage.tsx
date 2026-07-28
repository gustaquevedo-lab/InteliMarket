import { useState, useEffect } from "react"
import {
  BookOpen, RefreshCw, Loader2, CheckCircle, XCircle, Clock, AlertTriangle,
  Search, Plus, Settings, List, BarChart3, ArrowUpDown, FileText,
} from "lucide-react"
import { api, type InteliContEntry } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

const statusColor = (s: string) =>
  s === "sincronizado" || s === "completado" ? "bg-green-100 text-green-700" :
  s === "error" ? "bg-red-100 text-red-700" :
  s === "pendiente" ? "bg-yellow-100 text-yellow-700" :
  "bg-gray-100 text-gray-700"

export default function InteliContPage() {
  const [tab, setTab] = useState<"entries" | "pending" | "config" | "stats">("entries")
  const toast = useToast()

  const [entries, setEntries] = useState<InteliContEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [pending, setPending] = useState<any[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState("")

  const fetchEntries = async () => {
    setEntriesLoading(true)
    try {
      const data = await api.intelicont.entries()
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }

  const fetchPending = async () => {
    setPendingLoading(true)
    try {
      const data = await api.intelicont.pending()
      setPending(Array.isArray(data) ? data : [])
    } catch {
      setPending([])
    } finally {
      setPendingLoading(false)
    }
  }

  useEffect(() => { if (tab === "entries") fetchEntries() }, [tab])
  useEffect(() => { if (tab === "pending") fetchPending() }, [tab])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.intelicont.bulkSync()
      toast.success("Sincronizado", "Asientos contables sincronizados")
      fetchPending()
      fetchEntries()
    } catch {
      toast.error("Error", "No se pudo sincronizar")
    } finally {
      setSyncing(false)
    }
  }

  const handleGenerate = async () => {
    try {
      await api.intelicont.generate()
      toast.success("Generado", "Asientos contables generados")
      fetchPending()
      fetchEntries()
    } catch {
      toast.error("Error", "No se pudo generar")
    }
  }

  const [config, setConfig] = useState<any>(null)
  const [configForm, setConfigForm] = useState({ auto_sync: false, sync_interval_minutes: 60, url_base: "", api_key: "" })
  const [savingConfig, setSavingConfig] = useState(false)

  const fetchConfig = async () => {
    try {
      const data = await api.intelicont.syncConfig()
      setConfig(data)
      if (data) {
        setConfigForm({
          auto_sync: data.auto_sync ?? false,
          sync_interval_minutes: data.sync_interval_minutes ?? 60,
          url_base: data.url_base ?? "",
          api_key: "",
        })
      }
    } catch {}
  }

  useEffect(() => { if (tab === "config") fetchConfig() }, [tab])

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      await api.intelicont.updateSyncConfig(configForm)
      toast.success("Configuración guardada", "InteliCont configurado")
    } catch {
      toast.error("Error", "No se pudo guardar")
    } finally {
      setSavingConfig(false)
    }
  }

  const filtered = search
    ? entries.filter(e =>
        (e.numero ?? "").includes(search) ||
        (e.concepto ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.cuenta_nombre ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : entries

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">InteliCont</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Contabilidad integrada</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { k: "entries" as const, l: "Asientos", i: List },
          { k: "pending" as const, l: "Pendientes", i: Clock },
          { k: "config" as const, l: "Configuración", i: Settings },
          { k: "stats" as const, l: "Estadísticas", i: BarChart3 },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.k ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <t.i className="w-4 h-4" />{t.l}
          </button>
        ))}
      </div>

      {tab === "entries" && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Buscar asientos..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
            </div>
            <button onClick={handleGenerate} className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm">
              <Plus className="w-4 h-4" />Generar
            </button>
            <button onClick={fetchEntries} disabled={entriesLoading} className="p-2 rounded-lg text-gray-400 hover:text-primary"><RefreshCw className={`w-4 h-4 ${entriesLoading ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debe</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Haber</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {entriesLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay asientos contables</td></tr>
                ) : (
                  filtered.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{e.fecha ? new Date(e.fecha).toLocaleDateString("es-PY") : "-"}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{e.numero ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{e.concepto ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono">{e.monto_debe ? formatPYG(e.monto_debe) : "-"}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono">{e.monto_haber ? formatPYG(e.monto_haber) : "-"}</td>
                      <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(e.estado ?? "")}`}>{e.estado ?? "-"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "pending" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Sincronizar todo
            </button>
            <button onClick={fetchPending} disabled={pendingLoading} className="p-2 rounded-lg text-gray-400 hover:text-primary"><RefreshCw className={`w-4 h-4 ${pendingLoading ? "animate-spin" : ""}`} /></button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : pending.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hay asientos pendientes de sincronizar</td></tr>
                ) : (
                  pending.map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{e.fecha ? new Date(e.fecha).toLocaleDateString("es-PY") : "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{e.tipo_asiento ?? e.tipo ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{e.descripcion ?? e.concepto ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono">{e.total_debe ? formatPYG(e.total_debe) : "-"}</td>
                      <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(e.sync_status ?? e.estado ?? "")}`}>{e.sync_status ?? e.estado ?? "-"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="max-w-2xl">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Configuración de InteliCont</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL Base (ERP Contable)</label>
                <input type="text" value={configForm.url_base} onChange={e => setConfigForm({ ...configForm, url_base: e.target.value })}
                  placeholder="http://intelicont:8000"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                <input type="password" value={configForm.api_key} onChange={e => setConfigForm({ ...configForm, api_key: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Intervalo de sync (minutos)</label>
                <input type="number" value={configForm.sync_interval_minutes} onChange={e => setConfigForm({ ...configForm, sync_interval_minutes: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Auto Sync</span>
                  <p className="text-xs text-gray-500">Sincronizar automáticamente los asientos</p>
                </div>
                <button onClick={() => setConfigForm({ ...configForm, auto_sync: !configForm.auto_sync })}
                  className={`w-12 h-6 rounded-full transition-colors ${configForm.auto_sync ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"} relative`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${configForm.auto_sync ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
              <button onClick={handleSaveConfig} disabled={savingConfig}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><List className="w-6 h-6 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Total Asientos</p>
                <p className="text-2xl font-bold">{entries.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"><Clock className="w-6 h-6 text-yellow-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Pendientes</p>
                <p className="text-2xl font-bold">{pending.length}</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Sincronizados</p>
                <p className="text-2xl font-bold">{entries.filter(e => e.estado === "sincronizado" || e.estado === "completado").length}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
