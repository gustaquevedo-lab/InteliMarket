import { useState, useEffect } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, MonitorSmartphone, Receipt, FileSpreadsheet, Users, MessageCircle, Megaphone,
  Tags, Warehouse, Scale, ShoppingBag, Briefcase, Banknote, Landmark, Sparkles, ShieldAlert, CreditCard, Wallet, ReceiptText,
  MapPinned, Truck, ShoppingCart, Pill, Shirt, ShieldCheck, BadgeDollarSign, Blocks, LineChart, Fingerprint, Settings,
  LogOut, Menu, X, Moon, Sun, Monitor, Search, Plus, Store, ChevronDown, Building2, Shield, Crown, Target,
  ClipboardList, RotateCcw, Percent, Coins, HandCoins, Building, Scan, QrCode, BookOpen, PiggyBank, Beaker, PieChart, Factory, Smartphone,
  ArrowLeftRight, Cpu, Map, Navigation, Fence, BarChart3, MapPin, DollarSign, TrendingUp, Route, Lightbulb, Thermometer, Bot, Clock, Award, Globe, Repeat, Wrench,
  Copy, Package, Upload, Mail, AlertTriangle, LayoutGrid, Tag, Ticket, Check
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { useFeatures } from "../context/FeatureContext"
import { useBranch } from "../context/BranchContext"
import Logo from "./Logo"
import NotificationBell from "./NotificationBell"
import MarcoCopilot from "./MarcoCopilot"

const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  path: string
  feature?: string
  superadminOnly?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: "Inicio",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: TrendingUp, label: "Gerente Comercial IA", path: "/commercial-agent" },
      { icon: Bot, label: "Gerente Financiero IA", path: "/finance-agent" },
      { icon: Sparkles, label: "Gerente de Marketing IA", path: "/marketing-agent" },
    ]
  },
  {
    title: "Ventas",
    items: [
      { icon: MonitorSmartphone, label: "Punto de Venta (POS)", path: "/pos" },
      { icon: Receipt, label: "Facturación SIFEN", path: "/sales" },
      { icon: ClipboardList, label: "Pedidos & Preventa", path: "/sales-orders" },
      { icon: FileSpreadsheet, label: "Cotizaciones", path: "/quotes" },
      { icon: RotateCcw, label: "Devoluciones & NC", path: "/returns" },
      { icon: Users, label: "Clientes Mayoristas", path: "/customers" },
      { icon: BadgeDollarSign, label: "Listas de Precios", path: "/price-lists" },
      { icon: DollarSign, label: "Comisiones", path: "/commissions" },
      { icon: Globe, label: "Portal Clientes", path: "/portal" },
    ]
  },
  {
    title: "Inventario",
    items: [
      { icon: Tags, label: "Catálogo de Productos", path: "/products" },
      { icon: Copy, label: "Variantes & Empaques", path: "/variants" },
      { icon: Package, label: "Kits & Combos", path: "/kits" },
      { icon: Warehouse, label: "Depósitos & Stock", path: "/inventory" },
      { icon: AlertTriangle, label: "Mermas (Shrinkage)", path: "/shrinkage" },
      { icon: ArrowLeftRight, label: "Transferencias", path: "/transferencias" },
      { icon: ClipboardList, label: "Reabastecimiento", path: "/auto-replenish" },
    ]
  },
  {
    title: "Distribución & Logística",
    items: [
      { icon: Factory, label: "Módulo Distribuidora", path: "/distribuidora" },
      { icon: Navigation, label: "Rutas de Venta", path: "/rutas" },
      { icon: MapPinned, label: "Rutas de Logística", path: "/logistics" },
      { icon: Truck, label: "Flota & Entregas", path: "/intelientregas" },
      { icon: Map, label: "Mapa en Tiempo Real", path: "/mapa-tiempo-real" },
      { icon: BarChart3, label: "Rendimiento Preventa", path: "/rendimiento" },
      { icon: Smartphone, label: "App Repartidor", path: "/driver-app" },
    ]
  },
  {
    title: "Abastecimiento",
    items: [
      { icon: ShoppingBag, label: "Gestión de Compras", path: "/purchases" },
      { icon: TrendingUp, label: "Forecast & Reposición", path: "/demand-forecast" },
      { icon: Target, label: "Metas & Rebates PARESA", path: "/proveedor-kpis" },
      { icon: Briefcase, label: "Contratos Proveedores", path: "/contratos-proveedores" },
      { icon: Award, label: "Bonificaciones Compra", path: "/bonificaciones-compra" },
      { icon: RotateCcw, label: "Devol. a Proveedores", path: "/devoluciones-proveedores" },
      { icon: Upload, label: "Importaciones CSV", path: "/imports" },
      { icon: Globe, label: "Portal Proveedores", path: "/portal/proveedores/dashboard" },
    ]
  },
  {
    title: "Finanzas & Tesorería",
    items: [
      { icon: Banknote, label: "Arqueo de Caja", path: "/caja" },
      { icon: Landmark, label: "Bóveda Central", path: "/boveda" },
      { icon: Landmark, label: "Cuentas Bancarias", path: "/bancos" },
      { icon: CreditCard, label: "Gestión de Cheques", path: "/checks" },
      { icon: DollarSign, label: "Cuentas por Cobrar", path: "/accounts-receivable" },
      { icon: ShieldAlert, label: "Deuda Consolidada", path: "/deudas-consolidadas" },
      { icon: CreditCard, label: "Líneas de Crédito", path: "/credit-accounts" },
      { icon: HandCoins, label: "Cuentas por Pagar", path: "/accounts-payable" },
      { icon: ReceiptText, label: "Gastos Operativos", path: "/gastos" },
      { icon: DollarSign, label: "PyG Diario", path: "/pyg-diario" },
      { icon: Building, label: "Contabilidad Integrada", path: "/contabilidad" },
    ]
  },
  {
    title: "CRM & Marketing",
    items: [
      { icon: Users, label: "Fidelidad & CRM", path: "/crm" },
      { icon: PieChart, label: "Customer 360", path: "/customer360" },
      { icon: MessageCircle, label: "WhatsApp", path: "/whatsapp" },
      { icon: Megaphone, label: "IntelliZapp", path: "/intellizapp" },
      { icon: Tag, label: "Promociones & Campañas", path: "/promociones" },
      { icon: Target, label: "Metas de Venta", path: "/sales-targets" },
    ]
  },
  {
    title: "Recursos Humanos",
    items: [
      { icon: PiggyBank, label: "Nómina (SueldOK)", path: "/sueldok" },
      { icon: Clock, label: "Turnos & Horarios", path: "/schedule" },
      { icon: BookOpen, label: "Capacitación", path: "/capacitacion" },
    ]
  },
  {
    title: "Integraciones",
    items: [
      { icon: CreditCard, label: "Bancard & Dinelco", path: "/bancard" },
      { icon: CreditCard, label: "Pagopar", path: "/pagopar" },
      { icon: QrCode, label: "Kuapay", path: "/kuapay" },
      { icon: Mail, label: "Email Transaccional", path: "/email" },
      { icon: BookOpen, label: "InteliCont", path: "/intelicont" },
      { icon: Blocks, label: "Ecosistema Intelli", path: "/integrations" },
    ]
  },
  {
    title: "Inteligencia & Sistema",
    items: [
      { icon: Bot, label: "Marco IA (Cerebro)", path: "/asistente-virtual" },
      { icon: LineChart, label: "Business Intelligence", path: "/reports" },
      { icon: PieChart, label: "Reportes Gerenciales", path: "/gerencial" },
      { icon: Fingerprint, label: "Auditoría", path: "/audit" },
      { icon: Building2, label: "Sucursales", path: "/branches" },
      { icon: Shield, label: "Usuarios & Permisos (RBAC)", path: "/rbac" },
      { icon: Settings, label: "Configuración", path: "/settings" },
      { icon: Crown, label: "Admin SaaS", path: "/admin", superadminOnly: true },
      { icon: LayoutGrid, label: "Verticales", path: "/admin/verticals", superadminOnly: true },
    ]
  }
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { hasFeature } = useFeatures()
  const { branches, selectedBranch, selectedBranchId, setSelectedBranchId } = useBranch()
  const navigate = useNavigate()
  const location = useLocation()

  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  useEffect(() => {
    const activeGroup = navGroups.find(g => g.items.some(i => i.path === location.pathname || (i.path !== "/" && i.path !== "/dashboard" && location.pathname.startsWith(i.path))))
    if (activeGroup && !expandedGroups.includes(activeGroup.title)) {
      setExpandedGroups(prev => [...prev, activeGroup.title])
    }
  }, [location.pathname])

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => 
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    )
  }

  if (isElectron) {
    return (
      <div className="min-h-screen bg-body-light dark:bg-body-dark">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="h-screen bg-body-light dark:bg-body-dark flex overflow-hidden font-sans">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar Estilo Granítico con Estilo Pill, Línea Vertical y Acentuación Teal ── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 sidebar-gradient transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        
        {/* Logo & Header con Pill de Vertical */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col text-left">
              <Logo />
              <span className="mt-1.5 text-[9px] font-black bg-teal-500 text-white px-2.5 py-0.5 rounded-full w-max uppercase tracking-widest shadow-sm">
                Versión: Distribuidora
              </span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Menú de Navegación con Pills de Categoría y Guía Vertical */}
        <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => {
              if (item.superadminOnly && !user?.is_superadmin) return false
              return !item.feature || hasFeature(item.feature)
            })
            if (visibleItems.length === 0) return null

            const isExpanded = group.title === "Inicio" || expandedGroups.includes(group.title)

            return (
              <div key={group.title} className="space-y-1 text-left">
                {/* ── Estilo Pill en la Categoría ── */}
                {group.title !== "Inicio" && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className={`w-full flex items-center justify-between px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all text-left shadow-xs ${
                      isExpanded 
                        ? "bg-white/15 text-white border border-white/20" 
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5"
                    }`}
                  >
                    <span className="text-left flex-1 truncate">{group.title}</span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180 text-white" : "text-white/60"}`} />
                  </button>
                )}

                {/* ── Submenús con Línea Vertical al Costado Izquierdo y Acento Teal ── */}
                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className={`${group.title !== "Inicio" ? "ml-3 pl-2.5 border-l-2 border-white/20 space-y-1 py-1" : "space-y-1"}`}>
                    {visibleItems.map((item) => {
                      const active = location.pathname === item.path || (item.path === "/dashboard" && location.pathname === "/")
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                          className={`w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all duration-200 ${
                            active
                              ? "bg-white/25 text-white font-bold shadow-lg border-l-4 border-teal-400 pl-2"
                              : "text-white/75 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-teal-300" : "text-white/70"}`} />
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
        <div className="p-3 border-t border-white/10 space-y-1 relative">
          <div className="relative">
            <button onClick={() => setThemeDropdownOpen(!themeDropdownOpen)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3">
                {theme === 'light' ? <Sun className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                <span>Tema: {theme === 'light' ? "Claro" : theme === 'dark' ? "Oscuro" : "Sistema"}</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${themeDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {themeDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-[#0a2244] dark:bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                <button onClick={() => { setTheme('light'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/10">
                  <Sun className="w-4 h-4" /> Claro
                </button>
                <button onClick={() => { setTheme('dark'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/10">
                  <Moon className="w-4 h-4" /> Oscuro
                </button>
                <button onClick={() => { setTheme('system'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/10">
                  <Monitor className="w-4 h-4" /> Sistema
                </button>
              </div>
            )}
          </div>
          <button onClick={() => { logout(); navigate("/login") }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all">
            <LogOut className="w-5 h-5" />Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main Layout Body ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="relative z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 lg:px-6 py-3 flex items-center gap-4 lg:gap-8 justify-between">
          <div className="flex items-center gap-4 lg:hidden">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors"><Menu className="w-6 h-6" /></button>
          </div>
          
          {/* Global Search */}
          <div className="hidden lg:flex flex-1 max-w-xl">
            <div className="relative w-full group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                className="w-full bg-gray-100 dark:bg-slate-800/50 border border-transparent focus:border-primary/50 focus:bg-white dark:focus:bg-slate-800 text-sm rounded-xl pl-10 pr-12 py-2.5 transition-all text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                placeholder="Buscar productos, clientes, facturas mayoristas..."
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-[10px] font-semibold text-gray-400 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800">Ctrl K</span>
              </div>
            </div>
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {/* Interactive Branch Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-all cursor-pointer shadow-2xs"
                title="Seleccionar Sucursal Activa"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  {selectedBranch ? <Store className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider leading-none">
                    {selectedBranch ? `Sucursal (${selectedBranch.codigo})` : "Consolidado"}
                  </span>
                  <span className="text-xs font-black text-gray-900 dark:text-white leading-tight mt-0.5 max-w-[140px] truncate">
                    {selectedBranch ? selectedBranch.nombre : "Todas las Sucursales"}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${branchDropdownOpen ? "rotate-180 text-teal-500" : ""}`} />
              </button>

              {branchDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-2 py-1.5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 mb-1 flex items-center justify-between">
                    <span>Sucursales Casa Gonzalito</span>
                    <span className="text-[9px] text-teal-600 dark:text-teal-400 font-bold">{branches.length} activas</span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedBranchId("all")
                      setBranchDropdownOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left mb-1 ${
                      selectedBranchId === "all"
                        ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-teal-500" />
                      <span>🏢 Todas las Sucursales</span>
                    </div>
                    {selectedBranchId === "all" && <Check className="w-3.5 h-3.5 text-teal-500" />}
                  </button>

                  <div className="space-y-0.5 max-h-56 overflow-y-auto">
                    {branches.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBranchId(b.id)
                          setBranchDropdownOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left ${
                          selectedBranchId === b.id
                            ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/30"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 font-medium"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate">{b.nombre}</span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Cod: {b.codigo} · {b.ciudad || "Amambay"}
                          </span>
                        </div>
                        {selectedBranchId === b.id && <Check className="w-3.5 h-3.5 text-teal-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions & Notifications */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={() => navigate("/sales")} className="hidden sm:flex items-center gap-1.5 bg-teal-600/10 hover:bg-teal-600/20 text-teal-700 dark:text-teal-300 px-3 py-2 rounded-lg text-sm font-bold transition-colors">
                <Plus className="w-4 h-4" />
                <span>Nueva Venta</span>
              </button>
              
              <NotificationBell />
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

            {/* User Profile */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-sm font-semibold text-sm">
                {user?.nombre?.charAt(0).toUpperCase() || "G"}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-bold text-gray-900 dark:text-white leading-none">{user?.nombre || "Gustavo Quevedo"}</span>
                <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">Distribución Mayorista</span>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>

      {/* Global AI Copilot (Marco) */}
      <MarcoCopilot />
    </div>
  )
}
