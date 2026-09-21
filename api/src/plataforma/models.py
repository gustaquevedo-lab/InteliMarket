"""Consola de plataforma: incidencias (estilo Sentry), latidos de cajas,
auditoria de cambios del superadmin y verificaciones de integraciones.

Son tablas de PLATAFORMA (schema public, compartidas): el API de sandbox las
ve por el search_path "sandbox,public" y separa sus datos con `environment`.
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class MonIssue(Base):
    __tablename__ = "mon_issues"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    environment = Column(String(12), nullable=False, server_default="production")
    fingerprint = Column(String(64), nullable=False)
    source = Column(String(16), nullable=False)          # backend | frontend | electron | integration
    level = Column(String(10), nullable=False, server_default="error")  # fatal | error | warning | info
    title = Column(String(300), nullable=False)
    culprit = Column(String(300))
    provider = Column(String(40))
    status = Column(String(12), nullable=False, server_default="unresolved")  # unresolved | resolved | ignored
    first_seen = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    occurrences = Column(Integer, nullable=False, server_default="1")
    regressions = Column(Integer, nullable=False, server_default="0")
    first_release = Column(String(60))
    last_release = Column(String(60))
    resolved_at = Column(DateTime(timezone=True))
    resolved_release = Column(String(60))
    resolved_by = Column(String(120))
    ignored_until = Column(DateTime(timezone=True))
    last_alert_at = Column(DateTime(timezone=True))
    spike_alert_at = Column(DateTime(timezone=True))
    note = Column(Text)
    dims = Column(JSONB, nullable=False, server_default="{}")  # {"cajas": {"CAJA3": 12}, "users": {...}, "releases": {...}, "routes": {...}}

    __table_args__ = (
        UniqueConstraint("environment", "fingerprint", name="uq_mon_issue_fp"),
        Index("ix_mon_issues_status_last", "status", "last_seen"),
        Index("ix_mon_issues_source", "source"),
        Index("ix_mon_issues_provider", "provider"),
    )


class MonEvent(Base):
    __tablename__ = "mon_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    issue_id = Column(UUID(as_uuid=True), ForeignKey("mon_issues.id", ondelete="CASCADE"), nullable=False)
    ts = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    level = Column(String(10), nullable=False, server_default="error")
    message = Column(Text)
    stack = Column(Text)
    request_id = Column(String(16))
    route = Column(String(300))
    http_method = Column(String(8))
    http_status = Column(Integer)
    duration_ms = Column(Integer)
    user_id = Column(String(40))
    user_name = Column(String(120))
    rol = Column(String(40))
    hostname = Column(String(80))
    punto_emision = Column(String(10))
    release = Column(String(60))
    app_version = Column(String(40))
    url = Column(String(500))
    client_ip = Column(String(45))
    user_agent = Column(String(300))
    breadcrumbs = Column(JSONB)
    extra = Column(JSONB)

    __table_args__ = (
        Index("ix_mon_events_issue_ts", "issue_id", "ts"),
        Index("ix_mon_events_ts", "ts"),
    )


class MonIssueHourly(Base):
    """Contador por hora: permite graficar la historia real aunque los eventos viejos se purguen."""
    __tablename__ = "mon_issue_hourly"

    issue_id = Column(UUID(as_uuid=True), ForeignKey("mon_issues.id", ondelete="CASCADE"), primary_key=True)
    bucket = Column(DateTime(timezone=True), primary_key=True)
    count = Column(Integer, nullable=False, server_default="0")


class MonHeartbeat(Base):
    """Ultimo latido de cada maquina/sesion: base de "Cajas y terminales"."""
    __tablename__ = "mon_heartbeats"

    key = Column(String(120), primary_key=True)  # hostname de la caja, o web:<user_id>
    kind = Column(String(10), nullable=False, server_default="web")  # caja | web
    environment = Column(String(12), nullable=False, server_default="production")
    hostname = Column(String(80))
    punto_emision = Column(String(10))
    user_name = Column(String(120))
    rol = Column(String(40))
    release = Column(String(60))
    app_version = Column(String(40))
    electron_version = Column(String(40))
    capabilities = Column(JSONB)
    url = Column(String(500))
    client_ip = Column(String(45))
    user_agent = Column(String(300))
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    meta = Column(JSONB)


class PlatformAudit(Base):
    __tablename__ = "platform_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    ts = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    actor_id = Column(String(40))
    actor_name = Column(String(120))
    action = Column(String(60), nullable=False)
    target_type = Column(String(40))
    target_id = Column(String(80))
    target_label = Column(String(160))
    company_id = Column(UUID(as_uuid=True))
    before = Column(JSONB)
    after = Column(JSONB)
    client_ip = Column(String(45))

    __table_args__ = (Index("ix_platform_audit_ts", "ts"),)


class IntegrationCheck(Base):
    __tablename__ = "integration_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    ts = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    company_id = Column(UUID(as_uuid=True))
    provider = Column(String(40), nullable=False)
    environment = Column(String(12))
    ok = Column(Boolean, nullable=False)
    latency_ms = Column(Integer)
    detail = Column(Text)
    actor = Column(String(120))
    meta = Column(JSONB)

    __table_args__ = (Index("ix_integration_checks_prov_ts", "provider", "ts"),)


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String(60), primary_key=True)
    value = Column(JSONB)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
