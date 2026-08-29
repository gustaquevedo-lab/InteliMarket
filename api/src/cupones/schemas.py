"""Schemas for Cupones Sorteo, Fidelizacion and IA Analysis"""

from pydantic import BaseModel, Field, field_validator
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


class CuponConfigBase(BaseModel):
    monto_por_cupon: float = 50000
    whatsapp_mensaje_template: str = "¡Hola *{nombre}*! 👋\n\n🎉 Te confirmamos que tenés *{cantidad} cupón(es)* generados para el *Gran Sorteo Aniversario* con tu Ticket *#{ticket}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨"
    whatsapp_activo: bool = True
    ticket_encabezado: str = "EXTRA SUPERMERCADO"
    ticket_subtitulo: str = "*** GRAN SORTEO ANIVERSARIO ***"
    ticket_pie_urna: str = "¡Deposita este cupon en la urna de la sucursal!"


class CuponConfigOut(CuponConfigBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CuponConfigUpdate(BaseModel):
    monto_por_cupon: Optional[float] = None
    whatsapp_mensaje_template: Optional[str] = None
    whatsapp_activo: Optional[bool] = None
    ticket_encabezado: Optional[str] = None
    ticket_subtitulo: Optional[str] = None
    ticket_pie_urna: Optional[str] = None


class CuponStatsResponse(BaseModel):
    total_tickets: int
    total_cupones: int
    total_clientes: int
    total_recaudado: float
    tickets_sincronizados: int
    tickets_pendientes: int
    whatsapp_enviados: int
    whatsapp_pendientes: int
    whatsapp_fallidos: int
    top_barrios: List[Dict[str, Any]]
    distribucion_monto: List[Dict[str, Any]]


class AnalisisIARequest(BaseModel):
    cliente_ids: Optional[List[UUID]] = None
    limite: int = 20
    forzar_reanalisis: bool = False


class AnalisisIAResponse(BaseModel):
    procesados: int
    exitos: int
    fallas: int
    detalles: List[Dict[str, Any]]


class GenerarCampanaRequest(BaseModel):
    segmento: str
    tono: Optional[str] = "Persuasivo"
    oferta_especifica: Optional[str] = None


class GenerarCampanaResponse(BaseModel):
    segmento: str
    mensaje_sugerido: str
    llamado_a_la_accion: str
    keywords: List[str]


class ClienteLookupResponse(BaseModel):
    existe: bool
    origen: Optional[str] = None  # "cupones" | "customers"
    cliente: Optional[Dict[str, Any]] = None


class SyncBatchRequest(BaseModel):
    limite: int = 50
    delay_ms: int = 200


class SyncBatchProgressResponse(BaseModel):
    activo: bool
    total: int
    procesados: int
    exitos: int
    fallas: int
    porcentaje: float
    inicio: Optional[datetime] = None
    fin: Optional[datetime] = None


# ── MOTOR MULTI-CAMPAÑA DE SORTEOS Y CUPONES ─────────────────────────────────

class SorteoCampanaBase(BaseModel):
    nombre: str
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    patrocinador: Optional[str] = "Extra Supermercado"
    premio_destacado: Optional[str] = None
    tipo_trigger: str = "MONTO_GLOBAL"  # MONTO_GLOBAL | PRODUCTOS_ESPECIFICOS | MARCA_PROVEEDOR | CATEGORIA
    criterio_evaluacion: str = "MONTO_ACUMULADO"  # MONTO_ACUMULADO | CANTIDAD_UNIDADES
    valor_umbral: float = 50000
    productos_participantes: Optional[List[Dict[str, Any]]] = []
    marcas_participantes: Optional[List[str]] = []
    categorias_participantes: Optional[List[str]] = []
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    activo: bool = True
    whatsapp_template: Optional[str] = None
    whatsapp_activo: bool = True
    ticket_encabezado: Optional[str] = "EXTRA SUPERMERCADO"
    ticket_subtitulo: Optional[str] = None
    ticket_pie_urna: Optional[str] = "¡Deposita este cupon en la urna de la sucursal!"

    @field_validator("fecha_inicio", "fecha_fin", mode="before")
    @classmethod
    def parse_optional_datetime(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("codigo", "descripcion", "premio_destacado", "whatsapp_template", "ticket_subtitulo", mode="before")
    @classmethod
    def parse_optional_str(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class SorteoCampanaCreate(SorteoCampanaBase):
    pass


class SorteoCampanaUpdate(BaseModel):
    nombre: Optional[str] = None
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    patrocinador: Optional[str] = None
    premio_destacado: Optional[str] = None
    tipo_trigger: Optional[str] = None
    criterio_evaluacion: Optional[str] = None
    valor_umbral: Optional[float] = None
    productos_participantes: Optional[List[Dict[str, Any]]] = None
    marcas_participantes: Optional[List[str]] = None
    categorias_participantes: Optional[List[str]] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    activo: Optional[bool] = None
    whatsapp_template: Optional[str] = None
    whatsapp_activo: Optional[bool] = None
    ticket_encabezado: Optional[str] = None
    ticket_subtitulo: Optional[str] = None
    ticket_pie_urna: Optional[str] = None

    @field_validator("fecha_inicio", "fecha_fin", mode="before")
    @classmethod
    def parse_optional_datetime_update(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("codigo", "descripcion", "premio_destacado", "whatsapp_template", "ticket_subtitulo", mode="before")
    @classmethod
    def parse_optional_str_update(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class SorteoCampanaOut(SorteoCampanaBase):
    id: UUID
    company_id: UUID
    total_cupones_emitidos: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EvaluarCarritoItem(BaseModel):
    producto_id: Optional[UUID] = None
    sku: Optional[str] = None
    nombre: str
    cantidad: float = 1.0
    precio_unitario: float = 0.0
    total: float = 0.0
    marca: Optional[str] = None
    categoria: Optional[str] = None
    codigo_barra: Optional[str] = None


class EvaluarCarritoRequest(BaseModel):
    total_monto: float
    items: List[EvaluarCarritoItem] = []
    cliente_id: Optional[UUID] = None
    cliente_doc: Optional[str] = None


class CampanaCalificadaOut(BaseModel):
    campana_id: UUID
    nombre: str
    patrocinador: str
    premio_destacado: Optional[str] = None
    tipo_trigger: str
    cupones_ganados: int
    monto_o_cantidad_base: float
    ticket_encabezado: Optional[str] = "EXTRA SUPERMERCADO"
    ticket_subtitulo: Optional[str] = None
    ticket_pie_urna: Optional[str] = "¡Deposita este cupon en la urna de la sucursal!"
    whatsapp_template: Optional[str] = None
    whatsapp_activo: bool = True


class EvaluarCarritoResponse(BaseModel):
    total_cupones: int
    campanas_calificadas: List[CampanaCalificadaOut]


class RegistrarCuponesMultipleItem(BaseModel):
    campana_id: Optional[UUID] = None
    campana_nombre: str
    cantidad: int


class RegistrarCuponesMultipleRequest(BaseModel):
    documento: str
    nombre: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    barrio: Optional[str] = None
    ciudad: Optional[str] = "Pedro Juan Caballero"
    nro_ticket: str
    monto_compra: float
    sale_id: Optional[UUID] = None
    usuario_nombre: Optional[str] = None
    cupones_por_campana: List[RegistrarCuponesMultipleItem]
    items: Optional[List[Dict[str, Any]]] = None
    enviar_whatsapp: bool = True


