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
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Radar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">Consola de Plataforma</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Activity className={cx("w-3 h-3", loading && "animate-pulse text-indigo-500")} />
              Solo superadministradores · se actualiza sola cada 20 s
              {ov && ov.environment_api !== "production" && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-[10px]">API {ov.environment_api}</span>}
            </p>
          </div>
        </div>
        <Segmented<Env> value={env} onChange={setEnv} options={[{ value: "production", label: "Producción" }, { value: "sandbox", label: "Sandbox" }, { value: "all", label: "Todo" }]} />
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 -mx-1 px-1">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => goTab(key)}
            className={cx(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-black whitespace-nowrap border-b-2 -mb-px transition cursor-pointer",
              tab === key ? "border-indigo-600 text-indigo-700 dark:text-indigo-300 dark:border-indigo-400" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === "incidencias" && abiertas > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] leading-[18px] text-center">{abiertas}</span>}
          </button>
        ))}
      </nav>

      <Suspense fallback={<div className="py-16 text-center text-xs text-slate-400 font-bold">Cargando…</div>}>
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
