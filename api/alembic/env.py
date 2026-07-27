import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Add project root to path (parent of api/)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from api.src.db import Base

# Import all models so Alembic can detect them
import api.src.auth.models
import api.src.tenants.models
import api.src.companies.models
import api.src.products.models
import api.src.inventory.models
import api.src.sales.models
import api.src.customers.models
import api.src.sifen.models
import api.src.purchases.models
import api.src.payments.models
import api.src.currency.models
import api.src.integrations.models
import api.src.integrations.scales.models
import api.src.caja.models
import api.src.intelicont.models
import api.src.inteliaudit.models
import api.src.sueldok.models
import api.src.pagopar.models
import api.src.backups.models
import api.src.receipts.models
import api.src.branches.models
import api.src.credit_accounts.models
import api.src.logistics.models
import api.src.kuapay.models
import api.src.variants.models
import api.src.price_lists.models
import api.src.quotes.models
import api.src.sales_orders.models
import api.src.returns.models
import api.src.discounts.models
import api.src.commissions.models
import api.src.commercial_agreements.models
import api.src.kits.models
import api.src.accounts_receivable.models
import api.src.rbac.models
import api.src.crm.models
import api.src.whatsapp.models
import api.src.notifications.models
import api.src.farmacia.models
import api.src.intelientregas.models
import api.src.intelientregas.fleet_models
import api.src.boutique.models
import api.src.spi.models
import api.src.supermer.models
import api.src.promotions.models
import api.src.petty_cash.models
import api.src.ecommerce.models
import api.src.data_migration.models
import api.src.financial.models
import api.src.finance_agent.models
import api.src.sales_agent.models
import api.src.nemuha_connector.models
import api.src.client_app.models
import api.src.distribuidora.models
import api.src.distribuidora.tracking_models
import api.src.fiscal.models
import api.src.products.models
import api.src.smart_pricing.models
import api.src.demand_forecast.models
import api.src.intelligent_routing.models
import api.src.credit_scoring.models
import api.src.comerciales.models
import api.src.cold_chain.models
import api.src.asistente_virtual.models
import api.src.clientes.models
import api.src.scanandgo.models
import api.src.customer360.models
import api.src.schedule.models
import api.src.productividad.models
import api.src.capacitacion.models
import api.src.pygdiario.models
import api.src.shrinkage.models
import api.src.forecast_avanzado.models
import api.src.benchmarking.models
import api.src.ecommerce_sm.models
import api.src.delivery_integrations.models
import api.src.suscripciones.models
import api.src.retail.models
import api.src.servicios.models

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
