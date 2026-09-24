import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Activity, Bug, BellRing, Building2, Cpu, Plug, Radar, ScrollText, ShieldCheck } from "lucide-react"
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
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* ── LUXURY COMMAND DECK HEADER (IDÉNTICO A REPORTS/BUSINESS INTELLIGENCE) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Radar className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    TELEMETRÍA &amp; OPERACIONES · SUPERADMIN
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    EXTRA SUPERMERCADO · SRE &amp; STATUS
                  </span>
                  {ov && ov.environment_api !== "production" && (
                    <span className="ml-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase font-mono">
                      API {ov.environment_api}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Consola de Plataforma &amp; Monitoreo Central
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Monitoreo centralizado de incidencias, auditoría de eventos, salud de cajas y conectividad de servicios
                </p>
              </div>
            </div>

            {/* Micro pills idénticos a reports */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🇵🇾 Zona Horaria: America/Asuncion
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                🌐 Entorno: {env === "production" ? "Producción (8000/8002)" : env === "sandbox" ? "Sandbox (8001)" : "Todo"}
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-rose-400">
                ⚠️ {abiertas} incidencia(s) abiertas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                ⚡ {ov?.events_24h_total || 0} eventos en 24h
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-black shadow-lg transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Activity className={cx("w-4 h-4", loading && "animate-spin")} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* ── TABS DE NAVEGACIÓN (IDÉNTICOS A REPORTS) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => goTab(key)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
                active
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
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
