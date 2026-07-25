"""SueldOK integration models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SueldokSyncConfig(Base):
    __tablename__ = "sueldok_sync_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    api_url = Column(String(500), nullable=False)
    api_key = Column(String(200))
    enabled = Column(Boolean, default=True)
    commission_rate = Column(Numeric(5, 2), default=2.00)
    auto_sync = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
