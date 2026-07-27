"""InteliMarket API — FastAPI Application Entry Point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

import logging

from api.src.config import settings
from api.src.scheduler import start_scheduler
from api.src.common.handlers import register_exception_handlers
from api.src.common.logging import RequestLoggingMiddleware

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
from api.src.auth.router import router as auth_router
from api.src.tenants.router import router as tenants_router
from api.src.companies.router import router as companies_router
from api.src.products.router import router as products_router
from api.src.inventory.router import router as inventory_router
from api.src.sales.router import router as sales_router
from api.src.customers.router import router as customers_router
from api.src.sifen.router import router as sifen_router
from api.src.purchases.router import router as purchases_router
from api.src.payments.router import router as payments_router
from api.src.currency.router import router as currency_router
from api.src.reports.router import router as reports_router
from api.src.integrations.router import router as integrations_router
from api.src.integrations.scales.router import router as scales_router
from api.src.caja.router import router as caja_router
from api.src.intelicont.router import router as intelicont_router
from api.src.inteliaudit.router import router as inteliaudit_router
from api.src.sueldok.router import router as sueldok_router
from api.src.events.router import router as events_router
from api.src.tenants.admin_router import router as admin_router
from api.src.pagopar.router import router as pagopar_router
from api.src.receipts.router import router as receipts_router
from api.src.backups.router import router as backups_router
from api.src.pagopar.public_router import router as pagopar_public_router
from api.src.kuapay.router import router as kuapay_router
from api.src.kuapay.public_router import router as kuapay_public_router
from api.src.branches.router import router as branches_router
from api.src.credit_accounts.router import router as credit_accounts_router
from api.src.logistics.router import router as logistics_router
from api.src.imports.router import router as imports_router
from api.src.email.router import router as email_router
from api.src.variants.router import router as variants_router
from api.src.crm.router import router as crm_router
from api.src.verticals.router import router as verticals_router
from api.src.price_lists.router import router as price_lists_router
from api.src.portal.router import router as portal_router
from api.src.security.router import router as security_router
from api.src.bancard.router import router as bancard_router
from api.src.spi.router import router as spi_router
from api.src.spi.public_router import router as spi_public_router
from api.src.dinelco.router import router as dinelco_router
from api.src.loyalty.router import router as loyalty_router
from api.src.quotes.router import router as quotes_router
from api.src.sales_orders.router import router as sales_orders_router
from api.src.returns.router import router as returns_router
from api.src.discounts.router import router as discounts_router
from api.src.commissions.router import router as commissions_router
from api.src.commercial_agreements.router import router as commercial_agreements_router
from api.src.kits.router import router as kits_router
from api.src.accounts_receivable.router import router as accounts_receivable_router
from api.src.public.router import router as public_router
from api.src.rbac.router import router as rbac_router
from api.src.whatsapp.router import router as whatsapp_router
from api.src.whatsapp.public_router import router as whatsapp_public_router
from api.src.whatsapp.campaign_router import router as intellizapp_router
from api.src.notifications.router import router as notifications_router
from api.src.farmacia.router import router as farmacia_router
from api.src.intelientregas.router import router as intelientregas_router
from api.src.intelientregas.driver_router import router as intelientregas_driver_router
from api.src.boutique.router import router as boutique_router
from api.src.supermer.router import router as supermer_router
from api.src.promotions.router import router as promotions_router
from api.src.petty_cash.router import router as expenses_router
from api.src.gerencial.router import router as gerencial_router
from api.src.mobile.router import router as mobile_router
from api.src.ecommerce.router import router as ecommerce_router
from api.src.data_migration.router import router as data_migration_router
from api.src.financial.router import router as financial_router
from api.src.finance_agent.router import router as finance_agent_router
from api.src.sales_agent.router import router as sales_agent_router
from api.src.nemuha_connector.router import router as nemuha_connector_router
from api.src.fiscal.router import router as fiscal_router
from api.src.distribuidora.router import router as distribuidora_router
from api.src.distribuidora.tracking_router import router as distribuidora_tracking_router
from api.src.intelientregas.fase2_router import router as intelientregas_fase2_router
from api.src.client_app.router import router as client_app_router
from api.src.supplier_portal.router import router as supplier_portal_router
from api.src.marketing.router import router as marketing_router
from api.src.retail.router import router as retail_router
from api.src.advanced_inventory.router import router as advanced_inventory_router
from api.src.integrated_finance.router import router as integrated_finance_router
from api.src.sifen_avanzado.router import router as sifen_avanzado_router
from api.src.smart_pricing.router import router as smart_pricing_router
from api.src.demand_forecast.router import router as demand_forecast_router
from api.src.intelligent_routing.router import router as intelligent_routing_router
from api.src.credit_scoring.router import router as credit_scoring_router
from api.src.comerciales.router import router as comerciales_router
from api.src.cold_chain.router import router as cold_chain_router
from api.src.asistente_virtual.router import router as asistente_virtual_router
from api.src.clientes.router import router as clientes_router
from api.src.scanandgo.router import router as scanandgo_router
from api.src.customer360.router import router as customer360_router
from api.src.schedule.router import router as schedule_router
from api.src.productividad.router import router as productividad_router
from api.src.capacitacion.router import router as capacitacion_router
from api.src.pygdiario.router import router as pygdiario_router
from api.src.shrinkage.router import router as shrinkage_router
from api.src.forecast_avanzado.router import router as forecast_avanzado_router
from api.src.benchmarking.router import router as benchmarking_router
from api.src.ecommerce_sm.router import router as ecommerce_sm_router
from api.src.delivery_integrations.router import router as delivery_integrations_router
from api.src.suscripciones.router import router as suscripciones_router
from api.src.servicios.router import router as servicios_router

app = FastAPI(
    title="InteliMarket API",
    description="""
# InteliMarket API v1

SaaS ERP para comercios y distribuidores en Paraguay.
Multi-tenant, multi-moneda, compliance SIFEN/e-Kuatia.

## Autenticación
- **JWT Bearer Token**: Obtén tu token en `/api/v1/auth/login`
- **API Key**: Headers `X-API-Key` para integraciones server-to-server

## Tenants
Cada tenant tiene su propio schema en PostgreSQL. El `company_id` se pasa
como parámetro en los endpoints correspondientes.

## Módulos
- Ventas, POS, Cotizaciones, Pedidos
- Compras, Inventario, Kits/Combos
- Cuentas por Cobrar, Pagos
- SIFEN/e-Kuatia, Pasarelas (Pagopar, Kuapay, Bancard)
- Logística, Sucursales
- Reportes, Exportación XLSX
- Integraciones: InteliCont, InteliAudit, SueldOK
""",
    version="0.3.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    contact={"name": "InteliMarket", "email": "soporte@intelimarket.py"},
    license_info={"name": "Proprietary"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.3.0"}


app.include_router(auth_router)
app.include_router(tenants_router)
app.include_router(companies_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(sales_router)
app.include_router(customers_router)
app.include_router(sifen_router)
app.include_router(purchases_router)
app.include_router(payments_router)
app.include_router(currency_router)
app.include_router(reports_router)
app.include_router(integrations_router)
app.include_router(scales_router)
app.include_router(caja_router)
app.include_router(intelicont_router)
app.include_router(inteliaudit_router)
app.include_router(sueldok_router)
app.include_router(events_router)
app.include_router(admin_router)
app.include_router(pagopar_router)
app.include_router(receipts_router)
app.include_router(backups_router)
app.include_router(pagopar_public_router)
app.include_router(kuapay_router)
app.include_router(kuapay_public_router)
app.include_router(branches_router)
app.include_router(credit_accounts_router)
app.include_router(logistics_router)
app.include_router(imports_router)
app.include_router(email_router)
app.include_router(variants_router)
app.include_router(verticals_router)
app.include_router(crm_router)
app.include_router(price_lists_router)
app.include_router(portal_router)
app.include_router(security_router)
app.include_router(bancard_router)
app.include_router(spi_router)
app.include_router(spi_public_router)
app.include_router(dinelco_router)
app.include_router(loyalty_router)
app.include_router(quotes_router)
app.include_router(sales_orders_router)
app.include_router(returns_router)
app.include_router(discounts_router)
app.include_router(commissions_router)
app.include_router(commercial_agreements_router)
app.include_router(kits_router)
app.include_router(accounts_receivable_router)
app.include_router(public_router)
app.include_router(rbac_router)
app.include_router(whatsapp_router)
app.include_router(whatsapp_public_router)
app.include_router(intellizapp_router)
app.include_router(notifications_router)
app.include_router(farmacia_router)
app.include_router(intelientregas_router)
app.include_router(intelientregas_driver_router)
app.include_router(boutique_router)
app.include_router(supermer_router)
app.include_router(promotions_router)
app.include_router(expenses_router)
app.include_router(gerencial_router)
app.include_router(mobile_router)
app.include_router(ecommerce_router)
app.include_router(fiscal_router)
app.include_router(advanced_inventory_router)
app.include_router(integrated_finance_router)
app.include_router(sifen_avanzado_router)
app.include_router(smart_pricing_router)
app.include_router(demand_forecast_router)
app.include_router(intelligent_routing_router)
app.include_router(credit_scoring_router)
app.include_router(comerciales_router)
app.include_router(cold_chain_router)
app.include_router(asistente_virtual_router)
app.include_router(clientes_router)
app.include_router(scanandgo_router)
app.include_router(customer360_router)
app.include_router(schedule_router)
app.include_router(productividad_router)
app.include_router(capacitacion_router)
app.include_router(pygdiario_router)
app.include_router(shrinkage_router)
app.include_router(forecast_avanzado_router)
app.include_router(benchmarking_router)
app.include_router(ecommerce_sm_router)
app.include_router(delivery_integrations_router)
app.include_router(suscripciones_router)
app.include_router(financial_router)
app.include_router(finance_agent_router)
app.include_router(sales_agent_router)
app.include_router(nemuha_connector_router)
app.include_router(marketing_router)
app.include_router(data_migration_router)
app.include_router(distribuidora_router)
app.include_router(distribuidora_tracking_router)
app.include_router(intelientregas_fase2_router)
app.include_router(client_app_router)
app.include_router(supplier_portal_router)
app.include_router(retail_router)
app.include_router(servicios_router)

