/**
 * ============================================================
 * INTELIMARKET — DESIGN SYSTEM TOKENS
 * Versión: 1.0 | Distribuidora / Casa Gonzalito S.R.L.
 * ============================================================
 *
 * Filosofía base: módulos Gerente Comercial IA & Gerente Financiero IA
 *
 * REGLAS:
 * 1. Cada módulo/página elige UN solo color acento de `ACCENT_PALETTE`.
 * 2. Nunca mezclar acentos dentro del mismo módulo.
 * 3. Siempre usar `font-black` para títulos Hero y cifras KPI.
 * 4. Siempre usar `font-mono` para valores monetarios y métricas numéricas.
 * 5. Superficie oscura obligatoria en los headers de página.
 * 6. Los estados semafóricos (success/warning/danger) son globales e inamovibles.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// PALETA DE ACENTOS POR MÓDULO
// ─────────────────────────────────────────────────────────────

export type AccentKey =
  | "emerald"   // Ventas, SIFEN, Gerente Comercial
  | "indigo"    // Finanzas, Tesorería, Gerente Financiero
  | "violet"    // Marketing, CRM, Promociones
  | "sky"       // Logística, Rutas, Entregas
  | "amber"     // Inventario, Compras, Almacén
  | "rose"      // Alertas ejecutivas, Devoluciones
  | "teal"      // Clientes, 360°, Fidelización
  | "orange"    // POS / Caja Rápida, Retail
  | "blue"      // Reportes, Auditoría, Analítica
  | "slate"     // Admin, Configuración, RBAC

export type AccentConfig = {
  headerGradient: string
  iconBg: string
  iconShadow: string
  tabActive: string
  badgePrimary: string
  btnPrimary: string
  kpiText: string
  progressFull: string
  borderAccent: string
  statusDot: string
  chatUserBubble: string
  subtleBg: string
  linkText: string
}

export const ACCENT_PALETTE: Record<AccentKey, AccentConfig> = {
  emerald: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950",
    iconBg:          "bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950",
    iconShadow:      "shadow-emerald-500/20",
    tabActive:       "bg-emerald-600 text-white shadow-md shadow-emerald-600/20",
    badgePrimary:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    btnPrimary:      "bg-emerald-500 hover:bg-emerald-400 text-slate-950",
    kpiText:         "text-emerald-600 dark:text-emerald-400",
    progressFull:    "bg-emerald-500",
    borderAccent:    "border-l-emerald-500",
    statusDot:       "bg-emerald-500",
    chatUserBubble:  "bg-gradient-to-r from-emerald-600 to-teal-600",
    subtleBg:        "hover:border-emerald-500/50",
    linkText:        "text-emerald-600 dark:text-emerald-400",
  },
  indigo: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950",
    iconBg:          "bg-gradient-to-tr from-indigo-500 to-violet-500 text-white",
    iconShadow:      "shadow-indigo-500/20",
    tabActive:       "bg-indigo-600 text-white shadow-md shadow-indigo-600/20",
    badgePrimary:    "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    btnPrimary:      "bg-indigo-500 hover:bg-indigo-400 text-white",
    kpiText:         "text-indigo-600 dark:text-indigo-400",
    progressFull:    "bg-indigo-500",
    borderAccent:    "border-l-indigo-500",
    statusDot:       "bg-indigo-500",
    chatUserBubble:  "bg-gradient-to-r from-indigo-600 to-violet-600",
    subtleBg:        "hover:border-indigo-500/50",
    linkText:        "text-indigo-600 dark:text-indigo-400",
  },
  violet: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-violet-950",
    iconBg:          "bg-gradient-to-tr from-violet-500 to-purple-500 text-white",
    iconShadow:      "shadow-violet-500/20",
    tabActive:       "bg-violet-600 text-white shadow-md shadow-violet-600/20",
    badgePrimary:    "bg-violet-500/20 text-violet-300 border-violet-500/40",
    btnPrimary:      "bg-violet-500 hover:bg-violet-400 text-white",
    kpiText:         "text-violet-600 dark:text-violet-400",
    progressFull:    "bg-violet-500",
    borderAccent:    "border-l-violet-500",
    statusDot:       "bg-violet-500",
    chatUserBubble:  "bg-gradient-to-r from-violet-600 to-purple-600",
    subtleBg:        "hover:border-violet-500/50",
    linkText:        "text-violet-600 dark:text-violet-400",
  },
  sky: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950",
    iconBg:          "bg-gradient-to-tr from-sky-500 to-cyan-500 text-slate-950",
    iconShadow:      "shadow-sky-500/20",
    tabActive:       "bg-sky-600 text-white shadow-md shadow-sky-600/20",
    badgePrimary:    "bg-sky-500/20 text-sky-300 border-sky-500/40",
    btnPrimary:      "bg-sky-500 hover:bg-sky-400 text-slate-950",
    kpiText:         "text-sky-600 dark:text-sky-400",
    progressFull:    "bg-sky-500",
    borderAccent:    "border-l-sky-500",
    statusDot:       "bg-sky-500",
    chatUserBubble:  "bg-gradient-to-r from-sky-600 to-cyan-600",
    subtleBg:        "hover:border-sky-500/50",
    linkText:        "text-sky-600 dark:text-sky-400",
  },
  amber: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950",
    iconBg:          "bg-gradient-to-tr from-amber-500 to-orange-400 text-slate-950",
    iconShadow:      "shadow-amber-500/20",
    tabActive:       "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20",
    badgePrimary:    "bg-amber-500/20 text-amber-300 border-amber-500/40",
    btnPrimary:      "bg-amber-500 hover:bg-amber-400 text-slate-950",
    kpiText:         "text-amber-600 dark:text-amber-400",
    progressFull:    "bg-amber-500",
    borderAccent:    "border-l-amber-500",
    statusDot:       "bg-amber-500",
    chatUserBubble:  "bg-gradient-to-r from-amber-500 to-orange-500",
    subtleBg:        "hover:border-amber-500/50",
    linkText:        "text-amber-600 dark:text-amber-400",
  },
  rose: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950",
    iconBg:          "bg-gradient-to-tr from-rose-500 to-pink-500 text-white",
    iconShadow:      "shadow-rose-500/20",
    tabActive:       "bg-rose-600 text-white shadow-md shadow-rose-600/20",
    badgePrimary:    "bg-rose-500/20 text-rose-300 border-rose-500/40",
    btnPrimary:      "bg-rose-500 hover:bg-rose-400 text-white",
    kpiText:         "text-rose-600 dark:text-rose-400",
    progressFull:    "bg-rose-500",
    borderAccent:    "border-l-rose-500",
    statusDot:       "bg-rose-500",
    chatUserBubble:  "bg-gradient-to-r from-rose-600 to-pink-600",
    subtleBg:        "hover:border-rose-500/50",
    linkText:        "text-rose-600 dark:text-rose-400",
  },
  teal: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950",
    iconBg:          "bg-gradient-to-tr from-teal-500 to-cyan-400 text-slate-950",
    iconShadow:      "shadow-teal-500/20",
    tabActive:       "bg-teal-600 text-white shadow-md shadow-teal-600/20",
    badgePrimary:    "bg-teal-500/20 text-teal-300 border-teal-500/40",
    btnPrimary:      "bg-teal-500 hover:bg-teal-400 text-slate-950",
    kpiText:         "text-teal-600 dark:text-teal-400",
    progressFull:    "bg-teal-500",
    borderAccent:    "border-l-teal-500",
    statusDot:       "bg-teal-500",
    chatUserBubble:  "bg-gradient-to-r from-teal-600 to-cyan-600",
    subtleBg:        "hover:border-teal-500/50",
    linkText:        "text-teal-600 dark:text-teal-400",
  },
  orange: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950",
    iconBg:          "bg-gradient-to-tr from-orange-500 to-amber-400 text-slate-950",
    iconShadow:      "shadow-orange-500/20",
    tabActive:       "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20",
    badgePrimary:    "bg-orange-500/20 text-orange-300 border-orange-500/40",
    btnPrimary:      "bg-orange-500 hover:bg-orange-400 text-slate-950",
    kpiText:         "text-orange-600 dark:text-orange-400",
    progressFull:    "bg-orange-500",
    borderAccent:    "border-l-orange-500",
    statusDot:       "bg-orange-500",
    chatUserBubble:  "bg-gradient-to-r from-orange-500 to-amber-500",
    subtleBg:        "hover:border-orange-500/50",
    linkText:        "text-orange-600 dark:text-orange-400",
  },
  blue: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950",
    iconBg:          "bg-gradient-to-tr from-blue-500 to-indigo-400 text-white",
    iconShadow:      "shadow-blue-500/20",
    tabActive:       "bg-blue-600 text-white shadow-md shadow-blue-600/20",
    badgePrimary:    "bg-blue-500/20 text-blue-300 border-blue-500/40",
    btnPrimary:      "bg-blue-500 hover:bg-blue-400 text-white",
    kpiText:         "text-blue-600 dark:text-blue-400",
    progressFull:    "bg-blue-500",
    borderAccent:    "border-l-blue-500",
    statusDot:       "bg-blue-500",
    chatUserBubble:  "bg-gradient-to-r from-blue-600 to-indigo-600",
    subtleBg:        "hover:border-blue-500/50",
    linkText:        "text-blue-600 dark:text-blue-400",
  },
  slate: {
    headerGradient:  "bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800",
    iconBg:          "bg-gradient-to-tr from-slate-500 to-slate-600 text-white",
    iconShadow:      "shadow-slate-500/20",
    tabActive:       "bg-slate-700 text-white shadow-md shadow-slate-700/20",
    badgePrimary:    "bg-slate-500/20 text-slate-300 border-slate-500/40",
    btnPrimary:      "bg-slate-600 hover:bg-slate-500 text-white",
    kpiText:         "text-slate-600 dark:text-slate-300",
    progressFull:    "bg-slate-500",
    borderAccent:    "border-l-slate-500",
    statusDot:       "bg-slate-400",
    chatUserBubble:  "bg-gradient-to-r from-slate-600 to-slate-700",
    subtleBg:        "hover:border-slate-500/50",
    linkText:        "text-slate-600 dark:text-slate-300",
  },
}

// ─────────────────────────────────────────────────────────────
// SEMÁFORO GLOBAL — idéntico en todos los módulos
// ─────────────────────────────────────────────────────────────

export const STATUS = {
  success: {
    bg:     "bg-emerald-500/20",
    text:   "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/40",
    bar:    "bg-emerald-500",
    icon:   "text-emerald-500",
  },
  warning: {
    bg:     "bg-amber-500/20",
    text:   "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/40",
    bar:    "bg-amber-500",
    icon:   "text-amber-500",
  },
  danger: {
    bg:     "bg-rose-500/20",
    text:   "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/40",
    bar:    "bg-rose-500",
    icon:   "text-rose-500",
  },
  info: {
    bg:     "bg-blue-500/20",
    text:   "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/40",
    bar:    "bg-blue-500",
    icon:   "text-blue-500",
  },
  neutral: {
    bg:     "bg-slate-100 dark:bg-slate-800",
    text:   "text-slate-600 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    bar:    "bg-slate-400",
    icon:   "text-slate-400",
  },
} as const

/** Retorna la config de semáforo según un porcentaje de cumplimiento */
export function statusFromPct(pct: number): typeof STATUS[keyof typeof STATUS] {
  if (pct >= 100) return STATUS.success
  if (pct >= 80)  return STATUS.warning
  return STATUS.danger
}

/** Clase de barra de progreso según porcentaje */
export function progressBarColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500"
  if (pct >= 80)  return "bg-blue-500"
  return "bg-amber-500"
}

// ─────────────────────────────────────────────────────────────
// SUPERFICIES
// ─────────────────────────────────────────────────────────────

export const SURFACE = {
  card:       "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm",
  cardLg:     "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl",
  controlBar: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-4",
  metricCell: "bg-slate-50 dark:bg-slate-800/80 rounded-xl p-2",
  emptyState: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center",
  chatArea:   "bg-slate-50/60 dark:bg-gray-900/60",
  chatWrap:   "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-3xl flex flex-col overflow-hidden",
} as const

// ─────────────────────────────────────────────────────────────
// TIPOGRAFÍA
// ─────────────────────────────────────────────────────────────

export const TYPE = {
  pageTitle:    "text-2xl font-black text-white tracking-tight",
  pageSubtitle: "text-xs text-slate-300 mt-1",
  kpiLabel:     "text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400",
  kpiValue:     "text-xl font-black font-mono",
  money:        "font-mono font-black",
  body:         "text-xs text-slate-600 dark:text-slate-300 leading-relaxed",
  hint:         "text-[11px] text-slate-400 font-medium",
  badge:        "text-[10px] font-black uppercase",
  sectionHead:  "font-bold text-xs text-slate-900 dark:text-white",
} as const

// ─────────────────────────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────────────────────────

export const INPUT = {
  base:   "w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:border-current",
  search: "pl-10 pr-4 py-2",
  select: "select select-bordered select-sm text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium",
  chat:   "flex-1 bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1",
} as const

// ─────────────────────────────────────────────────────────────
// BOTONES
// ─────────────────────────────────────────────────────────────

export const BTN = {
  base:      "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer",
  secondary: "bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold",
  danger:    "bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 text-rose-700 dark:text-rose-300 rounded-lg font-bold",
  outline:   "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold",
  chatSend:  "px-4 py-2.5 font-bold rounded-2xl text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-40 cursor-pointer",
  scaleFx:   "hover:scale-[1.02]",
} as const

// ─────────────────────────────────────────────────────────────
// ANIMACIONES
// ─────────────────────────────────────────────────────────────

export const ANIM = {
  pageIn: "animate-in fade-in duration-300",
  spin:   "animate-spin",
  pulse:  "animate-pulse",
} as const

// ─────────────────────────────────────────────────────────────
// ASIGNACIÓN CANÓNICA: MÓDULO → ACENTO
// ─────────────────────────────────────────────────────────────

/**
 * Uso:
 *   import { MODULE_ACCENT, ACCENT_PALETTE } from "@ds/tokens"
 *   const ds = ACCENT_PALETTE[MODULE_ACCENT.sifen]
 *   // ds.headerGradient, ds.tabActive, ds.btnPrimary, etc.
 */
export const MODULE_ACCENT: Record<string, AccentKey> = {
  sifen:              "emerald",
  sales:              "emerald",
  salesOrders:        "emerald",
  quotes:             "emerald",
  commercialAgent:    "emerald",

  financeAgent:       "indigo",
  treasury:           "indigo",
  accountsReceivable: "indigo",
  accountsPayable:    "indigo",
  checks:             "indigo",
  boveda:             "indigo",
  banks:              "indigo",

  marketing:          "violet",
  crm:                "violet",
  promotions:         "violet",
  oportunidades:      "violet",
  suscripciones:      "violet",

  logistics:          "sky",
  routes:             "sky",
  deliveries:         "sky",
  map:                "sky",
  geofences:          "sky",
  sellers:            "sky",
  visits:             "sky",

  inventory:          "amber",
  purchases:          "amber",
  suppliers:          "amber",
  products:           "amber",
  transferencias:     "amber",
  coldChain:          "amber",

  customers:          "teal",
  customer360:        "teal",
  creditAccounts:     "teal",

  pos:                "orange",
  cajaRapida:         "orange",
  retail:             "orange",

  reports:            "blue",
  audit:              "blue",
  benchmark:          "blue",
  forecast:           "blue",

  settings:           "slate",
  admin:              "slate",
  rbac:               "slate",
  branches:           "slate",
}

// ─────────────────────────────────────────────────────────────
// GLASSMORPHISM — surfaces translúcidas con backdrop-blur
// Requiere un fondo detrás (gradiente de página o orbs de color)
// ─────────────────────────────────────────────────────────────

/**
 * GLASS surfaces: siempre usar con un fondo visible detrás.
 * Agregar <PageGlassBg accent="emerald" /> al inicio de cada página.
 */
export const GLASS = {
  /** Card principal — KPI cards, content panels, formularios */
  card:     "bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-white/[0.08] shadow-xl shadow-black/5 rounded-2xl",
  /** Panel ligero — sub-paneles, control bars */
  panel:    "bg-white/50 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/[0.06] shadow-lg rounded-2xl",
  /** Chat container */
  chat:     "bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/[0.08] shadow-xl rounded-3xl",
  /** Celda interna (dentro de una card) */
  cell:     "bg-white/40 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl",
  /** Header banner oscuro con glass overlay */
  header:   "backdrop-blur-xl border border-white/[0.12] shadow-2xl",
  /** Input field glass */
  input:    "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/40 dark:border-slate-700/40",
  /** Card de recomendación / lista con borde-l acento */
  listCard: "bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/[0.08] shadow-lg rounded-2xl",
  /** Empty state */
  empty:    "bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-white/[0.08] rounded-3xl p-12 text-center",
} as const

/**
 * Colores de orbs ambientales por acento.
 * Usar en PageGlassBg o directamente como clases en el fondo de la página.
 */
export const GLASS_ORB: Record<AccentKey, { orb1: string; orb2: string }> = {
  emerald: { orb1: "bg-emerald-400/10 dark:bg-emerald-500/15", orb2: "bg-teal-400/8 dark:bg-teal-500/10" },
  indigo:  { orb1: "bg-indigo-400/10 dark:bg-indigo-500/15",  orb2: "bg-violet-400/8 dark:bg-violet-500/10" },
  violet:  { orb1: "bg-violet-400/10 dark:bg-violet-500/15",  orb2: "bg-purple-400/8 dark:bg-purple-500/10" },
  sky:     { orb1: "bg-sky-400/10 dark:bg-sky-500/15",        orb2: "bg-cyan-400/8 dark:bg-cyan-500/10" },
  amber:   { orb1: "bg-amber-400/10 dark:bg-amber-500/15",    orb2: "bg-orange-400/8 dark:bg-orange-500/10" },
  rose:    { orb1: "bg-rose-400/10 dark:bg-rose-500/15",      orb2: "bg-pink-400/8 dark:bg-pink-500/10" },
  teal:    { orb1: "bg-teal-400/10 dark:bg-teal-500/15",      orb2: "bg-cyan-400/8 dark:bg-cyan-500/10" },
  orange:  { orb1: "bg-orange-400/10 dark:bg-orange-500/15",  orb2: "bg-amber-400/8 dark:bg-amber-500/10" },
  blue:    { orb1: "bg-blue-400/10 dark:bg-blue-500/15",      orb2: "bg-indigo-400/8 dark:bg-indigo-500/10" },
  slate:   { orb1: "bg-slate-400/8 dark:bg-slate-500/12",     orb2: "bg-slate-300/6 dark:bg-slate-600/10" },
}

// ─────────────────────────────────────────────────────────────
// HELPER: Fondo ambiente para glassmorphism
// Usar al inicio del JSX de cada página:
//
//   import { glassPageBg } from "@ds/tokens"
//   <div className="relative pb-12 animate-in fade-in duration-300">
//     {glassPageBg("emerald")}
//     ... contenido ...
//   </div>
//
// Nota: requiere React importado en el módulo que lo llame.
// ─────────────────────────────────────────────────────────────

export function glassPageBg(accent: AccentKey): string {
  const orbs = GLASS_ORB[accent]
  return [
    "fixed inset-0 -z-10 pointer-events-none",
    "bg-gradient-to-br from-slate-100 via-white to-slate-50",
    "dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
    orbs.orb1,
    orbs.orb2,
  ].join(" ")
}

/**
 * Clases del wrapper de página completo (outer div).
 * El inner debe ser `relative space-y-6 pb-12 z-0`
 */
export const PAGE_WRAP = "relative min-h-0"
