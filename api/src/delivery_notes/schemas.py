from pydantic import BaseModel
from typing import Optional, Literal
from decimal import Decimal
from datetime import date, datetime

ConceptoType = Literal[
    "no_es_su_pedido",
    "faltante_deposito",
    "sin_dinero",
    "vencimiento_averia",
    "otro",
]


class DeliveryNoteCreate(BaseModel):
    company_id: str
    customer_id: str
    sale_id: Optional[str] = None
    numero_nota: str
    numero_factura_ref: Optional[str] = None
    fecha: date
    monto: Decimal
    concepto: ConceptoType
    descripcion: Optional[str] = None
    vendedor_id: Optional[str] = None
    cobrador_id: Optional[str] = None


class DeliveryNoteApplyInput(BaseModel):
    cobro_id: str


class DeliveryNoteResponse(BaseModel):
    id: str
    company_id: str
    customer_id: str
    sale_id: Optional[str] = None
    numero_nota: str
    numero_factura_ref: Optional[str] = None
    fecha: date
    monto: Decimal
    concepto: str
    descripcion: Optional[str] = None
    vendedor_id: Optional[str] = None
    cobrador_id: Optional[str] = None
    estado: str
    aplicada_en_cobro_id: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
