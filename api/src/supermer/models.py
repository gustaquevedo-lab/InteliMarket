"""Supermarket models — production, perishables, waste, forecasting"""

from decimal import Decimal

from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Numeric, Integer, Enum as SAEnum,
    ForeignKey, Index, Date
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from api.src.db import Base


class ProductionArea(str, enum.Enum):
    carniceria = "carniceria"
    panaderia = "panaderia"
    rotiseria = "rotiseria"
    pre_pack = "pre_pack"
    otros = "otros"


class ProductionOrderStatus(str, enum.Enum):
    planificada = "planificada"
    en_progreso = "en_progreso"
    completada = "completada"
    cancelada = "cancelada"


class WasteType(str, enum.Enum):
    produccion = "produccion"
    vencimiento = "vencimiento"
    rotura = "rotura"
    merma_natural = "merma_natural"
    devolucion = "devolucion"
    otros = "otros"


class ReceiveQualityGrade(str, enum.Enum):
    premium = "premium"
    estandar = "estandar"
    descuento = "descuento"
    rechazado = "rechazado"


class FreshnessGrade(str, enum.Enum):
    bueno = "bueno"
    regular = "regular"
    malo = "malo"


class PerishableCategory(str, enum.Enum):
    lacteos = "lacteos"
    fiambres = "fiambres"
    carnes = "carnes"
    frutas = "frutas"
    verduras = "verduras"
    congelados = "congelados"
    panificados = "panificados"
    otros = "otros"


class ForecastStatus(str, enum.Enum):
    pendiente = "pendiente"
    aprobada = "aprobada"
    pedida = "pedida"
    cancelada = "cancelada"


class ProductionRecipe(Base):
    __tablename__ = "supermer_recipes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    area = Column(SAEnum(ProductionArea), nullable=False)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    producto_terminado_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad_esperada = Column(Numeric(12, 3), nullable=False)
    unidad_medida = Column(String(10), default="UN")
    rendimiento_esperado = Column(Numeric(5, 2), default=100)
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supermer_recipes_company_area", "company_id", "area"),
    )


class ProductionRecipeItem(Base):
    __tablename__ = "supermer_recipe_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    receta_id = Column(UUID(as_uuid=True), ForeignKey("supermer_recipes.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    unidad_medida = Column(String(10), default="UN")
    es_opcional = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_supermer_recipe_items_receta", "receta_id"),
    )


class ProductionOrder(Base):
    __tablename__ = "supermer_production_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    receta_id = Column(UUID(as_uuid=True), ForeignKey("supermer_recipes.id"))
    area = Column(SAEnum(ProductionArea), nullable=False)
    cantidad_objetivo = Column(Numeric(12, 3), nullable=False)
    estado = Column(SAEnum(ProductionOrderStatus), nullable=False, default="planificada")
    fecha_inicio = Column(DateTime(timezone=True))
    fecha_fin = Column(DateTime(timezone=True))
    fecha_vencimiento = Column(Date)
    responsable_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notas = Column(Text)
    insumos_usados = Column(JSONB)
    producto_obtenido = Column(Numeric(12, 3))
    rendimiento_real = Column(Numeric(5, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supermer_orders_company_area", "company_id", "area"),
        Index("ix_supermer_orders_estado", "estado"),
    )


class ProductionBatch(Base):
    __tablename__ = "supermer_production_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    orden_id = Column(UUID(as_uuid=True), ForeignKey("supermer_production_orders.id"))
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad_obtenida = Column(Numeric(12, 3), nullable=False)
    fecha_produccion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_vencimiento = Column(Date, nullable=False)
    lote_codigo = Column(String(50))
    costo_unitario = Column(Numeric(12, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_supermer_batches_producto", "producto_id"),
        Index("ix_supermer_batches_vencimiento", "fecha_vencimiento"),
    )


class WasteLog(Base):
    __tablename__ = "supermer_waste_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    area = Column(SAEnum(ProductionArea), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    costo_unitario = Column(Numeric(12, 2))
    costo_total = Column(Numeric(12, 2))
    tipo_merma = Column(SAEnum(WasteType), nullable=False)
    motivo = Column(Text)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    registrado_por = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    __table_args__ = (
        Index("ix_supermer_waste_company_area", "company_id", "area"),
        Index("ix_supermer_waste_fecha", "fecha"),
    )


class PerishableConfig(Base):
    __tablename__ = "supermer_perishable_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, unique=True)
    vida_util_dias = Column(Integer, nullable=False)
    requiere_markdown = Column(Boolean, default=True)
    categoria_perecedera = Column(SAEnum(PerishableCategory), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_supermer_perishable_company", "company_id"),
    )


class MarkdownLog(Base):
    __tablename__ = "supermer_markdown_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    lote_id = Column(UUID(as_uuid=True), ForeignKey("supermer_production_batches.id"))
    receive_batch_id = Column(UUID(as_uuid=True), ForeignKey("supermer_receive_batches.id"))
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False)
    precio_original = Column(Numeric(12, 2), nullable=False)
    precio_markdown = Column(Numeric(12, 2), nullable=False)
    fecha_inicio = Column(DateTime(timezone=True), server_default=func.now())
    fecha_fin = Column(DateTime(timezone=True))
    activo = Column(Boolean, default=True)
    creado_por = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    motivo = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_supermer_markdown_producto", "producto_id"),
        Index("ix_supermer_markdown_activo", "activo"),
    )


class PurchaseForecast(Base):
    __tablename__ = "supermer_purchase_forecasts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    fecha_pronosticada = Column(Date, nullable=False)
    cantidad_pronosticada = Column(Numeric(12, 3), nullable=False)
    confianza = Column(Numeric(5, 2))
    fecha_generacion = Column(DateTime(timezone=True), server_default=func.now())
    periodo_used = Column(Integer, default=90)
    # Enhanced seasonality fields
    estacionalidad_factor = Column(Numeric(5, 2), default=Decimal("1"), comment="1.0=normal, >1=alta demanda, <1=baja demanda")
    venta_semana_anterior = Column(Numeric(12, 3))
    venta_misma_semana_anio_anterior = Column(Numeric(12, 3))
    precio_promedio_semana = Column(Numeric(12, 2))
    calidad_promedio_recepcion = Column(String(20))
    dias_ultima_lluvia = Column(Integer)
    temperatura_promedio_c = Column(Numeric(4, 1))

    __table_args__ = (
        Index("ix_supermer_forecast_producto_fecha", "producto_id", "fecha_pronosticada"),
    )


class ButcheryTemplate(Base):
    __tablename__ = "supermer_butchery_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    especie = Column(String(50), nullable=False, default="bovino")
    peso_promedio_kg = Column(Numeric(8, 2), nullable=False)
    descripcion = Column(Text)
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supermer_butchery_templates_company", "company_id"),
    )


class ButcheryTemplateCut(Base):
    __tablename__ = "supermer_butchery_template_cuts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    template_id = Column(UUID(as_uuid=True), ForeignKey("supermer_butchery_templates.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    rendimiento_porcentual = Column(Numeric(5, 2), nullable=False)
    precio_ponderado = Column(Numeric(5, 2), default=Decimal("50"), comment="% del costo total que absorbe este corte para costeo")
    orden = Column(Integer, default=0)
    es_subproducto = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_supermer_butchery_cuts_template", "template_id"),
    )


class BakeryDailyPlan(Base):
    __tablename__ = "supermer_bakery_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    dia_semana = Column(Integer, nullable=False, comment="0=lunes..6=domingo, 7=todos")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supermer_bakery_plans_company_dia", "company_id", "dia_semana"),
    )


class BakeryPlanItem(Base):
    __tablename__ = "supermer_bakery_plan_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    plan_id = Column(UUID(as_uuid=True), ForeignKey("supermer_bakery_plans.id"), nullable=False)
    receta_id = Column(UUID(as_uuid=True), ForeignKey("supermer_recipes.id"), nullable=False)
    cantidad_objetivo = Column(Numeric(12, 3), nullable=False, comment="unidades del producto final a producir")
    prioridad = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_supermer_bakery_plan_items_plan", "plan_id"),
    )


class ReceiveBatch(Base):
    __tablename__ = "supermer_receive_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    cantidad_recibida = Column(Numeric(12, 3), nullable=False)
    cantidad_aceptada = Column(Numeric(12, 3))
    calidad = Column(SAEnum(ReceiveQualityGrade), nullable=False, default="estandar")
    precio_unitario = Column(Numeric(12, 2))
    fecha_recepcion = Column(Date, nullable=False, server_default=func.current_date())
    fecha_vencimiento_estimada = Column(Date)
    lote_proveedor = Column(String(100))
    lote_codigo_interno = Column(String(50))
    nota_calidad = Column(Text)
    rechazo_motivo = Column(String(200))
    registrado_por = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_supermer_receive_company", "company_id"),
        Index("ix_supermer_receive_producto", "producto_id"),
        Index("ix_supermer_receive_proveedor", "proveedor_id"),
        Index("ix_supermer_receive_fecha", "fecha_recepcion"),
    )


class FreshnessAudit(Base):
    __tablename__ = "supermer_freshness_audits"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("supermer_receive_batches.id"))
    calidad_actual = Column(SAEnum(FreshnessGrade), nullable=False)
    firmeza = Column(Integer, comment="1-5")
    color = Column(Integer, comment="1-5")
    aspecto_general = Column(Integer, comment="1-5")
    notas = Column(Text)
    audited_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    audited_at = Column(DateTime(timezone=True), server_default=func.now())
    triggered_markdown = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_supermer_freshness_producto", "producto_id"),
        Index("ix_supermer_freshness_fecha", "audited_at"),
    )


class SupplierScorecard(Base):
    __tablename__ = "supermer_supplier_scorecards"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    total_recibido = Column(Numeric(12, 3), default=0)
    calidad_promedio = Column(String(20))
    merma_porcentaje = Column(Numeric(5, 2), default=0)
    rechazos = Column(Integer, default=0)
    entregas_puntuales = Column(Integer, default=0)
    total_entregas = Column(Integer, default=0)
    precio_promedio = Column(Numeric(12, 2))
    puntaje_general = Column(Numeric(5, 2), comment="0-100")
    recomendacion = Column(String(20), default="preferido")
    periodo_inicio = Column(Date)
    periodo_fin = Column(Date)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supermer_scorecard_proveedor_producto", "proveedor_id", "producto_id"),
    )


class PurchaseSuggestion(Base):
    __tablename__ = "supermer_purchase_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    cantidad_sugerida = Column(Numeric(12, 3), nullable=False)
    cantidad_stock_actual = Column(Numeric(12, 3), default=0)
    cantidad_pendiente_recibir = Column(Numeric(12, 3), default=0)
    cantidad_pronosticada = Column(Numeric(12, 3))
    lead_time_dias = Column(Integer)
    fecha_sugerida_pedido = Column(Date)
    fecha_sugerida_llegada = Column(Date)
    precio_estimado = Column(Numeric(12, 2))
    costo_estimado_total = Column(Numeric(12, 2))
    estado = Column(SAEnum(ForecastStatus), nullable=False, default="pendiente")
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_supermer_suggestions_estado", "estado"),
        Index("ix_supermer_suggestions_company", "company_id"),
    )


# ============================================================
# ROTISERÍA / DELI / COMIDAS PREPARADAS (Fase 1)
# ============================================================

class RotiseriaCookingMethod(str, enum.Enum):
    horno = "horno"
    horno_conveccion = "horno_conveccion"
    freidora = "freidora"
    parrilla = "parrilla"
    plancha = "plancha"
    hervido = "hervido"
    vapor = "vapor"
    sarten = "sarten"
    crudo = "crudo"
    ensamblado = "ensamblado"


class RotiseriaHoldingMethod(str, enum.Enum):
    caliente = "caliente"       # baño maría / línea caliente
    frio = "frio"               # vitrina fría / ensaladera
    ambiente = "ambiente"       # panadería / repostería
    congelado = "congelado"     # freezer exhibición


class RotiseriaProductionStatus(str, enum.Enum):
    planificada = "planificada"
    en_progreso = "en_progreso"
    completada = "completada"
    cancelada = "cancelada"


class RotiseriaBatch(Base):
    """Receta de rotisería con rendimiento de cocción y parámetros HACCP."""
    __tablename__ = "supermer_rotiseria_recipes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    area = Column(String(30), nullable=False)
    holding_method = Column(String(20), nullable=False)

    # Cooking yield: 1kg raw pollo entero → 0.75kg cooked
    factor_coccion = Column(Numeric(5, 4), nullable=False, default=1.0)
    factor_merma_coccion = Column(Numeric(5, 4), default=0)

    producto_terminado_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad_esperada = Column(Numeric(12, 3), nullable=False)
    unidad_medida = Column(String(20), default="unidad")

    # HACCP parameters for this recipe
    temp_min_conservacion = Column(Numeric(5, 1))       # °C min holding temp
    temp_max_conservacion = Column(Numeric(5, 1))       # °C max holding temp
    tiempo_maximo_exhibicion_hs = Column(Numeric(4, 1)) # max hours on display
    requiere_etiquetado = Column(Boolean, default=True)
    alérgenos = Column(JSON)                            # ["lacteos", "gluten", "huevo", "nueces", "soja", "cacahuate", "sulfitos", "apio", "pescado", "crustaceos", "altramuz", "moluscos", "mostaza", "sesamo"]

    # Pricing
    costo_estimado_porcion = Column(Numeric(12, 2))
    precio_sugerido = Column(Numeric(12, 2))
    margen_objetivo_pct = Column(Numeric(5, 2))

    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("RotiseriaRecipeItem", backref="receta", cascade="all, delete-orphan")


RotiseriaRecipe = RotiseriaBatch


class RotiseriaRecipeItem(Base):
    """Insumo individual de una receta de rotisería."""
    __tablename__ = "supermer_rotiseria_recipe_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    receta_id = Column(UUID(as_uuid=True), ForeignKey("supermer_rotiseria_recipes.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    unidad_medida = Column(String(20))
    es_opcional = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class RotiseriaProductionPlan(Base):
    """Plan diario de producción de rotisería."""
    __tablename__ = "supermer_rotiseria_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)
    receta_id = Column(UUID(as_uuid=True), ForeignKey("supermer_rotiseria_recipes.id"), nullable=False)
    cantidad_objetivo = Column(Numeric(12, 3), nullable=False)
    cantidad_producida = Column(Numeric(12, 3))
    estado = Column(String(20), default="planificada")
    hora_inicio = Column(DateTime(timezone=True))
    hora_fin = Column(DateTime(timezone=True))
    responsable_id = Column(UUID(as_uuid=True))
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    temperature_logs = relationship("RotiseriaTemperatureLog", backref="plan", cascade="all, delete-orphan")
    labels = relationship("RotiseriaLabelBatch", backref="plan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_rotiseria_plan_fecha_company", "company_id", "fecha"),
    )


class RotiseriaTemperatureLog(Base):
    """Registro de temperatura de mantenimiento de productos de rotisería."""
    __tablename__ = "supermer_rotiseria_temp_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("supermer_rotiseria_plans.id"), nullable=False)
    punto_control = Column(String(100), nullable=False)  # ej: "Baño María Pollos", "Vitrina Ensaladas"
    tipo = Column(String(20), nullable=False)
    temperatura = Column(Numeric(5, 1), nullable=False)
    temp_min_requerida = Column(Numeric(5, 1))
    temp_max_requerida = Column(Numeric(5, 1))
    conforme = Column(Boolean)
    registrado_por = Column(UUID(as_uuid=True))
    registrado_at = Column(DateTime(timezone=True), server_default=func.now())
    observaciones = Column(Text)

    __table_args__ = (
        Index("ix_rotiseria_temp_plan", "plan_id"),
    )


class RotiseriaLabelBatch(Base):
    """Lote de etiquetas generadas para productos de rotisería."""
    __tablename__ = "supermer_rotiseria_labels"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("supermer_rotiseria_plans.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    lote_codigo = Column(String(50), nullable=False)
    fecha_elaboracion = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=False)
    ingredientes = Column(Text)
    alérgenos = Column(JSON)
    informacion_nutricional = Column(JSON)
    precio_unitario = Column(Numeric(12, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class RotiseriaMarkdownSuggestion(Base):
    """Sugerencia de markdown nocturno para productos próximos a cierre."""
    __tablename__ = "supermer_rotiseria_markdowns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    label_batch_id = Column(UUID(as_uuid=True), ForeignKey("supermer_rotiseria_labels.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    precio_original = Column(Numeric(12, 2), nullable=False)
    descuento_sugerido_pct = Column(Numeric(5, 2))
    precio_markdown = Column(Numeric(12, 2))
    motivo = Column(String(50))  # "cierre_tienda", "excedente_produccion", "proximo_vencer"
    aplicado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# HACCP & CADENA DE FRÍO (Fase 1)
# ============================================================

class HaccpRiskLevel(str, enum.Enum):
    bajo = "bajo"
    medio = "medio"
    alto = "alto"
    critico = "critico"


class HaccpPointType(str, enum.Enum):
    temperatura = "temperatura"
    ph = "ph"
    humedad = "humedad"
    tiempo = "tiempo"
    visual = "visual"
    quimico = "quimico"
    microbiologico = "microbiologico"


class HaccpPlan(Base):
    """Plan HACCP por área del supermercado."""
    __tablename__ = "supermer_haccp_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    area = Column(String(50), nullable=False, index=True)  # carniceria, panaderia, rotiseria, lacteos, congelados, verduleria
    descripcion = Column(Text)
    version = Column(Integer, default=1)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_haccp_plan_area_company", "company_id", "area"),
    )


class HaccpCriticalPoint(Base):
    """Punto crítico de control (PCC) dentro de un plan HACCP."""
    __tablename__ = "supermer_haccp_critical_points"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    plan_id = Column(UUID(as_uuid=True), ForeignKey("supermer_haccp_plans.id"), nullable=False)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(30), nullable=False)
    riesgo = Column(String(20), nullable=False)

    # Critical limits
    limite_inferior = Column(Numeric(8, 2))     # ej: 0°C para refrigeración
    limite_superior = Column(Numeric(8, 2))     # ej: 5°C para refrigeración
    unidad = Column(String(20))                 # °C, %, pH, horas

    # Monitoring
    frecuencia_monitoreo_min = Column(Integer)   # cada cuántos minutos
    metodo_monitoreo = Column(String(200))      # "sensor_iot", "manual_termometro", "visual"

    # Corrective action template
    accion_correctiva_template = Column(Text)

    # Sensor mapping (integration with IoT Cold Chain)
    sensor_ids = Column(JSON)                   # ["cold_chain_sensor_uuid", ...]

    activo = Column(Boolean, default=True)
    orden = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_haccp_cp_plan", "plan_id", "orden"),
    )


class HaccpMonitoringLog(Base):
    """Registro de monitoreo de un punto crítico."""
    __tablename__ = "supermer_haccp_monitoring_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    critical_point_id = Column(UUID(as_uuid=True), ForeignKey("supermer_haccp_critical_points.id"), nullable=False)
    valor = Column(Numeric(8, 2), nullable=False)
    conforme = Column(Boolean, nullable=False)

    # Source
    fuente = Column(String(20), default="manual")  # "manual", "sensor_iot", "api"
    sensor_id = Column(UUID(as_uuid=True))         # ref to cold_chain sensor if applicable

    registrado_por = Column(UUID(as_uuid=True))
    registrado_at = Column(DateTime(timezone=True), server_default=func.now())
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_haccp_monitoring_cp", "critical_point_id", "registrado_at"),
    )


class HaccpCorrectiveAction(Base):
    """Acción correctiva cuando un PCC está fuera de control."""
    __tablename__ = "supermer_haccp_corrective_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    monitoring_log_id = Column(UUID(as_uuid=True), ForeignKey("supermer_haccp_monitoring_logs.id"), nullable=False)
    critical_point_id = Column(UUID(as_uuid=True), ForeignKey("supermer_haccp_critical_points.id"), nullable=False)

    descripcion = Column(Text, nullable=False)
    accion_tomada = Column(Text, nullable=False)
    responsable_id = Column(UUID(as_uuid=True), nullable=False)
    producto_afectado_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))

    # Disposition
    disposicion = Column(String(50))  # "rechazar", "reprocesar", "reetiquetar", "liberar_bajo_condicion", "destruir"
    cantidad_afectada = Column(Numeric(12, 3))
    costo_perdida = Column(Numeric(12, 2))

    # Resolution
    resuelto = Column(Boolean, default=False)
    resuelto_at = Column(DateTime(timezone=True))
    resuelto_por = Column(UUID(as_uuid=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# FASE 2 — DSD RECEIVING (Recepción en Puerta)
# ============================================================

class DsdReceivingStatus(str, enum.Enum):
    programada = "programada"
    en_curso = "en_curso"
    completada = "completada"
    parcial = "parcial"
    cancelada = "cancelada"

class DsdDockType(str, enum.Enum):
    seco = "seco"
    frio = "frio"
    congelado = "congelado"

class DsdTemperatureCheck(str, enum.Enum):
    manual = "manual"
    iot_sensor = "iot_sensor"
    no_requerido = "no_requerido"

class DsdReceivingSchedule(Base):
    """Cita de recepción de proveedor en puerta de backroom."""
    __tablename__ = "supermer_dsd_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    numero_oc = Column(String(50), nullable=False)
    fecha_programada = Column(Date, nullable=False, index=True)
    ventana_inicio = Column(DateTime(timezone=True), nullable=False)
    ventana_fin = Column(DateTime(timezone=True), nullable=False)
    muelle = Column(String(20))
    tipo_carga = Column(String(20), nullable=False)
    transportista = Column(String(100))
    patente = Column(String(20))
    conductor = Column(String(100))
    conductor_telefono = Column(String(20))
    total_bultos_estimado = Column(Integer)
    total_peso_estimado_kg = Column(Numeric(8, 2))
    estado = Column(String(20), default="programada")
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_dsd_schedule_fecha_proveedor", "company_id", "fecha_programada", "proveedor_id"),
    )


class DsdReceivingLog(Base):
    """Registro de recepción DSD en puerta."""
    __tablename__ = "supermer_dsd_receivings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("supermer_dsd_schedules.id"), nullable=False)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    numero_oc = Column(String(50), nullable=False)
    numero_remito = Column(String(50))
    fecha_recepcion = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    recibido_por = Column(UUID(as_uuid=True), nullable=False)
    total_bultos_recibidos = Column(Integer)
    total_bultos_rechazados = Column(Integer, default=0)
    temp_ambiente_descarga = Column(Numeric(4, 1))
    temp_check_method = Column(String(20), default="manual")
    hora_inicio = Column(DateTime(timezone=True))
    hora_fin = Column(DateTime(timezone=True))
    estado = Column(String(20), default="en_curso")
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("DsdReceivingItem", backref="receiving")
    rechazos = relationship("DsdReceivingRejection", backref="receiving")

    __table_args__ = (
        Index("ix_dsd_receiving_fecha", "company_id", "fecha_recepcion"),
    )


class DsdReceivingItem(Base):
    """Producto individual recibido en DSD."""
    __tablename__ = "supermer_dsd_receiving_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    receiving_id = Column(UUID(as_uuid=True), ForeignKey("supermer_dsd_receivings.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad_solicitada = Column(Numeric(12, 3), nullable=False)
    cantidad_recibida = Column(Numeric(12, 3), nullable=False)
    cantidad_aceptada = Column(Numeric(12, 3))
    temperatura_producto = Column(Numeric(4, 1))
    temp_conforme = Column(Boolean)
    lote = Column(String(50))
    fecha_vencimiento = Column(Date)
    condicion_visual = Column(String(50))  # excelente, buena, regular, mala
    inspeccion_conforme = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class DsdReceivingRejection(Base):
    """Rechazo de producto durante recepción DSD."""
    __tablename__ = "supermer_dsd_rejections"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    receiving_id = Column(UUID(as_uuid=True), ForeignKey("supermer_dsd_receivings.id"), nullable=False)
    item_id = Column(UUID(as_uuid=True), ForeignKey("supermer_dsd_receiving_items.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad_rechazada = Column(Numeric(12, 3), nullable=False)
    motivo = Column(String(50), nullable=False)  # temp_fuera_rango, danado, vencido, proximo_vencer, cantidad_incorrecta, calidad_insuficiente, otro
    detalle = Column(Text)
    foto_evidencia_url = Column(String(500))
    genera_nota_credito = Column(Boolean, default=True)
    nota_credito_numero = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resuelto = Column(Boolean, default=False)
    resuelto_at = Column(DateTime(timezone=True))


# ============================================================
# FASE 2 — INVENTARIO FÍSICO & CONTEO CÍCLICO ABC
# ============================================================

class CountSessionStatus(str, enum.Enum):
    abierta = "abierta"
    en_curso = "en_curso"
    congelada = "congelada"
    completada = "completada"
    ajustada = "ajustada"

class AbcCategory(str, enum.Enum):
    a = "a"
    b = "b"
    c = "c"

class PhysicalCountSession(Base):
    """Sesión de conteo físico de inventario."""
    __tablename__ = "supermer_count_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(20), nullable=False)
    area = Column(String(50), nullable=False)
    ubicacion = Column(String(100))
    tipo = Column(String(20), default="ciclico")  # completo, ciclico, abc, por_area
    abc_category = Column(String(1))
    contador_principal = Column(UUID(as_uuid=True))
    contador_verificador = Column(UUID(as_uuid=True))
    fecha_inicio = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_fin = Column(DateTime(timezone=True))
    estado = Column(String(20), default="abierta")
    total_items_sistema = Column(Integer, default=0)
    total_items_contados = Column(Integer, default=0)
    total_discrepancias = Column(Integer, default=0)
    valor_discrepancia_total = Column(Numeric(14, 2), default=0)
    requiere_doble_conteo = Column(Boolean, default=False)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("PhysicalCountItem", backref="session")

    __table_args__ = (
        Index("ix_count_session_area", "company_id", "area", "estado"),
    )


class PhysicalCountItem(Base):
    """Producto contado en una sesión de inventario."""
    __tablename__ = "supermer_count_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    session_id = Column(UUID(as_uuid=True), ForeignKey("supermer_count_sessions.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    codigo_barra = Column(String(50))
    cantidad_sistema = Column(Numeric(12, 3), nullable=False)
    cantidad_contada = Column(Numeric(12, 3))
    cantidad_verificada = Column(Numeric(12, 3))
    diferencia = Column(Numeric(12, 3))
    costo_promedio = Column(Numeric(12, 2))
    valor_diferencia = Column(Numeric(14, 2))
    lote = Column(String(50))
    fecha_vencimiento = Column(Date)
    conforme = Column(Boolean)
    requiere_ajuste = Column(Boolean, default=False)
    contado_por = Column(UUID(as_uuid=True))
    verificado_por = Column(UUID(as_uuid=True))
    contado_at = Column(DateTime(timezone=True))
    verificado_at = Column(DateTime(timezone=True))
    foto_evidencia_url = Column(String(500))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_count_item_session", "session_id", "producto_id"),
    )


class CountAdjustment(Base):
    """Ajuste de inventario generado por discrepancia en conteo."""
    __tablename__ = "supermer_count_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("supermer_count_sessions.id"), nullable=False)
    count_item_id = Column(UUID(as_uuid=True), ForeignKey("supermer_count_items.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    tipo = Column(String(20), nullable=False)  # sobrante, faltante
    cantidad_ajuste = Column(Numeric(12, 3), nullable=False)
    costo_unitario = Column(Numeric(12, 2))
    valor_ajuste = Column(Numeric(14, 2))
    motivo = Column(String(200))
    aprobado_por = Column(UUID(as_uuid=True))
    aprobado_at = Column(DateTime(timezone=True))
    estado = Column(String(20), default="pendiente")  # pendiente, aprobado, rechazado
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# FASE 2 — REPOSICIÓN AUTOMÁTICA & CROSS-DOCKING
# ============================================================

class ReplenishmentRule(Base):
    """Regla de reposición automática por producto."""
    __tablename__ = "supermer_replenishment_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, unique=True)
    proveedor_preferente_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    proveedor_secundario_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    lead_time_dias = Column(Integer, nullable=False)
    stock_seguridad_dias = Column(Integer, default=3)
    stock_seguridad_unidades = Column(Numeric(12, 3))
    lote_economico = Column(Numeric(12, 3))  # EOQ
    multiplo_pedido = Column(Numeric(12, 3))  # ej: caja de 12 unidades
    cantidad_minima_pedido = Column(Numeric(12, 3))
    punto_pedido = Column(Numeric(12, 3))  # auto-calculado: (demanda diaria avg * lead_time) + stock_seguridad
    metodo_pronostico = Column(String(20), default="promedio")  # promedio, ventana, seasonal
    dias_historial = Column(Integer, default=90)
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_replenishment_rule_producto", "company_id", "producto_id"),
    )


class ReplenishmentSuggestion(Base):
    """Sugerencia generada por el motor de reposición."""
    __tablename__ = "supermer_replenishment_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    regla_id = Column(UUID(as_uuid=True), ForeignKey("supermer_replenishment_rules.id"))
    fecha_generacion = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    stock_actual = Column(Numeric(12, 3), nullable=False)
    stock_pendiente_recibir = Column(Numeric(12, 3), default=0)
    demanda_diaria_avg = Column(Numeric(12, 3))
    demanda_pronosticada = Column(Numeric(12, 3))
    punto_pedido = Column(Numeric(12, 3))
    cantidad_sugerida = Column(Numeric(12, 3), nullable=False)
    costo_unitario_estimado = Column(Numeric(12, 2))
    costo_total_estimado = Column(Numeric(14, 2))
    oc_generada = Column(Boolean, default=False)
    oc_numero = Column(String(50))
    estado = Column(String(20), default="pendiente")  # pendiente, aprobada, rechazada, oc_generada
    revisado_por = Column(UUID(as_uuid=True))
    revisado_at = Column(DateTime(timezone=True))
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_replenishment_suggestion_estado", "company_id", "estado"),
    )


class CrossDockOrder(Base):
    """Orden de cross-docking: producto que va directo de recepción a tienda."""
    __tablename__ = "supermer_crossdock_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    receiving_item_id = Column(UUID(as_uuid=True), ForeignKey("supermer_dsd_receiving_items.id"))
    cantidad = Column(Numeric(12, 3), nullable=False)
    fecha_crossdock = Column(Date, nullable=False)
    destino = Column(String(50))  # gondola, exhibicion, prepack
    asignado_a = Column(UUID(as_uuid=True))
    estado = Column(String(20), default="pendiente")  # pendiente, en_progreso, completado
    completado_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# FASE 2 — DEVOLUCIONES A PROVEEDOR & BACKHAUL
# ============================================================

class ReturnStatus(str, enum.Enum):
    pendiente = "pendiente"
    autorizado = "autorizado"
    en_proceso = "en_proceso"
    completado = "completado"
    cancelado = "cancelado"

class ReturnReason(str, enum.Enum):
    vencido = "vencido"
    danado = "danado"
    retiro_mercado = "retiro_mercado"
    sobrestock = "sobrestock"
    orden_incorrecta = "orden_incorrecta"
    calidad_insuficiente = "calidad_insuficiente"
    otro = "otro"

class SupplierReturn(Base):
    """Devolución de mercadería a proveedor."""
    __tablename__ = "supermer_supplier_returns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    codigo = Column(String(30), nullable=False)
    tipo = Column(String(30), default="devolucion")  # devolucion, recall
    fecha_creacion = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fecha_estimada_retiro = Column(Date)
    total_items = Column(Integer, default=0)
    valor_total_estimado = Column(Numeric(14, 2))
    nota_credito_numero = Column(String(50))
    nota_credito_monto = Column(Numeric(14, 2))
    estado = Column(String(20), default="pendiente")
    autorizado_por = Column(UUID(as_uuid=True))
    autorizado_at = Column(DateTime(timezone=True))
    completado_por = Column(UUID(as_uuid=True))
    completado_at = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("SupplierReturnItem", backref="return_ref")

    __table_args__ = (
        Index("ix_supplier_return_proveedor", "company_id", "proveedor_id", "estado"),
    )


class SupplierReturnItem(Base):
    """Producto incluido en una devolución a proveedor."""
    __tablename__ = "supermer_supplier_return_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    return_id = Column(UUID(as_uuid=True), ForeignKey("supermer_supplier_returns.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    costo_promedio = Column(Numeric(12, 2))
    valor_unitario = Column(Numeric(12, 2))
    valor_total = Column(Numeric(14, 2))
    motivo = Column(String(30), nullable=False)
    lote = Column(String(50))
    fecha_vencimiento = Column(Date)
    detalle = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class ReturnAuthorization(Base):
    """Autorización de devolución emitida por el proveedor."""
    __tablename__ = "supermer_return_authorizations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    return_id = Column(UUID(as_uuid=True), ForeignKey("supermer_supplier_returns.id"), nullable=False)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    numero_autorizacion = Column(String(50), nullable=False)
    fecha_autorizacion = Column(Date, nullable=False)
    valido_hasta = Column(Date)
    autorizado_por_proveedor = Column(String(100))
    nota_credito_numero = Column(String(50))
    nota_credito_monto = Column(Numeric(14, 2))
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class BackhaulSchedule(Base):
    """Programación de viaje de retorno para devoluciones."""
    __tablename__ = "supermer_backhaul_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    return_ids = Column(JSON)  # ["return_uuid", ...]
    fecha_programada = Column(DateTime(timezone=True), nullable=False)
    ventana_inicio = Column(DateTime(timezone=True))
    ventana_fin = Column(DateTime(timezone=True))
    transportista = Column(String(100))
    patente = Column(String(20))
    conductor = Column(String(100))
    total_bultos = Column(Integer)
    peso_estimado_kg = Column(Numeric(8, 2))
    destino_direccion = Column(String(200))
    estado = Column(String(20), default="pendiente")  # pendiente, en_ruta, completado, cancelado
    notas_logisticas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ============================================================
# FASE 3 — PRECIOS MULTICANAL & COMPETITIVOS
# ============================================================

class PriceZoneType(str, enum.Enum):
    sucursal = "sucursal"
    canal = "canal"
    zona_geografica = "zona_geografica"

class StorePriceZone(Base):
    """Zona de precio: sucursal, canal o región geográfica."""
    __tablename__ = "supermer_price_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    tipo = Column(String(20), nullable=False)
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CompetitorPrice(Base):
    """Precio de competidor capturado por producto."""
    __tablename__ = "supermer_competitor_prices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    competidor = Column(String(100), nullable=False)
    precio = Column(Numeric(12, 2), nullable=False)
    fecha_captura = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    fuente = Column(String(20), default="manual")  # manual, api, scraping
    diferencia_pct = Column(Numeric(5, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_competitor_price_producto", "company_id", "producto_id", "competidor"),
    )


class PriceAuditLog(Base):
    """Auditoría de cambios de precio — quién, cuándo, por qué."""
    __tablename__ = "supermer_price_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    precio_anterior = Column(Numeric(12, 2))
    precio_nuevo = Column(Numeric(12, 2))
    diferencia_pct = Column(Numeric(5, 2))
    motivo = Column(String(200), nullable=False)
    cambiado_por = Column(UUID(as_uuid=True), nullable=False)
    cambiado_at = Column(DateTime(timezone=True), server_default=func.now())
    requiere_aprobacion = Column(Boolean, default=False)
    aprobado_por = Column(UUID(as_uuid=True))
    aprobado_at = Column(DateTime(timezone=True))
    estado = Column(String(20), default="aplicado")  # pendiente, aplicado, rechazado
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class PsychologicalPriceRule(Base):
    """Regla de precio psicológico: redondeo, terminación, umbrales."""
    __tablename__ = "supermer_psychological_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    tipo_redondeo = Column(String(20), nullable=False)  # .990, .900, .500, .000, .999
    limite_superior = Column(Numeric(12, 2))
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# FASE 3 — ELECTRONIC SHELF LABELS (ESL)
# ============================================================

class EslDevice(Base):
    """Etiqueta electrónica de góndola."""
    __tablename__ = "supermer_esl_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo_dispositivo = Column(String(50), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    precio_actual = Column(Numeric(12, 2))
    ubicacion = Column(String(100))
    zona_id = Column(UUID(as_uuid=True), ForeignKey("supermer_esl_zones.id"))
    estado = Column(String(20), default="online")  # online, offline, bateria_baja, error
    bateria_pct = Column(Integer)
    ultima_sync = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EslZone(Base):
    """Zona de tienda para agrupar ESLs."""
    __tablename__ = "supermer_esl_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    dispositivos = relationship("EslDevice", backref="zona")


class EslPriceSync(Base):
    """Registro de sincronización de precio a ESL."""
    __tablename__ = "supermer_esl_price_syncs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    esl_device_id = Column(UUID(as_uuid=True), ForeignKey("supermer_esl_devices.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    precio_anterior = Column(Numeric(12, 2))
    precio_nuevo = Column(Numeric(12, 2))
    estado = Column(String(20), default="pendiente")  # pendiente, enviado, confirmado, error
    intentos = Column(Integer, default=0)
    error_msg = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    completado_at = Column(DateTime(timezone=True))


# ============================================================
# FASE 3 — CALENDARIO PROMOCIONAL & OPTIMIZACIÓN
# ============================================================

class PromoCalendar(Base):
    """Evento promocional en el calendario anual."""
    __tablename__ = "supermer_promo_calendar"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    tipo = Column(String(30), nullable=False)  # temporada, evento, feriado, limpieza, lanzamiento
    presupuesto_asignado = Column(Numeric(14, 2))
    estado = Column(String(20), default="planificado")  # planificado, activo, completado, cancelado
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_promo_calendar_fechas", "company_id", "fecha_inicio", "fecha_fin"),
    )


class PromoBudget(Base):
    """Presupuesto detallado de promoción por categoría."""
    __tablename__ = "supermer_promo_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    promo_id = Column(UUID(as_uuid=True), ForeignKey("supermer_promo_calendar.id"), nullable=False)
    categoria = Column(String(50), nullable=False)
    presupuesto_planificado = Column(Numeric(14, 2))
    gasto_real = Column(Numeric(14, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class PromoEffectiveness(Base):
    """Efectividad de promoción: lift, margen incremental, canibalización."""
    __tablename__ = "supermer_promo_effectiveness"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    promo_id = Column(UUID(as_uuid=True), ForeignKey("supermer_promo_calendar.id"), nullable=False)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    ventas_durante = Column(Numeric(14, 2))
    ventas_antes = Column(Numeric(14, 2))
    ventas_despues = Column(Numeric(14, 2))
    lift_pct = Column(Numeric(5, 2))
    margen_incremental = Column(Numeric(14, 2))
    canibalizacion_pct = Column(Numeric(5, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# FASE 3 — MARKDOWN DINÁMICO CON ML
# ============================================================

class DynamicMarkdownRule(Base):
    """Regla de descuento dinámico por producto/categoría."""
    __tablename__ = "supermer_dynamic_markdown_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    categoria = Column(String(50))
    estrategia = Column(String(20), nullable=False)  # agresiva, moderada, conservadora
    descuento_maximo_pct = Column(Numeric(5, 2), nullable=False)
    descuento_minimo_pct = Column(Numeric(5, 2))
    horas_limite = Column(Integer)  # horas antes del vencimiento para aplicar descuento agresivo
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_dynamic_markdown_producto", "company_id", "producto_id"),
    )


class MarkdownRecommendation(Base):
    """Recomendación de markdown generada por el motor dinámico."""
    __tablename__ = "supermer_markdown_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    precio_original = Column(Numeric(12, 2), nullable=False)
    descuento_recomendado_pct = Column(Numeric(5, 2), nullable=False)
    precio_recomendado = Column(Numeric(12, 2), nullable=False)
    motivo = Column(String(100))  # proximo_vencer, excedente, baja_demanda, competencia
    score_urgencia = Column(Integer)  # 1-100
    aplicada = Column(Boolean, default=False)
    aplicada_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# AUDITORÍAS DIARIAS & CHECKLISTS (Fase 1)
# ============================================================

class AuditArea(str, enum.Enum):
    caja = "caja"
    carniceria = "carniceria"
    panaderia = "panaderia"
    rotiseria = "rotiseria"
    verduleria = "verduleria"
    almacen = "almacen"
    camaras = "camaras"
    pasillos = "pasillos"
    banos = "banos"
    recepcion = "recepcion"
    general = "general"


class AuditResponseType(str, enum.Enum):
    si_no = "si_no"
    si_no_na = "si_no_na"
    escala_1_5 = "escala_1_5"
    texto = "texto"
    temperatura = "temperatura"
    foto = "foto"


class AuditSchedule(str, enum.Enum):
    apertura = "apertura"
    cierre = "cierre"
    cada_4h = "cada_4h"
    diario = "diario"
    semanal = "semanal"
    mensual = "mensual"


class StoreAuditTemplate(Base):
    """Plantilla de checklist de auditoría."""
    __tablename__ = "supermer_audit_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    area = Column(String(20), nullable=False, index=True)
    schedule = Column(String(20), nullable=False)

    # Scoring
    peso_porcentual = Column(Numeric(5, 2), default=100.0)
    puntaje_minimo_aprobacion = Column(Numeric(5, 2), default=70.0)

    activo = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("StoreAuditTemplateItem", backref="template", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_audit_template_area_company", "company_id", "area"),
    )


class StoreAuditTemplateItem(Base):
    """Item individual de un checklist de auditoría."""
    __tablename__ = "supermer_audit_template_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    template_id = Column(UUID(as_uuid=True), ForeignKey("supermer_audit_templates.id"), nullable=False)
    orden = Column(Integer, nullable=False)
    pregunta = Column(Text, nullable=False)
    tipo_respuesta = Column(String(20), nullable=False)
    peso = Column(Numeric(5, 2), default=1.0)  # weight for scoring
    opciones = Column(JSON)                      # for escala type: [1,2,3,4,5]
    instrucciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


    __table_args__ = (
        Index("ix_audit_item_template", "template_id", "orden"),
    )


class StoreAuditExecution(Base):
    """Ejecución de una auditoría."""
    __tablename__ = "supermer_audit_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("supermer_audit_templates.id"), nullable=False)
    fecha = Column(Date, nullable=False, index=True)
    hora = Column(DateTime(timezone=True), server_default=func.now())

    ejecutado_por = Column(UUID(as_uuid=True), nullable=False)
    supervisor_id = Column(UUID(as_uuid=True))

    # Results
    puntaje_total = Column(Numeric(5, 2))
    puntaje_maximo = Column(Numeric(5, 2))
    porcentaje = Column(Numeric(5, 2))
    aprobado = Column(Boolean)

    estado = Column(String(20), default="completada")  # completada, pendiente_revision, rechazada
    notas_generales = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    answers = relationship("StoreAuditAnswer", backref="execution", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_audit_execution_fecha", "company_id", "fecha"),
    )


class StoreAuditAnswer(Base):
    """Respuesta individual de una auditoría."""
    __tablename__ = "supermer_audit_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    execution_id = Column(UUID(as_uuid=True), ForeignKey("supermer_audit_executions.id"), nullable=False)
    template_item_id = Column(UUID(as_uuid=True), ForeignKey("supermer_audit_template_items.id"), nullable=False)

    valor = Column(Text)  # "si", "no", "3", "24.5°C", or JSON for multiple values
    conforme = Column(Boolean)
    foto_url = Column(Text)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ============================================================
# MANTENIMIENTO DE EQUIPOS (Fase 1)
# ============================================================

class EquipmentCategory(str, enum.Enum):
    refrigeracion = "refrigeracion"
    congelacion = "congelacion"
    horno = "horno"
    horno_conveccion = "horno_conveccion"
    freidora = "freidora"
    balanza = "balanza"
    pos = "pos"
    impresora = "impresora"
    scanner = "scanner"
    exhibidor_frio = "exhibidor_frio"
    exhibidor_caliente = "exhibidor_caliente"
    camara_frigorifica = "camara_frigorifica"
    camara_congelacion = "camara_congelacion"
    generador = "generador"
    grupo_electrogeno = "grupo_electrogeno"
    aire_acondicionado = "aire_acondicionado"
    cinta_transportadora = "cinta_transportadora"
    otro = "otro"


class EquipmentPriority(str, enum.Enum):
    baja = "baja"
    media = "media"
    alta = "alta"
    critica = "critica"


class MaintenanceType(str, enum.Enum):
    preventivo = "preventivo"
    correctivo = "correctivo"
    predictivo = "predictivo"
    emergencia = "emergencia"


class MaintenanceStatus(str, enum.Enum):
    programado = "programado"
    en_progreso = "en_progreso"
    completado = "completado"
    cancelado = "cancelado"


class StoreEquipment(Base):
    """Registro de equipo del supermercado."""
    __tablename__ = "supermer_equipment"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    categoria = Column(String(30), nullable=False, index=True)
    marca = Column(String(100))
    modelo = Column(String(100))
    numero_serie = Column(String(100))
    codigo_inventario = Column(String(50))

    # Location
    area = Column(String(50))  # carniceria, panaderia, caja, camaras, etc.
    ubicacion = Column(String(200))

    # Status
    activo = Column(Boolean, default=True)
    fecha_instalacion = Column(Date)
    fecha_ultimo_mantenimiento = Column(Date)
    fecha_proximo_mantenimiento = Column(Date)

    # Specifications
    capacidad = Column(String(100))         # ej: "300kg", "200L", "5kN"
    eficiencia_energetica = Column(String(10))  # A++, A+, A, B, C
    consumo_estimado_kwh = Column(Numeric(8, 2))

    # Alert thresholds for IoT integration
    temp_min_operacion = Column(Numeric(5, 1))
    temp_max_operacion = Column(Numeric(5, 1))
    alerta_habilitada = Column(Boolean, default=True)

    # Warranty & Provider
    proveedor_mantenimiento = Column(String(200))
    garantia_vencimiento = Column(Date)
    costo_adquisicion = Column(Numeric(12, 2))

    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EquipmentMaintenanceSchedule(Base):
    """Plan de mantenimiento preventivo para un equipo."""
    __tablename__ = "supermer_equipment_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    equipo_id = Column(UUID(as_uuid=True), ForeignKey("supermer_equipment.id"), nullable=False)
    tipo = Column(String(20), nullable=False)

    # Frequency
    frecuencia_dias = Column(Integer, nullable=False)
    frecuencia_instrucciones = Column(String(200))  # "Cada 30 días", "Cada 3 meses"

    # Task definition
    tareas = Column(JSON, nullable=False)  # List of subtasks with instructions
    duracion_estimada_min = Column(Integer)
    prioridad = Column(String(20), default="media")

    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_equip_schedule_equipo", "equipo_id"),
    )


class EquipmentWorkOrder(Base):
    """Orden de trabajo de mantenimiento."""
    __tablename__ = "supermer_equipment_work_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    equipo_id = Column(UUID(as_uuid=True), ForeignKey("supermer_equipment.id"), nullable=False)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("supermer_equipment_schedules.id"))

    numero_ot = Column(String(50), nullable=False)
    tipo = Column(String(20), nullable=False)
    prioridad = Column(String(20), default="media")
    estado = Column(String(20), default="programado")

    # Issue description (for corrective)
    descripcion_falla = Column(Text)
    sintomas = Column(JSON)  # ["ruido_anormal", "fuga_agua", "no_enfria"]

    # Work details
    asignado_a = Column(UUID(as_uuid=True))
    fecha_programada = Column(Date)
    fecha_inicio = Column(DateTime(timezone=True))
    fecha_fin = Column(DateTime(timezone=True))
    horas_trabajadas = Column(Numeric(6, 2))
    costo_repuestos = Column(Numeric(12, 2))
    costo_mano_obra = Column(Numeric(12, 2))
    costo_total = Column(Numeric(12, 2))

    # Resolution
    diagnostico = Column(Text)
    acciones_realizadas = Column(Text)
    repuestos_utilizados = Column(JSON)  # [{"nombre": "filtro", "cantidad": 2, "costo": 150000}]
    requiere_seguimiento = Column(Boolean, default=False)

    # Result
    resultado = Column(String(50))  # "resuelto", "parcial", "derivado_proveedor", "baja_equipo"
    notas = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EquipmentAlert(Base):
    """Alerta automática relacionada a equipos."""
    __tablename__ = "supermer_equipment_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    equipo_id = Column(UUID(as_uuid=True), ForeignKey("supermer_equipment.id"), nullable=False)

    tipo = Column(String(50), nullable=False)  # "mantenimiento_vencido", "temperatura_fuera_rango", "falla_reporte", "garantia_proxima_vencer"
    severidad = Column(String(20), default="media")  # baja, media, alta, critica
    mensaje = Column(Text, nullable=False)

    resuelta = Column(Boolean, default=False)
    resuelta_at = Column(DateTime(timezone=True))
    resuelta_por = Column(UUID(as_uuid=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())



# Aliases expected by supermer service_*.py
AuditTemplate = StoreAuditTemplate
AuditTemplateItem = StoreAuditTemplateItem
AuditExecution = StoreAuditExecution
AuditAnswer = StoreAuditAnswer
MaintenanceSchedule = EquipmentMaintenanceSchedule
WorkOrder = EquipmentWorkOrder
