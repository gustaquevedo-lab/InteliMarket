"""InteliAudit integration schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditSyncConfig(BaseModel):
    id: str
    tenant_id: str
    enabled: bool
    auto_sync: bool
    url_base: str
    api_key: str | None = None
    created_at: datetime
    updated_at: datetime


class AuditSyncConfigCreate(BaseModel):
    url_base: str
    api_key: Optional[str] = None
    auto_sync: bool = False


class AuditEvent(BaseModel):
    id: str
    tenant_id: str
    company_id: str | None = None
    user_id: str | None = None
    accion: str
    entidad: str
    entidad_id: str | None = None
    datos_anteriores: dict | None = None
    datos_nuevos: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    sync_status: str
    synced_at: datetime | None = None
    created_at: datetime


AUDIT_EVENTS = [
    "user.login",
    "user.logout",
    "sale.created",
    "sale.cancelled",
    "sale.sifen_sent",
    "product.created",
    "product.updated",
    "product.deleted",
    "inventory.adjustment",
    "inventory.transfer",
    "payment.received",
    "payment.made",
    "cash_session.opened",
    "cash_session.closed",
    "purchase_order.created",
    "purchase_order.received",
    "config.changed",
]
