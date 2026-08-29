"""Schemas for Cupones Sorteo, Fidelizacion and IA Analysis"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID


class CuponClienteBase(BaseModel):
    documento: str
    nombre: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    barrio: Optional[str] = None
    ciudad: Optional[str] = "Pedro Juan Caballero"


class CuponClienteCreate(CuponClienteBase):
    pass


class CuponClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    barrio: Optional[str] = None
    ciudad: Optional[str] = None
    segmentos: Optional[str] = None
    ia_analisis: Optional[Dict[str, Any]] = None
    activo: Optional[bool] = None


class CuponClienteOut(CuponClienteBase):
    id: UUID
    company_id: UUID
    ticket_promedio: float
    total_gastado: float
    cantidad_compras: int
    ultimo_consumo: Optional[datetime] = None
    segmentos: Optional[str] = None
    ia_analisis: Optional[Dict[str, Any]] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CuponTicketItemOut(BaseModel):
    id: UUID
    ticket_id: UUID
    producto_id: Optional[UUID] = None
    descripcion: str
    cantidad: float
    precio_unitario: float
    total: float
    created_at: datetime

    class Config:
        from_attributes = True


class CuponTicketOut(BaseModel):
    id: UUID
    company_id: UUID
    cliente_id: UUID
    sale_id: Optional[UUID] = None
    nro_ticket: str
    cantidad: int
    monto_compra: float
    fecha_compra: Optional[datetime] = None
    fecha_captura: datetime
    usuario_nombre: Optional[str] = None
    sincronizado: bool
    whatsapp_enviado: bool
    whatsapp_status: Optional[str] = None
    created_at: datetime
    cliente: Optional[CuponClienteOut] = None
    items: List[CuponTicketItemOut] = []

    class Config:
        from_attributes = True


class RegistrarCuponRequest(BaseModel):
    documento: str
    nombre: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    barrio: Optional[str] = None
    ciudad: Optional[str] = "Pedro Juan Caballero"
    nro_ticket: str
    cantidad: int = 1
    monto_compra: Optional[float] = None
    usuario_nombre: Optional[str] = None
    enviar_whatsapp: bool = True


class RegistrarCuponResponse(BaseModel):
    ticket: CuponTicketOut
    cliente: CuponClienteOut
    items_cruzados: int
    whatsapp_disparado: bool
    mensaje: str


class ClienteLookupResponse(BaseModel):
    existe: bool
    cliente: Optional[CuponClienteOut] = None
    origen: Optional[str] = None  # "cupones" | "customers" | None


class AnalisisIARequest(BaseModel):
    cliente_ids: Optional[List[UUID]] = None
    limite: int = 20
    forzar_reanalisis: bool = False


class AnalisisIAResponse(BaseModel):
    analizados: int
    fallidos: int
    detalles: List[Dict[str, Any]]
    mensaje: str


class CuponStatsResponse(BaseModel):
    total_cupones: int
    total_tickets: int
    total_clientes: int
    monto_total_compras: float
    top_barrios: List[Dict[str, Any]]
    whatsapp_stats: Dict[str, int]


class CuponConfigOut(BaseModel):
    id: UUID
    company_id: UUID
    monto_por_cupon: float
    sorteo_nombre: str
    whatsapp_mensaje_template: Optional[str] = None
    disparo_whatsapp_activo: bool
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CuponConfigUpdate(BaseModel):
    monto_por_cupon: Optional[float] = None
    sorteo_nombre: Optional[str] = None
    whatsapp_mensaje_template: Optional[str] = None
    disparo_whatsapp_activo: Optional[bool] = None
    activo: Optional[bool] = None


class GenerarCampanaRequest(BaseModel):
    segmento: str
    tono: Optional[str] = "Persuasivo"  # Persuasivo, Amigable, Urgente, Formal
    oferta_especifica: Optional[str] = None


class GenerarCampanaResponse(BaseModel):
    segmento: str
    tono: str
    mensaje_generado: str
    audiencia_estimada: int


class SyncBatchRequest(BaseModel):
    limite: int = 50
    delay_ms: int = 200
    force: bool = False


class SyncBatchProgressResponse(BaseModel):
    activo: bool
    total: int
    procesados: int
    exitos: int
    fallas: int
    porcentaje: float
    inicio: Optional[datetime] = None
    fin: Optional[datetime] = None

