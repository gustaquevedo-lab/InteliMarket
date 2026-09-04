import { useState, useEffect } from "react"
import ErrorBoundary from "./ErrorBoundary"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, MonitorSmartphone, Receipt, FileSpreadsheet, Users, MessageCircle, Megaphone,
  Tags, Warehouse, Scale, ShoppingBag, Briefcase, Banknote, Landmark, CreditCard, Wallet, ReceiptText,
  Truck, ShoppingCart, ShieldCheck, BadgeDollarSign, Blocks, LineChart, Fingerprint, Settings, FileSignature,
  LogOut, Menu, X, Moon, Sun, Monitor, Search, Store, ChevronDown, Building, Scan, QrCode, BookOpen, PiggyBank,
  PieChart, DollarSign, TrendingUp, Bot, Clock, Award, Globe, Repeat, Wrench,
  Copy, Package, Upload, Mail, AlertTriangle, LayoutGrid, Carrot, ChefHat, Radio, Plus, Sparkles, Tag,
  Ticket
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { useFeatures } from "../context/FeatureContext"
import { api } from "../api"
import Logo from "./Logo"
import NotificationBell from "./NotificationBell"

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
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: TrendingUp, label: "Gerente de Ventas IA", path: "/sales-agent" },
      { icon: Bot, label: "Gerente Financiero IA", path: "/finance-agent" },
      { icon: Sparkles, label: "Gerente de Marketing IA", path: "/marketing-agent" },
    ]
  },
  {
    title: "Ventas",
    items: [
      { icon: MonitorSmartphone, label: "Punto de Venta", path: "/pos" },
      { icon: Scan, label: "Self-Checkout", path: "/self-checkout" },
      { icon: Receipt, label: "Facturación", path: "/sales" },
      { icon: FileSpreadsheet, label: "Pedidos & Cotizaciones", path: "/sales-orders" },
      { icon: Repeat, label: "Devoluciones & NC", path: "/returns" },
      { icon: Users, label: "Clientes", path: "/customers" },
      { icon: DollarSign, label: "Precios Inteligentes", path: "/smart-pricing" },
      { icon: BadgeDollarSign, label: "Listas de Precios", path: "/price-lists" },
      { icon: LineChart, label: "Benchmarking Precios", path: "/benchmarking" },
      { icon: DollarSign, label: "Comisiones", path: "/commissions" },
      { icon: Store, label: "Tienda Online", path: "/tienda" },
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
    ]
  },
  {
    title: "Operaciones de Salón",
    items: [
      { icon: LayoutGrid, label: "Hub Operaciones (PWA)", path: "/operaciones-salon" },
      { icon: Scan, label: "Verificador de Precios (Kiosko)", path: "/verificador" },
      { icon: Monitor, label: "TV Digital Carnicería (55\")", path: "/tv/carniceria" },
      { icon: Scale, label: "Carnicería & Desposte", path: "/desposte" },
      { icon: Carrot, label: "Verdulería & Frescos", path: "/frescos" },
      { icon: ChefHat, label: "Panadería & Rotisería", path: "/panaderia-rotiseria" },
      { icon: ShieldCheck, label: "Inocuidad & HACCP", path: "/haccp" },
      { icon: Wrench, label: "Mantenimiento & Equipos", path: "/equipos-mantenimiento" },
    ]
  },
  {
    title: "Abastecimiento",
    items: [
      { icon: ShoppingBag, label: "Gestión de Compras", path: "/purchases" },
      { icon: Tags, label: "Etiquetas", path: "/etiquetas" },
      { icon: TrendingUp, label: "Forecast & Reposición", path: "/demand-forecast" },
      { icon: Truck, label: "Recepción Directa DSD", path: "/dsd" },
      { icon: Briefcase, label: "Contratos & Rebates", path: "/contratos-proveedores" },
      { icon: Globe, label: "Portal Proveedores", path: "/portal/proveedores" },
    ]
  },
  {
    title: "Finanzas & Tesorería",
    items: [
      { icon: Banknote, label: "Arqueo de Caja", path: "/caja" },
      { icon: Landmark, label: "Bóveda Central", path: "/boveda" },
      { icon: Landmark, label: "Cuentas Bancarias", path: "/bancos" },
      { icon: CreditCard, label: "Gestión de Cheques", path: "/cheques" },
      { icon: DollarSign, label: "Cuentas por Cobrar", path: "/accounts-receivable" },
      // DESACTIVADO 2026-09-04: el modulo hoy es una maqueta -- 0 datos reales, el frontend rellena con clientes inventados si la API real da vacio (que es siempre). No lo usa este tenant. Ver auditoria de sidebar.
      // { icon: ShieldCheck, label: "Scoring de Crédito", path: "/credit-scoring" },
      { icon: CreditCard, label: "Cuentas por Pagar (AP)", path: "/payments" },
      { icon: ReceiptText, label: "Gastos Operativos", path: "/gastos" },
      { icon: DollarSign, label: "PyG Diario por Depto.", path: "/pyg-diario" },
      { icon: Building, label: "Gestión Financiera", path: "/financiero" },
    ]
  },
  {
    title: "CRM & Marketing",
    items: [
      { icon: Users, label: "Fidelidad ExtraClub", path: "/crm" },
      { icon: Ticket, label: "Cupones de Sorteo", path: "/cupones" },
      { icon: PieChart, label: "Customer 360", path: "/customer360" },
      { icon: MessageCircle, label: "IntelliZapp (WhatsApp)", path: "/intellizapp" },
      { icon: Tag, label: "Promociones & Campañas", path: "/promociones" },
    ]
  },
  {
    title: "Recursos Humanos",
    items: [
      { icon: PiggyBank, label: "Nómina & Sueldos (SueldOK)", path: "/sueldok" },
      { icon: Clock, label: "Turnos & Horarios", path: "/schedule" },
      { icon: LineChart, label: "Productividad de Cajas", path: "/productividad" },
    ]
  },
  {
    title: "Integraciones",
    items: [
      { icon: ShieldCheck, label: "Facturación & Autoimpresor (DNIT)", path: "/sifen" },
      { icon: FileSignature, label: "Facturación Electrónica (Próximamente)", path: "/facturacion-electronica" },
      { icon: Scale, label: "Básculas & Balanzas", path: "/escalas" },
      { icon: Radio, label: "Etiquetas Electrónicas (ESL)", path: "/esl" },
      { icon: Globe, label: "Delivery Apps", path: "/delivery-integrations" },
      { icon: CreditCard, label: "Integración Medios de Pago", path: "/integrations" },
    ]
  },
  {
    title: "Inteligencia & Sistema",
    items: [
      { icon: LineChart, label: "Business Intelligence", path: "/reports" },
      { icon: PieChart, label: "Reportes Gerenciales", path: "/gerencial" },
      { icon: Fingerprint, label: "Auditoría", path: "/audit" },
      { icon: Settings, label: "Configuración", path: "/settings" },
      { icon: Building, label: "Sucursales", path: "/branches" },
      { icon: ShieldCheck, label: "Usuarios & Permisos (RBAC)", path: "/rbac" },
    ]
  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { hasFeature } = useFeatures()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<any>(null)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)

  useEffect(() => {
    api.branches.list()
      .then((data: any) => {
        if (Array.isArray(data)) {
          setBranches(data)
          if (data.length > 0) {
            setSelectedBranch(data[0])
          }
        }
      })
      .catch((err: any) => console.error("Error fetching branches:", err))
  }, [])

  useEffect(() => {
    const activeGroup = navGroups.find(g => g.items.some(i => i.path === location.pathname))
    if (activeGroup && !expandedGroups.includes(activeGroup.title)) {
      setExpandedGroups(prev => [...prev, activeGroup.title])
    }
  }, [location.pathname])

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    )
  }

  const userRole = user?.is_superadmin
    ? "Super Admin"
    : (user as any)?.rol || (user as any)?.role || "Administrador"

  // ── Buscador global funcional ────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  const allNavItems = navGroups.flatMap(g => g.items)
  const searchResults = searchQuery.trim().length > 0
    ? allNavItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (!item.feature || hasFeature(item.feature)) &&
        (!item.superadminOnly || user?.is_superadmin)
      ).slice(0, 8)
    : []

  const handleSearchNavigate = (path: string) => {
    navigate(path)
    setSearchQuery("")
    setSearchOpen(false)
  }

  const isPosRoute = location.pathname.startsWith("/pos") || location.pathname.startsWith("/self-checkout") || location.pathname.startsWith("/pharma-pos");
  if (isElectron || isPosRoute) {
    return (
      <div className="min-h-screen bg-body-light dark:bg-body-dark">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="h-screen bg-body-light dark:bg-body-dark flex overflow-hidden font-sans">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar Estilo Vertical Distribuidora con Estilo Pill y Línea Vertical ── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 sidebar-gradient transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        
        {/* Logo & Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col text-left">
              <Logo />
              <span className="mt-1.5 text-[9px] font-black bg-emerald-500/90 text-white px-2 py-0.5 rounded-full w-max uppercase tracking-widest shadow-sm">
                Versión: Supermercado
              </span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Menú de Navegación con Pills y Guía Vertical */}
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
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all text-left shadow-sm ${
                      isExpanded 
                        ? "bg-white/15 text-white border border-white/20" 
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5"
                    }`}
                  >
                    <span className="text-left flex-1 truncate">{group.title}</span>
                    <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180 text-white" : "text-white/60"}`} />
                  </button>
                )}

                {/* ── Submenús con Línea Vertical al Costado Izquierdo ── */}
                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className={`${group.title !== "Inicio" ? "ml-3 pl-2.5 border-l-2 border-white/20 space-y-1 py-1" : "space-y-1"}`}>
                    {visibleItems.map((item) => {
                      const active = location.pathname === item.path
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                          className={`w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all duration-200 ${
                            active
                              ? "bg-white/25 text-white font-bold shadow-lg border-l-4 border-emerald-400 pl-2"
                              : "text-white/75 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-emerald-300" : "text-white/70"}`} />
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

        {/* Footer: User & Settings */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="relative">
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all text-left"
            >
              <div className="flex items-center gap-2.5 text-left">
                {theme === 'light' ? <Sun className="w-4 h-4 text-amber-300" /> : theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-300" /> : <Monitor className="w-4 h-4 text-emerald-300" />}
                <span className="text-left">Tema</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {themeDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-[#0a2244] dark:bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 text-left">
                <button onClick={() => { setTheme('light'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 text-left">
                  <Sun className="w-4 h-4 text-amber-300" /> <span className="text-left">Claro</span>
                </button>
                <button onClick={() => { setTheme('dark'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 text-left">
                  <Moon className="w-4 h-4 text-indigo-300" /> <span className="text-left">Oscuro</span>
                </button>
                <button onClick={() => { setTheme('system'); setThemeDropdownOpen(false) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 text-left">
                  <Monitor className="w-4 h-4 text-emerald-300" /> <span className="text-left">Sistema</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { logout(); navigate("/login") }}
            className="w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all text-left"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" /> <span className="text-left">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="relative z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 lg:px-6 py-3 flex items-center gap-4 lg:gap-8 justify-between">
          <div className="flex items-center gap-4 lg:hidden">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </div>
          
          {/* Global Search */}
          <div className="hidden lg:flex flex-1 max-w-xl relative">
            <div className="relative w-full group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "Escape") { setSearchQuery(""); setSearchOpen(false) }
                  if (e.key === "Enter" && searchResults.length > 0) handleSearchNavigate(searchResults[0].path)
                }}
                className="w-full bg-gray-100 dark:bg-slate-800/50 border border-transparent focus:border-primary/50 focus:bg-white dark:focus:bg-slate-800 text-sm rounded-xl pl-10 pr-12 py-2.5 transition-all text-gray-900 dark:text-white placeholder-gray-500 outline-none text-left"
                placeholder="Buscar productos, clientes, facturas..."
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-[10px] font-semibold text-gray-400 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800">Ctrl K</span>
              </div>
            </div>

            {/* Dropdown de resultados */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50 text-left">
                {searchResults.map((item) => (
                  <button
                    key={item.path}
                    onMouseDown={() => handleSearchNavigate(item.path)}
                    className="w-full flex items-center justify-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white text-left flex-1 truncate">{item.label}</span>
                    <span className="ml-auto text-[10px] text-gray-400 font-mono text-right">{item.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {/* Branch Selector */}
            <div className="relative">
              <div 
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary">
                  <Store className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider leading-none text-left">Sucursal</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white leading-tight mt-0.5 text-left truncate max-w-[150px]">
                    {selectedBranch?.nombre || "Casa Central"}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
              </div>

              {branchDropdownOpen && branches.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 text-left font-sans">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSelectedBranch(b)
                        setBranchDropdownOpen(false)
                      }}
                      className="w-full flex flex-col items-start px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors text-left"
                    >
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{b.nombre}</span>
                      <span className="text-[10px] text-gray-500">{b.ciudad} · Código {b.codigo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions & Notifications */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={() => navigate("/pos")}
                className="hidden sm:flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo</span>
              </button>
              
              <NotificationBell />
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

            {/* User Profile */}
            <div 
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity text-left"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white shadow-sm font-semibold text-sm">
                {user?.nombre?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-medium text-gray-900 dark:text-white leading-none text-left">{user?.nombre || "Usuario"}</span>
                <span className="text-[11px] text-gray-500 mt-0.5 text-left">{userRole}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><ErrorBoundary><Outlet /></ErrorBoundary></main>
      </div>
    </div>
  )
}
