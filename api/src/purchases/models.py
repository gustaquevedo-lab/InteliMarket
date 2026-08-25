"""Purchase models — suppliers, orders, receipts, requisitions, contracts, forecasting, suggestions, budgets"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo_persona = Column(String(20), nullable=False, default="juridica")
    ruc = Column(String(15), index=True)
    ci = Column(String(20))
    razon_social = Column(String(255), nullable=False)
    condicion_iva = Column(String(20))
    direccion = Column(Text)
    ciudad = Column(String(100))
    telefono = Column(String(20))
    email = Column(String(255))
    plazo_pago_dias = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    tipo_proveedor = Column(String(30), default="nacional")
    grupo = Column(String(50))
    categoria_ids = Column(ARRAY(UUID(as_uuid=True)))
    moneda_default = Column(String(3), default="PYG")
    plazo_entrega_promedio = Column(Integer, default=0)
    rating = Column(Numeric(2, 1), default=0)
    notas = Column(Text)
    contacto_nombre = Column(String(100))
    contacto_telefono = Column(String(20))
    contacto_email = Column(String(255))
    banco = Column(String(100))
    cuenta_bancaria = Column(String(50))
    tipo_contribuyente = Column(String(30))
    retencion_irp = Column(Boolean, default=False)
    retencion_iva = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier", primaryjoin="PurchaseOrder.supplier_id == Supplier.id", foreign_keys="PurchaseOrder.supplier_id")
    contracts = relationship("SupplierContract", back_populates="supplier", primaryjoin="SupplierContract.supplier_id == Supplier.id", foreign_keys="SupplierContract.supplier_id")
    evaluations = relationship("SupplierEvaluation", back_populates="supplier", primaryjoin="SupplierEvaluation.supplier_id == Supplier.id", foreign_keys="SupplierEvaluation.supplier_id")
    price_history = relationship("SupplierPriceHistory", back_populates="supplier", primaryjoin="SupplierPriceHistory.supplier_id == Supplier.id", foreign_keys="SupplierPriceHistory.supplier_id")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    fecha_entrega_estimada = Column(Date)
    estado = Column(String(20), nullable=False, default="borrador")
    moneda = Column(String(3), default="PYG")
    tipo_cambio = Column(Numeric(10, 2), default=1)
    subtotal = Column(Numeric(15, 0))
    descuento_total = Column(Numeric(15, 0), default=0)
    iva_10 = Column(Numeric(15, 0), default=0)
    iva_5 = Column(Numeric(15, 0), default=0)
    total = Column(Numeric(15, 0))
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    tipo_compra = Column(String(20), default="local")
    prioridad = Column(String(20), default="normal")
    condiciones_pago = Column(Text)
    dias_validez = Column(Integer, default=30)
    shipping_cost = Column(Numeric(15, 0), default=0)
    insurance_cost = Column(Numeric(15, 0), default=0)
    customs_cost = Column(Numeric(15, 0), default=0)
    otros_costos = Column(Numeric(15, 0), default=0)
    costo_landed_total = Column(Numeric(15, 0), default=0)
    fecha_envio = Column(DateTime(timezone=True))
    fecha_confirmacion_proveedor = Column(DateTime(timezone=True))
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    sugerencia_id = Column(UUID(as_uuid=True))
    seguimiento_numero = Column(String(50))
    created_by_name = Column(String(100))
    updated_by_name = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")
    supplier = relationship("Supplier", back_populates="purchase_orders", primaryjoin="PurchaseOrder.supplier_id == Supplier.id", foreign_keys=[supplier_id])
    receipts = relationship("PurchaseReceipt", back_populates="purchase_order", foreign_keys="[PurchaseReceipt.purchase_order_id]")
    history = relationship("PurchaseOrderHistory", back_populates="purchase_order", primaryjoin="PurchaseOrderHistory.purchase_order_id == PurchaseOrder.id", foreign_keys="PurchaseOrderHistory.purchase_order_id")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad = Column(Numeric(10, 3), nullable=False)
    cantidad_recibida = Column(Numeric(10, 3), default=0)
    precio_unitario = Column(Numeric(15, 0), nullable=False)
    descuento_pct = Column(Numeric(5, 2), default=0)
    iva_tasa = Column(Numeric(5, 2))
    total = Column(Numeric(15, 0), nullable=False)
    costo_unitario_estimado = Column(Numeric(15, 0))
    fecha_entrega_esperada = Column(Date)
    fecha_entrega_real = Column(Date)
    warehouse_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("PurchaseOrder", back_populates="items")


class PurchaseOrderHistory(Base):
    __tablename__ = "purchase_order_history"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    purchase_order_id = Column(UUID(as_uuid=True), nullable=False)
    estado_anterior = Column(String(30))
    estado_nuevo = Column(String(30), nullable=False)
    cambiado_por = Column(UUID(as_uuid=True))
    cambiado_por_nombre = Column(String(100))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    purchase_order = relationship("PurchaseOrder", back_populates="history", primaryjoin="PurchaseOrderHistory.purchase_order_id == PurchaseOrder.id", foreign_keys="PurchaseOrderHistory.purchase_order_id")


class PurchaseReceipt(Base):
    __tablename__ = "purchase_receipts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"))
    supplier_id = Column(UUID(as_uuid=True))
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    total = Column(Numeric(15, 0), nullable=False, default=0)
    proveedor_ref = Column(String(50))
    estado = Column(String(20), default="completado")
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    requiere_revision = Column(Boolean, default=False)
    motivo_revision = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("PurchaseReceiptItem", back_populates="receipt", cascade="all, delete-orphan")
    purchase_order = relationship("PurchaseOrder", back_populates="receipts", foreign_keys=[purchase_order_id])


class PurchaseReceiptItem(Base):
    __tablename__ = "purchase_receipt_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    receipt_id = Column(UUID(as_uuid=True), ForeignKey("purchase_receipts.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    cantidad_ordenada = Column(Numeric(10, 3))
    cantidad_recibida = Column(Numeric(10, 3), nullable=False)
    precio_unitario = Column(Numeric(15, 0))
    costo_unitario = Column(Numeric(15, 0), nullable=False)
    total = Column(Numeric(15, 0))
    batch_id = Column(UUID(as_uuid=True))
    cantidad_rechazada = Column(Numeric(10, 3))
    motivo_rechazo = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    receipt = relationship("PurchaseReceipt", back_populates="items")


class PurchaseRequisition(Base):
    __tablename__ = "purchase_requisitions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    fecha_necesidad = Column(Date)
    departamento = Column(String(100))
    solicitante_id = Column(UUID(as_uuid=True))
    solicitante_nombre = Column(String(100))
    estado = Column(String(30), nullable=False, default="borrador")
    prioridad = Column(String(20), default="normal")
    moneda = Column(String(3), default="PYG")
    subtotal = Column(Numeric(15, 0))
    total = Column(Numeric(15, 0))
    motivo = Column(Text)
    observaciones = Column(Text)
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    purchase_order_id = Column(UUID(as_uuid=True))
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("PurchaseRequisitionItem", back_populates="requisition", cascade="all, delete-orphan")


class PurchaseRequisitionItem(Base):
    __tablename__ = "purchase_requisition_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    requisition_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requisitions.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad_solicitada = Column(Numeric(10, 3), nullable=False)
    cantidad_aprobada = Column(Numeric(10, 3))
    precio_estimado = Column(Numeric(15, 0))
    total_estimado = Column(Numeric(15, 0))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    requisition = relationship("PurchaseRequisition", back_populates="items")


class SupplierContract(Base):
    __tablename__ = "supplier_contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(30), nullable=False, unique=True)
    nombre = Column(String(200))
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    moneda = Column(String(3), default="PYG")
    tipo_cambio_fijo = Column(Numeric(10, 2))
    condiciones_pago = Column(Text)
    plazo_entrega_dias = Column(Integer)
    monto_minimo_mensual = Column(Numeric(15, 0))
    monto_maximo_mensual = Column(Numeric(15, 0))
    activo = Column(Boolean, default=True)
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier", back_populates="contracts", primaryjoin="SupplierContract.supplier_id == Supplier.id", foreign_keys=[supplier_id])
    items = relationship("SupplierContractItem", back_populates="contract", cascade="all, delete-orphan")


class SupplierContractItem(Base):
    __tablename__ = "supplier_contract_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    contract_id = Column(UUID(as_uuid=True), ForeignKey("supplier_contracts.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    precio_acordado = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    cantidad_minima = Column(Numeric(10, 3))
    descuento_pct = Column(Numeric(5, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contract = relationship("SupplierContract", back_populates="items")


class SupplierEvaluation(Base):
    __tablename__ = "supplier_evaluations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    periodo = Column(String(10))
    puntaje_calidad = Column(Numeric(3, 1))
    puntaje_entrega = Column(Numeric(3, 1))
    puntaje_precio = Column(Numeric(3, 1))
    puntaje_atencion = Column(Numeric(3, 1))
    puntaje_total = Column(Numeric(3, 1))
    ordenes_completadas = Column(Integer)
    ordenes_totales = Column(Integer)
    entregas_a_tiempo = Column(Integer)
    entregas_totales = Column(Integer)
    comentarios = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("Supplier", back_populates="evaluations", primaryjoin="SupplierEvaluation.supplier_id == Supplier.id", foreign_keys=[supplier_id])


class SupplierPriceHistory(Base):
    __tablename__ = "supplier_price_history"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    precio = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    purchase_order_id = Column(UUID(as_uuid=True))
    notas = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("Supplier", back_populates="price_history", primaryjoin="SupplierPriceHistory.supplier_id == Supplier.id", foreign_keys=[supplier_id])


class ForecastRule(Base):
    __tablename__ = "forecast_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    activo = Column(Boolean, default=True)
    tipo = Column(String(30), nullable=False)
    product_id = Column(UUID(as_uuid=True))
    categoria_id = Column(UUID(as_uuid=True))
    metodo = Column(String(30), default="promedio_movil")
    dias_historial = Column(Integer, default=90)
    dias_proyeccion = Column(Integer, default=30)
    nivel_servicio = Column(Numeric(3, 1), default=95)
    lead_time_dias = Column(Integer, default=7)
    lead_time_variacion = Column(Integer, default=2)
    stock_seguridad_dias = Column(Integer, default=7)
    multiplo_pedido = Column(Numeric(10, 3), default=1)
    minimo_pedido = Column(Numeric(10, 3))
    maximo_pedido = Column(Numeric(10, 3))
    stock_maximo = Column(Numeric(10, 3))
    stock_minimo = Column(Numeric(10, 3))
    proveedor_preferido_id = Column(UUID(as_uuid=True))
    ultima_ejecucion = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ForecastProjection(Base):
    __tablename__ = "forecast_projections"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    rule_id = Column(UUID(as_uuid=True))
    product_id = Column(UUID(as_uuid=True), nullable=False)
    fecha_proyeccion = Column(Date, nullable=False)
    demanda_pronosticada = Column(Numeric(15, 0))
    demanda_real = Column(Numeric(15, 0))
    confianza = Column(Numeric(3, 1))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PurchaseSuggestion(Base):
    __tablename__ = "purchase_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True))
    supplier_id = Column(UUID(as_uuid=True))
    cantidad_sugerida = Column(Numeric(10, 3), nullable=False)
    precio_estimado = Column(Numeric(15, 0))
    total_estimado = Column(Numeric(15, 0))
    moneda = Column(String(3), default="PYG")
    motivo = Column(String(50), nullable=False)
    detalle = Column(Text)
    urgencia = Column(String(20), default="media")
    confianza = Column(Numeric(3, 1))
    stock_actual = Column(Numeric(10, 3))
    stock_seguridad = Column(Numeric(10, 3))
    demanda_diaria_promedio = Column(Numeric(15, 0))
    dias_cobertura = Column(Integer)
    lead_time_dias = Column(Integer)
    estado = Column(String(20), default="pendiente")
    purchase_order_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PurchaseBudget(Base):
    __tablename__ = "purchase_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    anio = Column(Integer, nullable=False)
    mes = Column(Integer)
    tipo = Column(String(30), default="mensual")
    moneda = Column(String(3), default="PYG")
    monto_presupuestado = Column(Numeric(15, 0), nullable=False)
    monto_ejecutado = Column(Numeric(15, 0), default=0)
    monto_disponible = Column(Numeric(15, 0))
    categoria_id = Column(UUID(as_uuid=True))
    departamento = Column(String(100))
    activo = Column(Boolean, default=True)
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PurchaseRfq(Base):
    __tablename__ = "purchase_rfqs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    requisition_id = Column(UUID(as_uuid=True))
    numero = Column(String(20), nullable=False, unique=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    fecha_limite = Column(Date)
    estado = Column(String(20), nullable=False, default="enviada")  # enviada, evaluando, adjudicada, cancelada
    motivo = Column(Text)
    observaciones = Column(Text)
    ganador_supplier_id = Column(UUID(as_uuid=True))
    purchase_order_id = Column(UUID(as_uuid=True))
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("PurchaseRfqItem", back_populates="rfq", cascade="all, delete-orphan")
    responses = relationship("PurchaseRfqResponse", back_populates="rfq", cascade="all, delete-orphan")


class PurchaseRfqItem(Base):
    __tablename__ = "purchase_rfq_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("purchase_rfqs.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    descripcion = Column(String(300))
    cantidad_solicitada = Column(Numeric(10, 3), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rfq = relationship("PurchaseRfq", back_populates="items")


class PurchaseRfqResponse(Base):
    __tablename__ = "purchase_rfq_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    rfq_id = Column(UUID(as_uuid=True), ForeignKey("purchase_rfqs.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    estado = Column(String(20), nullable=False, default="invitada")  # invitada, respondida, ganadora, descartada
    fecha_respuesta = Column(DateTime(timezone=True))
    plazo_entrega_dias = Column(Integer)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    rfq = relationship("PurchaseRfq", back_populates="responses")
    items = relationship("PurchaseRfqResponseItem", back_populates="response", cascade="all, delete-orphan")


class PurchaseRfqResponseItem(Base):
    __tablename__ = "purchase_rfq_response_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    response_id = Column(UUID(as_uuid=True), ForeignKey("purchase_rfq_responses.id"), nullable=False)
    rfq_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_rfq_items.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    precio_unitario = Column(Numeric(15, 0), nullable=False)
    plazo_entrega_dias = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    response = relationship("PurchaseRfqResponse", back_populates="items")


class CustomerLostDemand(Base):
    __tablename__ = "customer_lost_demands"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_nombre = Column(String(255), nullable=False)
    categoria = Column(String(100))
    marca = Column(String(100))
    notas = Column(Text)
    cliente_nombre = Column(String(255))
    cliente_contacto = Column(String(100))
    cajero_id = Column(UUID(as_uuid=True))
    cajero_nombre = Column(String(255))
    caja_id = Column(String(50))
    estado = Column(String(30), nullable=False, default="PENDIENTE")  # PENDIENTE, EN_EVALUACION, COMPRADO, DESCARTADO
    orden_compra_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
