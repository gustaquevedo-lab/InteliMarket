import { useState, useEffect } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, MonitorSmartphone, Receipt, FileSpreadsheet, Users, MessageCircle, Megaphone,
  Tags, Warehouse, Scale, ShoppingBag, Briefcase, Banknote, Landmark, CreditCard, Wallet, ReceiptText,
  MapPinned, Truck, ShoppingCart, Pill, Shirt, ShieldCheck, BadgeDollarSign, Blocks, LineChart, Fingerprint, Settings,
  LogOut, Menu, X, Moon, Sun, Monitor, Search, Plus, Store, ChevronDown, Building2, Shield, Crown, Target,
  ClipboardList, RotateCcw, Percent, Coins, HandCoins, Building, Scan, QrCode, BookOpen, PiggyBank, Beaker, PieChart, Factory, Smartphone,
   ArrowLeftRight, Cpu, Map, Navigation, Fence, BarChart3, MapPin, DollarSign, TrendingUp, Route, Lightbulb, Thermometer, Bot, Clock, Award, Globe, Repeat, Wrench,
   Copy, Package, Upload, Mail, AlertTriangle, LayoutGrid
  } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { useFeatures } from "../context/FeatureContext"
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
    ]
  },
  {
    title: "Ventas",
    items: [
      { icon: MonitorSmartphone, label: "Punto de Venta", path: "/pos", feature: "pos" },
      { icon: Receipt, label: "Facturación", path: "/sales" },
      { icon: ClipboardList, label: "Pedidos", path: "/sales-orders" },
      { icon: FileSpreadsheet, label: "Cotizaciones", path: "/quotes" },
      { icon: RotateCcw, label: "Devoluciones", path: "/returns" },
      { icon: Users, label: "Clientes", path: "/customers" },
      { icon: Globe, label: "Portal Clientes", path: "/portal", feature: "portal" },
    ]
  },
  {
    title: "Retail / Tienda",
    items: [
      { icon: ShoppingBag, label: "Retail Hub", path: "/retail", feature: "retail" },
      { icon: Store, label: "Tienda Online", path: "/tienda" },
    ]
  },
  {
    title: "CRM & Marketing",
    items: [
      { icon: Target, label: "Fidelidad & CRM", path: "/crm", feature: "crm" },
      { icon: MessageCircle, label: "WhatsApp", path: "/whatsapp", feature: "whatsapp" },
      { icon: Megaphone, label: "IntelliZapp", path: "/intellizapp", feature: "intellizapp" },
      { icon: Megaphone, label: "Campañas", path: "/promociones" },
      { icon: Percent, label: "Descuentos", path: "/discounts" },
      { icon: Coins, label: "Comisiones", path: "/commissions" },
      { icon: DollarSign, label: "Precios Inteligente", path: "/smart-pricing", feature: "smart_pricing" },
      { icon: BadgeDollarSign, label: "Listas de Precios", path: "/price-lists", feature: "price_lists" },
      { icon: Megaphone, label: "Marketing Automat.", path: "/marketing", feature: "marketing_automation" },
      { icon: Award, label: "Lealtad", path: "/loyalty", feature: "loyalty" },
    ]
  },
  {
    title: "IA & Analítica",
    items: [
      { icon: TrendingUp, label: "Forecast Demanda", path: "/demand-forecast", feature: "demand_forecast" },
      { icon: Route, label: "Ruteo Inteligente", path: "/intelligent-routing", feature: "intelligent_routing" },
      { icon: Shield, label: "Scoring Crédito", path: "/credit-scoring", feature: "credit_scoring" },
      { icon: Lightbulb, label: "Oportunidades", path: "/oportunidades", feature: "comerciales" },
      { icon: Thermometer, label: "Cadena de Frío", path: "/cold-chain", feature: "cold_chain" },
      { icon: Bot, label: "Asistente Virtual", path: "/asistente-virtual", feature: "asistente_virtual" },
      { icon: Users, label: "Clientes", path: "/clientes", feature: "clientes_fidelizacion" },
      { icon: PieChart, label: "Customer 360", path: "/customer360", feature: "customer360" },
      { icon: Clock, label: "Turnos", path: "/schedule", feature: "schedule" },
      { icon: BarChart3, label: "Productividad", path: "/productividad", feature: "productividad" },
      { icon: BookOpen, label: "Capacitación", path: "/capacitacion", feature: "capacitacion" },
      { icon: DollarSign, label: "PyG Diario", path: "/pyg-diario", feature: "pyg_diario" },
      { icon: AlertTriangle, label: "Shrinkage", path: "/shrinkage", feature: "shrinkage" },
      { icon: TrendingUp, label: "Forecast Avanz.", path: "/forecast-avanzado", feature: "forecast_avanzado" },
      { icon: BarChart3, label: "Benchmarking", path: "/benchmarking", feature: "benchmarking" },
      { icon: ShoppingCart, label: "E-commerce", path: "/ecommerce-sm", feature: "ecommerce_sm" },
      { icon: Globe, label: "Delivery Apps", path: "/delivery-integrations", feature: "delivery_integrations" },
      { icon: Repeat, label: "Suscripciones", path: "/suscripciones", feature: "suscripciones" },
    ]
  },
  {
    title: "Inventario",
    items: [
      { icon: Tags, label: "Catálogo", path: "/products" },
      { icon: Copy, label: "Variantes", path: "/variants", feature: "variants" },
      { icon: Package, label: "Kits", path: "/kits", feature: "kits" },
      { icon: Warehouse, label: "Almacenes", path: "/inventory" },
      { icon: Scale, label: "Básculas", path: "/escalas", feature: "supermercado" },
      { icon: ArrowLeftRight, label: "Transferencias", path: "/transferencias", feature: "advanced_inventory" },
      { icon: ClipboardList, label: "Reabastecimiento", path: "/auto-replenish", feature: "advanced_inventory" },
      { icon: MapPin, label: "Inventario Avanzado", path: "/advanced-inventory", feature: "advanced_inventory" },
    ]
  },
  {
    title: "Abastecimiento",
    items: [
      { icon: ShoppingBag, label: "Gestión de Compras", path: "/purchases" },
      { icon: Upload, label: "Importaciones CSV", path: "/imports", feature: "imports" },
      { icon: Briefcase, label: "Contratos Prov.", path: "/contratos-proveedores" },
      { icon: Users, label: "Acuerdos Clientes", path: "/acuerdos-clientes" },
      { icon: Globe, label: "Portal Proveedores", path: "/portal/proveedores/dashboard" },
    ]
  },
  {
    title: "Finanzas & Tesorería",
    items: [
      { icon: Bot, label: "Gerente Financiero IA", path: "/finance-agent" },
      { icon: Banknote, label: "Arqueo de Caja", path: "/caja" },
      { icon: Truck, label: "Liquidación Cobradores", path: "/route-cash-settlements" },
      { icon: Target, label: "Metas de Venta", path: "/sales-targets" },
      { icon: Percent, label: "Rebates de Proveedores", path: "/proveedor-kpis" },
      { icon: Landmark, label: "Bóveda Central", path: "/boveda", feature: "supermercado" },
      { icon: Landmark, label: "Cuentas por Cobrar", path: "/accounts-receivable" },
      { icon: HandCoins, label: "Cuentas por Pagar", path: "/payments" },
      { icon: Wallet, label: "Líneas de Crédito", path: "/credit-accounts", feature: "credit_accounts" },
      { icon: Landmark, label: "Cheques y Pagarés", path: "/checks", feature: "credit_accounts" },
      { icon: ReceiptText, label: "Gastos Operativos", path: "/gastos" },
      { icon: Building, label: "Gestión Financiera", path: "/financiero" },
      { icon: BarChart3, label: "Gestión Financ. Integr.", path: "/integrated-finance", feature: "integrated_finance" },
    ]
  },
  {
    title: "Logística & Reparto",
    items: [
      { icon: Factory, label: "Distribuidora", path: "/distribuidora", feature: "distribuidora" },
      { icon: MapPinned, label: "Rutas de Distrib.", path: "/logistics", feature: "logistics" },
      { icon: Truck, label: "Flota y Entregas", path: "/intelientregas", feature: "logistics" },
      { icon: Smartphone, label: "App Repartidor", path: "/driver-app" },
    ]
  },
  {
    title: "Mapa & Rutas",
    items: [
      { icon: Map, label: "Mapa en Tiempo Real", path: "/mapa-tiempo-real", feature: "real_time_map" },
      { icon: Users, label: "Vendedores", path: "/sellers", feature: "seller_tracking" },
      { icon: Navigation, label: "Rutas de Venta", path: "/rutas", feature: "sales_routes" },
      { icon: ClipboardList, label: "Visitas", path: "/visitas", feature: "seller_tracking" },
      { icon: Fence, label: "Geocercas", path: "/geocercas", feature: "geofence_zones" },
      { icon: BarChart3, label: "Rendimiento", path: "/rendimiento", feature: "seller_performance" },
    ]
  },
  {
    title: "Verticales (Especiales)",
    items: [
      { icon: ShoppingCart, label: "Supermercado", path: "/supermer", feature: "supermercado" },
      { icon: Scan, label: "Self-Checkout", path: "/self-checkout", feature: "supermercado" },
      { icon: QrCode, label: "Scan&Go", path: "/scanandgo", feature: "scanandgo" },
      { icon: Cpu, label: "Edge Hardware", path: "/edge-agent", feature: "supermercado" },
      { icon: Pill, label: "Farmacia", path: "/pharma", feature: "pharma" },
      { icon: Beaker, label: "POS Farmacia", path: "/pharma-pos", feature: "pharma" },
      { icon: Shirt, label: "Boutique", path: "/boutique", feature: "boutique_pedidos" },
      { icon: Wrench, label: "Servicios", path: "/servicios", feature: "servicios" },
      { icon: Smartphone, label: "App Clientes", path: "/client-app", feature: "client_app" },
    ]
  },
  {
    title: "Integraciones",
    items: [
      { icon: ShieldCheck, label: "Facturación SET", path: "/sifen", feature: "sifen" },
      { icon: ShieldCheck, label: "SIFEN Avanzado", path: "/sifen-avanzado", feature: "sifen_avanzado" },
      { icon: CreditCard, label: "Pagopar", path: "/pagopar", feature: "pagopar" },
      { icon: QrCode, label: "Kuapay", path: "/kuapay", feature: "kuapay" },
      { icon: Scan, label: "SPI QR", path: "/spi", feature: "spi" },
      { icon: CreditCard, label: "Bancard", path: "/bancard", feature: "bancard" },
      { icon: CreditCard, label: "Dinelco", path: "/dinelco", feature: "dinelco" },
      { icon: Mail, label: "Email", path: "/email", feature: "email" },
      { icon: BookOpen, label: "InteliCont", path: "/intelicont" },
      { icon: PiggyBank, label: "SueldOK", path: "/sueldok" },
      { icon: Blocks, label: "Ecosistema Intelli", path: "/integrations" },
    ]
  },
  {
    title: "Inteligencia & Sistema",
    items: [
      { icon: LineChart, label: "Business Intelligence", path: "/reports" },
      { icon: PieChart, label: "Rep. Gerenciales", path: "/gerencial" },
      { icon: Fingerprint, label: "Auditoría", path: "/audit" },
      { icon: Settings, label: "Configuración", path: "/settings" },
      { icon: Building2, label: "Sucursales", path: "/branches", feature: "branches" },
      { icon: Shield, label: "RBAC", path: "/rbac", feature: "rbac" },
      { icon: Crown, label: "Admin SaaS", path: "/admin", superadminOnly: true },
      { icon: LayoutGrid, label: "Verticales", path: "/admin/verticals", superadminOnly: true },
    ]
  }
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { hasFeature } = useFeatures()
  const navigate = useNavigate()
  const location = useLocation()

  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

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

  if (isElectron) {
    return (
      <div className="min-h-screen bg-body-light dark:bg-body-dark">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="h-screen bg-body-light dark:bg-body-dark flex overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 sidebar-gradient transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Logo />
              {localStorage.getItem('demo_mode') === 'supermercado' && (
                <span className="mt-1 text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full w-max uppercase tracking-wider">
                  Versión: Supermercado
                </span>
              )}
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {navGroups.map((group) => {
            if (localStorage.getItem('demo_mode') === 'supermercado') {
              const allowedGroups = ["Inicio", "Ventas", "Inventario", "Abastecimiento", "Finanzas & Tesorería", "Verticales (Especiales)", "Integraciones", "Inteligencia & Sistema", "CRM & Marketing"];
              if (!allowedGroups.includes(group.title)) return null;
            }

            const visibleItems = group.items.filter((item) => {
              const isSupermerCRM = localStorage.getItem('demo_mode') === 'supermercado' && (item.label === "Fidelidad & CRM" || item.label === "WhatsApp");
              if (item.feature && !hasFeature(item.feature) && !isSupermerCRM) return false;
              if (item.superadminOnly && !user?.is_superadmin) return false;
              if (localStorage.getItem('demo_mode') === 'supermercado') {
                if (
                  item.label === "SueldOK" ||
                  item.label === "Supermercado" ||
                  item.label === "Self-Checkout" ||
                  item.label === "Edge Hardware" ||
                  item.label === "Básculas" ||
                  item.label === "Catálogo" ||
                  item.label === "Almacenes" ||
                  item.label === "Transferencias" ||
                  item.label === "Reabastecimiento" ||
                  item.label === "Punto de Venta" ||
                  item.label === "Devoluciones" ||
                  item.label === "Facturación" ||
                  item.label === "Arqueo de Caja" ||
                  item.label === "Bóveda Central" ||
                  item.label === "Cuentas por Cobrar" ||
                  item.label === "Cuentas por Pagar" ||
                  item.label === "Líneas de Crédito" ||
                  item.label === "Gastos Operativos" ||
                  item.label === "Gestión Financiera" ||
                  item.label === "Dashboard" ||
                  item.label === "Facturación SET" ||
                  item.label === "Pagopar" ||
                  item.label === "Kuapay" ||
                  item.label === "SPI QR" ||
                  item.label === "InteliCont" ||
                  item.label === "Ecosistema Intelli" ||
                  item.label === "Auditoría" ||
                  item.label === "Gestión de Compras" ||
                  item.label === "Contratos Prov." ||
                  item.label === "Fidelidad & CRM" ||
                  item.label === "WhatsApp"
                ) {
                  return true;
                }
                return false;
              }
              return true;
            });
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                {group.title !== "Inicio" && (
                  <button 
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-3 py-2 mt-2 text-xs font-semibold text-white/50 hover:text-white uppercase tracking-wide transition-colors"
                  >
                    <span>{group.title}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedGroups.includes(group.title) ? "rotate-180 text-white" : ""}`} />
                  </button>
                )}
                
                <div className={`space-y-1 overflow-hidden transition-all duration-300 ${group.title === "Inicio" || expandedGroups.includes(group.title) ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
                  {visibleItems.map((item) => {
                    const active = location.pathname === item.path
                    return (
                      <button key={item.path} onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active ? "bg-white/20 text-white shadow-lg" : "text-white/70 hover:text-white hover:bg-white/10"}`}>
                        <item.icon className="w-5 h-5 flex-shrink-0" />{item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            );
          })}
        </nav>

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
                placeholder="Buscar productos, clientes, facturas..."
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-[10px] font-semibold text-gray-400 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800">Ctrl K</span>
              </div>
            </div>
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {/* Branch Selector */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider leading-none">Sucursal</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white leading-tight mt-0.5">Centro (Súper)</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
            </div>

            {/* Quick Actions & Notifications */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button className="hidden sm:flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" />
                <span>Nuevo</span>
              </button>
              
              <NotificationBell />
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

            {/* User Profile */}
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white shadow-sm font-semibold text-sm">
                {user?.nombre?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-white leading-none">{user?.nombre || "Usuario"}</span>
                <span className="text-[11px] text-gray-500 mt-0.5">Administrador</span>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
