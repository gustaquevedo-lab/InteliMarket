"""Pydantic schemas for Donations & Round-Up Engine"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class DonationCampaignBase(BaseModel):
    nombre: str = "Abre tu corazón"
    ong_nombre: str = "Centro Amor y Esperanza"
    ong_ruc: Optional[str] = None
    ong_web: str = "www.centroamoresperanza.org"
    slogan: Optional[str] = "Ayudanos a ayudar"
    mensaje_ticket: str = "¡Gracias por abrir tu corazón! Colaboraste con {monto} para el Centro Amor y Esperanza."
    meta_recaudacion_pyg: Decimal = Decimal("20000000")
    fecha_fin: Optional[datetime] = None
    activa: bool = True


class DonationCampaignCreate(DonationCampaignBase):
    company_id: UUID


class DonationCampaignUpdate(BaseModel):
    nombre: Optional[str] = None
    ong_nombre: Optional[str] = None
    ong_ruc: Optional[str] = None
    ong_web: Optional[str] = None
    slogan: Optional[str] = None
    mensaje_ticket: Optional[str] = None
    meta_recaudacion_pyg: Optional[Decimal] = None
    fecha_fin: Optional[datetime] = None
    activa: Optional[bool] = None


class DonationCampaignResponse(DonationCampaignBase):
    id: UUID
    company_id: UUID
    fecha_inicio: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DonationRecordCreate(BaseModel):
    company_id: UUID
    branch_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    cajero_nombre: Optional[str] = None
    campana_id: Optional[UUID] = None
    monto_pyg: Decimal = Field(gt=0)
    monto_total_venta_pyg: Decimal = Field(ge=0)
    numero_comprobante: Optional[str] = None
    tipo_origen: str = "redondeo_vuelto"


class DonationRecordResponse(BaseModel):
    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    cajero_nombre: Optional[str] = None
    campana_id: UUID
    monto_pyg: Decimal
    monto_total_venta_pyg: Decimal
    numero_comprobante: Optional[str] = None
    tipo_origen: str
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True


class DonationLiquidationCreate(BaseModel):
    company_id: UUID
    campana_id: UUID
    fecha_desde: datetime
    fecha_hasta: datetime
    entregado_por_nombre: str
    recibido_por_nombre: str
    recibido_por_ci: Optional[str] = None
    comprobante_transferencia: Optional[str] = None
    observaciones: Optional[str] = None


class DonationLiquidationResponse(BaseModel):
    id: UUID
    company_id: UUID
    campana_id: UUID
    monto_total_pyg: Decimal
    cantidad_donaciones: int
    fecha_desde: datetime
    fecha_hasta: datetime
    numero_acta: str
    entregado_por_nombre: Optional[str] = None
    recibido_por_nombre: Optional[str] = None
    recibido_por_ci: Optional[str] = None
    comprobante_transferencia: Optional[str] = None
    observaciones: Optional[str] = None
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True


class DonationStatsResponse(BaseModel):
    total_recaudado_pyg: Decimal
    total_mes_pyg: Decimal
    total_hoy_pyg: Decimal
    total_liquidado_pyg: Decimal
    total_pendiente_pyg: Decimal
    cantidad_donaciones: int
    ticket_promedio_donacion: Decimal
    meta_pyg: Decimal
    progreso_meta_pct: float
    campana_activa: Optional[DonationCampaignResponse] = None


class CajeroSolidarioRankingItem(BaseModel):
    user_id: Optional[UUID] = None
    cajero_nombre: str
    total_recaudado_pyg: Decimal
    cantidad_donaciones: int
    total_ventas_atendidas: int
    tasa_adhesion_pct: float
