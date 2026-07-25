"""Fleet management models — maintenance, fuel, expenses, checklists."""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer, ForeignKey, Enum as SAEnum, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import enum

from api.src.db import Base


class MaintenanceType(str, enum.Enum):
    oil_change = "oil_change"
    tires = "tires"
    brakes = "brakes"
    battery = "battery"
    transmission = "transmission"
    suspension = "suspension"
    electrical = "electrical"
    ac = "ac"
    general_service = "general_service"
    itv = "itv"
    insurance = "insurance"
    other = "other"


class MaintenanceStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class FuelType(str, enum.Enum):
    gasoline = "gasoline"
    diesel = "diesel"
    ethanol = "ethanol"
    electric = "electric"
    hybrid = "hybrid"
    gnv = "gnv"


class ChecklistCategory(str, enum.Enum):
    pre_trip = "pre_trip"
    post_trip = "post_trip"
    weekly = "weekly"
    monthly = "monthly"


class VehicleMaintenance(Base):
    """Maintenance log for vehicles."""
    __tablename__ = "intelientregas_vehicle_maintenance"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_vehicles.id"), nullable=False)
    tipo = Column(SAEnum(MaintenanceType), nullable=False)
    descripcion = Column(Text)
    status = Column(SAEnum(MaintenanceStatus), default=MaintenanceStatus.scheduled, server_default="scheduled")
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    completed_date = Column(DateTime(timezone=True), nullable=True)
    costo = Column(Float, default=0)
    proveedor = Column(String(200))
    notas = Column(Text)
    odometro_km = Column(Integer)
    proximo_vencimiento_km = Column(Integer)
    proximo_vencimiento_fecha = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class VehicleFuelEntry(Base):
    """Fuel consumption tracking."""
    __tablename__ = "intelientregas_vehicle_fuel"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_vehicles.id"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_drivers.id"), nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    tipo = Column(SAEnum(FuelType), default=FuelType.diesel)
    litros = Column(Float, nullable=False)
    costo_por_litro = Column(Float, default=0)
    costo_total = Column(Float, default=0)
    odometro_km = Column(Integer)
    proveedor = Column(String(200))
    comprobante_url = Column(Text)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VehicleExpense(Base):
    """Other vehicle expenses (tolls, parking, washing, etc.)."""
    __tablename__ = "intelientregas_vehicle_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_vehicles.id"), nullable=False)
    categoria = Column(String(50), nullable=False)
    descripcion = Column(Text)
    monto = Column(Float, default=0)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    comprobante_url = Column(Text)
    proveedor = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VehicleChecklistItem(Base):
    """Checklist templates for vehicle inspections."""
    __tablename__ = "intelientregas_checklist_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    nombre = Column(String(200), nullable=False)
    categoria = Column(SAEnum(ChecklistCategory), default=ChecklistCategory.pre_trip)
    obligatorio = Column(Boolean, default=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VehicleChecklistLog(Base):
    """Completed checklists."""
    __tablename__ = "intelientregas_checklist_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_vehicles.id"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("intelientregas_drivers.id"), nullable=False)
    results = Column(JSONB, comment='{"item_id": true/false, ...}')
    observaciones = Column(Text)
    aprobado = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
