"""Mobile schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import date


class InventoryCountItem(BaseModel):
    product_id: UUID
    cantidad_real: int = Field(..., ge=0)
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None


class InventoryCountInput(BaseModel):
    warehouse_id: UUID
    items: list[InventoryCountItem]


class InventoryDiscrepancy(BaseModel):
    product_id: UUID
    cantidad_sistema: int
    cantidad_real: int
    diferencia: int


class InventoryCountResult(BaseModel):
    procesados: int
    discrepancias: list[InventoryDiscrepancy]


class ReceiveRemitItem(BaseModel):
    product_id: UUID
    cantidad_recibida: int = Field(..., ge=0)
    cantidad_bonificada: int = Field(0, ge=0)
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None


class ReceiveRemitInput(BaseModel):
    orden_id: UUID
    items: list[ReceiveRemitItem]


class ReceiveRemitResult(BaseModel):
    orden_id: UUID
    procesados: int
    errores: list[str]


class ApproveSuggestionInput(BaseModel):
    suggestion_ids: list[UUID]


class MobileDashboard(BaseModel):
    recepciones_pendientes: int = 0
    inventarios_pendientes: int = 0
    sugerencias_pendientes: int = 0
    entregas_hoy: int = 0

