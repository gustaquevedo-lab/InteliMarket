from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


class ExpenseCategoryCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    presupuesto_mensual: Optional[Decimal] = None


class ExpenseCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    presupuesto_mensual: Optional[float] = None
    activo: bool = True
    created_at: Optional[datetime] = None


class CostCenterCreate(BaseModel):
    nombre: str
    tipo: str = "sector"  # sector | global
    peso_prorateo: Optional[Decimal] = Decimal("1")


class CostCenterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    tipo: str
    peso_prorateo: float
    activo: bool = True
    created_at: Optional[datetime] = None


class PettyCashFundCreate(BaseModel):
    branch_id: Optional[str] = None
    nombre: str
    custodio_id: Optional[str] = None
    monto_autorizado: Decimal


class PettyCashFundUpdate(BaseModel):
    nombre: Optional[str] = None
    custodio_id: Optional[str] = None
    activo: Optional[bool] = None


class FundReplenishRequest(BaseModel):
    monto: Decimal
    bank_account_id: Optional[str] = None
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class PettyCashFundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    branch_nombre: Optional[str] = None
    nombre: str
    custodio_id: Optional[UUID] = None
    custodio_nombre: Optional[str] = None
    monto_autorizado: float
    saldo_actual: float
    activo: bool
    created_at: Optional[datetime] = None


class PettyCashFundMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fund_id: UUID
    tipo: str
    monto: float
    saldo_anterior: float
    saldo_nuevo: float
    referencia_type: Optional[str] = None
    referencia_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None


class ExpenseCreate(BaseModel):
    branch_id: Optional[str] = None
    fund_id: Optional[str] = None
    category_id: Optional[str] = None
    cost_center_id: Optional[str] = None
    monto: Decimal
    descripcion: str
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: str = "efectivo"
    fecha_gasto: Optional[date] = None


class ExpenseUpdate(BaseModel):
    category_id: Optional[str] = None
    cost_center_id: Optional[str] = None
    monto: Optional[Decimal] = None
    descripcion: Optional[str] = None
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: Optional[str] = None


class ExpenseApprovalConfig(BaseModel):
    umbral_aprobacion: Decimal = Decimal("200000")
    tolerancia_arqueo: Decimal = Decimal("2000")


class FundCountCreate(BaseModel):
    monto_contado: Decimal
    observaciones: Optional[str] = None


class FundCountConfirm(BaseModel):
    ajustar: bool = True
    observaciones: Optional[str] = None


class PettyCashFundCountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fund_id: UUID
    contado_por: UUID
    contado_por_nombre: Optional[str] = None
    saldo_esperado: float
    monto_contado: float
    diferencia: float
    requiere_revision: bool
    estado: str
    confirmado_por: Optional[UUID] = None
    confirmado_por_nombre: Optional[str] = None
    fecha_confirmacion: Optional[datetime] = None
    ajusto_saldo: bool = False
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None


class ExpenseRejectBody(BaseModel):
    motivo: str


class ExpenseVoidBody(BaseModel):
    motivo: str


class ComprobanteUploadResponse(BaseModel):
    url: str
    filename: str


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: Optional[UUID] = None
    branch_id: Optional[UUID] = None
    fund_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    monto: float
    descripcion: str
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: Optional[str] = None
    fecha_gasto: Optional[date] = None
    registrado_por: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    aprobado_at: Optional[datetime] = None
    rechazado_por: Optional[UUID] = None
    rechazado_at: Optional[datetime] = None
    rechazado_motivo: Optional[str] = None
    anulado: bool = False
    anulado_por: Optional[UUID] = None
    anulado_at: Optional[datetime] = None
    anulado_motivo: Optional[str] = None
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


class ExpenseDashboard(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    total_periodo: float
    total_periodo_anterior: float
    variacion_pct: Optional[float] = None
    por_categoria: list[dict]
    por_sector: list[dict]
    tendencia_mensual: list[dict]
    top_proveedores: list[dict]
    sugerencias: list[dict]
