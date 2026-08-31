import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "./context/ThemeContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { FeatureProvider, useFeatures } from "./context/FeatureContext"
import { OfflineProvider } from "./context/OfflineContext"
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt"
import Layout from "./components/Layout"
import ErrorBoundary from "./components/ErrorBoundary"

const Login = lazy(() => import("./pages/Login"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const MarketingPage = lazy(() => import("./pages/marketing/MarketingPage"))
const SifenPage = lazy(() => import("./pages/sifen/SifenPage"))
const ProductsPage = lazy(() => import("./pages/products/ProductsPage"))
const InventoryPage = lazy(() => import("./pages/inventory/InventoryPage"))
const CustomersPage = lazy(() => import("./pages/customers/CustomersPage"))
const SalesPage = lazy(() => import("./pages/sales/SalesPage"))
const PurchasesPage = lazy(() => import("./pages/purchases/PurchasesPage"))
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"))
const ExecutiveReportPage = lazy(() => import("./pages/gerencial/ExecutiveReportPage"))
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"))
const POSPage = lazy(() => import("./pages/pos/POSPage"))
const SupervisorPage = lazy(() => import("./pages/pos/SupervisorPage"))
const CajaPage = lazy(() => import("./pages/caja/CajaPage"))
const AdminPage = lazy(() => import("./pages/admin/AdminPage"))
const VerticalsPage = lazy(() => import("./pages/admin/VerticalsPage"))
const PagoparPage = lazy(() => import("./pages/pagopar/PagoparPage"))
const KuapayPage = lazy(() => import("./pages/kuapay/KuapayPage"))
const SpiPage = lazy(() => import("./pages/spi/SpiPage"))
const BranchesPage = lazy(() => import("./pages/branches/BranchesPage"))
const CreditAccountsPage = lazy(() => import("./pages/credit-accounts/CreditAccountsPage"))
const LogisticsPage = lazy(() => import("./pages/logistics/LogisticsPage"))
const AuditPage = lazy(() => import("./pages/audit/AuditPage"))
const SueldokPage = lazy(() => import("./pages/sueldok/SueldokPage"))
const ScalesPage = lazy(() => import("./pages/scales/ScalesPage"))
const PedidosCotizacionesPage = lazy(() => import("./pages/sales-orders/PedidosCotizacionesPage"))
const ReturnsPage = lazy(() => import("./pages/returns/ReturnsPage"))
const DiscountsPage = lazy(() => import("./pages/discounts/DiscountsPage"))
const CommissionsPage = lazy(() => import("./pages/commissions/CommissionsPage"))
const AccountsReceivablePage = lazy(() => import("./pages/accounts-receivable/AccountsReceivablePage"))
const FinanceAgentPage = lazy(() => import("./pages/finance-agent/FinanceAgentPage"))
const SalesAgentPage = lazy(() => import("./pages/sales-agent/SalesAgentPage"))
const MarketingAgentPage = lazy(() => import("./pages/marketing-agent/MarketingAgentPage"))
const RbacPage = lazy(() => import("./pages/rbac/RbacPage"))
const UsuariosPage = lazy(() => import("./pages/usuarios/UsuariosPage"))
const CrmPage = lazy(() => import("./pages/crm/CrmPage"))
const WhatsAppPage = lazy(() => import("./pages/whatsapp/WhatsAppPage"))
const NotificationsPage = lazy(() => import("./pages/notifications/NotificationsPage"))
const PharmaPage = lazy(() => import("./pages/pharma/PharmaPage"))
const PharmaPOSPage = lazy(() => import("./pages/pharma/PharmaPOSPage"))
const InteliEntregasPage = lazy(() => import("./pages/intelientregas/InteliEntregasPage"))
const DriverAppPage = lazy(() => import("./pages/driverapp/DriverAppPage"))
const BoutiquePage = lazy(() => import("./pages/boutique/BoutiquePage"))
const ServiciosPage = lazy(() => import("./pages/servicios/ServiciosPage"))
const InteliContPage = lazy(() => import("./pages/intelicont/InteliContPage"))
const IntegrationsPage = lazy(() => import("./pages/integrations/IntegrationsPage"))
const PromotionsPage = lazy(() => import("./pages/marketing/PromocionesPage"))
const CapturaCuponesPage = lazy(() => import("./pages/cupones/CapturaCuponesPage"))
const IntelliZappPage = lazy(() => import("./pages/intellizapp/IntelliZappPage"))
const ExpensesPage = lazy(() => import("./pages/expenses/ExpensesPage"))
const FinancialPage = lazy(() => import("./pages/financial/FinancialPage"))
const BancosPage = lazy(() => import("./pages/bancos/BancosPage"))
const SupplierContractsPage = lazy(() => import("./pages/supplier-contracts/SupplierContractsPage"))
const ChequesPage = lazy(() => import("./pages/cheques/ChequesPage"))
const PaymentsPage = lazy(() => import("./pages/payments/PaymentsPage"))
const SupplierLogin = lazy(() => import("./pages/supplier-portal/SupplierLogin"))
const SupplierDashboard = lazy(() => import("./pages/supplier-portal/SupplierDashboard"))
const CustomerAgreementsPage = lazy(() => import("./pages/customer-agreements/CustomerAgreementsPage"))
const DistribuidoraPage = lazy(() => import("./pages/distribuidora/DistribuidoraPage"))
const SupermerPage = lazy(() => import("./pages/supermer/SupermerPage"))
const CarniceriaDespostePage = lazy(() => import("./pages/operations/CarniceriaDespostePage"))
const VerduleriaFrescosPage = lazy(() => import("./pages/operations/VerduleriaFrescosPage"))
const PanaderiaRotiseriaPage = lazy(() => import("./pages/operations/PanaderiaRotiseriaPage"))
const HaccpPage = lazy(() => import("./pages/operations/HaccpPage"))
const EquipmentPage = lazy(() => import("./pages/operations/EquipmentPage"))
const SalonOperacionesPwaPage = lazy(() => import("./pages/operations/SalonOperacionesPwaPage"))
const CarniceriaTvDigitalPage = lazy(() => import("./pages/kiosk/CarniceriaTvDigitalPage"))
const DsdPage = lazy(() => import("./pages/operations/DsdPage"))
const EslPage = lazy(() => import("./pages/operations/EslPage"))
const PriceCheckerKioskPage = lazy(() => import("./pages/kiosk/PriceCheckerKioskPage"))
const CajaRapidaPage = lazy(() => import("./pages/pos/CajaRapidaPage"))
const SelfCheckoutPage = lazy(() => import("./pages/pos/SelfCheckoutPage"))
const TransferenciasPage = lazy(() => import("./pages/inventory/TransferenciasPage"))
const BovedaPage = lazy(() => import("./pages/caja/BovedaPage"))
const EdgeAgentPage = lazy(() => import("./pages/pos/EdgeAgentPage"))
const SellersPage = lazy(() => import("./pages/sellers/SellersPage"))
const MapaPage = lazy(() => import("./pages/mapa-tiempo-real/MapaPage"))
const RutasPage = lazy(() => import("./pages/rutas/RutasPage"))
const VisitasPage = lazy(() => import("./pages/visitas/VisitasPage"))
const GeocercasPage = lazy(() => import("./pages/geocercas/GeocercasPage"))
const RendimientoPage = lazy(() => import("./pages/rendimiento/RendimientoPage"))
const InventoryAdvancedPage = lazy(() => import("./pages/inventory/InventoryAdvancedPage"))
const IntegratedFinancePage = lazy(() => import("./pages/integrated-finance/IntegratedFinancePage"))
const SmartPricingPage = lazy(() => import("./pages/smart-pricing/SmartPricingPage"))
const DemandForecastPage = lazy(() => import("./pages/demand-forecast/DemandForecastPage"))
const IntelligentRoutingPage = lazy(() => import("./pages/intelligent-routing/IntelligentRoutingPage"))
const OportunidadesPage = lazy(() => import("./pages/comerciales/OportunidadesPage"))
const ColdChainPage = lazy(() => import("./pages/cold-chain/ColdChainPage"))
const AsistenteVirtualPage = lazy(() => import("./pages/asistente-virtual/AsistenteVirtualPage"))
const ClientesPage = lazy(() => import("./pages/clientes/ClientesPage"))
const ScanAndGoPage = lazy(() => import("./pages/scanandgo/ScanAndGoPage"))
const Customer360Page = lazy(() => import("./pages/customer360/Customer360Page"))
const CreditScoringPage = lazy(() => import("./pages/credit-scoring/CreditScoringPage"))
const SchedulePage = lazy(() => import("./pages/schedule/SchedulePage"))
const ProductividadPage = lazy(() => import("./pages/productividad/ProductividadPage"))
const CapacitacionPage = lazy(() => import("./pages/capacitacion/CapacitacionPage"))
const PyGDiarioPage = lazy(() => import("./pages/pyg-diario/PyGDiarioPage"))
const ShrinkagePage = lazy(() => import("./pages/shrinkage/ShrinkagePage"))
const ForecastAvanzadoPage = lazy(() => import("./pages/forecast-avanzado/ForecastAvanzadoPage"))
const BenchmarkingPage = lazy(() => import("./pages/benchmarking/BenchmarkingPage"))
const EcommerceSmPage = lazy(() => import("./pages/ecommerce-sm/EcommerceSmPage"))
const DeliveryIntegrationsPage = lazy(() => import("./pages/delivery-integrations/DeliveryIntegrationsPage"))
const SuscripcionesPage = lazy(() => import("./pages/suscripciones/SuscripcionesPage"))
const RetailPage = lazy(() => import("./pages/retail/RetailPage"))
const EcommerceLogin = lazy(() => import("./pages/ecommerce/EcommerceLogin"))
const EcommerceRegister = lazy(() => import("./pages/ecommerce/EcommerceRegister"))
const EcommerceCatalog = lazy(() => import("./pages/ecommerce/EcommerceCatalog"))
const EcommerceProductDetail = lazy(() => import("./pages/ecommerce/EcommerceProductDetail"))
const EcommerceCart = lazy(() => import("./pages/ecommerce/EcommerceCart"))
const EcommerceCheckout = lazy(() => import("./pages/ecommerce/EcommerceCheckout"))
const EcommerceOrders = lazy(() => import("./pages/ecommerce/EcommerceOrders"))
const EcommerceOrderDetail = lazy(() => import("./pages/ecommerce/EcommerceOrderDetail"))
const VariantsPage = lazy(() => import("./pages/variants/VariantsPage"))
const KitsPage = lazy(() => import("./pages/kits/KitsPage"))
const PriceListsPage = lazy(() => import("./pages/price-lists/PriceListsPage"))
const ImportsPage = lazy(() => import("./pages/imports/ImportsPage"))
const EmailPage = lazy(() => import("./pages/email/EmailPage"))
const BancardPage = lazy(() => import("./pages/bancard/BancardPage"))
const DinelcoPage = lazy(() => import("./pages/dinelco/DinelcoPage"))
const LoyaltyPage = lazy(() => import("./pages/loyalty/LoyaltyPage"))
const PortalPage = lazy(() => import("./pages/portal/PortalPage"))
const ClientAppPage = lazy(() => import("./pages/client-app/ClientAppPage"))
const SifenAvanzadoPage = lazy(() => import("./pages/sifen-avanzado/SifenAvanzadoPage"))
const SupplierPortalHubPage = lazy(() => import("./pages/supplier-portal/SupplierPortalHubPage"))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-body-light dark:bg-body-dark">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 animate-pulse">Cargando...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function FeatureRoute({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { hasFeature, loading } = useFeatures()
  if (loading) return <PageLoader />
  if (!hasFeature(feature)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-body-light dark:bg-body-dark">
        <div className="text-center p-8 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Módulo no habilitado</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
            Este módulo no está disponible en tu plan actual.
          </p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

function AppRoutes() {
  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
      <Route path="/portal/proveedores/login" element={<Suspense fallback={<PageLoader />}><SupplierLogin /></Suspense>} />
      <Route path="/portal/proveedores/dashboard" element={<Suspense fallback={<PageLoader />}><SupplierDashboard /></Suspense>} />
      <Route path="/driver-app" element={<Suspense fallback={<PageLoader />}><DriverAppPage /></Suspense>} />
      <Route path="/tienda" element={<Suspense fallback={<PageLoader />}><EcommerceCatalog /></Suspense>} />
      <Route path="/tienda/login" element={<Suspense fallback={<PageLoader />}><EcommerceLogin /></Suspense>} />
      <Route path="/tienda/registro" element={<Suspense fallback={<PageLoader />}><EcommerceRegister /></Suspense>} />
      <Route path="/tienda/producto/:id" element={<Suspense fallback={<PageLoader />}><EcommerceProductDetail /></Suspense>} />
      <Route path="/tienda/carrito" element={<Suspense fallback={<PageLoader />}><EcommerceCart /></Suspense>} />
      <Route path="/tienda/checkout" element={<Suspense fallback={<PageLoader />}><EcommerceCheckout /></Suspense>} />
      <Route path="/tienda/pedidos" element={<Suspense fallback={<PageLoader />}><EcommerceOrders /></Suspense>} />
      <Route path="/tienda/pedido/:id" element={<Suspense fallback={<PageLoader />}><EcommerceOrderDetail /></Suspense>} />
      <Route path="/tienda/dashboard" element={<Suspense fallback={<PageLoader />}><EcommerceOrders /></Suspense>} />
      <Route path="/verificador" element={<Suspense fallback={<PageLoader />}><PriceCheckerKioskPage /></Suspense>} />
      <Route path="/consulta-precios" element={<Suspense fallback={<PageLoader />}><PriceCheckerKioskPage /></Suspense>} />
      <Route path="/tv/carniceria" element={<Suspense fallback={<PageLoader />}><CarniceriaTvDigitalPage /></Suspense>} />
      <Route path="/operaciones-salon" element={<Suspense fallback={<PageLoader />}><SalonOperacionesPwaPage /></Suspense>} />
      <Route path="/pos" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><POSPage /></Suspense></ProtectedRoute>} />
      <Route path="/supervisor" element={<Suspense fallback={<PageLoader />}><SupervisorPage /></Suspense>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={isElectron ? "/pos" : "/dashboard"} replace />} />
        {[
          ["dashboard", <Dashboard />],
          ["self-checkout", <SelfCheckoutPage />],
          ["transferencias", <TransferenciasPage />],
          ["boveda", <BovedaPage />],
          ["edge-agent", <EdgeAgentPage />],
          ["sales", <SalesPage />],
          ["products", <ProductsPage />],
          ["inventory", <InventoryPage />],
          ["purchases", <PurchasesPage />],
          ["customers", <CustomersPage />],
          ["reports", <ReportsPage />],
          ["gerencial", <ExecutiveReportPage />],
          ["settings", <SettingsPage />],
          ["sifen", <SifenPage />],
          ["caja", <CajaPage />],
          ["admin", <AdminPage />],
          ["admin/verticals", <VerticalsPage />],
          ["audit", <AuditPage />],
          ["quotes", <PedidosCotizacionesPage />],
          ["sales-orders", <PedidosCotizacionesPage />],
          ["returns", <ReturnsPage />],
          ["discounts", <DiscountsPage />],
          ["commissions", <CommissionsPage />],
          ["accounts-receivable", <AccountsReceivablePage />],
          ["finance-agent", <FinanceAgentPage />],
          ["sales-agent", <SalesAgentPage />],
          ["marketing-agent", <MarketingAgentPage />],
          ["notifications", <NotificationsPage />],
          ["intelicont", <InteliContPage />],
          ["integrations", <IntegrationsPage />],
          ["sueldok", <SueldokPage />],
          ["promociones", <PromotionsPage />],
          ["cupones", <CapturaCuponesPage />],
          ["marketing/cupones", <CapturaCuponesPage />],
          ["crm", <CrmPage />],
          ["intellizapp", <IntelliZappPage />],
          ["whatsapp", <IntelliZappPage />],
          ["gastos", <ExpensesPage />],
          ["financiero", <FinancialPage />],
          ["bancos", <BancosPage />],
          ["cheques", <ChequesPage />],
          ["payments", <PaymentsPage />],
          ["contratos-proveedores", <SupplierContractsPage />],
          ["portal/proveedores", <SupplierPortalHubPage />],
          ["acuerdos-clientes", <CustomerAgreementsPage />],
          ["distribuidora", <DistribuidoraPage />],
          ["sellers", <SellersPage />],
          ["mapa-tiempo-real", <MapaPage />],
          ["rutas", <RutasPage />],
          ["visitas", <VisitasPage />],
          ["geocercas", <GeocercasPage />],
          ["rendimiento", <RendimientoPage />],
        ].map(([path, el]) => (
          <Route key={path as string} path={path as string} element={<Suspense fallback={<PageLoader />}>{el as React.ReactNode}</Suspense>} />
        ))}
        <Route path="pagopar" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pagopar"><PagoparPage /></FeatureRoute></Suspense>} />
        <Route path="kuapay" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="kuapay"><KuapayPage /></FeatureRoute></Suspense>} />
        <Route path="spi" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="spi"><SpiPage /></FeatureRoute></Suspense>} />
        <Route path="branches" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="branches"><BranchesPage /></FeatureRoute></Suspense>} />
        <Route path="credit-accounts" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="credit_accounts"><CreditAccountsPage /></FeatureRoute></Suspense>} />
        <Route path="logistics" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="logistics"><LogisticsPage /></FeatureRoute></Suspense>} />
        <Route path="rbac" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="rbac"><RbacPage /></FeatureRoute></Suspense>} />
        <Route path="usuarios" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="rbac"><UsuariosPage /></FeatureRoute></Suspense>} />
        <Route path="pharma" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pharma"><PharmaPage /></FeatureRoute></Suspense>} />
        <Route path="pharma-pos" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pharma"><PharmaPOSPage /></FeatureRoute></Suspense>} />
        <Route path="intelientregas" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="intelientregas"><InteliEntregasPage /></FeatureRoute></Suspense>} />
        <Route path="boutique" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="boutique_pedidos"><BoutiquePage /></FeatureRoute></Suspense>} />
        <Route path="servicios" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="servicios"><ServiciosPage /></FeatureRoute></Suspense>} />
        <Route path="supermer" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="supermercado"><SupermerPage /></FeatureRoute></Suspense>} />
        <Route path="operaciones-salon" element={<Suspense fallback={<PageLoader />}><SalonOperacionesPwaPage /></Suspense>} />
        <Route path="desposte" element={<Suspense fallback={<PageLoader />}><CarniceriaDespostePage /></Suspense>} />
        <Route path="frescos" element={<Suspense fallback={<PageLoader />}><VerduleriaFrescosPage /></Suspense>} />
        <Route path="panaderia-rotiseria" element={<Suspense fallback={<PageLoader />}><PanaderiaRotiseriaPage /></Suspense>} />
        <Route path="haccp" element={<Suspense fallback={<PageLoader />}><HaccpPage /></Suspense>} />
        <Route path="equipos-mantenimiento" element={<Suspense fallback={<PageLoader />}><EquipmentPage /></Suspense>} />
        <Route path="dsd" element={<Suspense fallback={<PageLoader />}><DsdPage /></Suspense>} />
        <Route path="esl" element={<Suspense fallback={<PageLoader />}><EslPage /></Suspense>} />
        <Route path="escalas" element={<Suspense fallback={<PageLoader />}><ScalesPage /></Suspense>} />
        <Route path="distribuidora" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="distribuidora"><DistribuidoraPage /></FeatureRoute></Suspense>} />
        <Route path="advanced-inventory" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="advanced_inventory"><InventoryAdvancedPage /></FeatureRoute></Suspense>} />
        <Route path="integrated-finance" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="integrated_finance"><IntegratedFinancePage /></FeatureRoute></Suspense>} />
        <Route path="smart-pricing" element={<Suspense fallback={<PageLoader />}><SmartPricingPage /></Suspense>} />
        <Route path="demand-forecast" element={<Suspense fallback={<PageLoader />}><DemandForecastPage /></Suspense>} />
        <Route path="auto-replenish" element={<Navigate to="/demand-forecast" replace />} />
        <Route path="intelligent-routing" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="intelligent_routing"><IntelligentRoutingPage /></FeatureRoute></Suspense>} />
        <Route path="oportunidades" element={<Suspense fallback={<PageLoader />}><OportunidadesPage /></Suspense>} />
        <Route path="cold-chain" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="cold_chain"><ColdChainPage /></FeatureRoute></Suspense>} />
        <Route path="asistente-virtual" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="asistente_virtual"><AsistenteVirtualPage /></FeatureRoute></Suspense>} />
        <Route path="clientes" element={<Suspense fallback={<PageLoader />}><ClientesPage /></Suspense>} />
        <Route path="scanandgo" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="scanandgo"><ScanAndGoPage /></FeatureRoute></Suspense>} />
        <Route path="customer360" element={<Suspense fallback={<PageLoader />}><Customer360Page /></Suspense>} />
        <Route path="credit-scoring" element={<Suspense fallback={<PageLoader />}><CreditScoringPage /></Suspense>} />
        <Route path="schedule" element={<Suspense fallback={<PageLoader />}><SchedulePage /></Suspense>} />
        <Route path="productividad" element={<Suspense fallback={<PageLoader />}><ProductividadPage /></Suspense>} />
        <Route path="capacitacion" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="capacitacion"><CapacitacionPage /></FeatureRoute></Suspense>} />
        <Route path="pyg-diario" element={<Suspense fallback={<PageLoader />}><PyGDiarioPage /></Suspense>} />
        <Route path="shrinkage" element={<Suspense fallback={<PageLoader />}><ShrinkagePage /></Suspense>} />
        <Route path="forecast-avanzado" element={<Suspense fallback={<PageLoader />}><ForecastAvanzadoPage /></Suspense>} />
        <Route path="benchmarking" element={<Suspense fallback={<PageLoader />}><BenchmarkingPage /></Suspense>} />
        <Route path="ecommerce-sm" element={<Suspense fallback={<PageLoader />}><EcommerceSmPage /></Suspense>} />
        <Route path="delivery-integrations" element={<Suspense fallback={<PageLoader />}><DeliveryIntegrationsPage /></Suspense>} />
        <Route path="suscripciones" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="suscripciones"><SuscripcionesPage /></FeatureRoute></Suspense>} />
        <Route path="retail" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="retail"><RetailPage /></FeatureRoute></Suspense>} />
        <Route path="sifen-avanzado" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="sifen_avanzado"><SifenAvanzadoPage /></FeatureRoute></Suspense>} />
        <Route path="variants" element={<Suspense fallback={<PageLoader />}><VariantsPage /></Suspense>} />
        <Route path="kits" element={<Suspense fallback={<PageLoader />}><KitsPage /></Suspense>} />
        <Route path="price-lists" element={<Suspense fallback={<PageLoader />}><PriceListsPage /></Suspense>} />
        <Route path="imports" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="imports"><ImportsPage /></FeatureRoute></Suspense>} />
        <Route path="email" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="email"><EmailPage /></FeatureRoute></Suspense>} />
        <Route path="bancard" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="bancard"><BancardPage /></FeatureRoute></Suspense>} />
        <Route path="dinelco" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="dinelco"><DinelcoPage /></FeatureRoute></Suspense>} />
        <Route path="loyalty" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="loyalty"><LoyaltyPage /></FeatureRoute></Suspense>} />
        <Route path="portal" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="portal"><PortalPage /></FeatureRoute></Suspense>} />
        <Route path="client-app" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="client_app"><ClientAppPage /></FeatureRoute></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FeatureProvider>
          <OfflineProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <PWAUpdatePrompt />
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </BrowserRouter>
          </OfflineProvider>
        </FeatureProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
