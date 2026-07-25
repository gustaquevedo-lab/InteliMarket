"""Notifications models"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Time, Text, text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func

from api.src.db import Base


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    title_template = Column(String(500), nullable=False)
    body_template = Column(Text, nullable=False)
    tipo = Column(String(50), nullable=False, index=True)
    canales = Column(ARRAY(String), server_default=text("ARRAY['in_app']"))
    activo = Column(Boolean, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserNotificationPreference(Base):
    __tablename__ = "user_notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    canal = Column(String(20), nullable=False)
    tipo = Column(String(50), nullable=False)
    habilitado = Column(Boolean, server_default=text("true"))
    horario_inicio = Column(Time, nullable=True)
    horario_fin = Column(Time, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    tipo = Column(String(50), nullable=False, index=True)
    link = Column(String(500), nullable=True)
    leida = Column(Boolean, server_default=text("false"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)