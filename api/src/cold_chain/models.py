from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, JSON, Float, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class ColdSensor(Base):
    __tablename__ = "cc_sensors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    container_id = Column(UUID(as_uuid=True), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), nullable=True)

    name = Column(String(100), nullable=False)
    mac_address = Column(String(20), nullable=True, unique=True)
    sensor_type = Column(String(20), default="dht22")
    location_type = Column(String(20), default="warehouse")
    location_name = Column(String(100), nullable=True)
    lat = Column(Numeric(10, 7), nullable=True)
    lng = Column(Numeric(10, 7), nullable=True)

    min_temp = Column(Numeric(5, 2), default=-2.0)
    max_temp = Column(Numeric(5, 2), default=8.0)
    max_humidity = Column(Numeric(5, 2), nullable=True)

    is_active = Column(Boolean, default=True)
    last_temperature = Column(Numeric(5, 2), nullable=True)
    last_humidity = Column(Numeric(5, 2), nullable=True)
    last_reading_at = Column(DateTime(timezone=True), nullable=True)
    battery_level = Column(Integer, nullable=True)
    signal_strength = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SensorReading(Base):
    __tablename__ = "cc_sensor_readings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sensor_id = Column(UUID(as_uuid=True), ForeignKey("cc_sensors.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    temperature = Column(Numeric(5, 2), nullable=False)
    humidity = Column(Numeric(5, 2), nullable=True)
    battery = Column(Integer, nullable=True)
    signal_strength = Column(Integer, nullable=True)

    read_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ColdChainAlert(Base):
    __tablename__ = "cc_cold_chain_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sensor_id = Column(UUID(as_uuid=True), ForeignKey("cc_sensors.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    alert_type = Column(String(30), nullable=False)
    severity = Column(String(20), default="warning")
    temperature = Column(Numeric(5, 2), nullable=True)
    threshold_min = Column(Numeric(5, 2), nullable=True)
    threshold_max = Column(Numeric(5, 2), nullable=True)
    message = Column(Text, nullable=False)

    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    whatsapp_notified = Column(Boolean, default=False)
    whatsapp_notified_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ComplianceLog(Base):
    __tablename__ = "cc_compliance_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sensor_id = Column(UUID(as_uuid=True), ForeignKey("cc_sensors.id"), nullable=True)
    container_id = Column(UUID(as_uuid=True), nullable=True)
    product_id = Column(UUID(as_uuid=True), nullable=True)
    product_name = Column(String(200), nullable=True)
    batch_number = Column(String(100), nullable=True)

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    min_temp = Column(Numeric(5, 2), nullable=True)
    max_temp = Column(Numeric(5, 2), nullable=True)
    avg_temp = Column(Numeric(5, 2), nullable=True)
    temp_violations = Column(Integer, default=0)
    total_readings = Column(Integer, default=0)
    compliant = Column(Boolean, default=True)

    report_generated = Column(Boolean, default=False)
    report_url = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
