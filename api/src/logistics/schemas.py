"""Logistics schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class DeliveryCreate(BaseModel):
    company_id: uuid.UUID
    sale_id: Optional[uuid.UUID] = None
    customer_id: uuid.UUID
    branch_id: Optional[uuid.UUID] = None
    driver_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    direccion_entrega: str
    coordenadas: Optional[str] = None
    fecha_programada: Optional[datetime] = None
    observaciones: Optional[str] = None


class DeliveryUpdate(BaseModel):
    estado: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    fecha_salida: Optional[datetime] = None
    fecha_entrega: Optional[datetime] = None
    observaciones: Optional[str] = None
    tracking_notes: Optional[str] = None


class DeliveryResponse(BaseModel):
    id: str
    company_id: str
    sale_id: Optional[str]
    customer_id: str
    branch_id: Optional[str]
    driver_name: Optional[str]
    vehicle_plate: Optional[str]
    direccion_entrega: str
    coordenadas: Optional[str]
    estado: str
    fecha_programada: Optional[datetime]
    fecha_salida: Optional[datetime]
    fecha_entrega: Optional[datetime]
    observaciones: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RouteCreate(BaseModel):
    company_id: uuid.UUID
    nombre: str
    descripcion: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    fecha: datetime


class RouteResponse(BaseModel):
    id: str
    company_id: str
    nombre: str
    descripcion: Optional[str]
    driver_name: Optional[str]
    vehicle_plate: Optional[str]
    fecha: datetime
    estado: str
    total_deliveries: int
    completed_deliveries: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RouteStopCreate(BaseModel):
    route_id: uuid.UUID
    delivery_id: uuid.UUID
    orden: int


class RouteStopResponse(BaseModel):
    id: str
    route_id: str
    delivery_id: str
    orden: int
    estado: str
    fecha_llegada: Optional[datetime]
    observaciones: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
