"""Integrations module schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class IntegrationConfigCreate(BaseModel):
    destino: str  # "intelicont", "inteliaudit", "sueldok", "custom"
    url: str
    secret: Optional[str] = None
    eventos: list[str] = []
    activo: bool = True


class IntegrationConfigUpdate(BaseModel):
    url: Optional[str] = None
    secret: Optional[str] = None
    eventos: Optional[list[str]] = None
    activo: Optional[bool] = None


class IntegrationConfig(BaseModel):
    id: int
    destino: str
    url: str
    activo: bool
    eventos: list[str]
    creado: datetime
    actualizado: Optional[datetime] = None


class WebhookEvent(BaseModel):
    evento: str
    payload: dict


class PosMatchRequest(BaseModel):
    procesador: str  # "BANCARD" | "DINELCO"
    monto: int
    desde: datetime  # momento en que se abrió el cobro en InteliMarket


class PosMatchCandidate(BaseModel):
    id: str
    fecha: str
    tarjeta_marca: str
    monto: float
    voucher: str
    cajero: str


class PosClaimRequest(BaseModel):
    fin_operacao_pos_id: str
    procesador: str
    monto: int
    voucher: Optional[str] = None
    tarjeta_marca: Optional[str] = None
    sale_id: Optional[str] = None


class WebhookDelivery(BaseModel):
    id: int
    config_id: int
    evento: str
    url: str
    status: int
    payload_size: int
    intento: int
    creado: datetime


EVENTOS_DISPONIBLES = [
    "venta.creada",
    "venta.anulada",
    "compra.creada",
    "compra.recibida",
    "producto.creado",
    "producto.actualizado",
    "stock.actualizado",
    "cliente.creado",
    "cliente.actualizado",
    "pago.recibido",
    "pago.enviado",
    "ekuatia.emitida",
    "ekuatia.anulada",
    "timbrado.vencido",
    "usuario.creado",
    "empresa.creada",
    # InteliEntregas
    "entrega.asignada",
    "entrega.recogida",
    "entrega.transito",
    "entrega.entregada",
    "entrega.fallida",
    # Boutique / Pedidos
    "pedido.actualizado",
    "pedido.asignado_repartidor",
    "pedido.aprobado",
    "pedido.rendido",
]
