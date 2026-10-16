import { useState, useEffect, useMemo, useRef } from "react"
import ErrorBoundary from "./ErrorBoundary"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, MonitorSmartphone, Receipt, FileSpreadsheet, Users, MessageCircle, Megaphone,
  Tags, Warehouse, ShoppingBag, Briefcase, Banknote, Landmark, CreditCard, Wallet, ReceiptText,
  MapPinned, Truck, ShieldCheck, BadgeDollarSign, Blocks, LineChart, Fingerprint, Settings,
  LogOut, Menu, X, Moon, Sun, Monitor, Search, Plus, Store, ChevronDown, Building2, Shield, Crown, Target,
  ClipboardList, RotateCcw, Percent, Coins, HandCoins, Building, BookOpen, PiggyBank, PieChart, Factory, Smartphone,
  ArrowLeftRight, Cpu, Map, Navigation, BarChart3, MapPin, DollarSign, TrendingUp, Route, Lightbulb, Bot, Clock, Award, Globe, Repeat, Wrench,
  Copy, Package, Upload, Mail, AlertTriangle, LayoutGrid, Trophy, Sparkles
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { useFeatures } from "../context/FeatureContext"
import { usePermissions } from "../context/PermissionsContext"
import Logo from "./Logo"
import NotificationBell from "./NotificationBell"
import MarcoCopilot from "./MarcoCopilot"

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  path: string
  feature?: string
  permission?: string
  superadminOnly?: boolean
  keywords?: string[]
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: "Inicio",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: TrendingUp, label: "Gerente de Ventas IA", path: "/sales-agent" },
      { icon: Bot, label: "Gerente Financiero IA", path: "/finance-agent" },
      { icon: Sparkles, label: "Gerente de Marketing IA", path: "/marketing-agent" },
      { icon: Bot, label: "Marco IA (Cerebro)", path: "/asistente-virtual" },
    ]
  },
  {
    title: "Ventas & Preventa",
    items: [
      { icon: Receipt, label: "Facturación SIFEN", path: "/sales" },
      { icon: ClipboardList, label: "Pedidos & Preventa", path: "/sales-orders" },
      { icon: Target, label: "Metas de Venta", path: "/sales-targets" },
      { icon: FileSpreadsheet, label: "Cotizaciones", path: "/quotes" },
      { icon: RotateCcw, label: "Devoluciones & NC", path: "/returns" },
      { icon: Users, label: "Clientes Mayoristas", path: "/customers" },
      { icon: BadgeDollarSign, label: "Listas de Precios", path: "/price-lists" },
      { icon: DollarSign, label: "Comisiones de Vendedores", path: "/commissions" },
      { icon: Globe, label: "Portal Clientes", path: "/portal" },
    ]
  },
  {
    title: "Distribución & Logística",
    items: [
      { icon: Map, label: "Mapa en Tiempo Real", path: "/mapa-tiempo-real" },
      { icon: Navigation, label: "Planificador de Rutas", path: "/rutas" },
      { icon: Trophy, label: "Rendimiento Preventistas", path: "/distribuidora/rendimiento-vendedores" },
      { icon: Truck, label: "Despacho & Carga (Muelle)", path: "/distribuidora/despacho" },
      { icon: Navigation, label: "Mi Viaje Hoy (Cobrador)", path: "/distribuidora/mi-viaje" },
      { icon: DollarSign, label: "Rendiciones de Cobro", path: "/distribuidora/rendiciones" },
      { icon: Landmark, label: "Liquidaciones de Ruta", path: "/distribuidora/liquidaciones" },
      { icon: Briefcase, label: "Tesorería de Rutas", path: "/distribuidora/tesoreria" },
      { icon: Award, label: "KPIs & Rebates (PARESA)", path: "/supplier-kpis" },
      { icon: Factory, label: "Módulo Distribuidora", path: "/distribuidora" },
    ]
  },
  {
    title: "Inventario & Depósitos",
    items: [
      { icon: Tags, label: "Catálogo de Productos", path: "/products" },
      { icon: Copy, label: "Variantes & Empaques", path: "/variants" },
      { icon: Package, label: "Kits & Combos", path: "/kits" },
      { icon: Warehouse, label: "Depósitos & Stock", path: "/inventory", permission: "inventory:adjust" },
      { icon: ArrowLeftRight, label: "Transferencias entre Depósitos", path: "/transferencias", permission: "inventory:transfer" },
      { icon: MapPin, label: "Conteo Cíclico & Lotes", path: "/advanced-inventory", permission: "inventory:cycle_count" },
      { icon: AlertTriangle, label: "Mermas (Shrinkage)", path: "/shrinkage" },
      { icon: ClipboardList, label: "Reabastecimiento", path: "/auto-replenish" },
    ]
  },
  {
    title: "Abastecimiento & Compras",
    items: [
      { icon: ShoppingBag, label: "Gestión de Compras", path: "/purchases" },
      { icon: Truck, label: "Recepción de Mercadería", path: "/deposito", permission: "purchases:receive" },
      { icon: TrendingUp, label: "Forecast de Demanda", path: "/demand-forecast" },
      { icon: Briefcase, label: "Contratos & Rebates", path: "/contratos-proveedores" },
      { icon: Upload, label: "Importaciones CSV", path: "/imports" },
      { icon: Globe, label: "Portal Proveedores", path: "/portal/proveedores/dashboard" },
    ]
  },
  {
    title: "Crédito, Cobranzas & Finanzas",
    items: [
      { icon: DollarSign, label: "Cuentas por Cobrar (AR)", path: "/accounts-receivable" },
      { icon: HandCoins, label: "Cuentas por Pagar (AP)", path: "/payments" },
      { icon: Landmark, label: "Cuentas Bancarias", path: "/bancos" },
      { icon: CreditCard, label: "Gestión de Cheques", path: "/cheques" },
      { icon: Banknote, label: "Arqueo de Caja", path: "/caja" },
      { icon: Wallet, label: "Líneas de Crédito", path: "/credit-accounts" },
      { icon: ReceiptText, label: "Gastos Operativos", path: "/gastos" },
      { icon: BarChart3, label: "Contabilidad Integrada", path: "/integrated-finance" },
      { icon: LineChart, label: "Reportes Financieros", path: "/reports?sector=financiero" },
    ]
  },
  {
    title: "CRM & Comunicación",
    items: [
      { icon: Users, label: "Fidelidad & CRM", path: "/crm" },
      { icon: PieChart, label: "Customer 360", path: "/customer360" },
      { icon: MessageCircle, label: "WhatsApp & Chat", path: "/whatsapp" },
      { icon: Megaphone, label: "Campañas & Promociones", path: "/promociones" },
    ]
  },
  {
    title: "Recursos Humanos",
    items: [
      { icon: PiggyBank, label: "Nómina & Sueldos (SueldOK)", path: "/sueldok" },
    ]
  },
  {
    title: "Inteligencia & Sistema",
    items: [
      { icon: LineChart, label: "Business Intelligence", path: "/reports" },
      { icon: PieChart, label: "Reportes Gerenciales", path: "/gerencial" },
      { icon: Fingerprint, label: "Auditoría & Riesgos", path: "/audit" },
      { icon: Smartphone, label: "Apps Móviles & APKs", path: "/apps-moviles" },
      { icon: Building2, label: "Sucursales", path: "/branches" },
      { icon: Users, label: "Gestión de Usuarios", path: "/usuarios" },
      { icon: ShieldCheck, label: "Permisos & Roles (RBAC)", path: "/rbac" },
      { icon: Settings, label: "Configuración", path: "/settings" },
      { icon: ShieldCheck, label: "Salud del Sistema", path: "/salud-sistema", superadminOnly: true },
      { icon: Blocks, label: "Consola de Plataforma", path: "/plataforma", superadminOnly: true },
    ]
  },
  {
    title: "Ayuda",
    items: [
      { icon: BookOpen, label: "Manual Interactivo", path: "/manual" },
    ]
  }
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { hasFeature } = useFeatures()
  const { hasPermission } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()

  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  useEffect(() => {
    const activeGroup = navGroups.find(g =>
      g.items.some(i => i.path === location.pathname || (i.path !== "/" && i.path !== "/dashboard" && location.pathname.startsWith(i.path)))
    )
    if (activeGroup && !expandedGroups.includes(activeGroup.title)) {
      setExpandedGroups(prev => [...prev, activeGroup.title])
    }
  }, [location.pathname])

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    )
  }

  // Ctrl+K shortcut para buscar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Índice plano de items navegables para el buscador
  const allSearchItems = useMemo(() => {
    const list: { label: string; group: string; path: string; icon: any }[] = []
    navGroups.forEach(g => {
      g.items.forEach(it => {
        list.push({ label: it.label, group: g.title, path: it.path, icon: it.icon })
      })
    })
    return list
  }, [])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return allSearchItems.filter(item =>
      item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [searchQuery, allSearchItems])

  const handleSearchNavigate = (path: string) => {
    navigate(path)
    setSearchQuery("")
    setSearchOpen(false)
  }

  return (
    <div className="flex h-screen bg-[#071326] dark:bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Granitic Sidebar Distribuidora ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gradient-to-b from-[#0a2244] via-[#091a33] to-[#071326] border-r border-teal-500/20
        flex flex-col transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header / Brand */}
        <div className="p-4 border-b border-teal-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="icon" />
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-wider text-white">INTELIMARKET</span>
              <span className="text-[10px] text-teal-300 uppercase tracking-widest font-black">
                DISTRIBUIDORA
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-3 custom-scrollbar">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => {
              if (item.superadminOnly && user?.rol !== "superadmin") return false
              if (item.feature && !hasFeature(item.feature)) return false
              if (item.permission && !hasPermission(item.permission)) return false
              return true
            })

            if (visibleItems.length === 0) return null

            const isExpanded = group.title === "Inicio" || expandedGroups.includes(group.title)

            return (
              <div key={group.title} className="space-y-1">
                {group.title !== "Inicio" && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-teal-300/80 hover:text-teal-200 hover:bg-white/5 rounded-lg transition-colors text-left"
                  >
                    <span>{group.title}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                )}

                {/* Submenús con guía vertical y acento Teal */}
                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className={`${group.title !== "Inicio" ? "ml-3 pl-2.5 border-l-2 border-teal-500/20 space-y-1 py-1" : "space-y-1"}`}>
                    {visibleItems.map((item) => {
                      const active = location.pathname === item.path || (item.path === "/" && (location.pathname === "/" || location.pathname === "/dashboard"))
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                          className={`w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all duration-200 ${
                            active
                              ? "bg-teal-500/20 text-white font-bold shadow-lg border-l-4 border-teal-400 pl-2"
                              : "text-slate-300 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-teal-300" : "text-slate-400"}`} />
                          <span className="text-left flex-1 truncate leading-tight">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer: Selector de Tema & Logout */}
        <div className="p-3 border-t border-teal-500/20 space-y-1 relative">
          <div className="relative">
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-3">
                {theme === 'light' ? <Sun className="w-5 h-5 text-amber-400" /> : theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Monitor className="w-5 h-5 text-teal-400" />}
                <span>Tema: {theme === 'light' ? "Claro" : theme === 'dark' ? "Oscuro" : "Sistema"}</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${themeDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {themeDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-[#0a2244] border border-teal-500/30 rounded-xl shadow-2xl overflow-hidden z-50">
                <button onClick={() => { setTheme('light'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/10">
                  <Sun className="w-4 h-4 text-amber-400" /> Claro
                </button>
                <button onClick={() => { setTheme('dark'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/10">
                  <Moon className="w-4 h-4 text-indigo-400" /> Oscuro
                </button>
                <button onClick={() => { setTheme('system'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/10">
                  <Monitor className="w-4 h-4 text-teal-400" /> Sistema
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { logout(); navigate("/login") }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all"
          >
            <LogOut className="w-5 h-5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main Layout Body ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <header className="relative z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-4 lg:px-6 py-3 flex items-center gap-4 lg:gap-8 justify-between">
          <div className="flex items-center gap-4 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Global Search Mayorista */}
          <div className="relative hidden lg:flex flex-1 max-w-xl">
            <div className="relative w-full group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-teal-600 transition-colors" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("")
                    setSearchOpen(false)
                  }
                  if (e.key === "Enter" && searchResults.length > 0) {
                    handleSearchNavigate(searchResults[0].path)
                  }
                }}
                className="w-full bg-gray-100 dark:bg-slate-800/60 border border-transparent focus:border-teal-500/50 focus:bg-white dark:focus:bg-slate-800 text-sm rounded-xl pl-10 pr-12 py-2.5 transition-all text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                placeholder="Buscar módulos, rutas, clientes, pedidos mayoristas..."
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-[10px] font-semibold text-gray-400 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800">Ctrl K</span>
              </div>
            </div>

            {/* Dropdown de resultados de búsqueda */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 text-left">
                {searchResults.map((item) => (
                  <button
                    key={item.path}
                    onMouseDown={() => handleSearchNavigate(item.path)}
                    className="w-full flex items-center justify-start gap-3 px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 flex-shrink-0">
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col flex-1 truncate">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.label}</span>
                      <span className="text-[10px] text-gray-400 truncate">{item.group}</span>
                    </div>
                    <span className="ml-auto text-[10px] text-gray-400 font-mono text-right">{item.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {/* Branch / Tenant Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
              <div className="w-6 h-6 rounded bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider leading-none">Distribuidora</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight mt-0.5">Casa Gonzalito</span>
              </div>
            </div>

            {/* Quick Actions & Notifications */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigate("/sales")}
                className="hidden sm:flex items-center gap-1.5 bg-teal-600/10 hover:bg-teal-600/20 text-teal-700 dark:text-teal-300 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Venta</span>
              </button>

              <NotificationBell />
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

            {/* User Profile */}
            <div
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-sm font-semibold text-sm">
                {user?.nombre?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-bold text-gray-900 dark:text-white leading-none">{user?.nombre || "Admin Casa Gonzalito"}</span>
                <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">Distribución Mayorista</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Asistente Flotante Marco IA */}
      <MarcoCopilot />
    </div>
  )
}
