from sqlalchemy import Column, String, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from api.src.db import Base


class SupervisorAuthRequest(Base):
    """Solicitud de autorización de supervisor pedida a distancia -- antes
    la única forma de autorizar era que un supervisor tipeara su clave en
    la MISMA caja. Si no había un supervisor físicamente ahí, la acción
    quedaba bloqueada sin ninguna salida. Esto le da a la caja un canal
    para pedir la autorización y a la PWA de supervisora una cola real de
    pedidos pendientes con los que puede intervenir desde el celular."""
    __tablename__ = "supervisor_auth_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # remove_item, clear_cart, decrease_qty, process_return, open_pos_config, assign_terminal
    descripcion = Column(Text, nullable=False)
    monto = Column(String(30))  # texto ya formateado, informativo (ej. "Gs. 45.000"), no se opera con esto
    cajero_id = Column(UUID(as_uuid=True))
    cajero_nombre = Column(String(100))
    caja_nombre = Column(String(60))
    estado = Column(String(20), nullable=False, server_default="pendiente")  # pendiente, aprobado, rechazado, expirado
    resuelto_por = Column(UUID(as_uuid=True))
    resuelto_por_nombre = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resuelto_at = Column(DateTime(timezone=True))
