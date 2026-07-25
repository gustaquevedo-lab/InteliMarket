import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from api.src.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


class SupplierUser(Base):
    __tablename__ = "supplier_portal_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(200), nullable=False)
    telefono = Column(String(50))
    cargo = Column(String(100))
    activo = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        sa.UniqueConstraint("email", "company_id", name="uq_supplier_user_email_company"),
    )


class SupplierDocument(Base):
    __tablename__ = "supplier_portal_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_user_id = Column(UUID(as_uuid=True), ForeignKey("supplier_portal_users.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # factura, remito, certificado, ficha_tecnica, otro
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    filename = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer)
    purchase_order_id = Column(UUID(as_uuid=True), nullable=True)
    estado = Column(String(20), default="pendiente")  # pendiente, aprobado, rechazado
    rechazado_motivo = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user = relationship("SupplierUser", backref="documents")
