"""POS terminal transactions -- registro completo de cada respuesta real del
terminal Bancard (aprobada, rechazada, o cargada manualmente por falla de
conexion), pensado para segmentacion de clientes ademas de auditoria de caja."""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class PosTerminalTransaction(Base):
    __tablename__ = "pos_terminal_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    tipo_operacion = Column(String(30), nullable=False)  # venta_contado, venta_debito, venta_credito, venta_qr, venta_qr_pix, venta_qr_hub, venta_qr_arg, venta_canje, venta_billetera, anulacion, manual
    terminal_ip = Column(String(45), nullable=True)
    punto_emision = Column(String(10), nullable=True)
    factura_nro_provisional = Column(String(20), nullable=True)

    bin = Column(String(10), nullable=True)
    nsu = Column(String(10), nullable=True)
    codigo_autorizacion = Column(String(10), nullable=True)
    codigo_comercio = Column(String(15), nullable=True)
    issuer_id = Column(String(5), nullable=True)
    nombre_tarjeta = Column(String(60), nullable=True)
    pan = Column(String(4), nullable=True)
    mensaje_display = Column(String(60), nullable=True)
    nombre_cliente = Column(String(60), nullable=True)
    monto = Column(Numeric(15, 2), nullable=True)
    monto_vuelto = Column(Numeric(15, 2), nullable=True)
    monto_comision = Column(Numeric(15, 2), nullable=True)
    monto_extraccion = Column(Numeric(15, 2), nullable=True)
    saldo = Column(Numeric(15, 2), nullable=True)
    moneda_alt = Column(String(3), nullable=True)  # BRL, ARS -- cuando la respuesta trae montoRs/montoPs
    monto_alt = Column(Numeric(15, 2), nullable=True)

    exitosa = Column(Boolean, nullable=False, default=False)
    verificado_automaticamente = Column(Boolean, nullable=False, default=True)
    error_message = Column(String(200), nullable=True)
    raw_response = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
