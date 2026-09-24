import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Lightbulb,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ListChecks,
  MonitorSmartphone,
  CheckCircle2,
  Users,
  AlertTriangle,
  Keyboard,
  GraduationCap,
  ShieldAlert,
  Info,
  LayoutGrid,
  FileText,
} from "lucide-react"
import { MANUAL_CATEGORIES, ALL_MANUAL_MODULES } from "./index"
import { MockBlockViewer } from "./MockVisuals"
import type { ManualModule } from "./types"

const iconBgMap: Record<string, string> = {
  indigo: "from-indigo-500 to-indigo-600",
  purple: "from-purple-500 to-purple-600",
  slate: "from-slate-600 to-slate-700",
  gray: "from-gray-500 to-gray-600",
  amber: "from-amber-500 to-orange-500",
  blue: "from-blue-500 to-blue-600",
  emerald: "from-emerald-500 to-teal-600",
  green: "from-green-500 to-emerald-600",
  red: "from-red-500 to-rose-600",
  teal: "from-teal-500 to-cyan-600",
  cyan: "from-cyan-500 to-sky-600",
  violet: "from-violet-500 to-purple-600",
  rose: "from-rose-500 to-pink-600",
  orange: "from-orange-500 to-amber-600",
  fuchsia: "from-fuchsia-500 to-pink-600",
  sky: "from-sky-500 to-blue-600",
}

const tintMap: Record<string, string> = {
  indigo: "text-indigo-600",
  purple: "text-purple-600",
  slate: "text-slate-600",
  gray: "text-gray-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
  emerald: "text-emerald-600",
  green: "text-green-600",
  red: "text-red-600",
  teal: "text-teal-600",
  cyan: "text-cyan-600",
  violet: "text-violet-600",
  rose: "text-rose-600",
  orange: "text-orange-600",
  fuchsia: "text-fuchsia-600",
  sky: "text-sky-600",
}

const chipMap: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  green: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  fuchsia: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
}

function ModuleDetail({
  module,
  onBack,
  onSelectOtherModule,
}: {
  module: ManualModule
  onBack: () => void
  onSelectOtherModule: (m: ManualModule) => void
}) {
  const navigate = useNavigate()
  // "todo": Modo lectura continua (todo desplegado), ideal para aprender sin dar mil clics
  const [activeTab, setActiveTab] = useState<"todo" | "guia" | "casos" | "errores" | "atajos" | "faq">("todo")
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [sidebarQuery, setSidebarQuery] = useState("")
  const tint = tintMap[module.color] || "text-blue-600"
  const iconBg = iconBgMap[module.color] || iconBgMap.blue
  const mockEntries = Object.entries(module.mocks || {})

  const goToModule = () => {
    navigate(module.path)
    window.scrollTo(0, 0)
  }

  const filteredSidebarModules = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase()
    if (!q) return ALL_MANUAL_MODULES
    return ALL_MANUAL_MODULES.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.tagline.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    )
  }, [sidebarQuery])

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 animate-fade-in pb-12">
      {/* Sidebar de Navegación Rápida entre Módulos */}
      <aside className="w-full lg:w-72 shrink-0 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-primary transition-colors bg-gray-100 dark:bg-slate-800 px-3 py-2 rounded-xl w-full"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al Directorio General
        </button>

        <div className="card p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">
              Temario del Manual
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {ALL_MANUAL_MODULES.length} capítulos
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder="Filtrar temas..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
            {filteredSidebarModules.map((m) => {
              const isCurrent = m.id === module.id
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelectOtherModule(m)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                    isCurrent
                      ? "bg-primary text-white font-bold shadow-sm"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <m.icon className={`w-4 h-4 shrink-0 ${isCurrent ? "text-white" : tintMap[m.color] || "text-gray-400"}`} />
                  <span className="truncate flex-1">{m.label}</span>
                  {isCurrent && <ChevronRight className="w-3 h-3 text-white/80 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Contenido Central del Módulo */}
      <main className="flex-1 min-w-0 space-y-6">
        {/* Header Principal del Módulo */}
        <div className="card p-6 sm:p-8 relative overflow-hidden">
          <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${iconBg} opacity-10 pointer-events-none`} />
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white shadow-lg shrink-0`}>
              <module.icon className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">{module.label}</h1>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${chipMap[module.color] || chipMap.blue}`}>{module.category}</span>
                {module.role && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-2.5 py-0.5 rounded-full">
                    <Users className="w-3 h-3 text-primary" /> Rol: {module.role}
                  </span>
                )}
              </div>
              <p className={`text-sm font-semibold mt-1 ${tint}`}>{module.tagline}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2.5 leading-relaxed">{module.description}</p>
            </div>
          </div>

          {/* Flujo Operativo Resumido */}
          {module.workflowOverview && (
            <div className="mt-5 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
                <strong className="font-bold">Ciclo operativo en Extra Supermercado: </strong>
                {module.workflowOverview}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-slate-700/60">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={goToModule} className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm">
                <MonitorSmartphone className="w-3.5 h-3.5" /> Abrir pantalla en vivo
              </button>
              {module.tabs && module.tabs.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 ml-2">
                  <BookOpen className="w-3.5 h-3.5" /> Solapas de pantalla: {module.tabs.map((t) => t.label).join(" · ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
              <span>{module.steps.length} pasos</span>
              {module.useCases && module.useCases.length > 0 && <span>· {module.useCases.length} casos prácticos</span>}
              {mockEntries.length > 0 && <span>· {mockEntries.length} pantallas</span>}
            </div>
          </div>
        </div>

        {/* Requisitos Previos (Prerrequisitos) */}
        {module.prerequisites && module.prerequisites.length > 0 && (
          <div className="card p-5 border-l-4 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10">
            <div className="flex items-center gap-2 mb-2.5">
              <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Antes de operar: Requisitos Previos Obligatorios
              </h3>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
              {module.prerequisites.map((req, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Barra de Pestañas y Modo de Visualización */}
        <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab("todo")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === "todo"
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <FileText className="w-4 h-4 text-primary" />
            📖 Manual Completo (Todo Desplegado)
          </button>

          <button
            onClick={() => setActiveTab("guia")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
              activeTab === "guia"
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <ListChecks className="w-4 h-4 text-green-500" />
            Paso a Paso ({module.steps.length})
          </button>

          {module.useCases && module.useCases.length > 0 && (
            <button
              onClick={() => setActiveTab("casos")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === "casos"
                  ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <GraduationCap className="w-4 h-4 text-amber-500" />
              Casos Reales ({module.useCases.length})
            </button>
          )}

          {module.commonErrors && module.commonErrors.length > 0 && (
            <button
              onClick={() => setActiveTab("errores")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === "errores"
                  ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Resolución de Errores ({module.commonErrors.length})
            </button>
          )}

          {module.shortcutsOrHotkeys && module.shortcutsOrHotkeys.length > 0 && (
            <button
              onClick={() => setActiveTab("atajos")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === "atajos"
                  ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <Keyboard className="w-4 h-4 text-indigo-500" />
              Atajos de Teclado
            </button>
          )}

          {((module.faq && module.faq.length > 0) || (module.tips && module.tips.length > 0)) && (
            <button
              onClick={() => setActiveTab("faq")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === "faq"
                  ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <HelpCircle className="w-4 h-4 text-blue-500" />
              Tips & FAQs
            </button>
          )}
        </div>

        {/* SECCIÓN 1: GUÍA PASO A PASO */}
        {(activeTab === "todo" || activeTab === "guia") && (
          <div className="space-y-6">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-black text-gray-900 dark:text-white">Procedimiento Operativo Paso a Paso</h2>
              </div>
              <div className="space-y-3.5">
                {module.steps.map((step, i) => (
                  <div key={i} className="card p-5 flex gap-4 hover:border-primary/40 transition-colors">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${iconBg} text-white flex items-center justify-center text-sm font-black shrink-0 shadow-md`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{step.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Pantallas Simuladas */}
            {mockEntries.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">Simulación Visual en Pantalla</h2>
                  <span className="text-xs font-semibold text-gray-400">referencia visual de Extra Supermercado</span>
                </div>
                <div className="space-y-6">
                  {mockEntries.map(([key, block]) => (
                    <MockBlockViewer key={key} block={block} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* SECCIÓN 2: CASOS DE USO PRÁCTICOS */}
        {(activeTab === "todo" || activeTab === "casos") && module.useCases && module.useCases.length > 0 && (
          <div className="space-y-5 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Casos Prácticos de la Vida Real (Supermercado)</h2>
            </div>
            <div className="space-y-5">
              {module.useCases.map((uc, i) => (
                <div key={i} className="card p-6 border-l-4 border-amber-500 space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                      Caso Práctico #{i + 1}
                    </span>
                    <h3 className="text-base font-black text-gray-900 dark:text-white mt-1.5">{uc.title}</h3>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800/80 text-xs text-gray-700 dark:text-gray-300">
                    <strong className="font-bold text-gray-900 dark:text-white block mb-1">Escenario cotidiano:</strong>
                    {uc.scenario}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Cómo resolverlo en el sistema:</h4>
                    <div className="space-y-2">
                      {uc.stepByStep.map((s, si) => (
                        <div key={si} className="flex items-start gap-2.5 text-xs text-gray-700 dark:text-gray-300">
                          <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0 text-[10px]">
                            {si + 1}
                          </span>
                          <span className="leading-relaxed">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {uc.keyLesson && (
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Regla de oro de Extra Supermercado: </strong>
                        {uc.keyLesson}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN 3: RESOLUCIÓN DE PROBLEMAS */}
        {(activeTab === "todo" || activeTab === "errores") && module.commonErrors && module.commonErrors.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Resolución Rápida de Problemas y Alertas</h2>
            </div>
            <div className="space-y-3">
              {module.commonErrors.map((err, i) => (
                <div key={i} className="card p-5 border-l-4 border-rose-500 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                      Alerta / Discrepancia
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{err.error}</h3>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <strong>Causa común: </strong> {err.cause}
                  </div>
                  <div className="p-3 rounded-xl bg-green-50/60 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 text-xs text-green-900 dark:text-green-200">
                    <strong className="font-bold">Solución paso a paso: </strong> {err.solution}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN 4: ATAJOS DE TECLADO */}
        {(activeTab === "todo" || activeTab === "atajos") && module.shortcutsOrHotkeys && module.shortcutsOrHotkeys.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Keyboard className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Atajos de Teclado y Teclas Rápidas</h2>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 uppercase font-black">
                  <tr>
                    <th className="p-3.5">Tecla / Atajo</th>
                    <th className="p-3.5">Acción en el sistema</th>
                    {module.shortcutsOrHotkeys.some((s) => s.context) && <th className="p-3.5">Contexto</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 text-gray-700 dark:text-gray-300">
                  {module.shortcutsOrHotkeys.map((sh, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-bold text-primary">
                        <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 shadow-sm">
                          {sh.key}
                        </kbd>
                      </td>
                      <td className="p-3.5 font-medium">{sh.action}</td>
                      {module.shortcutsOrHotkeys?.some((s) => s.context) && (
                        <td className="p-3.5 text-gray-400">{sh.context || "General"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECCIÓN 5: TIPS & FAQS */}
        {(activeTab === "todo" || activeTab === "faq") && (
          <div className="space-y-6 pt-4">
            {/* Tips */}
            {module.tips && module.tips.length > 0 && (
              <section className="card p-5 border-l-4 border-amber-400">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-black text-gray-900 dark:text-white">Consejos Clave de Auditoría y Buenas Prácticas</h2>
                </div>
                <ul className="space-y-2">
                  {module.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* FAQ */}
            {module.faq && module.faq.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">Preguntas Frecuentes</h2>
                </div>
                <div className="space-y-2">
                  {module.faq.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="card w-full p-4 text-left hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{f.q}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                            openFaq === i ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                      {openFaq === i && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2.5 leading-relaxed pt-2 border-t border-gray-100 dark:border-slate-700/60">
                          {f.a}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ManualPage() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("todo")
  const [selectedModule, setSelectedModule] = useState<ManualModule | null>(null)
  const [viewMode, setViewMode] = useState<"directorio" | "manual">("manual")

  // Si está en modo manual continuo y no hay módulo seleccionado, seleccionamos el primero por defecto
  const currentModule = selectedModule || ALL_MANUAL_MODULES[0]

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MANUAL_CATEGORIES
      .map((cat) => ({
        ...cat,
        modules: cat.modules.filter((m) => {
          const matchCat = activeCategory === "todo" || cat.id === activeCategory
          if (!matchCat) return false
          if (q === "") return true

          const inBasic =
            m.label.toLowerCase().includes(q) ||
            m.tagline.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q) ||
            (m.role && m.role.toLowerCase().includes(q))

          const inSteps = m.steps.some(
            (s) => s.title.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q)
          )

          const inUseCases = m.useCases?.some(
            (u) =>
              u.title.toLowerCase().includes(q) ||
              u.scenario.toLowerCase().includes(q) ||
              u.stepByStep.some((st) => st.toLowerCase().includes(q))
          )

          const inFaq = m.faq?.some(
            (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
          )

          return inBasic || inSteps || inUseCases || inFaq
        }),
      }))
      .filter((cat) => cat.modules.length > 0)
  }, [query, activeCategory])

  const totalModules = useMemo(() => MANUAL_CATEGORIES.reduce((s, c) => s + c.modules.length, 0), [])

  // Si se seleccionó un módulo o está en modo manual continuo
  if (viewMode === "manual" && currentModule) {
    return (
      <div className="space-y-4">
        {/* Barra de control superior para alternar vistas */}
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Manual de Uso Operativo — Extra Supermercado
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "manual"
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Modo Guía de Estudio
            </button>
            <button
              onClick={() => {
                setViewMode("directorio")
                setSelectedModule(null)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-gray-500 hover:text-gray-900"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Directorio de Módulos
            </button>
          </div>
        </div>

        <ModuleDetail
          module={currentModule}
          onBack={() => {
            setViewMode("directorio")
            setSelectedModule(null)
          }}
          onSelectOtherModule={(m) => setSelectedModule(m)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Hero */}
      <div className={`card p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br ${MANUAL_CATEGORIES[0]?.gradient || "from-blue-600 to-indigo-700"}`}>
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 pointer-events-none" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Manual Interactivo de Extra Supermercado</h1>
              <p className="text-sm text-white/90 mt-1 leading-relaxed max-w-3xl">
                Guía didáctica y operativa paso a paso. Aprenda a operar cada módulo con facilidad: desde la apertura de caja, cobro multimoneda (₲ y R$), recepción de carnes y verduras, hasta la gestión de tesorería y cuentas por pagar.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setViewMode("manual")
              setSelectedModule(ALL_MANUAL_MODULES[0])
            }}
            className="shrink-0 hidden sm:flex items-center gap-1.5 bg-white text-blue-900 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg hover:bg-blue-50 transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-700" />
            Abrir Guía Continua
          </button>
        </div>

        {/* Search Bar Inteligente */}
        <div className="relative mt-5">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-white/60" />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por módulo, proceso o caso: 'kardex', 'arqueo', 'faltante', 'reales', 'pesables', 'factura crédito'..."
            className="w-full bg-white/15 backdrop-blur border border-white/25 focus:border-white/60 text-white text-sm rounded-xl pl-11 pr-4 py-3 transition-all placeholder-white/60 outline-none"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveCategory("todo")}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeCategory === "todo"
                ? "bg-white text-blue-900 shadow-lg"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            Todos ({totalModules})
          </button>
          {MANUAL_CATEGORIES.map((cat) => {
            const count = cat.modules.length
            const active = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(active ? "todo" : cat.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  active ? "bg-white text-blue-900 shadow-lg" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Categories & modules */}
      {filteredCategories.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-lg font-bold text-gray-900 dark:text-white">No se encontraron módulos</p>
          <p className="text-sm text-gray-500 mt-1">Pruebe con otra búsqueda como 'caja', 'kardex', 'merma', 'factura' o seleccione otra categoría.</p>
        </div>
      )}

      {filteredCategories.map((cat) => (
        <section key={cat.id}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.gradient || "from-slate-500 to-slate-700"} flex items-center justify-center text-white shadow-md`}>
              <cat.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-gray-900 dark:text-white">{cat.label}</h2>
                <span className="text-xs font-bold text-gray-400">({cat.modules.length} módulos)</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{cat.subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {cat.modules.map((m) => {
              const iconBg = iconBgMap[m.color] || iconBgMap.blue
              const mockCount = Object.keys(m.mocks || {}).length
              const useCaseCount = m.useCases?.length || 0
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModule(m)
                    setViewMode("manual")
                  }}
                  className="card card-hover p-5 text-left group relative overflow-hidden flex flex-col justify-between"
                >
                  <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${iconBg} opacity-[0.07] group-hover:opacity-15 transition-opacity pointer-events-none`} />
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white shadow-md shrink-0`}>
                        <m.icon className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-3 group-hover:text-primary transition-colors">
                      {m.label}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
                      {m.tagline}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 mt-4 flex-wrap pt-3 border-t border-gray-100 dark:border-slate-800">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chipMap[m.color] || chipMap.blue}`}>
                      {m.steps.length} pasos
                    </span>
                    {useCaseCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {useCaseCount} casos prácticos
                      </span>
                    )}
                    {mockCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300">
                        {mockCount} pantallas
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}