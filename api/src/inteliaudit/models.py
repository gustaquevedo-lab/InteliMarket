"""InteliAudit integration models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class InteliAuditSyncConfig(Base):
    __tablename__ = "inteliaudit_sync_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    webhook_url = Column(String(500), nullable=False)
    api_key = Column(String(200))
    hmac_secret = Column(String(200))
    enabled = Column(Boolean, default=True)
    auto_sync = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
