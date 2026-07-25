"""Fleet management Pydantic schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class MaintenanceCreate(BaseModel):
    vehicle_id: str
    tipo: str = "general_service"
    descripcion: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    costo: float = 0
    proveedor: Optional[str] = None
    notas: Optional[str] = None
    odometro_km: Optional[int] = None
    proximo_vencimiento_km: Optional[int] = None
    proximo_vencimiento_fecha: Optional[datetime] = None


class MaintenanceUpdate(BaseModel):
    status: Optional[str] = None
    descripcion: Optional[str] = None
    completed_date: Optional[datetime] = None
    costo: Optional[float] = None
    proveedor: Optional[str] = None
    notas: Optional[str] = None
    odometro_km: Optional[int] = None


class MaintenanceResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    tipo: str
    descripcion: Optional[str] = None
    status: str
    scheduled_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    costo: float
    proveedor: Optional[str] = None
    notas: Optional[str] = None
    odometro_km: Optional[int] = None
    proximo_vencimiento_km: Optional[int] = None
    proximo_vencimiento_fecha: Optional[datetime] = None
    created_at: datetime


class FuelEntryCreate(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    litros: float
    costo_por_litro: float = 0
    odometro_km: Optional[int] = None
    proveedor: Optional[str] = None
    notas: Optional[str] = None


class FuelEntryResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    driver_id: Optional[UUID] = None
    fecha: datetime
    tipo: str
    litros: float
    costo_por_litro: float
    costo_total: float
    odometro_km: Optional[int] = None
    proveedor: Optional[str] = None
    notas: Optional[str] = None
    created_at: datetime


class ExpenseCreate(BaseModel):
    vehicle_id: str
    categoria: str
    descripcion: Optional[str] = None
    monto: float = 0
    proveedor: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    categoria: str
    descripcion: Optional[str] = None
    monto: float
    fecha: datetime
    proveedor: Optional[str] = None
    created_at: datetime


class ChecklistItemCreate(BaseModel):
    nombre: str
    categoria: str = "pre_trip"
    obligatorio: bool = True


class ChecklistItemResponse(BaseModel):
    id: UUID
    nombre: str
    categoria: str
    obligatorio: bool
    activo: bool


class FleetDashboardResponse(BaseModel):
    total_vehicles: int
    active_vehicles: int
    maintenance_pending: int
    maintenance_overdue: int
    fuel_month_cost: float
    fuel_month_liters: float
    total_expenses: float
