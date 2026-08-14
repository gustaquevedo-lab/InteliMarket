from uuid import UUID
from pydantic import BaseModel, ConfigDict
from typing import Optional, Union
from datetime import date, datetime
from decimal import Decimal


class ExpenseCategoryCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    presupuesto_mensual: Optional[Decimal] = None


class ExpenseCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Union[UUID, str]
    nombre: str
    descripcion: Optional[str] = None
    presupuesto_mensual: Optional[float] = None
    activo: bool = True
    created_at: Optional[datetime] = None


class ExpenseCreate(BaseModel):
    branch_id: Optional[str] = None
    category_id: Optional[Union[UUID, str]] = None
    monto: Decimal
    descripcion: str
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: str = "efectivo"
    fecha_gasto: Optional[date] = None


class ExpenseUpdate(BaseModel):
    category_id: Optional[Union[UUID, str]] = None
    monto: Optional[Decimal] = None
    descripcion: Optional[str] = None
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: Optional[str] = None
    estado: Optional[str] = None


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Union[UUID, str]
    company_id: Optional[Union[UUID, str]] = None
    branch_id: Optional[str] = None
    category_id: Optional[Union[UUID, str]] = None
    monto: float
    descripcion: str
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: Optional[str] = None
    fecha_gasto: Optional[date] = None
    registrado_por: Optional[str] = None
    aprobado_por: Optional[str] = None
    estado: str = "pendiente"
    notas: Optional[str] = None
    created_at: Optional[datetime] = None


class ExpenseSummary(BaseModel):
    total_dia: float
    total_semana: float
    total_mes: float
    por_categoria: list[dict]
    por_sucursal: list[dict]
    pendientes_aprobacion: int
