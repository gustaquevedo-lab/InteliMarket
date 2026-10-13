from sqlalchemy import Column, String, Date, DateTime, Numeric, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class DeliveryNote(Base):
    __tablename__ = "delivery_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True)
    numero_nota = Column(String(30), nullable=False)
    numero_factura_ref = Column(String(30), nullable=True)
    fecha = Column(Date(), nullable=False)
    monto = Column(Numeric(15, 0), nullable=False)
    concepto = Column(String(50), nullable=False)
    descripcion = Column(Text(), nullable=True)
    vendedor_id = Column(UUID(as_uuid=True), nullable=True)
    cobrador_id = Column(UUID(as_uuid=True), nullable=True)
    estado = Column(String(20), nullable=False, default="pendiente")
    aplicada_en_cobro_id = Column(UUID(as_uuid=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_delivery_notes_company_b", "company_id"),
        Index("ix_delivery_notes_customer_b", "customer_id"),
    )
