"""Modelos SQLAlchemy para Actividades de Proveedor"""

from sqlalchemy import (
    Column, String, Integer, Boolean, Date, DateTime, Numeric, Text, ForeignKey,
    UniqueConstraint, text
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from api.src.db import Base


class Actividad(Base):
    """Actividades y acuerdos comerciales con proveedores (promociones, bonificaciones, escalas)."""
    __tablename__ = "actividades"
    __table_args__ = (
        UniqueConstraint("company_id", "legacy_id", name="uq_actividades_company_legacy"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    legacy_id = Column(Integer, nullable=True, index=True)
    nombre = Column(String(255), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    ciclo = Column(String(6), nullable=False, index=True)  # AAAAMM
    vigente_desde = Column(Date, nullable=False)
    vigente_hasta = Column(Date, nullable=False)
    tipo = Column(String(20), nullable=False)  # escala | bonificacion
    alcance = Column(String(20), nullable=False)  # productos | proveedor | division
    alcance_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False, server_default=text("'{}'::uuid[]"))
    presupuesto = Column(Numeric(15, 0), nullable=False, default=0)
    consumido = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    valoriza_bonificacion = Column(String(20), nullable=False, default="lista", server_default=text("'lista'"))  # lista | costo
    cuenta_contable = Column(Text, nullable=True)
    activa = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tramos = relationship("ActividadTramo", back_populates="actividad", cascade="all, delete-orphan")
    aplicaciones = relationship("ActividadAplicacion", back_populates="actividad")


class ActividadTramo(Base):
    """Tramos escalonados o requisitos de bonificación para una actividad."""
    __tablename__ = "actividad_tramos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    actividad_id = Column(UUID(as_uuid=True), ForeignKey("actividades.id", ondelete="CASCADE"), nullable=False, index=True)
    desde_cantidad = Column(Numeric(12, 2), nullable=False)  # en unidades
    porcentaje = Column(Numeric(5, 2), nullable=True)  # para tipo escala
    cada = Column(Numeric(12, 2), nullable=True)  # para tipo bonificacion (ej: cada 10)
    bonifica = Column(Numeric(12, 2), nullable=True)  # para tipo bonificacion (ej: 1 gratis)
    producto_bonificado_id = Column(UUID(as_uuid=True), nullable=True)  # null = mismo producto
    tope = Column(Numeric(12, 2), nullable=True)  # maximo bonificadas por pedido
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actividad = relationship("Actividad", back_populates="tramos")


class ActividadAplicacion(Base):
    """Registro granular de aplicación de una actividad a un ítem de venta."""
    __tablename__ = "actividad_aplicaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    actividad_id = Column(UUID(as_uuid=True), ForeignKey("actividades.id"), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_item_id = Column(UUID(as_uuid=True), nullable=True)
    rendicion_id = Column(UUID(as_uuid=True), ForeignKey("actividad_rendiciones.id", ondelete="SET NULL"), nullable=True, index=True)
    descuento_monto = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    unidades_bonificadas = Column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    valor = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))  # consumo real del presupuesto
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    actividad = relationship("Actividad", back_populates="aplicaciones")
    rendicion = relationship("ActividadRendicion", back_populates="aplicaciones")


class ActividadRendicion(Base):
    """Rendición mensual/cíclica de actividades al proveedor para recupero contable."""
    __tablename__ = "actividad_rendiciones"
    __table_args__ = (
        UniqueConstraint("company_id", "supplier_id", "ciclo", name="uq_actividad_rendiciones_company_supplier_ciclo"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    ciclo = Column(String(6), nullable=False, index=True)  # AAAAMM
    total_descuentos = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    total_bonificaciones = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    total_rendicion = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    monto = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))  # alias legacy para compatibilidad
    cobrado = Column(Numeric(15, 0), nullable=False, default=0, server_default=text("0"))
    estado = Column(String(20), nullable=False, default="abierta", server_default=text("'abierta'"))  # abierta | cerrada | conciliada
    asiento_id = Column(UUID(as_uuid=True), nullable=True)
    asiento_numero = Column(Integer, nullable=True)
    cerrada_por = Column(UUID(as_uuid=True), nullable=True)
    cerrada_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    aplicaciones = relationship("ActividadAplicacion", back_populates="rendicion")
