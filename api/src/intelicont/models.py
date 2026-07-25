"""InteliCont integration models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class InteliContSyncConfig(Base):
    __tablename__ = "intelicont_sync_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    webhook_url = Column(String(500), nullable=False)
    api_key = Column(String(200))
    enabled = Column(Boolean, default=True)
    auto_sync = Column(Boolean, default=False)
    sync_interval_minutes = Column(Integer, default=60)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InteliContEntry(Base):
    __tablename__ = "intelicont_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    fecha = Column(DateTime(timezone=True), nullable=False)
    tipo = Column(String(50), nullable=False)
    descripcion = Column(Text)
    referencia = Column(String(100))
    monto = Column(Numeric(15, 0), nullable=False)
    sync_status = Column(String(20), default="pending")
    sync_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InteliContEntryLine(Base):
    __tablename__ = "intelicont_entry_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    entry_id = Column(UUID(as_uuid=True), ForeignKey("intelicont_entries.id"), nullable=False)
    cuenta = Column(String(20), nullable=False)
    descripcion = Column(String(200))
    debe = Column(Numeric(15, 0), default=0)
    haber = Column(Numeric(15, 0), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
