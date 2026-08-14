"""Credit account schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
import uuid


class CreditAccountCreate(BaseModel):
    company_id: uuid.UUID
    customer_id: uuid.UUID
    limite_credito: float = 0


class CreditAccountUpdate(BaseModel):
    limite_credito: Optional[float] = None
    activo: Optional[bool] = None


class CreditAccountResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    customer_nombre: Optional[str] = None
    customer_ruc: Optional[str] = None
    limite_credito: float
    saldo_disponible: float
    saldo_utilizado: float
    activo: bool
    dias_mora_max: Optional[int] = None
    en_mora: Optional[bool] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CreditPayment(BaseModel):
    monto: float
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class CustomerAdvanceCreate(BaseModel):
    customer_id: uuid.UUID
    monto: float
    forma_pago: Optional[str] = None
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class CustomerAdvanceResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    customer_id: uuid.UUID
    customer_nombre: Optional[str] = None
    monto_total: float
    monto_disponible: float
    moneda: str
    forma_pago: Optional[str] = None
    referencia: Optional[str] = None
    fecha: date
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApplyAdvanceRequest(BaseModel):
    accounts_receivable_id: uuid.UUID
    monto: float


class DunningConfig(BaseModel):
    activo: bool = False
    buckets_dias: list[int] = [3, 7, 15, 30]
    mensaje_template: str = "Hola {cliente}, te escribimos de {empresa} para recordarte que tenés un saldo pendiente de {monto} con {dias_mora} días de atraso. Por favor contactanos para regularizar tu situación. ¡Gracias!"


class DunningPreviewItem(BaseModel):
    customer_id: uuid.UUID
    customer_nombre: Optional[str] = None
    telefono: Optional[str] = None
    monto_total: float
    dias_mora: int
    bucket_dias: int
    documentos_count: int


class DunningPreviewResponse(BaseModel):
    config: DunningConfig
    items: list[DunningPreviewItem]


class WriteoffRequestCreate(BaseModel):
    accounts_receivable_id: uuid.UUID
    motivo: str


class WriteoffRequestResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    accounts_receivable_id: uuid.UUID
    customer_id: uuid.UUID
    customer_nombre: Optional[str] = None
    credit_account_id: Optional[uuid.UUID] = None
    monto: float
    motivo: str
    estado: str
    numero_documento: Optional[str] = None
    aprobado_gerente_id: Optional[uuid.UUID] = None
    aprobado_finanzas_id: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MoraConfig(BaseModel):
    activo: bool = False
    porcentaje_mensual: float = 2.0
    dias_gracia: int = 0


class MoraPreviewItem(BaseModel):
    credit_account_id: uuid.UUID
    customer_id: uuid.UUID
    customer_nombre: Optional[str] = None
    documentos_afectados: int
    recargo_total: float


class MoraPreviewResponse(BaseModel):
    config: MoraConfig
    items: list[MoraPreviewItem]
    total_recargo: float


class CreditMovementResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    credit_account_id: uuid.UUID
    customer_id: uuid.UUID
    tipo: str
    monto: float
    saldo_anterior: float
    saldo_nuevo: float
    referencia_type: Optional[str]
    referencia_id: Optional[uuid.UUID]
    observaciones: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
