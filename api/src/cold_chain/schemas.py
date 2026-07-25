from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class SensorCreate(BaseModel):
    name: str
    container_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    mac_address: Optional[str] = None
    sensor_type: str = "dht22"
    location_type: str = "warehouse"
    location_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    min_temp: float = -2.0
    max_temp: float = 8.0
    max_humidity: Optional[float] = None


class SensorOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    container_id: Optional[uuid.UUID]
    vehicle_id: Optional[uuid.UUID]
    name: str
    mac_address: Optional[str]
    sensor_type: str
    location_type: str
    location_name: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    min_temp: float
    max_temp: float
    max_humidity: Optional[float]
    is_active: bool
    last_temperature: Optional[float]
    last_humidity: Optional[float]
    last_reading_at: Optional[datetime]
    battery_level: Optional[int]
    signal_strength: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReadingIn(BaseModel):
    sensor_id: str
    temperature: float
    humidity: Optional[float] = None
    battery: Optional[int] = None
    signal_strength: Optional[int] = None
    read_at: Optional[datetime] = None


class ReadingOut(BaseModel):
    id: uuid.UUID
    sensor_id: uuid.UUID
    company_id: uuid.UUID
    temperature: float
    humidity: Optional[float]
    battery: Optional[int]
    signal_strength: Optional[int]
    read_at: datetime
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: uuid.UUID
    sensor_id: uuid.UUID
    company_id: uuid.UUID
    alert_type: str
    severity: str
    temperature: Optional[float]
    threshold_min: Optional[float]
    threshold_max: Optional[float]
    message: str
    is_resolved: bool
    resolved_at: Optional[datetime]
    whatsapp_notified: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ComplianceLogOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    sensor_id: Optional[uuid.UUID]
    container_id: Optional[uuid.UUID]
    product_name: Optional[str]
    batch_number: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    min_temp: Optional[float]
    max_temp: Optional[float]
    avg_temp: Optional[float]
    temp_violations: int
    total_readings: int
    compliant: bool
    report_generated: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ColdChainDashboard(BaseModel):
    total_sensors: int
    active_sensors: int
    offline_sensors: int
    total_alerts: int
    unresolved_alerts: int
    current_readings: list[dict]
    recent_alerts: list[AlertOut]
    sensor_status_summary: list[dict]
    compliance_rate: Optional[float]
