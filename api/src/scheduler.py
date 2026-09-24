import logging
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import engine, async_session_factory
from api.src.tenants.models import Tenant
from api.src.backups.service import create_backup
from api.src.backups.models import BackupScheduleConfig

logger = logging.getLogger("intelimarket.scheduler")

scheduler = AsyncIOScheduler()


async def run_scheduled_backups():
    """Backup all active tenants automatically."""
    logger.info("Starting scheduled backup job...")

    config = await get_schedule_config()
    if not config.get("enabled", True):
        logger.info("Backups disabled in schedule config. Skipping.")
        return

    retention_days = config.get("retention_days", 30)
    max_backups = config.get("max_backups")

    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(Tenant).where(Tenant.estado == "activo")
            )
            tenants = result.scalars().all()
            logger.info(f"Found {len(tenants)} active tenants to backup.")

            for tenant in tenants:
                try:
                    backup = await create_backup(
                        db=db,
                        schema_name=tenant.schema_name,
                        tenant_id=str(tenant.id),
                        tenant_slug=tenant.slug,
                        backup_type="automatic",
                        notes="Scheduled backup",
                    )
                    logger.info(f"Backup completed for tenant {tenant.slug}")

                    if max_backups:
                        await cleanup_tenant_backups(db, str(tenant.id), max_backups)
                except Exception as e:
                    logger.error(f"Failed to backup tenant {tenant.slug}: {e}")
        except Exception as e:
            logger.error(f"Backup job failed: {e}")


async def run_dunning_notifications():
    """Envia recordatorios de cobro por WhatsApp para todas las empresas que
    tengan el dunning automatico activado (apagado por defecto — la mayoria
    de las empresas no hace nada acá, el chequeo de config.activo vive
    dentro de run_dunning y es seguro llamarlo para todas)."""
    logger.info("Starting dunning notifications job...")
    from api.src.companies.models import Company
    from api.src.credit_accounts.service import run_dunning

    async with async_session_factory() as db:
        try:
            result = await db.execute(select(Company).where(Company.activo == True))
            companies = result.scalars().all()
            for company in companies:
                try:
                    outcome = await run_dunning(db, str(company.id))
                    if outcome.get("enviados"):
                        logger.info(f"Dunning: {outcome['enviados']} recordatorios enviados para {company.razon_social}")
                except Exception as e:
                    logger.error(f"Dunning job failed for company {company.id}: {e}")
        except Exception as e:
            logger.error(f"Dunning notifications job failed: {e}")


async def run_cash_flow_alerts():
    """Chequea proyeccion de flujo de caja para todas las empresas y manda
    WhatsApp si algun dia del horizonte da negativo — apagado por defecto
    (config.activo en check_negative_cash_flow_alert), igual que dunning."""
    logger.info("Starting cash flow alert job...")
    from api.src.companies.models import Company
    from api.src.financial.service import check_negative_cash_flow_alert

    async with async_session_factory() as db:
        try:
            result = await db.execute(select(Company).where(Company.activo == True))
            companies = result.scalars().all()
            for company in companies:
                try:
                    outcome = await check_negative_cash_flow_alert(db, str(company.id))
                    if outcome.get("alertado"):
                        logger.info(f"Cash flow alert sent for {company.razon_social}: {outcome}")
                except Exception as e:
                    logger.error(f"Cash flow alert job failed for company {company.id}: {e}")
        except Exception as e:
            logger.error(f"Cash flow alert job failed: {e}")


async def run_fixed_assets_depreciation():
    """Postea la depreciacion mensual (linea recta) de todos los activos
    fijos activos, para el mes que acaba de cerrar -- corre el dia 1 de
    cada mes. Idempotente: post_monthly_depreciation salta los activos ya
    depreciados en ese periodo, seguro reintentar si el job corre de nuevo."""
    logger.info("Starting fixed assets depreciation job...")
    from api.src.companies.models import Company
    from api.src.fixed_assets.service import post_monthly_depreciation

    hoy = datetime.now(timezone.utc).date()
    mes_anterior = (hoy.replace(day=1) - timedelta(days=1))
    periodo = f"{mes_anterior.year}-{mes_anterior.month:02d}"

    async with async_session_factory() as db:
        try:
            result = await db.execute(select(Company).where(Company.activo == True))
            companies = result.scalars().all()
            for company in companies:
                try:
                    outcome = await post_monthly_depreciation(db, str(company.id), periodo)
                    if outcome.get("posteados"):
                        logger.info(f"Depreciación {periodo}: {outcome['posteados']} activos posteados para {company.razon_social}")
                except Exception as e:
                    logger.error(f"Fixed assets depreciation job failed for company {company.id}: {e}")
        except Exception as e:
            logger.error(f"Fixed assets depreciation job failed: {e}")


async def run_weekly_analytics_report():
    """Generate weekly delivery analytics PDF for all active tenants."""
    logger.info("Starting weekly analytics report job...")
    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(Tenant).where(Tenant.estado == "activo")
            )
            tenants = result.scalars().all()
            for tenant in tenants:
                try:
                    pdf = await export_delivery_pdf_for_tenant(db, str(tenant.id), 7)
                    if pdf:
                        logger.info(f"Weekly analytics PDF generated for tenant {tenant.slug} ({len(pdf)} bytes)")
                except Exception as e:
                    logger.error(f"Failed weekly report for tenant {tenant.slug}: {e}")
        except Exception as e:
            logger.error(f"Weekly analytics report job failed: {e}")


async def export_delivery_pdf_for_tenant(db: AsyncSession, company_id: str, days: int) -> bytes | None:
    """Helper to generate PDF report bytes for a given tenant."""
    try:
        from api.src.intelientregas.export_service import export_delivery_pdf
        return await export_delivery_pdf(db, company_id, days)
    except Exception as e:
        logger.error(f"Failed to generate PDF for {company_id}: {e}")
        return None


async def get_schedule_config() -> dict:
    """Get the global backup schedule configuration."""
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(BackupScheduleConfig).where(BackupScheduleConfig.tenant_id.is_(None))
            )
            config = result.scalar_one_or_none()
            if config:
                return {
                    "enabled": config.enabled,
                    "frequency": config.frequency,
                    "hour": config.hour,
                    "minute": config.minute,
                    "day_of_week": config.day_of_week,
                    "day_of_month": config.day_of_month,
                    "retention_days": config.retention_days,
                    "max_backups": config.max_backups,
                }
    except Exception as e:
        logger.error(f"Failed to load schedule config: {e}")

    return {
        "enabled": True,
        "frequency": "daily",
        "hour": 2,
        "minute": 0,
        "day_of_week": None,
        "day_of_month": None,
        "retention_days": 30,
        "max_backups": None,
    }


async def cleanup_tenant_backups(db: AsyncSession, tenant_id: str, max_backups: int):
    """Remove oldest backups for a tenant if exceeding max_backups."""
    from api.src.backups.models import Backup

    result = await db.execute(
        select(Backup)
        .where(Backup.tenant_id == tenant_id)
        .order_by(Backup.created_at.desc())
    )
    backups = result.scalars().all()

    if len(backups) > max_backups:
        to_delete = backups[max_backups:]
        for b in to_delete:
            await db.delete(b)
        await db.commit()
        logger.info(f"Cleaned up {len(to_delete)} old backups for tenant {tenant_id}")


def update_schedule(config: dict):
    """Update the scheduler with new configuration."""
    frequency = config.get("frequency", "daily")
    hour = config.get("hour", 2)
    minute = config.get("minute", 0)
    day_of_week = config.get("day_of_week")
    day_of_month = config.get("day_of_month")

    trigger_kwargs = {"minute": minute}

    if frequency == "hourly":
        trigger_kwargs["hour"] = "*"
    elif frequency == "daily":
        trigger_kwargs["hour"] = hour
    elif frequency == "weekly":
        trigger_kwargs["hour"] = hour
        trigger_kwargs["day_of_week"] = day_of_week if day_of_week is not None else 0
    elif frequency == "monthly":
        trigger_kwargs["hour"] = hour
        trigger_kwargs["day"] = day_of_month if day_of_month is not None else 1

    trigger = CronTrigger(**trigger_kwargs)

    if scheduler.get_job("daily_tenant_backups"):
        scheduler.reschedule_job(
            "daily_tenant_backups",
            trigger=trigger,
        )
    else:
        scheduler.add_job(
            run_scheduled_backups,
            trigger=trigger,
            id="daily_tenant_backups",
            name="Scheduled Tenant Backups",
            replace_existing=True,
        )

    # Dunning automatico — todos los dias a las 9:00 AM (horario habil,
    # no de madrugada, para no despertar clientes con recordatorios de deuda)
    if not scheduler.get_job("dunning_notifications"):
        scheduler.add_job(
            run_dunning_notifications,
            trigger=CronTrigger(hour=9, minute=0),
            id="dunning_notifications",
            name="Dunning Notifications (WhatsApp)",
            replace_existing=True,
        )

    # Alerta de flujo de caja negativo — todos los dias a las 8:00 AM,
    # antes que dunning, asi el dueno/gerente ve el problema de liquidez
    # antes de que se manden recordatorios de cobro por el mismo motivo.
    if not scheduler.get_job("cash_flow_alerts"):
        scheduler.add_job(
            run_cash_flow_alerts,
            trigger=CronTrigger(hour=8, minute=0),
            id="cash_flow_alerts",
            name="Cash Flow Negative Alert (WhatsApp)",
            replace_existing=True,
        )

    # Depreciacion mensual de activos fijos — dia 1 de cada mes a las 5:00 AM
    if not scheduler.get_job("fixed_assets_depreciation"):
        scheduler.add_job(
            run_fixed_assets_depreciation,
            trigger=CronTrigger(day=1, hour=5, minute=0),
            id="fixed_assets_depreciation",
            name="Fixed Assets Monthly Depreciation",
            replace_existing=True,
        )

    # Weekly analytics report — every Monday at 6:00 AM
    if not scheduler.get_job("weekly_analytics_report"):
        scheduler.add_job(
            run_weekly_analytics_report,
            trigger=CronTrigger(day_of_week="mon", hour=6, minute=0),
            id="weekly_analytics_report",
            name="Weekly Analytics Report",
            replace_existing=True,
        )

    logger.info(f"Scheduler updated: {frequency} at {hour:02d}:{minute:02d}")


def start_scheduler():
    scheduler.start()

    import asyncio
    try:
        loop = asyncio.get_event_loop()
        config = loop.run_until_complete(get_schedule_config())
    except Exception:
        config = {"frequency": "daily", "hour": 2, "minute": 0}

    update_schedule(config)
    logger.info("Scheduler started.")
    return scheduler
