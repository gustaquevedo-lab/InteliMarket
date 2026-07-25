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
