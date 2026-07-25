from sqlalchemy import Column, String, BigInteger, Boolean, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class Backup(Base):
    __tablename__ = "backups"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    tenant_slug = Column(String(100), nullable=True)
    schema_name = Column(String(100), nullable=False)
    filename = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    backup_type = Column(String(20), nullable=False, default="manual")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))


class BackupScheduleConfig(Base):
    __tablename__ = "backup_schedule_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    frequency = Column(String(20), nullable=False, default="daily")
    hour = Column(Integer, nullable=False, default=2)
    minute = Column(Integer, nullable=False, default=0)
    day_of_week = Column(Integer, nullable=True)
    day_of_month = Column(Integer, nullable=True)
    retention_days = Column(Integer, nullable=False, default=30)
    max_backups = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
