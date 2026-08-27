"""Registro de cada transaccion real intentada contra la API de PlugPay
(PIX o credito parcelado Brasil) -- aprobada o no, para conciliacion y
segmentacion de clientes, mismo criterio que pos_terminal_transactions."""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class PlugpayTransaction(Base):
    __tablename__ = "plugpay_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    tipo_operacion = Column(String(30), nullable=False)  # pix, credito_parcelado

    id_transacao = Column(String(30), nullable=True)
    referencia_interna = Column(String(80), nullable=True)

    # PIX
    qr_code_id = Column(String(80), nullable=True)
    qr_code_string_image = Column(String(2000), nullable=True)

    # Credito Parcelado
    value_brl = Column(Numeric(15, 2), nullable=True)
    url_payment_form = Column(String(500), nullable=True)
    numero_cuotas = Column(Integer, nullable=True)

    moneda_origen = Column(String(3), nullable=True)
    monto_origen = Column(Numeric(15, 2), nullable=True)

    exitosa = Column(Boolean, nullable=False, default=False)
    error_message = Column(String(300), nullable=True)
    raw_response = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
