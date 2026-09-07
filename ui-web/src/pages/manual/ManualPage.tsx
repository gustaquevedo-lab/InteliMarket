import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, ArrowLeft, BookOpen, ChevronRight, Lightbulb, HelpCircle, Sparkles, ChevronDown, ListChecks, MonitorSmartphone, CheckCircle2 } from "lucide-react"
import { MANUAL_CATEGORIES } from "./index"
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
}

function ModuleDetail({ module, onBack }: { module: ManualModule; onBack: () => void }) {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const tint = tintMap[module.color] || "text-blue-600"
  const iconBg = iconBgMap[module.color] || iconBgMap.blue
  const mockEntries = Object.entries(module.mocks || {})

  const goToModule = () => {
    navigate(module.path)
    window.scrollTo(0, 0)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver al índice
      </button>

      {/* Header */}
      <div className="card p-6 sm:p-8 relative overflow-hidden">
        <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${iconBg} opacity-10 pointer-events-none`} />
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white shadow-lg shrink-0`}>
            <module.icon className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">{module.label}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chipMap[module.color] || chipMap.blue}`}>{module.category}</span>
            </div>
            <p className={`text-sm font-semibold mt-0.5 ${tint}`}>{module.tagline}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{module.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button onClick={goToModule}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
            <MonitorSmartphone className="w-3.5 h-3.5" /> Abrir módulo
          </button>
          {module.tabs && module.tabs.length > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> pestañas: {module.tabs.map((t) => t.label).join(" · ")}
            </span>
          )}
        </div>
      </div>

      {/* Cómo se usa */}
      {module.steps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Cómo se usa</h2>
            <ListChecks className="w-5 h-5 text-green-500" />
            <span className="text-xs font-semibold text-gray-400">{module.steps.length} pasos</span>
          </div>
          <div className="space-y-3">
            {module.steps.map((step, i) => (
              <div key={i} className="card p-4 flex gap-4">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${iconBg} text-white flex items-center justify-center text-sm font-black shrink-0 shadow-md`}>
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{step.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pantallas */}
      {mockEntries.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Así se ve en pantalla</h2>
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-semibold text-gray-400">simulación ilustrativa</span>
          </div>
          <div className="space-y-6">
            {mockEntries.map(([key, block]) => (
              <MockBlockViewer key={key} block={block} />
            ))}
          </div>
        </section>
      )}

      {/* Tips */}
      {module.tips && module.tips.length > 0 && (
        <section className="card p-5 border-l-4 border-amber-400">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-black text-gray-900 dark:text-white">Consejos del asesor</h2>
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
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Preguntas frecuentes</h2>
            <HelpCircle className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-2">
            {module.faq.map((f, i) => (
              <button key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="card w-full p-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                {openFaq === i && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{f.a}</p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function ManualPage() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("todo")
  const [selectedModule, setSelectedModule] = useState<ManualModule | null>(null)

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MANUAL_CATEGORIES
      .map((cat) => ({
        ...cat,
        modules: cat.modules.filter((m) =>
          (activeCategory === "todo" || cat.id === activeCategory) &&
          (q === "" ||
            m.label.toLowerCase().includes(q) ||
            m.tagline.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.modules.length > 0)
  }, [query, activeCategory])

  const totalModules = useMemo(() => MANUAL_CATEGORIES.reduce((s, c) => s + c.modules.length, 0), [])

  if (selectedModule) {
    return (
      <div>
        <ModuleDetail module={selectedModule} onBack={() => setSelectedModule(null)} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Hero */}
      <div className={`card p-6 sm:p-8 relative overflow-hidden ${MANUAL_CATEGORIES[0]?.gradient ? `bg-gradient-to-br ${MANUAL_CATEGORIES[0].gradient}` : ""}`}>
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 pointer-events-none" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Manual Interactivo</h1>
            <p className="text-sm text-white/80 mt-1 leading-relaxed">
              Cómo usar cada módulo del sistema, paso a paso y en lenguaje sencillo. Explora {totalModules} módulos agrupados en {MANUAL_CATEGORIES.length} áreas.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-5">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-white/60" />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un módulo: facturación, carnes, caja, clientes..."
            className="w-full bg-white/15 backdrop-blur border border-white/25 focus:border-white/60 text-white text-sm rounded-xl pl-11 pr-4 py-3 transition-all placeholder-white/50 outline-none"
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
          <p className="text-sm text-gray-500 mt-1">Pruebe con otra búsqueda o categoría.</p>
        </div>
      )}

      {filteredCategories.map((cat) => (
        <section key={cat.id}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.gradient || "from-slate-500 to-slate-700"} flex items-center justify-center text-white shadow-md`}>
              <cat.icon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{cat.label}</h2>
            <span className="text-xs font-bold text-gray-400">{cat.modules.length} módulos</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {cat.modules.map((m) => {
              const iconBg = iconBgMap[m.color] || iconBgMap.blue
              const mockCount = Object.keys(m.mocks || {}).length
              return (
                <button key={m.id}
                  onClick={() => setSelectedModule(m)}
                  className="card card-hover p-5 text-left group relative overflow-hidden">
                  <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${iconBg} opacity-[0.07] group-hover:opacity-15 transition-opacity pointer-events-none`} />
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center text-white shadow-md shrink-0`}>
                      <m.icon className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-3 group-hover:text-primary transition-colors">
                    {m.label}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">{m.tagline}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chipMap[m.color] || chipMap.blue}`}>
                      {m.steps.length} pasos
                    </span>
                    {mockCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300">
                        {mockCount} pantallas
                      </span>
                    )}
                    {m.faq && m.faq.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                        {m.faq.length <= 1 ? "FAQ" : `${m.faq.length} FAQs`}
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