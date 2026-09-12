"""Inventory models — incluye workflow de doble aprobación (Gerencia + Administración),
audit trail inmutable, toma física con doble conteo ciego."""

import uuid as uuid_module
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from api.src.db import Base


# ---------------------------------------------------------------------------
# Motivos de ajuste con nivel de riesgo (catálogo en código, no en DB)
# ---------------------------------------------------------------------------
MOTIVOS_AJUSTE = {
    "conteo_fisico":        {"label": "Conteo Físico / Toma de Inventario",   "riesgo": "bajo"},
    "merma_vencimiento":    {"label": "Merma por Vencimiento",                 "riesgo": "medio"},
    "merma_rotura":         {"label": "Merma por Rotura / Daño",               "riesgo": "medio"},
    "merma_hurto_interno":  {"label": "Merma por Hurto Interno",               "riesgo": "severo"},
    "merma_hurto_externo":  {"label": "Merma por Hurto Externo / Robo",        "riesgo": "alto"},
    "error_recepcion":      {"label": "Error en Recepción de Mercadería",      "riesgo": "medio"},
    "donacion":             {"label": "Donación / Regalo Institucional",       "riesgo": "medio"},
    "muestra_degustacion":  {"label": "Muestra / Degustación",                "riesgo": "bajo"},
    "correccion_sistema":   {"label": "Corrección de Error de Sistema",        "riesgo": "severo"},
    "ajuste_precio_costo":  {"label": "Revaluación / Ajuste de Costo",         "riesgo": "alto"},
    "devolucion_proveedor": {"label": "Devolución a Proveedor",                "riesgo": "medio"},
    "otro":                 {"label": "Otro (justificación obligatoria)",       "riesgo": "alto"},
}

# Riesgos que requieren evidencia fotográfica/documental obligatoria
RIESGOS_CON_EVIDENCIA = {"alto", "severo"}


# ---------------------------------------------------------------------------
# Depósitos
# ---------------------------------------------------------------------------

class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    branch_id = Column(UUID(as_uuid=True))
    parent_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=True)
    codigo = Column(String(20), nullable=False)
    nombre = Column(String(100), nullable=False)
    direccion = Column(Text)
    tipo = Column(String(30), default="principal")
    responsable = Column(String(100))
    descripcion = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship("Warehouse", remote_side=[id], backref="subdepositos", lazy="selectin")


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------

class Stock(Base):
    __tablename__ = "stock"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    cantidad = Column(Integer, nullable=False, default=0)
    cantidad_reservada = Column(Integer, nullable=False, default=0)
    costo_unitario = Column(Numeric(15, 0))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StockLot(Base):
    __tablename__ = "stock_lots"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True))
    cantidad = Column(Integer, nullable=False, default=0)
    cantidad_disponible = Column(Integer, nullable=False, default=0)
    costo_unitario = Column(Numeric(15, 0), nullable=False)
    costo_total = Column(Numeric(18, 0), nullable=False)
    referencia = Column(String(100))
    fecha_ingreso = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_vencimiento = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Movimientos de inventario (Kardex)
# ---------------------------------------------------------------------------

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    tipo = Column(String(30), nullable=False)
    cantidad = Column(Integer, nullable=False)
    costo_unitario = Column(Numeric(15, 0))
    referencia_type = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    motivo = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Transferencias entre depósitos
# ---------------------------------------------------------------------------

class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    codigo = Column(String(20), nullable=False, unique=True)
    warehouse_origen_id = Column(UUID(as_uuid=True), nullable=False)
    warehouse_destino_id = Column(UUID(as_uuid=True), nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")
    fecha_envio = Column(DateTime(timezone=True))
    fecha_recepcion = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    user_id_envio = Column(UUID(as_uuid=True))
    user_id_recepcion = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    transfer_id = Column(UUID(as_uuid=True), ForeignKey("stock_transfers.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    cantidad_enviada = Column(Integer, nullable=False)
    cantidad_recibida = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transfer = relationship("StockTransfer")


# ---------------------------------------------------------------------------
# Ajustes de Stock — workflow de doble aprobación
# ---------------------------------------------------------------------------
# Estados posibles:
#   borrador → pendiente_gerencia → pendiente_administracion → aprobado
#                                                             → rechazado
# ---------------------------------------------------------------------------

class InventoryAdjustment(Base):
    """Ajuste de stock con doble aprobación obligatoria (Gerencia + Administración).
    
    El ajuste sólo impacta el stock real cuando pasa a estado='aprobado'.
    Cualquier rechazo en cualquier etapa es irreversible.
    """
    __tablename__ = "inventory_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    codigo = Column(String(30), nullable=False, unique=True)

    # Motivo estructurado (del catálogo MOTIVOS_AJUSTE) + detalle libre obligatorio
    motivo_codigo = Column(String(50), nullable=False)   # clave del catálogo
    motivo_label = Column(String(120))                    # desnormalizado para queries
    motivo_detalle = Column(Text, nullable=False)         # justificación, min 20 chars
    riesgo = Column(String(10), nullable=False, default="bajo")  # bajo|medio|alto|severo

    # Campo legado — se mantiene para compatibilidad con movimientos históricos
    motivo = Column(String(120))

    # Estado del workflow
    # borrador: creado, aún no enviado a aprobación
    # pendiente_gerencia: esperando firma de Gerencia
    # pendiente_administracion: Gerencia aprobó, esperando Administración
    # aprobado: ambas firmas otorgadas, stock actualizado
    # rechazado: rechazado en cualquier etapa
    estado = Column(String(30), nullable=False, default="pendiente_gerencia", index=True)

    # Impacto financiero calculado al crear
    impacto_financiero_gs = Column(Numeric(18, 0), nullable=False, default=0)

    # Evidencia (URLs de archivos en storage — obligatorio para riesgo alto/severo)
    evidencia_urls = Column(JSON, nullable=True)  # list[str]

    # Firma 1: Gerencia
    aprobado_por_gerencia = Column(UUID(as_uuid=True))
    aprobado_por_gerencia_nombre = Column(String(120))
    fecha_aprobacion_gerencia = Column(DateTime(timezone=True))
    comentario_gerencia = Column(Text)

    # Firma 2: Administración
    aprobado_por_administracion = Column(UUID(as_uuid=True))
    aprobado_por_administracion_nombre = Column(String(120))
    fecha_aprobacion_administracion = Column(DateTime(timezone=True))
    comentario_administracion = Column(Text)

    # Rechazo (cualquier etapa)
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_por_nombre = Column(String(120))
    motivo_rechazo = Column(Text)
    fecha_rechazo = Column(DateTime(timezone=True))

    # Quién creó el ajuste
    user_id = Column(UUID(as_uuid=True))

    # Campos legado — se mantienen para compatibilidad
    observaciones = Column(Text)
    aprobado_por = Column(UUID(as_uuid=True))
    fecha_aprobacion = Column(DateTime(timezone=True))

    # Referencia a sesión de toma física, si el ajuste proviene de una
    physical_session_id = Column(UUID(as_uuid=True), ForeignKey("physical_inventory_sessions.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("InventoryAdjustmentItem", back_populates="adjustment", lazy="selectin")
    audit_logs = relationship("StockAdjustmentAuditLog", back_populates="adjustment", lazy="selectin",
                              order_by="StockAdjustmentAuditLog.created_at")


class InventoryAdjustmentItem(Base):
    __tablename__ = "inventory_adjustment_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    adjustment_id = Column(UUID(as_uuid=True), ForeignKey("inventory_adjustments.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    variant_id = Column(UUID(as_uuid=True))
    product_nombre = Column(String(200))  # desnormalizado
    product_sku = Column(String(60))      # desnormalizado
    cantidad_sistema = Column(Numeric(15, 3), nullable=False)
    cantidad_fisica = Column(Numeric(15, 3), nullable=False)
    diferencia = Column(Numeric(15, 3), nullable=False)
    costo_unitario = Column(Numeric(15, 0))
    impacto_gs = Column(Numeric(18, 0))   # diferencia * costo_unitario
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    adjustment = relationship("InventoryAdjustment", back_populates="items")


# ---------------------------------------------------------------------------
# Audit Trail inmutable de ajustes
# ---------------------------------------------------------------------------

class StockAdjustmentAuditLog(Base):
    """Registro inmutable de cada acción sobre un ajuste de stock.
    
    Nunca se borra ni se modifica. Sólo INSERT.
    """
    __tablename__ = "stock_adjustment_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    adjustment_id = Column(UUID(as_uuid=True), ForeignKey("inventory_adjustments.id"), nullable=False, index=True)

    # Acción: creado | enviado_aprobacion | aprobado_gerencia | aprobado_administracion | rechazado | ejecutado
    accion = Column(String(40), nullable=False)

    user_id = Column(UUID(as_uuid=True), nullable=False)
    user_nombre = Column(String(120))
    rol_firmante = Column(String(40))    # gerencia | administracion | creador | sistema
    comentario = Column(Text)
    ip_address = Column(String(50))
    metadata_extra = Column(JSON)        # datos adicionales según acción

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    adjustment = relationship("InventoryAdjustment", back_populates="audit_logs")


# ---------------------------------------------------------------------------
# Toma Física de Inventario
# ---------------------------------------------------------------------------

class PhysicalInventorySession(Base):
    """Sesión de toma física (conteo de inventario).
    
    Soporta doble conteo ciego: dos operarios cuentan independientemente.
    Al cerrar, genera automáticamente un InventoryAdjustment con las diferencias.
    """
    __tablename__ = "physical_inventory_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    warehouse_id = Column(UUID(as_uuid=True), nullable=False)
    codigo = Column(String(30), nullable=False, unique=True)

    # Tipo: total (todo el depósito) | parcial (por categoría/pasillo) | ciclico (por rotation)
    tipo = Column(String(20), nullable=False, default="total")

    # Alcance opcional (para tomas parciales)
    categoria_id = Column(UUID(as_uuid=True))
    pasillo = Column(String(50))
    descripcion_alcance = Column(Text)

    # Estado: abierta | en_conteo | cerrada | cancelada
    estado = Column(String(20), nullable=False, default="abierta", index=True)

    # Observaciones y notas
    notas = Column(Text)

    # Quién creó la sesión
    creado_por = Column(UUID(as_uuid=True))
    creado_por_nombre = Column(String(120))

    # Contador 1 (primer conteo)
    contador_1_id = Column(UUID(as_uuid=True))
    contador_1_nombre = Column(String(120))

    # Contador 2 (doble ciego — cuenta sin ver resultados de contador 1)
    contador_2_id = Column(UUID(as_uuid=True))
    contador_2_nombre = Column(String(120))

    # Supervisor que cierra y autoriza
    cerrado_por = Column(UUID(as_uuid=True))
    cerrado_por_nombre = Column(String(120))

    # Totales de resultado
    total_items = Column(Integer, default=0)
    items_con_diferencia = Column(Integer, default=0)
    diferencia_total_unidades = Column(Numeric(15, 3), default=0)
    diferencia_total_gs = Column(Numeric(18, 0), default=0)

    # Referencia al ajuste generado al cerrar
    adjustment_id = Column(UUID(as_uuid=True), ForeignKey("inventory_adjustments.id"), nullable=True)

    fecha_inicio = Column(DateTime(timezone=True))
    fecha_cierre = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("PhysicalInventorySessionItem", back_populates="session", lazy="selectin")


class PhysicalInventorySessionItem(Base):
    """Item de toma física — un producto dentro de una sesión de conteo."""
    __tablename__ = "physical_inventory_session_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    session_id = Column(UUID(as_uuid=True), ForeignKey("physical_inventory_sessions.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False)
    product_nombre = Column(String(200))   # desnormalizado
    product_sku = Column(String(60))       # desnormalizado
    product_codigo_barra = Column(String(60))

    # Stock del sistema al momento de abrir la sesión (congelado, no cambia)
    cantidad_sistema = Column(Numeric(15, 3), nullable=False, default=0)
    costo_unitario = Column(Numeric(15, 0))

    # Conteo 1 (ingresado por contador_1)
    cantidad_conteo_1 = Column(Numeric(15, 3))
    contado_1_at = Column(DateTime(timezone=True))
    contado_1_by = Column(UUID(as_uuid=True))

    # Conteo 2 (doble ciego — ingresado por contador_2, sin ver conteo_1)
    cantidad_conteo_2 = Column(Numeric(15, 3))
    contado_2_at = Column(DateTime(timezone=True))
    contado_2_by = Column(UUID(as_uuid=True))

    # Conteo final reconciliado (supervisor define si hay discrepancia entre 1 y 2)
    cantidad_final = Column(Numeric(15, 3))
    reconciliado_by = Column(UUID(as_uuid=True))
    nota_reconciliacion = Column(Text)

    # Diferencia contra sistema
    diferencia = Column(Numeric(15, 3))
    impacto_gs = Column(Numeric(18, 0))

    # Estado del ítem: pendiente | conteo_1 | conteo_2 | reconciliado
    estado = Column(String(20), default="pendiente")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    session = relationship("PhysicalInventorySession", back_populates="items")

