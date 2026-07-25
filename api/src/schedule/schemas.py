from pydantic import BaseModel
from typing import Optional
from datetime import datetime, time, date
import uuid


class ShiftTemplateCreate(BaseModel):
    branch_id: Optional[uuid.UUID] = None
    nombre: str
    area: str
    rol: Optional[str] = None
    hora_inicio: str
    hora_fin: str
    days_of_week: Optional[list[int]] = None
    quantity_required: int = 1
    min_break_minutes: int = 60
    is_night_shift: bool = False
    is_holiday: bool = False


class ShiftTemplateResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    nombre: str
    area: str
    rol: Optional[str]
    hora_inicio: str
    hora_fin: str
    days_of_week: Optional[list]
    quantity_required: int
    min_break_minutes: int
    is_night_shift: bool
    is_holiday: bool
    activo: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ShiftPlanCreate(BaseModel):
    branch_id: Optional[uuid.UUID] = None
    template_id: Optional[uuid.UUID] = None
    employee_id: uuid.UUID
    employee_name: Optional[str] = None
    area: str
    rol: Optional[str] = None
    fecha: str
    hora_inicio: str
    hora_fin: str
    is_night_shift: bool = False
    is_holiday: bool = False
    notes: Optional[str] = None


class ShiftPlanResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    template_id: Optional[uuid.UUID]
    employee_id: uuid.UUID
    employee_name: Optional[str]
    area: str
    rol: Optional[str]
    fecha: str
    hora_inicio: str
    hora_fin: str
    is_night_shift: bool
    is_holiday: bool
    notes: Optional[str]
    status: str
    conflict_detected: bool
    conflict_detail: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class TimeClockEntryCreate(BaseModel):
    branch_id: Optional[uuid.UUID] = None
    plan_id: Optional[uuid.UUID] = None
    tipo: str
    source: str = "web"
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    device_id: Optional[str] = None
    notes: Optional[str] = None


class TimeClockEntryResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    employee_id: uuid.UUID
    plan_id: Optional[uuid.UUID]
    tipo: str
    timestamp: Optional[datetime]
    source: str
    latitude: Optional[str]
    longitude: Optional[str]
    device_id: Optional[str]
    notes: Optional[str]
    verified: bool

    class Config:
        from_attributes = True


class ShiftSwapCreate(BaseModel):
    plan_id: uuid.UUID
    receiver_id: uuid.UUID
    reason: Optional[str] = None


class ShiftSwapResponse(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    requester_id: uuid.UUID
    receiver_id: uuid.UUID
    reason: Optional[str]
    status: str
    approved_by: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ShiftCostConfigCreate(BaseModel):
    tipo_hora: str
    factor_pct: float
    descripcion: Optional[str] = None


class ShiftCostConfigResponse(BaseModel):
    id: uuid.UUID
    tipo_hora: str
    factor_pct: float
    descripcion: Optional[str]

    class Config:
        from_attributes = True


class HoursSummaryResponse(BaseModel):
    employee_id: uuid.UUID
    employee_name: Optional[str]
    area: Optional[str]
    total_hours: float
    normal_hours: float
    extra_hours: float
    night_hours: float
    holiday_hours: float
    total_cost: float
    clocked_hours: float
    attendance_pct: float


class ScheduleDashboardResponse(BaseModel):
    total_employees_planned: int
    total_employees_clocked: int
    planned_hours: float
    clocked_hours: float
    extra_hours: float
    night_hours: float
    holiday_hours: float
    total_cost: float
    absent_count: int
    attendance_rate: float
    pending_swaps: int
    by_area: list[dict]
    employee_summaries: list[HoursSummaryResponse]
