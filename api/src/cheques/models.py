from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class Cheque(Base):
    """Registro estructurado de cheques emitidos a proveedores. Antes de esto,
    'cheque' era solo un texto libre en supplier_invoice_payments.payment_method
    -- sin numero, banco, ni fecha de vencimiento (cheque diferido), a pesar de
    ser el metodo de pago dominante a proveedores en la practica real."""
    __tablename__ = "cheques"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(30), nullable=False)
    # False = numero sintetico generado en el backfill historico (el sistema
    # legado nunca guardo el numero real de cheque) -- true para todo lo
    # cargado de aca en mas, sea a mano o por el sync que recien empieza a
    # estructurar los pagos con cheque en vez de dejarlos como texto libre.
    numero_confiable = Column(Boolean, nullable=False, default=True)
    banco_emisor = Column(String(100))
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"))
    beneficiario = Column(String(200), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), index=True)
    monto = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    fecha_emision = Column(Date, nullable=False)
    fecha_entrega = Column(Date)
    fecha_pago = Column(Date)
    diferido = Column(Boolean, default=False)
    estado = Column(String(20), nullable=False, default="pendiente")
    invoice_payment_id = Column(UUID(as_uuid=True), ForeignKey("supplier_invoice_payments.id"))
    concepto = Column(String(300))
    notas = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    estado_updated_by = Column(UUID(as_uuid=True))
    estado_updated_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    historial = relationship("ChequeHistorial", back_populates="cheque", cascade="all, delete-orphan", order_by="ChequeHistorial.created_at")


class ChequeHistorial(Base):
    """Bitacora inmutable de cambios de estado -- quien, cuando, de que a que
    estado. Un cheque emitido a proveedor pesa mas de ₲10 mil millones en total
    en esta empresa; sin este historial no hay forma de auditar que pasó con
    cada uno."""
    __tablename__ = "cheque_historial"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cheque_id = Column(UUID(as_uuid=True), ForeignKey("cheques.id", ondelete="CASCADE"), nullable=False, index=True)
    estado_anterior = Column(String(20))
    estado_nuevo = Column(String(20), nullable=False)
    user_id = Column(UUID(as_uuid=True))
    user_nombre = Column(String(100))
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cheque = relationship("Cheque", back_populates="historial")
