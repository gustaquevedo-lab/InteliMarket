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
const SifenPage = lazy(() => import("./pages/SifenPage"))
const ProductsPage = lazy(() => import("./pages/products/ProductsPage"))
const InventoryPage = lazy(() => import("./pages/inventory/InventoryPage"))
const CustomersPage = lazy(() => import("./pages/customers/CustomersPage"))
const SalesPage = lazy(() => import("./pages/sales/SalesPage"))
const PurchasesPage = lazy(() => import("./pages/purchases/PurchasesPage"))
const PaymentsPage = lazy(() => import("./pages/payments/PaymentsPage"))
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"))
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"))
const POSPage = lazy(() => import("./pages/pos/POSPage"))
const CajaPage = lazy(() => import("./pages/caja/CajaPage"))
const RouteCashSettlementsPage = lazy(() => import("./pages/route-cash-settlements/RouteCashSettlementsPage"))
const SalesTargetsPage = lazy(() => import("./pages/sales-targets/SalesTargetsPage"))
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage"))
const AdminPage = lazy(() => import("./pages/admin/AdminPage"))
const VerticalsPage = lazy(() => import("./pages/admin/VerticalsPage"))
const PagoparPage = lazy(() => import("./pages/pagopar/PagoparPage"))
const KuapayPage = lazy(() => import("./pages/kuapay/KuapayPage"))
const SpiPage = lazy(() => import("./pages/spi/SpiPage"))
const BranchesPage = lazy(() => import("./pages/branches/BranchesPage"))
const CreditAccountsPage = lazy(() => import("./pages/credit-accounts/CreditAccountsPage"))
const ChecksPage = lazy(() => import("./pages/checks/ChecksPage"))
const DepositoPage = lazy(() => import("./pages/deposito/DepositoPage"))
const SupplierReturnsPage = lazy(() => import("./pages/supplier-returns/SupplierReturnsPage"))
const PurchaseBonusesPage = lazy(() => import("./pages/purchase-bonuses/PurchaseBonusesPage"))
const SupplierKpisPage = lazy(() => import("./pages/supplier-kpis/SupplierKpisPage"))
const LogisticsPage = lazy(() => import("./pages/logistics/LogisticsPage"))
const AuditPage = lazy(() => import("./pages/audit/AuditPage"))
const SueldokPage = lazy(() => import("./pages/sueldok/SueldokPage"))
const ScalesPage = lazy(() => import("./pages/scales/ScalesPage"))
const QuotesPage = lazy(() => import("./pages/quotes/QuotesPage"))
const SalesOrdersPage = lazy(() => import("./pages/sales-orders/SalesOrdersPage"))
const ReturnsPage = lazy(() => import("./pages/returns/ReturnsPage"))
const DiscountsPage = lazy(() => import("./pages/discounts/DiscountsPage"))
const CommissionsPage = lazy(() => import("./pages/commissions/CommissionsPage"))
const AccountsReceivablePage = lazy(() => import("./pages/accounts-receivable/AccountsReceivablePage"))
const AccountsPayablePage = lazy(() => import("./pages/accounts-payable/AccountsPayablePage"))
const ConsolidatedDebtsPage = lazy(() => import("./pages/customers/ConsolidatedDebtsPage"))
const TreasuryExecutiveSuitePage = lazy(() => import("./pages/financial/TreasuryExecutiveSuitePage"))
const FinanceAgentPage = lazy(() => import("./pages/finance-agent/FinanceAgentPage"))
const CommercialAgentPage = lazy(() => import("./pages/commercial-agent/CommercialAgentPage"))
const RbacPage = lazy(() => import("./pages/rbac/RbacPage"))
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
const PromotionsPage = lazy(() => import("./pages/promotions/PromotionsPage"))
const IntelliZappPage = lazy(() => import("./pages/intellizapp/IntelliZappPage"))
const ExpensesPage = lazy(() => import("./pages/expenses/ExpensesPage"))
const FinancialPage = lazy(() => import("./pages/financial/FinancialPage"))
const GerencialPage = lazy(() => import("./pages/gerencial/GerencialPage"))
const SupplierContractsPage = lazy(() => import("./pages/supplier-contracts/SupplierContractsPage"))
const SupplierLogin = lazy(() => import("./pages/supplier-portal/SupplierLogin"))
const SupplierDashboard = lazy(() => import("./pages/supplier-portal/SupplierDashboard"))
const CustomerAgreementsPage = lazy(() => import("./pages/customer-agreements/CustomerAgreementsPage"))
const DistribuidoraPage = lazy(() => import("./pages/distribuidora/DistribuidoraPage"))
const SupermerPage = lazy(() => import("./pages/supermer/SupermerPage"))
const CajaRapidaPage = lazy(() => import("./pages/pos/CajaRapidaPage"))
const SelfCheckoutPage = lazy(() => import("./pages/pos/SelfCheckoutPage"))
const TransferenciasPage = lazy(() => import("./pages/inventory/TransferenciasPage"))
const BovedaPage = lazy(() => import("./pages/caja/BovedaPage"))
const EdgeAgentPage = lazy(() => import("./pages/pos/EdgeAgentPage"))
const AutoReplenishPage = lazy(() => import("./pages/inventory/AutoReplenishPage"))
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
const CreditScoringPage = lazy(() => import("./pages/credit-scoring/CreditScoringPage"))
const OportunidadesPage = lazy(() => import("./pages/comerciales/OportunidadesPage"))
const ColdChainPage = lazy(() => import("./pages/cold-chain/ColdChainPage"))
const AsistenteVirtualPage = lazy(() => import("./pages/asistente-virtual/AsistenteVirtualPage"))
const ClientesPage = lazy(() => import("./pages/clientes/ClientesPage"))
const ScanAndGoPage = lazy(() => import("./pages/scanandgo/ScanAndGoPage"))
const Customer360Page = lazy(() => import("./pages/customer360/Customer360Page"))
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
  const { user, loading, mustChangePassword } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (mustChangePassword) return <Navigate to="/change-password" replace />
  return <>{children}</>
}

function FeatureRoute({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { hasFeature, loading } = useFeatures()
  if (loading) return <PageLoader />
  const isSupermerBypass = localStorage.getItem('demo_mode') === 'supermercado' && (feature === "crm" || feature === "whatsapp");
  if (!hasFeature(feature) && !isSupermerBypass) {
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
      <Route path="/change-password" element={<Suspense fallback={<PageLoader />}><ChangePasswordPage /></Suspense>} />
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
          ["sales", <SalesPage />],
          ["products", <ProductsPage />],
          ["inventory", <InventoryPage />],
          ["purchases", <PurchasesPage />],
          ["customers", <CustomersPage />],
          ["payments", <PaymentsPage />],
          ["reports", <ReportsPage />],
          ["settings", <SettingsPage />],
          ["caja", <CajaPage />],
          ["route-cash-settlements", <CajaPage />],
          ["sales-targets", <SalesTargetsPage />],
          ["admin", <AdminPage />],
          ["admin/verticals", <VerticalsPage />],
          ["audit", <AuditPage />],
          ["quotes", <QuotesPage />],
          ["sales-orders", <SalesOrdersPage />],
          ["returns", <ReturnsPage />],
          ["discounts", <DiscountsPage />],
          ["commissions", <CommissionsPage />],
          ["accounts-receivable", <AccountsReceivablePage />],
          ["accounts-payable", <AccountsPayablePage />],
          ["deudas-consolidadas", <ConsolidatedDebtsPage />],
          ["tesoreria", <FinanceAgentPage />],
          ["finanzas-executive", <FinanceAgentPage />],
          ["finance-agent", <FinanceAgentPage />],
          ["commercial-agent", <CommercialAgentPage />],
          ["sales-agent", <CommercialAgentPage />],
          ["marketing-agent", <MarketingPage />],
          ["marketing", <MarketingPage />],
          ["notifications", <NotificationsPage />],
          ["intelicont", <InteliContPage />],
          ["integrations", <IntegrationsPage />],
          ["sueldok", <SueldokPage />],
          ["gerencial", <GerencialPage />],
          ["promociones", <PromotionsPage />],
          ["gastos", <ExpensesPage />],
          ["contabilidad", <IntegratedFinancePage />],
          ["integrated-finance", <IntegratedFinancePage />],
          ["financiero", <IntegratedFinancePage />],
          ["contratos-proveedores", <SupplierContractsPage />],
          ["acuerdos-clientes", <CustomerAgreementsPage />],
        ].map(([path, el]) => (
          <Route key={path as string} path={path as string} element={<Suspense fallback={<PageLoader />}>{el as React.ReactNode}</Suspense>} />
        ))}
        {/* Rutas que Layout.tsx gatea por feature en el menu pero antes no
            estaban protegidas a nivel de URL — cualquiera que adivinara/tipeara
            la ruta entraba igual, sin pasar por FeatureRoute. */}
        <Route path="pos" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pos"><CajaRapidaPage /></FeatureRoute></Suspense>} />
        <Route path="self-checkout" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="supermercado"><SelfCheckoutPage /></FeatureRoute></Suspense>} />
        <Route path="transferencias" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="advanced_inventory"><TransferenciasPage /></FeatureRoute></Suspense>} />
        <Route path="boveda" element={<Suspense fallback={<PageLoader />}><BovedaPage /></Suspense>} />
        <Route path="edge-agent" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="supermercado"><EdgeAgentPage /></FeatureRoute></Suspense>} />
        <Route path="auto-replenish" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="advanced_inventory"><AutoReplenishPage /></FeatureRoute></Suspense>} />
        <Route path="sifen" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="sifen"><SifenPage /></FeatureRoute></Suspense>} />
        <Route path="sellers" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="seller_tracking"><SellersPage /></FeatureRoute></Suspense>} />
        <Route path="mapa-tiempo-real" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="real_time_map"><MapaPage /></FeatureRoute></Suspense>} />
        <Route path="rutas" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="sales_routes"><RutasPage /></FeatureRoute></Suspense>} />
        <Route path="visitas" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="seller_tracking"><VisitasPage /></FeatureRoute></Suspense>} />
        <Route path="geocercas" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="geofence_zones"><GeocercasPage /></FeatureRoute></Suspense>} />
        <Route path="rendimiento" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="seller_performance"><RendimientoPage /></FeatureRoute></Suspense>} />
        <Route path="pagopar" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pagopar"><PagoparPage /></FeatureRoute></Suspense>} />
        <Route path="kuapay" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="kuapay"><KuapayPage /></FeatureRoute></Suspense>} />
        <Route path="spi" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="spi"><SpiPage /></FeatureRoute></Suspense>} />
        <Route path="branches" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="branches"><BranchesPage /></FeatureRoute></Suspense>} />
        <Route path="credit-accounts" element={<Suspense fallback={<PageLoader />}><CreditAccountsPage /></Suspense>} />
        <Route path="checks" element={<Suspense fallback={<PageLoader />}><ChecksPage /></Suspense>} />
        <Route path="proveedor-kpis" element={<Suspense fallback={<PageLoader />}><SupplierKpisPage /></Suspense>} />
        <Route path="deposito" element={<Suspense fallback={<PageLoader />}><DepositoPage /></Suspense>} />
        <Route path="devoluciones-proveedores" element={<Suspense fallback={<PageLoader />}><SupplierReturnsPage /></Suspense>} />
        <Route path="bonificaciones-compra" element={<Suspense fallback={<PageLoader />}><PurchaseBonusesPage /></Suspense>} />
        <Route path="logistics" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="logistics"><LogisticsPage /></FeatureRoute></Suspense>} />
        <Route path="rbac" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="rbac"><RbacPage /></FeatureRoute></Suspense>} />
        <Route path="crm" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="crm"><CrmPage /></FeatureRoute></Suspense>} />
        <Route path="whatsapp" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="whatsapp"><WhatsAppPage /></FeatureRoute></Suspense>} />
        <Route path="intellizapp" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="intellizapp"><IntelliZappPage /></FeatureRoute></Suspense>} />
        <Route path="marketing" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="marketing_automation"><MarketingPage /></FeatureRoute></Suspense>} />
        <Route path="pharma" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pharma"><PharmaPage /></FeatureRoute></Suspense>} />
        <Route path="pharma-pos" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pharma"><PharmaPOSPage /></FeatureRoute></Suspense>} />
        <Route path="intelientregas" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="intelientregas"><InteliEntregasPage /></FeatureRoute></Suspense>} />
        <Route path="boutique" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="boutique_pedidos"><BoutiquePage /></FeatureRoute></Suspense>} />
        <Route path="servicios" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="servicios"><ServiciosPage /></FeatureRoute></Suspense>} />
        <Route path="supermer" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="supermercado"><SupermerPage /></FeatureRoute></Suspense>} />
        <Route path="escalas" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="supermercado"><ScalesPage /></FeatureRoute></Suspense>} />
        <Route path="distribuidora" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="distribuidora"><DistribuidoraPage /></FeatureRoute></Suspense>} />
        <Route path="advanced-inventory" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="advanced_inventory"><InventoryAdvancedPage /></FeatureRoute></Suspense>} />
        <Route path="integrated-finance" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="integrated_finance"><IntegratedFinancePage /></FeatureRoute></Suspense>} />
        <Route path="smart-pricing" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="smart_pricing"><SmartPricingPage /></FeatureRoute></Suspense>} />
        <Route path="demand-forecast" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="demand_forecast"><DemandForecastPage /></FeatureRoute></Suspense>} />
        <Route path="intelligent-routing" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="intelligent_routing"><IntelligentRoutingPage /></FeatureRoute></Suspense>} />
        <Route path="credit-scoring" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="credit_scoring"><CreditScoringPage /></FeatureRoute></Suspense>} />
        <Route path="oportunidades" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="comerciales"><OportunidadesPage /></FeatureRoute></Suspense>} />
        <Route path="cold-chain" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="cold_chain"><ColdChainPage /></FeatureRoute></Suspense>} />
        <Route path="asistente-virtual" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="asistente_virtual"><AsistenteVirtualPage /></FeatureRoute></Suspense>} />
        <Route path="clientes" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="clientes_fidelizacion"><ClientesPage /></FeatureRoute></Suspense>} />
        <Route path="scanandgo" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="scanandgo"><ScanAndGoPage /></FeatureRoute></Suspense>} />
        <Route path="customer360" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="customer360"><Customer360Page /></FeatureRoute></Suspense>} />
        <Route path="schedule" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="schedule"><SchedulePage /></FeatureRoute></Suspense>} />
        <Route path="productividad" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="productividad"><ProductividadPage /></FeatureRoute></Suspense>} />
        <Route path="capacitacion" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="capacitacion"><CapacitacionPage /></FeatureRoute></Suspense>} />
        <Route path="pyg-diario" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="pyg_diario"><PyGDiarioPage /></FeatureRoute></Suspense>} />
        <Route path="shrinkage" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="shrinkage"><ShrinkagePage /></FeatureRoute></Suspense>} />
        <Route path="forecast-avanzado" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="forecast_avanzado"><ForecastAvanzadoPage /></FeatureRoute></Suspense>} />
        <Route path="benchmarking" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="benchmarking"><BenchmarkingPage /></FeatureRoute></Suspense>} />
        <Route path="ecommerce-sm" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="ecommerce_sm"><EcommerceSmPage /></FeatureRoute></Suspense>} />
        <Route path="delivery-integrations" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="delivery_integrations"><DeliveryIntegrationsPage /></FeatureRoute></Suspense>} />
        <Route path="suscripciones" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="suscripciones"><SuscripcionesPage /></FeatureRoute></Suspense>} />
        <Route path="retail" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="retail"><RetailPage /></FeatureRoute></Suspense>} />
        <Route path="sifen-avanzado" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="sifen_avanzado"><SifenAvanzadoPage /></FeatureRoute></Suspense>} />
        <Route path="variants" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="variants"><VariantsPage /></FeatureRoute></Suspense>} />
        <Route path="kits" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="kits"><KitsPage /></FeatureRoute></Suspense>} />
        <Route path="price-lists" element={<Suspense fallback={<PageLoader />}><FeatureRoute feature="price_lists"><PriceListsPage /></FeatureRoute></Suspense>} />
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
