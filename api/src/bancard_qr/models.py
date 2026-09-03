"""Ventas QR Bancard — QR dinámico mostrado en la pantalla del Electron
(distinto del "QR Zimple" que ya existía, que es el QR que genera el
propio terminal físico Bancard en su pantalla vía electronAPI.bancardCall).
Esta es la integración por API HTTPS directa a Bancard (generate-qr-express
/ revert), con confirmación async por webhook -- ver especificación
"Qr en API de Comercios v1.2 Vuelto QR" (Bancard/GlobalSI, sept 2026)."""

import uuid
from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class BancardQrTransaction(Base):
    __tablename__ = "bancard_qr_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    hook_alias = Column(String(60), nullable=False, unique=True, index=True)
    amount = Column(BigInteger, nullable=False)
    description = Column(String(200))
    qr_url = Column(Text)
    qr_data = Column(Text)
    status = Column(String(20), nullable=False, default="pending")  # pending | confirmed | failed | reverted | error
    response_code = Column(String(10))
    response_description = Column(Text)
    ticket_number = Column(String(40))
    authorization_code = Column(String(40))
    account_type = Column(String(10))
    card_last_numbers = Column(String(10))
    bin = Column(String(20))
    payer_name = Column(String(120))
    payer_lastname = Column(String(120))
    punto_emision = Column(String(10))
    cajero_id = Column(UUID(as_uuid=True))
    reverted = Column(Boolean, default=False, server_default="false")
    raw_callback = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
