"""POS terminal assignments — cada máquina física (identificada por su
hostname de Windows, ej. CAJA8) queda fija a un número de caja y un punto de
emisión fiscal. Se configura una sola vez por un administrador y no depende
de quién inicie sesión como cajero."""

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class PosTerminalAssignment(Base):
    __tablename__ = "pos_terminal_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    hostname = Column(String(120), nullable=False, unique=True)
    punto_emision = Column(String(10), nullable=False)
    caja_nombre = Column(String(60), nullable=False)
    activo = Column(Boolean, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
