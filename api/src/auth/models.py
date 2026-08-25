"""User model"""

from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=False)
    telefono = Column(String(20))
    rol = Column(String(30), nullable=False, default="operador")
    is_superadmin = Column(Boolean, default=False, server_default="false")
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(100))
    activo = Column(Boolean, default=True)
    foto_url = Column(String(500), nullable=True)
    current_session_id = Column(String(64), nullable=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StaffShift(Base):
    """Registro de entrada/salida de cajeros y supervisores en un terminal POS
    (Electron). Distinto de la 'Apertura/Cierre de Turno de Caja' (sesion de
    caja con fondo de efectivo) -- esto es identidad de persona en turno, para
    la lista de login sin tipeo y para exigir que exista un supervisor
    realmente presente antes de autorizar acciones sensibles. Pensado para
    vincularse mas adelante con la marcacion de entrada real de SueldOK."""
    __tablename__ = "staff_shifts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    rol_en_turno = Column(String(30), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
