"""Inventory schemas — workflow doble aprobación, toma física, audit trail"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal


# ---------------------------------------------------------------------------
# Warehouses
# ---------------------------------------------------------------------------

class WarehouseCreate(BaseModel):
    company_id: Optional[UUID] = None
    branch_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    codigo: str = Field(min_length=1, max_length=20)
    nombre: str = Field(min_length=1, max_length=100)
    direccion: Optional[str] = None
    tipo: str = "principal"
    responsable: Optional[str] = None
    descripcion: Optional[str] = None
    activo: bool = True


class WarehouseUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    parent_id: Optional[UUID] = None
    direccion: Optional[str] = None
    tipo: Optional[str] = None
    responsable: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class WarehouseResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    codigo: str
    nombre: str
    direccion: Optional[str] = None
    tipo: str
    responsable: Optional[str] = None
    descripcion: Optional[str] = None
    activo: bool
    created_at: datetime
    parent_nombre: Optional[str] = None
    subdepositos_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------

class StockProductSummary(BaseModel):
    id: UUID
    sku: str
    nombre: str
    categoria_id: Optional[UUID] = None
    codigo_barra: Optional[str] = None
    unidad_medida: Optional[str] = None
    precio_venta: Optional[Decimal] = None
    costo_promedio: Optional[Decimal] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockWarehouseSummary(BaseModel):
    id: UUID
    nombre: str
    codigo: str
    company_id: UUID
    activo: bool

    class Config:
        from_attributes = True


class StockResponse(BaseModel):
    id: UUID
    warehouse_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    cantidad: int
    cantidad_reservada: int
    costo_unitario: Optional[Decimal] = None
    updated_at: datetime
    nombre: Optional[str] = None
    sku: Optional[str] = None
    costo_promedio: Optional[Decimal] = None
    product: Optional[StockProductSummary] = None
    warehouse: Optional[StockWarehouseSummary] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Movimientos (Kardex)
# ---------------------------------------------------------------------------

class MovementCreate(BaseModel):
    company_id: UUID
    warehouse_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    tipo: str
    cantidad: int
    costo_unitario: Optional[Decimal] = None
    referencia_type: Optional[str] = None
    referencia_id: Optional[str] = None
    motivo: Optional[str] = None
    user_id: Optional[UUID] = None


class MovementResponse(BaseModel):
    id: UUID
    company_id: UUID
    warehouse_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    tipo: str
    cantidad: int
    costo_unitario: Optional[Decimal] = None
    referencia_type: Optional[str] = None
    referencia_id: Optional[UUID] = None
    motivo: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Transferencias
# ---------------------------------------------------------------------------

class TransferCreate(BaseModel):
    company_id: UUID
    warehouse_origen_id: UUID
    warehouse_destino_id: UUID
    items: list[dict]
    observaciones: Optional[str] = None


class TransferResponse(BaseModel):
    id: UUID
    company_id: UUID
    codigo: str
    warehouse_origen_id: UUID
    warehouse_destino_id: UUID
    estado: str
    fecha_envio: Optional[datetime] = None
    fecha_recepcion: Optional[datetime] = None
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Ajustes de Stock — Workflow doble aprobación
# ---------------------------------------------------------------------------

class AdjustmentItemCreate(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    cantidad_sistema: Decimal
    cantidad_fisica: Decimal
    costo_unitario: Optional[Decimal] = None


class AdjustmentCreate(BaseModel):
    company_id: UUID
    warehouse_id: UUID
    motivo_codigo: str = Field(..., description="Clave del catálogo MOTIVOS_AJUSTE")
    motivo_detalle: str = Field(..., min_length=20, description="Justificación detallada, mínimo 20 caracteres")
    items: List[AdjustmentItemCreate]
    evidencia_urls: Optional[List[str]] = None
    observaciones: Optional[str] = None

    @validator("motivo_codigo")
    def validate_motivo(cls, v):
        from api.src.inventory.models import MOTIVOS_AJUSTE
        if v not in MOTIVOS_AJUSTE:
            raise ValueError(f"motivo_codigo inválido. Opciones: {list(MOTIVOS_AJUSTE.keys())}")
        return v


class AdjustmentItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    product_nombre: Optional[str] = None
    product_sku: Optional[str] = None
    cantidad_sistema: Decimal
    cantidad_fisica: Decimal
    diferencia: Decimal
    costo_unitario: Optional[Decimal] = None
    impacto_gs: Optional[Decimal] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdjustmentAuditLogResponse(BaseModel):
    id: UUID
    adjustment_id: UUID
    accion: str
    user_id: UUID
    user_nombre: Optional[str] = None
    rol_firmante: Optional[str] = None
    comentario: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdjustmentResponse(BaseModel):
    id: UUID
    company_id: UUID
    warehouse_id: UUID
    codigo: str
    motivo_codigo: Optional[str] = None
    motivo_label: Optional[str] = None
    motivo_detalle: Optional[str] = None
    motivo: Optional[str] = None
    riesgo: Optional[str] = None
    estado: str
    impacto_financiero_gs: Optional[Decimal] = None
    evidencia_urls: Optional[List[str]] = None
    aprobado_por_gerencia: Optional[UUID] = None
    aprobado_por_gerencia_nombre: Optional[str] = None
    fecha_aprobacion_gerencia: Optional[datetime] = None
    comentario_gerencia: Optional[str] = None
    aprobado_por_administracion: Optional[UUID] = None
    aprobado_por_administracion_nombre: Optional[str] = None
    fecha_aprobacion_administracion: Optional[datetime] = None
    comentario_administracion: Optional[str] = None
    rechazado_por: Optional[UUID] = None
    rechazado_por_nombre: Optional[str] = None
    motivo_rechazo: Optional[str] = None
    fecha_rechazo: Optional[datetime] = None
    user_id: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    observaciones: Optional[str] = None
    physical_session_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: Optional[List[AdjustmentItemResponse]] = None
    audit_logs: Optional[List[AdjustmentAuditLogResponse]] = None

    class Config:
        from_attributes = True


class ApproveAdjustmentBody(BaseModel):
    comentario: Optional[str] = None


class RejectAdjustmentBody(BaseModel):
    motivo_rechazo: str = Field(..., min_length=10, description="Motivo de rechazo, mínimo 10 caracteres")


# ---------------------------------------------------------------------------
# Toma Física de Inventario
# ---------------------------------------------------------------------------

class PhysicalSessionCreate(BaseModel):
    company_id: UUID
    warehouse_id: UUID
    tipo: str = Field(default="total", description="total | parcial | ciclico")
    categoria_id: Optional[UUID] = None
    pasillo: Optional[str] = None
    descripcion_alcance: Optional[str] = None
    notas: Optional[str] = None
    contador_1_id: Optional[UUID] = None
    contador_1_nombre: Optional[str] = None
    contador_2_id: Optional[UUID] = None
    contador_2_nombre: Optional[str] = None


class PhysicalSessionItemCountBody(BaseModel):
    cantidad: Decimal = Field(..., ge=0)
    numero_conteo: int = Field(..., ge=1, le=2, description="1=primer conteo, 2=segundo conteo")


class PhysicalSessionItemReconcileBody(BaseModel):
    cantidad_final: Decimal = Field(..., ge=0)
    nota_reconciliacion: Optional[str] = None


class PhysicalSessionItemResponse(BaseModel):
    id: UUID
    session_id: UUID
    product_id: UUID
    product_nombre: Optional[str] = None
    product_sku: Optional[str] = None
    product_codigo_barra: Optional[str] = None
    cantidad_sistema: Decimal
    costo_unitario: Optional[Decimal] = None
    cantidad_conteo_1: Optional[Decimal] = None
    contado_1_at: Optional[datetime] = None
    cantidad_conteo_2: Optional[Decimal] = None
    contado_2_at: Optional[datetime] = None
    cantidad_final: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    impacto_gs: Optional[Decimal] = None
    estado: str
    nota_reconciliacion: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PhysicalSessionResponse(BaseModel):
    id: UUID
    company_id: UUID
    warehouse_id: UUID
    codigo: str
    tipo: str
    estado: str
    categoria_id: Optional[UUID] = None
    pasillo: Optional[str] = None
    descripcion_alcance: Optional[str] = None
    notas: Optional[str] = None
    creado_por: Optional[UUID] = None
    creado_por_nombre: Optional[str] = None
    contador_1_id: Optional[UUID] = None
    contador_1_nombre: Optional[str] = None
    contador_2_id: Optional[UUID] = None
    contador_2_nombre: Optional[str] = None
    cerrado_por: Optional[UUID] = None
    cerrado_por_nombre: Optional[str] = None
    total_items: Optional[int] = None
    items_con_diferencia: Optional[int] = None
    diferencia_total_unidades: Optional[Decimal] = None
    diferencia_total_gs: Optional[Decimal] = None
    adjustment_id: Optional[UUID] = None
    fecha_inicio: Optional[datetime] = None
    fecha_cierre: Optional[datetime] = None
    created_at: datetime
    items: Optional[List[PhysicalSessionItemResponse]] = None

    class Config:
        from_attributes = True
