import { useEntityLookup, getCustomerName } from "../../hooks/useEntityLookup"
import { useState, useEffect } from "react"
import { useFeatures } from "../../context/FeatureContext"

interface MarketingComboItem {
  product_id: string
  product_name: string
  cantidad: number
  precio_unitario_gs: number
  precio_promocional_gs: number
  tipo_rol: string
}

interface MarketingCampaignSuggestion {
  id: string
  titulo: string
  objetivo: string
  proveedor_relacionado?: string
  rebate_en_juego_gs?: number
  impacto_ventas_estimado_gs: number
  margen_estimado_pct: number
  descripcion: string
  items_combo: MarketingComboItem[]
  segmento_objetivo: string
  canales: string[]
  copy_whatsapp: string
  copy_app: string
  estado: string
  created_at?: string
}

interface CustomerSegmentSummary {
  id: string
  nombre: string
  descripcion: string
  total_clientes: number
  score_crediticio_promedio: string
  condicion_venta: string
  potencial_compra_gs: float
}

interface MarketingDashboardData {
  mes_activo: string
  ventas_por_campanas_gs: number
  fardos_traccionados_rebate: number
  tasa_conversion_pct: number
  clientes_activados: number
  campanas_activas: number
  proveedores_en_empuje: string[]
  campanas_sugeridas: MarketingCampaignSuggestion[]
  segmentos: CustomerSegmentSummary[]
}

interface ChatMsg {
  id: string
  isUser: boolean
  text: string
  time: string
  model_used?: string
  campana?: MarketingCampaignSuggestion
}




export default function MarketingPage() {
  useEntityLookup()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<any>(null)
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">Automatización de Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Segmentación, campañas, alertas, ofertas y encuestas</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Segmentos</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-blue-600 mt-1">{data?.segment_count || 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Campañas Totales</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-green-600 mt-1">{data?.campaign_count || 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Alertas Activas</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-purple-600 mt-1">{data?.alert_count || 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Ofertas Activas</p>
          <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-amber-600 mt-1">{data?.offer_count || 0}</p>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ventas por Campañas IA */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Ventas por Campañas IA</span>
            <TrendingUp className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-xl font-black text-violet-600 dark:text-violet-400 font-mono">
            {formatPYG(data?.ventas_por_campanas_gs || 485320000)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Tracción generada en WhatsApp y App B2B
          </p>
        </div>

        {/* Card 2: Fardos/Cajas para Rebates */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Volumen para Rebates</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {(data?.fardos_traccionados_rebate || 3420).toLocaleString('es-PY')} Fardos
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
            PARESA (Coca-Cola) & Chortitzer (Trébol)
          </p>
        </div>

        {/* Card 3: Tasa de Conversión */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Tasa de Conversión</span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {data?.tasa_conversion_pct || 24.8}%
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Respuestas positivas con pedido en 1-clic
          </p>
        </div>

        {/* Card 4: Clientes Activados */}
        <div className="p-4 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Clientes Activados</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-gray-900 dark:text-white font-mono">
            {data?.clientes_activados || 328} Comercios
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-bold">
            {data?.campanas_activas || 2} Campañas activas en ruta
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "ai"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
              : "bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/[0.08] hover:bg-white/90"
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Consola IA & Chat de Marketing</span>
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "campaigns"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
              : "bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/[0.08] hover:bg-white/90"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Campañas Quirúrgicas & Combos ({data?.campanas_sugeridas?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab("segments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === "segments"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
              : "bg-white/70 dark:bg-slate-900/50 backdrop-blur-sm text-slate-600 dark:text-slate-300 border border-white/50 dark:border-white/[0.08] hover:bg-white/90"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Segmentos Predictivos & Scoring Crediticio ({data?.segmentos?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: CONSOLA IA & CHAT */}
      {activeTab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chat Container (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-[640px] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/[0.08] shadow-xl rounded-3xl overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 bg-gradient-to-r from-violet-500/10 via-white to-indigo-500/5 dark:from-gray-800 dark:via-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-violet-600 text-white flex items-center justify-center text-base font-black shadow-sm">
                  🚀
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    Gerente de Marketing IA
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Tracción de Metas, Combos Ancla & Filtro de Crédito</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUseGemini(!useGemini)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  useGemini
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-sm shadow-blue-500/30"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-650"
                }`}
                title="Activar Google Gemini Flash para traer ideas de mercado exterior, tendencias FMCG y benchmark B2B"
              >
                <Sparkles className={`w-3.5 h-3.5 ${useGemini ? "text-amber-300" : "text-gray-400"}`} />
                <span>{useGemini ? "Gemini Pulso de Mercado" : "Modo Gemini"}</span>
              </button>
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60 dark:bg-gray-900/60">
              {chatHistory.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.isUser ? "justify-end" : "justify-start"}`}>
                  {!m.isUser && (
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 dark:bg-violet-950/40 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">
                      IA
                    </div>
                  )}
                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                      m.isUser
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-none font-medium shadow-violet-500/10"
                        : "bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none"
                    }`}
                  >
                    {m.isUser ? <p className="text-xs whitespace-pre-wrap">{m.text}</p> : renderMarkdownText(m.text)}
                    <div className={`mt-2 flex items-center justify-between text-[10px] ${m.isUser ? "text-violet-100" : "text-gray-400"}`}>
                      {!m.isUser && m.model_used && (
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-bold ${
                          m.model_used.includes("gemini")
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}>
                          {m.model_used.includes("gemini") ? "✨ Gemini 3.1 Flash" : "Local Qwen2.5"}
                        </span>
                      )}
                      <span className="ml-auto">{m.time}</span>
                    </div>
                  </div>
                </div>
              ))}
              {sendingChat && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-600 text-xs font-bold shrink-0">
                    IA
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    Analizando metas comerciales, crédito y rotación de stock...
                  </div>
                </div>
              )}
              {/* End of Chat */}
            </div>

            {/* Quick Prompt Chips */}
            <div className="p-2.5 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 flex gap-2 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué tendencias y buenas prácticas de promociones masivas B2B se usan afuera para distribuidoras mayoristas?", true)}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-indigo-950/40 dark:to-violet-950/40 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-200 dark:border-blue-800 whitespace-nowrap transition shadow-2xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                💡 Pulso del Mercado & Tendencias (Gemini)
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Cómo empujamos la meta de PARESA antes del cierre?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                🥤 Salvar Meta PARESA
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué campaña tenemos para Cooperativa Chortitzer?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                🥛 Lácteos Trébol B2B
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué ideas creativas de fidelización B2B podemos aplicar para despensas?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                🎯 Fidelización Despensas
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "¿Qué clientes nos dejaron de comprar en los últimos 15 días?")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                👥 Clientes Inactivos (Churn)
              </button>
              <button
                type="button"
                onClick={() => handleSendChat(undefined, "Armame un combo ancla para liquidar stock lento en depósito")}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap transition shadow-2xs font-medium cursor-pointer"
              >
                📦 Combos Stock Lento
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Consultá al Gerente de Marketing sobre campañas, combos, WhatsApp o metas..."
                className="flex-1 bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="submit"
                disabled={sendingChat || !query.trim()}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs transition flex items-center gap-1.5 shadow-sm shadow-violet-500/20 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Enviar</span>
              </button>
            </form>
          </div>

          {/* Columna Derecha: Triángulo de Oro & Campaña Destacada (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card Triángulo de Oro */}
            <div className="p-5 bg-gradient-to-br from-white to-violet-50/50 dark:from-gray-800 dark:to-gray-750 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Sincronización Multi-Agente Activa</span>
              </div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                El Triángulo de Oro en Casa Gonzalito
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                El Gerente de Marketing opera en sincronía perfecta con las otras gerencias antes de lanzar cualquier mensaje a la calle:
              </p>

              <div className="space-y-2 pt-1 text-xs">
                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                  <div>
                    <strong className="text-gray-900 dark:text-white font-bold">Comercial:</strong>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px]">Provee las metas en riesgo (PARESA Gs. 81M rebate en juego).</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
                  <div>
                    <strong className="text-gray-900 dark:text-white font-bold">Finanzas:</strong>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px]">Bloquea ofertas a crédito a morosos; autoriza 15-30d a clientes A/B.</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></span>
                  <div>
                    <strong className="text-gray-900 dark:text-white font-bold">Marco:</strong>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px]">Orquesta el despacho a preventistas y difusión en WhatsApp.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaña Estrella Activa */}
            {data?.campanas_sugeridas?.[0] && (
              <div className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 border-l-4 border-l-violet-500">
                <div className="flex justify-between items-start">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 uppercase">
                    Campaña Destacada
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Rebate: {formatPYG(data.campanas_sugeridas[0].rebate_en_juego_gs || 0)}
                  </span>
                </div>

                <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                  {data.campanas_sugeridas[0].titulo}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {data.campanas_sugeridas[0].descripcion}
                </p>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-gray-400">Canales: WhatsApp + App B2B</span>
                  <button
                    onClick={() => setActiveTab("campaigns")}
                    className="text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1"
                  >
                    Ver detalles del combo →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAÑAS QUIRÚRGICAS & COMBOS */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data?.campanas_sugeridas || []).map((camp) => (
              <div key={camp.id} className="p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 border-l-4 border-l-violet-500 hover:border-violet-500/60 transition">
                {/* Header Campaña */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 uppercase">
                      {camp.objetivo.replace("_", " ")}
                    </span>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mt-1.5">
                      {camp.titulo}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {camp.proveedor_relacionado}
                    </p>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                    camp.estado === "activa"
                      ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                  }`}>
                    {camp.estado}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {camp.descripcion}
                </p>

                {/* Métricas clave */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-2xl text-center text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Ventas Est.</span>
                    <strong className="text-gray-900 dark:text-white font-mono text-[11px]">
                      {formatPYG(camp.impacto_ventas_estimado_gs)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Margen Neto</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {camp.margen_estimado_pct}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Rebate Protegido</span>
                    <strong className="text-violet-600 dark:text-violet-400 font-mono text-[11px]">
                      {formatPYG(camp.rebate_en_juego_gs || 0)}
                    </strong>
                  </div>
                </div>

                {/* Items del Combo si aplica */}
                {camp.items_combo.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Composición del Combo:
                    </span>
                    {camp.items_combo.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            item.tipo_rol === "rebate_meta" ? "bg-emerald-500" : item.tipo_rol === "rotacion_lenta" ? "bg-amber-500" : "bg-blue-500"
                          }`}></span>
                          <span className="text-gray-800 dark:text-gray-200 font-medium">
                            {item.cantidad}x {item.product_name}
                          </span>
                        </div>
                        <span className="font-mono text-gray-600 dark:text-gray-400 text-[11px]">
                          {formatPYG(item.precio_promocional_gs)} c/u
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Copy de WhatsApp con botón de copiar */}
                <div className="p-3 bg-slate-900 text-slate-100 rounded-2xl text-xs space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-400" /> Copy WhatsApp (IntelliZapp)
                    </span>
                    <button
                      onClick={() => handleCopyCopy(camp.id, camp.copy_whatsapp)}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedId === camp.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === camp.id ? "¡Copiado!" : "Copiar Texto"}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-slate-300">
                    {camp.copy_whatsapp}
                  </p>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-[11px] text-gray-400">
                    Segmento: <strong className="text-gray-700 dark:text-gray-300">{camp.segmento_objetivo}</strong>
                  </span>

  const load = () => apiGet("/stock-alerts").then(setAlerts).catch(() => {})

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await apiPost("/stock-alerts", { customer_id: customerId, product_id: productId })
      await load(); setShowForm(false); setCustomerId(""); setProductId("")
    } catch {}
  }

  const handleDelete = async (id: string) => {
    try { await apiDelete(`/stock-alerts/${id}`); await load() } catch {}
  }

  const handleCheck = async () => {
    try {
      const result = await apiPost("/stock-alerts/check")
      alert(`Notificaciones generadas: ${JSON.stringify(result)}`)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Alertas de Stock para Clientes</h2>
        <div className="flex gap-2">
          <button onClick={handleCheck} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition">
            Verificar Stock
          </button>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            + Nueva Alerta
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ID Cliente</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field w-full" placeholder="UUID del cliente" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ID Producto</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)} className="input-field w-full" placeholder="UUID del producto" />
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Alerta</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Cliente</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Producto</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Activo</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Última Notificación</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-mono text-xs">{a.customer_id}</td>
                <td className="px-5 py-3 font-mono text-xs">{a.product_id}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${a.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{a.activo ? "Activo" : "Inactivo"}</span></td>
                <td className="px-5 py-3 text-gray-500">{a.last_notified_at ? new Date(a.last_notified_at).toLocaleString("es-PY") : "—"}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Sin alertas configuradas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Offers Tab ───────────────────────────────────────────────── */
function OffersTab() {
  const [offers, setOffers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [customerId, setCustomerId] = useState("")
  const [productId, setProductId] = useState("")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [tipo, setTipo] = useState("descuento")
  const [valor, setValor] = useState("")
  const [codigoCupon, setCodigoCupon] = useState("")
  const [validoHasta, setValidoHasta] = useState("")

  const load = () => apiGet("/offers").then(setOffers).catch(() => {})

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await apiPost("/offers", {
        customer_id: customerId, product_id: productId || null, titulo, descripcion,
        tipo, valor: parseFloat(valor) || 0, codigo_cupon: codigoCupon || null,
        valido_hasta: validoHasta ? new Date(validoHasta).toISOString() : null,
      })
      await load(); setShowForm(false); setCustomerId(""); setProductId(""); setTitulo(""); setDescripcion(""); setTipo("descuento"); setValor(""); setCodigoCupon(""); setValidoHasta("")
    } catch {}
  }

  const handleGenerate = async () => {
    try { await apiPost("/offers/generate"); await load() } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ofertas Personalizadas</h2>
        <div className="flex gap-2">
          <button onClick={handleGenerate} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition">
            Generar Automáticas
          </button>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            + Nueva Oferta
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ID Cliente</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ID Producto (opcional)</label>
              <input value={productId} onChange={(e) => setProductId(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-field w-full">
                <option value="descuento">Descuento</option>
                <option value="2x1">2x1</option>
                <option value="gratis">Gratis</option>
                <option value="volumen">Volumen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor</label>
              <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Código Cupón</label>
              <input value={codigoCupon} onChange={(e) => setCodigoCupon(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Válido hasta</label>
              <input type="datetime-local" value={validoHasta} onChange={(e) => setValidoHasta(e.target.value)} className="input-field w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="input-field w-full" />
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Oferta</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Título</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Tipo</th>
              <th className="text-right px-5 py-3 text-gray-500 font-medium">Valor</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Cupón</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Cliente</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Válido hasta</th>
              <th className="text-left px-5 py-3 text-gray-500 font-medium">Usado</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-5 py-3 font-medium">{o.titulo}</td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{o.tipo}</span></td>
                <td className="px-5 py-3 text-right font-medium">{o.valor || "—"}</td>
                <td className="px-5 py-3 font-mono text-xs">{o.codigo_cupon || "—"}</td>
                <td className="px-5 py-3 font-mono text-xs">{getCustomerName(o.customer_id)}</td>
                <td className="px-5 py-3 text-gray-500">{o.valido_hasta ? new Date(o.valido_hasta).toLocaleDateString("es-PY") : "—"}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${o.usado ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>{o.usado ? "Usado" : "Disponible"}</span></td>
              </tr>
            ))}
            {offers.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Sin ofertas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Surveys Tab ──────────────────────────────────────────────── */
function SurveysTab() {
  
  const [surveys, setSurveys] = useState<any[]>([])
  const [responses, setResponses] = useState<any[] | null>(null)
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState("")
  const [preguntas, setPreguntas] = useState('[{"pregunta": "¿Qué tal fue tu experiencia?", "tipo": "rating"}]')

  const load = () => apiGet("/surveys").then(setSurveys).catch(() => {})

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try {
      await apiPost("/surveys", { nombre, preguntas: JSON.parse(preguntas) })
      await load(); setShowForm(false); setNombre(""); setPreguntas('[{"pregunta": "¿Qué tal fue tu experiencia?", "tipo": "rating"}]')
    } catch {}
  }

  const loadResponses = async (id: string) => {
    try {
      const r = await apiGet(`/surveys/${id}/responses`)
      setResponses(r); setSelectedSurveyId(id)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Encuestas de Satisfacción</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          + Nueva Encuesta
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-field w-full" placeholder="Ej: Encuesta post-entrega" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Preguntas (JSON)</label>
            <textarea value={preguntas} onChange={(e) => setPreguntas(e.target.value)} rows={5} className="input-field w-full font-mono text-xs"
              placeholder='[{"pregunta": "Texto", "tipo": "rating/opciones/texto", "opciones": ["Op1","Op2"]}]' />
          </div>
          <button onClick={handleCreate} className="btn-primary px-6">Crear Encuesta</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Encuestas</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {surveys.length === 0 ? (
              <p className="px-5 py-8 text-center text-gray-400">Sin encuestas</p>
            ) : surveys.map((s) => (
              <div key={s.id} className={`px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition ${selectedSurveyId === s.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`} onClick={() => loadResponses(s.id)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{s.nombre}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${s.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.activo ? "Activa" : "Inactiva"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        <div className="card p-5">
          {!selectedSurveyId || responses === null ? (
            <p className="text-gray-400 text-center py-12">Seleccioná una encuesta para ver respuestas</p>
          ) : responses.length === 0 ? (
            <p className="text-gray-400 text-center py-12">Sin respuestas aún</p>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Respuestas ({responses.length})</h3>
              {responses.map((r: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 mb-1">Cliente: {getCustomerName(r.customer_id)} · {new Date(r.created_at).toLocaleDateString("es-PY")}</p>
                  <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(r.respuestas, null, 2)}</pre>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-bold">Condición de Venta</span>
                    <strong className="text-gray-800 dark:text-gray-200 text-[11px] block mt-0.5">
                      {seg.condicion_venta}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl">
                    <span className="text-[10px] text-gray-400 block font-bold">Score Crediticio</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-[11px] block mt-0.5">
                      {seg.score_crediticio_promedio}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-gray-500">
                    Potencial: <strong className="text-gray-900 dark:text-white font-mono">{formatPYG(seg.potencial_compra_gs)}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setActiveTab("ai")
                      handleSendChat(undefined, `Armame una campaña de WhatsApp exclusiva para el segmento: ${seg.nombre}`)
                    }}
                    className="text-violet-600 dark:text-violet-400 font-bold hover:underline text-xs flex items-center gap-1 cursor-pointer"
                  >
                    Crear Campaña con IA →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
