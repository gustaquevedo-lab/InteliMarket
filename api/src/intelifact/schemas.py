from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class IntelifactConfigUpsert(BaseModel):
    enabled: bool = False
    ruc: Optional[str] = None
    dv: Optional[str] = None
    razon_social: Optional[str] = None
    nombre_fantasia: Optional[str] = None
    actividad_economica: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    timbrado: Optional[str] = None
    timbrado_inicio: Optional[str] = None
    codigo_establecimiento: Optional[str] = None
    codigo_punto_expedicion: Optional[str] = None
    cert_p12_base64: Optional[str] = None
    cert_password: Optional[str] = None
    ambiente: str = "test"
    service_base_url: Optional[str] = None


class IntelifactConfigResponse(BaseModel):
    id: UUID
    company_id: UUID
    enabled: bool
    ruc: Optional[str] = None
    dv: Optional[str] = None
    razon_social: Optional[str] = None
    nombre_fantasia: Optional[str] = None
    actividad_economica: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    timbrado: Optional[str] = None
    timbrado_inicio: Optional[str] = None
    codigo_establecimiento: Optional[str] = None
    codigo_punto_expedicion: Optional[str] = None
    ambiente: str
    service_base_url: Optional[str] = None
    cert_cargado: bool = False  # nunca se devuelve el cert en si, solo si hay uno guardado
    created_at: datetime
    updated_at: datetime


class InvoicePreviewItem(BaseModel):
    descripcion: str
    cantidad: float = 1
    precio_unitario: float = 0
    subtotal: float = 0


class InvoicePreviewRequest(BaseModel):
    total_amount: float
    subtotal: Optional[float] = None
    recipient_document: Optional[str] = "00000000"
    recipient_name: Optional[str] = "CONSUMIDOR FINAL"
    items: list[InvoicePreviewItem] = []


class TelemetryStatusResponse(BaseModel):
    disponible: bool
    detalle: Optional[dict] = None
    error: Optional[str] = None
