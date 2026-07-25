"""Distribuidora — Models for import, customer agreements, sales routes, credit."""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, Date, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


# ═══════════════════════════════════════════════════════════════
# 0. ACUERDOS COMERCIALES CON PROVEEDORES
# ═══════════════════════════════════════════════════════════════

class SupplierAgreement(Base):
    """Commercial agreement with a supplier (pricing, volume discounts, bonuses)."""
    __tablename__ = "dist_supplier_agreements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    numero = Column(String(30), nullable=False)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(30), nullable=False, server_default="compra")
    # compra, descuento_volumen, bonificacion, promocion, contrato_exclusividad

    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    renovacion_automatica = Column(Boolean, server_default="false")

    descuento_general_pct = Column(Numeric(5, 2), server_default="0")
    bono_volumen_pct = Column(Numeric(5, 2), server_default="0", comment="Bonificación por volumen")
    dias_credito = Column(Integer, server_default="0")
    moneda = Column(String(3), server_default="PYG")

    estado = Column(String(20), nullable=False, server_default="borrador")
    # borrador, activo, vencido, rescindido

    condiciones = Column(Text)
    archivo_url = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("SupplierAgreementItem", back_populates="agreement", cascade="all, delete-orphan")


class SupplierAgreementItem(Base):
    """Product-specific pricing within a supplier agreement."""
    __tablename__ = "dist_supplier_agreement_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    agreement_id = Column(UUID(as_uuid=True), ForeignKey("dist_supplier_agreements.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    precio_especial = Column(Numeric(15, 2))
    descuento_pct = Column(Numeric(5, 2), server_default="0")
    cantidad_minima = Column(Numeric(12, 3), server_default="0")
    bono_pct = Column(Numeric(5, 2), server_default="0", comment="Bonificación por producto")
    precio_lista_referencia = Column(Numeric(15, 2))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    agreement = relationship("SupplierAgreement", back_populates="items")


# ═══════════════════════════════════════════════════════════════
# 0b. APROBACIÓN DE ÓRDENES DE COMPRA
# ═══════════════════════════════════════════════════════════════

class POApprovalConfig(Base):
    """Approval rules for purchase orders per company."""
    __tablename__ = "dist_po_approval_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True, unique=True)

    requiere_aprobacion = Column(Boolean, server_default="true")
    monto_maximo_sin_aprobacion = Column(Numeric(15, 2), server_default="0")
    niveles_aprobacion = Column(Integer, server_default="1", comment="1 o 2 niveles")
    aprobadores_nivel1 = Column(JSON, comment="[user_id, ...]")
    aprobadores_nivel2 = Column(JSON, comment="[user_id, ...]")
    monto_maximo_nivel1 = Column(Numeric(15, 2), server_default="0")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class POApproval(Base):
    """Approval record for a purchase order."""
    __tablename__ = "dist_po_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    purchase_order_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    nivel = Column(Integer, nullable=False, default=1)
    estado = Column(String(20), nullable=False, server_default="pendiente")
    # pendiente, aprobado, rechazado

    aprobador_id = Column(UUID(as_uuid=True), nullable=False)
    fecha_decision = Column(DateTime(timezone=True))
    motivo_rechazo = Column(Text)
    comentarios = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════
# 1. IMPORTACIÓN — Contenedores, costos landed
# ═══════════════════════════════════════════════════════════════

class ImportContainer(Base):
    """Container/shipment tracking for imported goods."""
    __tablename__ = "import_containers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    purchase_order_id = Column(UUID(as_uuid=True), index=True, comment="Purchase order linked to this container")

    numero_contenedor = Column(String(30), nullable=False)
    booking = Column(String(50))
    viaje = Column(String(50))
    conocimiento_embarque = Column(String(50))

    puerto_origen = Column(String(100), nullable=False)
    puerto_destino = Column(String(100), nullable=False)
    incoterm = Column(String(10), nullable=False, server_default="FOB")

    fecha_zarpe = Column(Date)
    fecha_llegada = Column(Date)
    fecha_estiba = Column(Date)
    fecha_nacionalizacion = Column(Date)

    estado = Column(String(20), nullable=False, server_default="en_transito")
    # en_transito, en_aduanas, nacionalizado, en_almacen, distribuido

    proveedor_transporte = Column(String(200))
    agente_aduanero = Column(String(200))
    referencia_aduana = Column(String(100))

    moneda_origen = Column(String(3), server_default="USD")
    tipo_cambio = Column(Numeric(12, 4), server_default="1")

    # Cost summary
    valor_fob_total = Column(Numeric(15, 2), server_default="0")
    flete_total = Column(Numeric(15, 2), server_default="0")
    seguro_total = Column(Numeric(15, 2), server_default="0")
    arancel_total = Column(Numeric(15, 2), server_default="0")
    desaduanamiento_total = Column(Numeric(15, 2), server_default="0")
    almacenaje_total = Column(Numeric(15, 2), server_default="0")
    transporte_local_total = Column(Numeric(15, 2), server_default="0")
    otros_costos = Column(JSON, comment="[{concepto, monto, moneda}]")
    otros_costos_total = Column(Numeric(15, 2), server_default="0")
    costo_landed_total = Column(Numeric(15, 2), server_default="0")

    factura_proveedor_url = Column(Text)
    documentos_url = Column(JSON)

    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("ImportItem", back_populates="container", cascade="all, delete-orphan")


class ImportItem(Base):
    """Products within an import container with cost allocation."""
    __tablename__ = "import_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    container_id = Column(UUID(as_uuid=True), ForeignKey("import_containers.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    purchase_order_item_id = Column(UUID(as_uuid=True), index=True, comment="Linked PO item for reconciliation")

    cantidad = Column(Numeric(12, 3), nullable=False)
    unidad_medida = Column(String(10), server_default="UN")

    # Costs in origin currency
    precio_unitario_fob = Column(Numeric(15, 4), nullable=False)
    costo_unitario_flete = Column(Numeric(15, 4), server_default="0")
    costo_unitario_seguro = Column(Numeric(15, 4), server_default="0")

    # Costs in local currency (Gs)
    costo_unitario_arancel = Column(Numeric(15, 2), server_default="0")
    costo_unitario_desaduanamiento = Column(Numeric(15, 2), server_default="0")
    costo_unitario_almacenaje = Column(Numeric(15, 2), server_default="0")
    costo_unitario_transporte_local = Column(Numeric(15, 2), server_default="0")
    costo_unitario_otros = Column(Numeric(15, 2), server_default="0")

    costo_unitario_landed = Column(Numeric(15, 2), server_default="0")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    container = relationship("ImportContainer", back_populates="items")


# ═══════════════════════════════════════════════════════════════
# 2. ACUERDOS COMERCIALES CON CLIENTES
# ═══════════════════════════════════════════════════════════════

class CustomerAgreement(Base):
    """Commercial agreement with a customer (pricing, terms, discounts)."""
    __tablename__ = "customer_agreements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    numero = Column(String(30), nullable=False)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(30), nullable=False)
    # precio_especial, descuento_volumen, bonificacion, promocion, contrato

    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    renovacion_automatica = Column(Boolean, server_default="false")

    descuento_general_pct = Column(Numeric(5, 2), server_default="0")
    plazo_pago_dias = Column(Integer, server_default="0")
    limite_credito = Column(Numeric(15, 0), server_default="0")
    moneda = Column(String(3), server_default="PYG")

    estado = Column(String(20), nullable=False, server_default="borrador")
    # borrador, activo, vencido, rescindido

    observaciones = Column(Text)
    archivo_url = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("CustomerAgreementItem", back_populates="agreement", cascade="all, delete-orphan")


class CustomerAgreementItem(Base):
    """Product-specific pricing within a customer agreement."""
    __tablename__ = "customer_agreement_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    agreement_id = Column(UUID(as_uuid=True), ForeignKey("customer_agreements.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    precio_especial = Column(Numeric(15, 2))
    descuento_pct = Column(Numeric(5, 2), server_default="0")
    cantidad_minima = Column(Numeric(12, 3), server_default="0")
    precio_lista_referencia = Column(Numeric(15, 2))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    agreement = relationship("CustomerAgreement", back_populates="items")


# ═══════════════════════════════════════════════════════════════
# 3. RUTEO DE VENTA — Rutas, visitas, pedidos en ruta
# ═══════════════════════════════════════════════════════════════

class SalesRoute(Base):
    """Sales route for field sales reps."""
    __tablename__ = "sales_routes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    codigo = Column(String(20))
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # Sales rep assigned to this route

    dias_semana = Column(JSON, comment="[1,3,5] for Monday, Wednesday, Friday")
    zona = Column(String(100))
    estado = Column(String(20), nullable=False, server_default="activo")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customers = relationship("RouteCustomer", back_populates="route", cascade="all, delete-orphan")
    visits = relationship("RouteVisit", back_populates="route", cascade="all, delete-orphan")


class RouteCustomer(Base):
    """Customer assigned to a sales route with visit order."""
    __tablename__ = "route_customers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_id = Column(UUID(as_uuid=True), ForeignKey("sales_routes.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    orden_visita = Column(Integer, server_default="0")
    dia_semana = Column(Integer, comment="Day of week (0=Sun, 1=Mon, ...)")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    route = relationship("SalesRoute", back_populates="customers")


class RouteVisit(Base):
    """Record of a sales visit to a customer."""
    __tablename__ = "route_visits"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_id = Column(UUID(as_uuid=True), ForeignKey("sales_routes.id"), nullable=False, index=True)
    route_customer_id = Column(UUID(as_uuid=True), ForeignKey("route_customers.id"))
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    fecha_planificada = Column(Date, nullable=False)
    fecha_visita = Column(DateTime(timezone=True))
    latitud = Column(Numeric(10, 7))
    longitud = Column(Numeric(10, 7))

    estado = Column(String(20), nullable=False, server_default="pendiente")
    # pendiente, visitado, no_encontrado, cancelado

    resultado = Column(String(30))
    # pedido_tomado, cobranza_realizada, entrega, seguimiento, sin_novedad

    monto_cobrado = Column(Numeric(15, 2), server_default="0")
    notas = Column(Text)
    fotos_url = Column(JSON)
    firma_url = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    route = relationship("SalesRoute", back_populates="visits")


# ═══════════════════════════════════════════════════════════════
# 4. GESTIÓN DE CRÉDITO — Límites, scoring, autorizaciones
# ═══════════════════════════════════════════════════════════════

class CustomerCreditLimit(Base):
    """Credit limit and scoring per customer."""
    __tablename__ = "customer_credit_limits"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True, unique=True)

    limite_credito = Column(Numeric(15, 0), nullable=False, server_default="0")
    limite_disponible = Column(Numeric(15, 0), server_default="0")
    saldo_utilizado = Column(Numeric(15, 0), server_default="0")
    dias_credito = Column(Integer, server_default="0")
    scoring = Column(Integer, comment="0-100 credit score")

    bloqueado_por_mora = Column(Boolean, server_default="false")
    dias_mora_maximo = Column(Integer, server_default="0")
    fecha_ultima_mora = Column(Date)
    motivo_bloqueo = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CreditAuthorization(Base):
    """Extra credit authorization requests."""
    __tablename__ = "credit_authorizations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    monto_solicitado = Column(Numeric(15, 2), nullable=False)
    monto_autorizado = Column(Numeric(15, 2))
    motivo = Column(Text)
    autorizado_por = Column(UUID(as_uuid=True))
    estado = Column(String(20), nullable=False, server_default="pendiente")
    # pendiente, aprobado, rechazado

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
