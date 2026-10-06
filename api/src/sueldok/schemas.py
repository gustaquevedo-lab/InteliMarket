"""SueldOK integration schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SueldOKSyncConfig(BaseModel):
    id: str
    tenant_id: str
    enabled: bool
    auto_sync: bool
    url_base: str
    api_key: str | None = None
    created_at: datetime
    updated_at: datetime


class SueldOKSyncConfigCreate(BaseModel):
    url_base: str
    api_key: Optional[str] = None
    auto_sync: bool = False


class PayrollSyncData(BaseModel):
    employee_id: str
    periodo: str
    sueldo_base: float
    horas_extra: float
    bonificaciones: float
    deducciones: float
    comisiones: float
    adelantos: float


SYNC_EVENTS = [
    "payroll.sync",
    "employee.created",
    "employee.updated",
    "attendance.sync",
    "payroll.approved",
]


class PayrollPaymentOrderCreate(BaseModel):
    periodo: str
    total_neto: float
    colaboradores_count: Optional[int] = 0
    observaciones: Optional[str] = None
    liquidar_inmediato: Optional[bool] = False
    forma_pago: Optional[str] = "transferencia"  # transferencia | cheque | boveda | fondo_fijo
    bank_account_id: Optional[str] = None
    referencia_transferencia: Optional[str] = None
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    fecha_pago: Optional[str] = None


class SettlementCreate(BaseModel):
    employee_id: str
    employee_nombre: str
    employee_ci: Optional[str] = None
    employee_cargo: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    fecha_salida: str
    motivo: Optional[str] = "despido_injustificado"
    salario_base: float
    dias_trabajados_mes: Optional[int] = 0
    monto_dias_trabajados: Optional[float] = 0
    vacaciones_monto: Optional[float] = 0
    aguinaldo_proporcional: Optional[float] = 0
    preaviso: Optional[float] = 0
    indemnizacion_legal: Optional[float] = 0
    descuentos_varios: Optional[float] = 0
    total_liquidacion_neta: float
    observaciones: Optional[str] = None
    generar_op: Optional[bool] = True
    liquidar_inmediato: Optional[bool] = False
    forma_pago: Optional[str] = "transferencia"  # transferencia | cheque | boveda | fondo_fijo
    bank_account_id: Optional[str] = None
    referencia_transferencia: Optional[str] = None
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    fecha_pago: Optional[str] = None


class SettlementResponse(BaseModel):
    id: str
    company_id: str
    employee_id: str
    employee_nombre: str
    employee_ci: Optional[str] = None
    employee_cargo: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    fecha_salida: str
    motivo: str
    salario_base: float
    dias_trabajados_mes: Optional[int] = 0
    monto_dias_trabajados: Optional[float] = 0
    vacaciones_monto: Optional[float] = 0
    aguinaldo_proporcional: Optional[float] = 0
    preaviso: Optional[float] = 0
    indemnizacion_legal: Optional[float] = 0
    descuentos_varios: Optional[float] = 0
    total_liquidacion_neta: float
    payment_order_id: Optional[str] = None
    payment_order_numero: Optional[str] = None
    estado: str
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None

