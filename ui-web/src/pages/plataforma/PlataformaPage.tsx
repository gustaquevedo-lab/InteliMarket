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
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto flex flex-col gap-6">
      {/* Hero Banner Ejecutivo */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/50 border border-slate-800/80 p-6 sm:p-8 shadow-2xl">
        {/* Glow ambient orbs */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-10 w-64 h-64 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-xs">
              <Radar className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Telemetría & Operaciones Supermercado · Superadmin</span>
              {ov && ov.environment_api !== "production" && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">API {ov.environment_api.toUpperCase()}</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              Consola de Plataforma
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/85 max-w-2xl leading-relaxed">
              Monitoreo centralizado de incidencias, auditoría de eventos, salud de cajas y conectividad de servicios en Extra Supermercado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-bold transition-all shadow-xs backdrop-blur-md cursor-pointer disabled:opacity-50"
            >
              <Activity className={cx("w-3.5 h-3.5 text-indigo-400", loading && "animate-spin")} />
              <span>{loading ? "Sincronizando..." : "Actualizar"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Glassmorphism */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-x-auto shadow-xs">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => goTab(key)}
              className={cx(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 whitespace-nowrap cursor-pointer",
                active
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50",
              )}
            >
              <Icon className={cx("w-4 h-4", active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
              <span>{label}</span>
              {key === "incidencias" && abiertas > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none shadow-xs">
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
