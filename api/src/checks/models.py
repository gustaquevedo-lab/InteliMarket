"""Checks/pagares (cheques y pagares recibidos de clientes) models.

Registro completo tipo legacy (Credito/selchckcli.asp consolidaba cheques
recibidos, cheques devueltos y pagares desde 3 tablas separadas) — aca vive
todo en una sola tabla con historial de estados en check_events, en vez de
mutar una fila y perder el rastro de la cadena rechazo->reemplazo.
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Text, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class Check(Base):
    __tablename__ = "checks"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    tipo = Column(String(10), nullable=False, default="cheque")  # cheque | pagare
    numero = Column(String(50), nullable=False)
    banco = Column(String(100))  # nulo para pagare
    titular = Column(String(150))
    monto = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), nullable=False, default="PYG")
    fecha_emision = Column(Date)
    fecha_vencimiento = Column(Date, nullable=False, index=True)  # fecha de cobro/pago
    estado = Column(String(20), nullable=False, default="cartera", index=True)
    # cartera | depositado | acreditado | rechazado | reemplazado | endosado
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"))
    accounts_receivable_id = Column(UUID(as_uuid=True))
    reemplaza_check_id = Column(UUID(as_uuid=True), ForeignKey("checks.id"))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CheckEvent(Base):
    __tablename__ = "check_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    check_id = Column(UUID(as_uuid=True), ForeignKey("checks.id"), nullable=False, index=True)
    estado_anterior = Column(String(20))
    estado_nuevo = Column(String(20), nullable=False)
    motivo = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
