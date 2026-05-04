"""SIFEN schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID


class TimbradoCreate(BaseModel):
    company_id: UUID
    numero: str = Field(min_length=1, max_length=20)
    fecha_inicio: date
    fecha_fin: date
    rango_desde: int = Field(ge=1)
    rango_hasta: int = Field(ge=1)
    tipo_comprobante: Optional[str] = None


class TimbradoResponse(BaseModel):
    id: UUID
    company_id: UUID
    numero: str
    fecha_inicio: date
    fecha_fin: date
    rango_desde: int
    rango_hasta: int
    tipo_comprobante: Optional[str] = None
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SifenResponseRecord(BaseModel):
    id: UUID
    sale_id: UUID
    cdc: Optional[str] = None
    estado: str
    codigo_error: Optional[str] = None
    mensaje_error: Optional[str] = None
    xml_sent: Optional[str] = None
    xml_response: Optional[str] = None
    fecha_envio: datetime
    fecha_respuesta: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SifenSendRequest(BaseModel):
    sale_id: UUID


class CdcQueryResponse(BaseModel):
    cdc: str
    valido: bool
    estado: Optional[str] = None
    ruc_emisor: Optional[str] = None
    tipo_de: Optional[str] = None
    numero: Optional[str] = None
    fecha_emision: Optional[str] = None
    total: Optional[str] = None
    mensaje: Optional[str] = None
