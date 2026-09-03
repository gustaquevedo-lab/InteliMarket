from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from api.src.payment_integrations.models import PaymentIntegrationConfig
from api.src.payment_integrations.schemas import PaymentIntegrationConfigUpsert

# Campos que nunca deben salir en una respuesta al frontend, sin importar el
# proveedor -- password/tokens de PlugPay son las unicas credenciales reales
# que este modulo guarda hoy.
SENSITIVE_CONFIG_KEYS = {"password", "cached_token", "cached_refresh_token", "cached_token_expires_at", "private_key", "callback_password"}


def sanitize_config(config: dict | None) -> dict | None:
    if not config:
        return config
    return {k: v for k, v in config.items() if k not in SENSITIVE_CONFIG_KEYS}


async def get_config(db: AsyncSession, company_id: str, provider: str) -> PaymentIntegrationConfig | None:
    result = await db.execute(
        select(PaymentIntegrationConfig).where(
            PaymentIntegrationConfig.company_id == uuid.UUID(company_id),
            PaymentIntegrationConfig.provider == provider,
        ).order_by(PaymentIntegrationConfig.environment.desc())
    )
    return result.scalars().first()


async def upsert_config(db: AsyncSession, company_id: str, provider: str, data: PaymentIntegrationConfigUpsert) -> PaymentIntegrationConfig:
    existing = await get_config(db, company_id, provider)
    if existing:
        # Si el config nuevo no trae una clave sensible (ej. el frontend nunca
        # remanda "password" porque no lo tiene), se preserva la guardada --
        # evita que guardar el resto del formulario borre la credencial.
        merged = dict(existing.config or {})
        merged.update(data.config or {})
        existing.environment = data.environment
        existing.enabled = data.enabled
        existing.config = merged
        await db.commit()
        await db.refresh(existing)
        return existing

    row = PaymentIntegrationConfig(
        company_id=uuid.UUID(company_id),
        provider=provider,
        environment=data.environment,
        enabled=data.enabled,
        config=data.config or {},
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
