"""InteliCont integration schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class AccountingEntry(BaseModel):
    id: UUID
    fecha: datetime
    tipo_asiento: str
    descripcion: str
    referencia_tipo: str
    referencia_id: str
    total_debe: float
    total_haber: float
    estado: str
    sync_status: str
    synced_at: datetime | None = None
    created_at: datetime


class AccountingEntryLine(BaseModel):
    id: UUID
    entry_id: UUID
    cuenta_codigo: str
    cuenta_nombre: str
    debe: float
    haber: float
    descripcion: str | None = None


class SyncConfig(BaseModel):
    id: UUID
    tenant_id: str
    enabled: bool
    auto_sync: bool
    sync_interval_minutes: int
    last_sync_at: datetime | None = None
    url_base: str
    api_key: str | None = None
    created_at: datetime
    updated_at: datetime


class SyncConfigCreate(BaseModel):
    url_base: str
    api_key: Optional[str] = None
    auto_sync: bool = False
    sync_interval_minutes: int = 60


class SyncResult(BaseModel):
    status: str
    entries_synced: int
    errors: list[str] = []
    synced_at: str


class ChartOfAccount(BaseModel):
    codigo: str
    nombre: str
    tipo: str
    nivel: int
    padre: str | None = None


SYNC_EVENTS = [
    "sale.completed",
    "sale.cancelled",
    "purchase.received",
    "payment.received",
    "payment.made",
    "inventory.adjustment",
    "session.closed",
]
