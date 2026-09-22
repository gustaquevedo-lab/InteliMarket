import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Activity, Bug, BellRing, Building2, Cpu, Plug, Radar, ScrollText } from "lucide-react"
import { platform, type Env, type Overview } from "../../api/platform"
import { Segmented, cx } from "./ui"
import ResumenTab from "./ResumenTab"
import IncidenciasTab from "./IncidenciasTab"
import { AlertasTab, AuditoriaTab } from "./AuditoriaAlertasTabs"

const IntegracionesTab = lazy(() => import("./IntegracionesTab"))
const CajasTab = lazy(() => import("./CajasTab"))
const TenantsTab = lazy(() => import("./TenantsTab"))

const TABS = [
  { key: "resumen", label: "Resumen", Icon: Radar },
  { key: "incidencias", label: "Incidencias", Icon: Bug },
  { key: "integraciones", label: "Integraciones", Icon: Plug },
  { key: "cajas", label: "Cajas y terminales", Icon: Cpu },
  { key: "tenants", label: "Empresas", Icon: Building2 },
  { key: "auditoria", label: "Auditoría", Icon: ScrollText },
  { key: "alertas", label: "Alertas", Icon: BellRing },
] as const

export default function PlataformaPage() {
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get("tab") || "resumen"
  const issueParam = sp.get("issue")
  const [env, setEnvState] = useState<Env>(() => {
    try { return (localStorage.getItem("plat_env") as Env) || "production" } catch { return "production" }
  })
  const [ov, setOv] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)

  const setEnv = (e: Env) => { setEnvState(e); try { localStorage.setItem("plat_env", e) } catch { /* nada */ } }
  const goTab = (t: string) => {
    if (t === "salud") { nav("/salud-sistema"); return }
    const n = new URLSearchParams(sp); n.set("tab", t); n.delete("issue"); n.delete("provider"); setSp(n, { replace: true })
  }
  const setIssue = useCallback((id: string | null) => {
    const n = new URLSearchParams(window.location.search)
    if (id) n.set("issue", id); else n.delete("issue")
    setSp(n, { replace: true })
  }, [setSp])

  const load = useCallback(async () => {
    setLoading(true)
    try { setOv(await platform.overview(env)) } catch { /* el panel sigue con lo ultimo */ } finally { setLoading(false) }
  }, [env])
  useEffect(() => { setOv(null); void load() }, [load])
  useEffect(() => { const t = setInterval(() => { void load() }, 20000); return () => clearInterval(t) }, [load])

  const abiertas = ov?.issues.unresolved || 0

  return (
    <div className="space-y-6">
      {/* ── HEADER DE PLATAFORMA (IDÉNTICO A BUSINESS INTELLIGENCE) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/20">
              <Radar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">
                  Consola de Plataforma &amp; Telemetría
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Superadmin &amp; SRE
                </span>
                {ov && ov.environment_api !== "production" && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-black font-mono">
                    API {ov.environment_api.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Monitoreo centralizado de incidencias, auditoría de eventos, salud de cajas y conectividad en Extra Supermercado
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Segmented<Env>
            value={env}
            onChange={setEnv}
            options={[
              { value: "production", label: "Producción" },
              { value: "sandbox", label: "Sandbox" },
              { value: "all", label: "Todo" },
            ]}
          />
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 rounded-xl shadow-md shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50"
            title="Sincronizar telemetría"
          >
            <Activity className={cx("w-3.5 h-3.5", loading && "animate-spin")} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* ── TABS BAR (IDÉNTICO A BUSINESS INTELLIGENCE) ── */}
      <div className="flex gap-1.5 bg-gray-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1.5 w-full overflow-x-auto shadow-inner">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => goTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                active
                  ? "bg-white dark:bg-slate-700 shadow-md text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-500/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {key === "incidencias" && abiertas > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none">
                  {abiertas}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-2"><Activity className="w-5 h-5 animate-spin text-indigo-500" /> Cargando vista…</div>}>
        {tab === "resumen" && <ResumenTab ov={ov} loading={loading} goTab={goTab} onOpenIssue={(id) => { const n = new URLSearchParams(sp); n.set("tab", "incidencias"); n.set("issue", id); setSp(n, { replace: true }) }} />}
        {tab === "incidencias" && <IncidenciasTab env={env} initialIssueId={issueParam} initialProvider={sp.get("provider")} onOpenChange={setIssue} />}
        {tab === "integraciones" && <IntegracionesTab env={env} />}
        {tab === "cajas" && <CajasTab />}
        {tab === "tenants" && <TenantsTab />}
        {tab === "auditoria" && <AuditoriaTab />}
        {tab === "alertas" && <AlertasTab />}
      </Suspense>
    </div>
  )
}
