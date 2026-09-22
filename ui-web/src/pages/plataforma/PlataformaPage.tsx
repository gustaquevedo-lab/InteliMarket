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
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto flex flex-col gap-6">
      {/* ── HERO INSTITUCIONAL — CONSOLA DE PLATAFORMA ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-black">
                <Radar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    Telemetría &amp; Operaciones Supermercado · Superadmin
                  </span>
                  {ov && ov.environment_api !== "production" && (
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                      API {ov.environment_api.toUpperCase()}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Consola de Plataforma
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Monitoreo centralizado de incidencias, auditoría de eventos, salud de cajas y conectividad de servicios en Extra Supermercado.
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🌐 Entorno: {env === "production" ? "Producción (8000/8002)" : env === "sandbox" ? "Sandbox (8001)" : "Todo"}
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-400">
                ⚠️ {abiertas} incidencia(s) abiertas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                ⚡ {ov?.events_24h_total || 0} eventos procesados (24h)
              </span>
            </div>
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
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Sincronizar telemetría"
            >
              <Activity className={cx("w-4 h-4 text-indigo-400", loading && "animate-spin")} />
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
