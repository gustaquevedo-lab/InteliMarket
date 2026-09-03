from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from api.src.payment_integrations.models import PaymentIntegrationConfig
from api.src.payment_integrations.schemas import PaymentIntegrationConfigUpsert
from api.src.payment_integrations.crypto import encrypt_value, decrypt_value

# Campos que nunca deben salir en una respuesta al frontend, sin importar el
# proveedor -- password/tokens de PlugPay son las unicas credenciales reales
# que este modulo guarda hoy. Estos mismos campos se guardan CIFRADOS en la
# base (ver crypto.py) -- antes quedaban en texto plano en la columna JSON,
# leibles por cualquiera con acceso directo a Postgres (backup, replica, un
# SELECT * en un reporte), aunque sanitize_config ya los sacara de las
# respuestas al frontend.
SENSITIVE_CONFIG_KEYS = {"password", "cached_token", "cached_refresh_token", "cached_token_expires_at", "private_key", "callback_password"}


def sanitize_config(config: dict | None) -> dict | None:
    if not config:
        return config
    return {k: v for k, v in config.items() if k not in SENSITIVE_CONFIG_KEYS}


def _encrypt_sensitive(config: dict) -> dict:
    return {k: (encrypt_value(v) if k in SENSITIVE_CONFIG_KEYS and isinstance(v, str) else v) for k, v in config.items()}


def _decrypt_sensitive(config: dict) -> dict:
    return {k: (decrypt_value(v) if k in SENSITIVE_CONFIG_KEYS and isinstance(v, str) else v) for k, v in config.items()}


async def get_config(db: AsyncSession, company_id: str, provider: str) -> PaymentIntegrationConfig | None:
    result = await db.execute(
        select(PaymentIntegrationConfig).where(
            PaymentIntegrationConfig.company_id == uuid.UUID(company_id),
            PaymentIntegrationConfig.provider == provider,
        ).order_by(PaymentIntegrationConfig.environment.desc())
    )
    row = result.scalars().first()
    if row and row.config:
        # Descifrado solo en memoria, para quien realmente necesita las
        # credenciales reales (ej. plugpay/service.py armando el login) --
        # nunca se vuelve a escribir en texto plano.
        row.config = _decrypt_sensitive(row.config)
    return row


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
        existing.config = _encrypt_sensitive(merged)
        await db.commit()
        await db.refresh(existing)
        existing.config = _decrypt_sensitive(existing.config or {})
        return existing

    row = PaymentIntegrationConfig(
        company_id=uuid.UUID(company_id),
        provider=provider,
        environment=data.environment,
        enabled=data.enabled,
        config=_encrypt_sensitive(data.config or {}),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    row.config = _decrypt_sensitive(row.config or {})
    return row
