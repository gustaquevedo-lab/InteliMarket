"""Models for Cupones Sorteo, Clientes Fidelizacion and Ticket Items"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


class CuponCliente(Base):
    __tablename__ = "cupones_clientes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    documento = Column(String(30), nullable=False, index=True)
    nombre = Column(String(255), nullable=False)
    telefono = Column(String(50), nullable=True, index=True)
    direccion = Column(Text, nullable=True)
    barrio = Column(String(100), nullable=True, index=True)
    ciudad = Column(String(100), nullable=False, default="Pedro Juan Caballero", server_default="Pedro Juan Caballero")
    
    # Métricas de consumo acumuladas
    ticket_promedio = Column(Numeric(15, 2), default=0, server_default=text("0"))
    total_gastado = Column(Numeric(15, 2), default=0, server_default=text("0"))
    cantidad_compras = Column(Integer, default=0, server_default=text("0"))
    ultimo_consumo = Column(DateTime(timezone=True), nullable=True)
    
    # Segmentación y Perfilado IA
    segmentos = Column(Text, nullable=True)
    ia_analisis = Column(JSONB, nullable=True)
    activo = Column(Boolean, default=True, server_default=text("true"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tickets = relationship("CuponTicket", back_populates="cliente", cascade="all, delete-orphan")


class CuponTicket(Base):
    __tablename__ = "cupon_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("cupones_clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    campana_id = Column(UUID(as_uuid=True), ForeignKey("sorteo_campanas.id", ondelete="SET NULL"), nullable=True, index=True)
    campana_nombre = Column(String(255), nullable=True)
    sale_id = Column(UUID(as_uuid=True), nullable=True)
    nro_ticket = Column(String(100), nullable=False, index=True)
    cantidad = Column(Integer, default=1, server_default=text("1"), nullable=False)
    monto_compra = Column(Numeric(15, 2), default=0, server_default=text("0"), nullable=False)
    fecha_compra = Column(DateTime(timezone=True), nullable=True)
    fecha_captura = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    usuario_nombre = Column(String(150), nullable=True)
    
    sincronizado = Column(Boolean, default=False, server_default=text("false"), nullable=False)
    whatsapp_enviado = Column(Boolean, default=False, server_default=text("false"), nullable=False)
    whatsapp_status = Column(String(50), default="pendiente", server_default="pendiente")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente = relationship("CuponCliente", back_populates="tickets")
    campana = relationship("SorteoCampana", back_populates="tickets")
    items = relationship("CuponTicketItem", back_populates="ticket", cascade="all, delete-orphan")


class CuponTicketItem(Base):
    __tablename__ = "cupon_ticket_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("cupon_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), nullable=True)
    descripcion = Column(String(300), nullable=False)
    cantidad = Column(Numeric(12, 3), default=1, server_default=text("1"), nullable=False)
    precio_unitario = Column(Numeric(15, 2), default=0, server_default=text("0"), nullable=False)
    total = Column(Numeric(15, 2), default=0, server_default=text("0"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("CuponTicket", back_populates="items")


class SorteoCampana(Base):
    __tablename__ = "sorteo_campanas"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(255), nullable=False)
    codigo = Column(String(50), nullable=True, index=True)
    descripcion = Column(Text, nullable=True)
    patrocinador = Column(String(150), default="Extra Supermercado", server_default="Extra Supermercado", nullable=False)
    premio_destacado = Column(String(255), nullable=True)

    # Reglas de activación
    tipo_trigger = Column(String(50), default="MONTO_GLOBAL", server_default="MONTO_GLOBAL", nullable=False) # MONTO_GLOBAL | PRODUCTOS_ESPECIFICOS | MARCA_PROVEEDOR | CATEGORIA
    criterio_evaluacion = Column(String(50), default="MONTO_ACUMULADO", server_default="MONTO_ACUMULADO", nullable=False) # MONTO_ACUMULADO | CANTIDAD_UNIDADES
    valor_umbral = Column(Numeric(15, 2), default=50000, server_default=text("50000"), nullable=False)
    cupones_por_umbral = Column(Integer, default=1, server_default=text("1"), nullable=False)

    # Filtros de aplicabilidad
    productos_participantes = Column(JSONB, nullable=True, default=list, server_default=text("'[]'::jsonb"))
    marcas_participantes = Column(JSONB, nullable=True, default=list, server_default=text("'[]'::jsonb"))
    categorias_participantes = Column(JSONB, nullable=True, default=list, server_default=text("'[]'::jsonb"))

    fecha_inicio = Column(DateTime(timezone=True), nullable=True)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    activo = Column(Boolean, default=True, server_default=text("true"), nullable=False)

    # Mensajería WhatsApp exclusiva de la campaña
    whatsapp_template = Column(
        Text,
        default="¡Hola *{{nombre}}*! 👋\n\n🎉 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* (Premio: {{premio}}) con tu Ticket *#{{ticket}}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨",
        server_default="¡Hola *{{nombre}}*! 👋\n\n🎉 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* (Premio: {{premio}}) con tu Ticket *#{{ticket}}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨",
        nullable=True
    )
    whatsapp_activo = Column(Boolean, default=True, server_default=text("true"), nullable=False)

    # Textos de Personalización de Ticket Térmico
    ticket_encabezado = Column(String(255), nullable=True, default="EXTRA SUPERMERCADO", server_default="EXTRA SUPERMERCADO")
    ticket_subtitulo = Column(String(255), nullable=True)
    ticket_pie_urna = Column(String(255), nullable=True, default="¡Deposita este cupon en la urna de la sucursal!", server_default="¡Deposita este cupon en la urna de la sucursal!")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tickets = relationship("CuponTicket", back_populates="campana")


class CuponConfig(Base):
    __tablename__ = "cupon_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    monto_por_cupon = Column(Numeric(15, 2), default=50000, server_default=text("50000"), nullable=False)
    sorteo_nombre = Column(String(255), default="Gran Sorteo Aniversario Extra Supermercado", server_default="Gran Sorteo Aniversario Extra Supermercado", nullable=False)
    whatsapp_mensaje_template = Column(
        Text,
        default="¡Hola *{{nombre}}*! 👋\n\n🎉 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* con tu Ticket *#{{ticket}}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨",
        server_default="¡Hola *{{nombre}}*! 👋\n\n🎉 Registramos exitosamente tus *{{cantidad}} cupones* para el *{{sorteo}}* con tu Ticket *#{{ticket}}* en *Extra Supermercado*.\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨",
        nullable=True
    )
    disparo_whatsapp_activo = Column(Boolean, default=True, server_default=text("true"), nullable=False)
    activo = Column(Boolean, default=True, server_default=text("true"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


