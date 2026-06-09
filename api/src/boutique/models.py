"""Modelos Boutique/Indumentaria (bout_*).

Vertical de moda: talles, colores, temporadas, colecciones, AR try-on, clienteling, markdown IA.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4 as _uuid

from sqlalchemy import (Column, String, Integer, Numeric, Boolean, DateTime,
                         Date, Text, ForeignKey, JSON, Float, Time, Index,
                         UniqueConstraint, Enum as SQLEnum)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from api.src.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ============================================================
# 1. COLECCIONES / TEMPORADAS
# ============================================================
class BoutiqueCollection(Base):
    __tablename__ = "bout_collections"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    temporada = Column(String(20), nullable=False)  # primavera_verano, otonio_invierno
    anio = Column(Integer, nullable=False)
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    estado = Column(String(20), default="borrador")
    imagen_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    items = relationship("BoutiqueCollectionItem", back_populates="collection",
                          cascade="all, delete-orphan")


class BoutiqueCollectionItem(Base):
    __tablename__ = "bout_collection_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    collection_id = Column(UUID(as_uuid=True),
                           ForeignKey("bout_collections.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True),
                         ForeignKey("bout_products.id"),
                         nullable=False, index=True)
    orden = Column(Integer, default=0)
    destacado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    collection = relationship("BoutiqueCollection", back_populates="items")
    producto = relationship("BoutiqueProduct")


# ============================================================
# 2. TALLES Y COLORES (maestros)
# ============================================================
class BoutiqueSize(Base):
    __tablename__ = "bout_sizes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    categoria = Column(String(50))  # ropa, calzado, accesorios
    orden = Column(Integer, default=0)
    medida_referencia_cm = Column(Numeric(8, 2))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class BoutiqueColor(Base):
    __tablename__ = "bout_colors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(30), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    hex = Column(String(7))
    familia = Column(String(50))  # rojos, azules, neutros, estampados
    es_basico = Column(Boolean, default=False)
    orden = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 3. CATEGORIAS JERARQUICAS
# ============================================================
class BoutiqueCategory(Base):
    __tablename__ = "bout_categories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    parent_id = Column(UUID(as_uuid=True),
                       ForeignKey("bout_categories.id", ondelete="SET NULL"),
                       index=True)
    nivel = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    imagen_url = Column(Text)
    orden = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    children = relationship("BoutiqueCategory",
                             remote_side=[parent_id],
                             cascade="all")


# ============================================================
# 4. PRODUCTOS (base) Y VARIANTES (talle x color)
# ============================================================
class BoutiqueProduct(Base):
    __tablename__ = "bout_products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(300), nullable=False)
    descripcion = Column(Text)
    categoria_id = Column(UUID(as_uuid=True),
                          ForeignKey("bout_categories.id", ondelete="SET NULL"),
                          index=True)
    tipo_producto = Column(String(30), default="indumentaria")
    genero = Column(String(20))  # mujer, hombre, unisex, nino, nina
    marca = Column(String(200))
    material = Column(String(200))
    cuidados = Column(Text)
    precio_base = Column(Numeric(12, 2), nullable=False)
    costo_promedio = Column(Numeric(12, 2))
    moneda = Column(String(10), default="PYG")
    imagen_principal = Column(Text)
    imagenes_adicionales = Column(JSONB, default=list)
    tags = Column(ARRAY(String), default=[])
    activo = Column(Boolean, default=True)
    destacado = Column(Boolean, default=False)
    incluye_gift_wrapping = Column(Boolean, default=False)
    gift_wrapping_surcharge = Column(Numeric(10, 2))
    meta_title = Column(String(200))
    meta_description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    categoria = relationship("BoutiqueCategory")
    variantes = relationship("BoutiqueProductVariant", back_populates="producto",
                              cascade="all, delete-orphan")
    colecciones = relationship("BoutiqueCollectionItem", back_populates="producto")


class BoutiqueProductVariant(Base):
    __tablename__ = "bout_product_variants"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    product_id = Column(UUID(as_uuid=True),
                        ForeignKey("bout_products.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    size_id = Column(UUID(as_uuid=True),
                     ForeignKey("bout_sizes.id", ondelete="RESTRICT"),
                     nullable=False, index=True)
    color_id = Column(UUID(as_uuid=True),
                      ForeignKey("bout_colors.id", ondelete="RESTRICT"),
                      nullable=False, index=True)
    sku = Column(String(80), unique=True, nullable=False, index=True)
    ean = Column(String(20))
    precio_sobrecargo = Column(Numeric(10, 2), default=0)
    stock_actual = Column(Integer, default=0)
    stock_minimo = Column(Integer, default=0)
    stock_reservado = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    producto = relationship("BoutiqueProduct", back_populates="variantes")
    size = relationship("BoutiqueSize")
    color = relationship("BoutiqueColor")
    __table_args__ = (
        UniqueConstraint("product_id", "size_id", "color_id",
                         name="uq_bout_variant_product_size_color"),
    )
    @property
    def stock_disponible(self):
        return self.stock_actual - self.stock_reservado

    @property
    def precio_final(self):
        return self.producto.precio_base + self.precio_sobrecargo if self.producto else None


# ============================================================
# 5. INVENTARIO POR VARIANTE (movimientos)
# ============================================================
class BoutiqueVariantStockMovement(Base):
    __tablename__ = "bout_stock_movements"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True),
                        ForeignKey("bout_product_variants.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # ingreso, egreso, ajuste, reserva, devolucion
    cantidad = Column(Integer, nullable=False)
    stock_resultante = Column(Integer, nullable=False)
    referencia_tipo = Column(String(50))  # venta, compra, transferencia, inventario
    referencia_id = Column(String(100))
    nota = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    variant = relationship("BoutiqueProductVariant")


# ============================================================
# 6. VENTAS (transaccionales, referencia a orders existente)
# ============================================================
class BoutiqueSale(Base):
    __tablename__ = "bout_sales"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fecha = Column(DateTime(timezone=True), default=_utcnow)
    subtotal = Column(Numeric(12, 2), nullable=False)
    descuento = Column(Numeric(12, 2), default=0)
    impuesto = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False)
    moneda = Column(String(10), default="PYG")
    tipo_venta = Column(String(20), default="tienda")  # tienda, online, whatsapp, feria
    incluye_gift_wrapping = Column(Boolean, default=False)
    gift_wrapping_fee = Column(Numeric(10, 2), default=0)
    notas = Column(Text)
    external_order_id = Column(UUID(as_uuid=True))  # referencia al sistema core
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    items = relationship("BoutiqueSaleItem", back_populates="venta",
                          cascade="all, delete-orphan")


class BoutiqueSaleItem(Base):
    __tablename__ = "bout_sale_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    sale_id = Column(UUID(as_uuid=True),
                     ForeignKey("bout_sales.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True),
                         ForeignKey("bout_products.id", ondelete="RESTRICT"),
                         nullable=False)
    variant_id = Column(UUID(as_uuid=True),
                        ForeignKey("bout_product_variants.id", ondelete="RESTRICT"))
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    descuento_item = Column(Numeric(12, 2), default=0)
    venta = relationship("BoutiqueSale", back_populates="items")
    producto = relationship("BoutiqueProduct")
    variant = relationship("BoutiqueProductVariant")


# ============================================================
# 7. DEVOLUCIONES / CAMBIOS
# ============================================================
class BoutiqueReturn(Base):
    __tablename__ = "bout_returns"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True),
                     ForeignKey("bout_sales.id", ondelete="SET NULL"))
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fecha = Column(DateTime(timezone=True), default=_utcnow)
    motivo = Column(String(50), nullable=False)  # talle_incorrecto, defecto, cambio_opinion
    estado = Column(String(20), default="pendiente")
    tipo_reintegro = Column(String(20))  # reembolso, cambio, credito_tienda
    total_reintegro = Column(Numeric(12, 2))
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    items = relationship("BoutiqueReturnItem", back_populates="return_",
                          cascade="all, delete-orphan")


class BoutiqueReturnItem(Base):
    __tablename__ = "bout_return_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    return_id = Column(UUID(as_uuid=True),
                       ForeignKey("bout_returns.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    sale_item_id = Column(UUID(as_uuid=True),
                          ForeignKey("bout_sale_items.id", ondelete="SET NULL"))
    variant_id = Column(UUID(as_uuid=True),
                        ForeignKey("bout_product_variants.id", ondelete="RESTRICT"),
                        nullable=False)
    cantidad = Column(Integer, nullable=False)
    motivo = Column(String(100))
    estado_item = Column(String(20))  # nuevo, usado, danado
    return_ = relationship("BoutiqueReturn", back_populates="items")


# ============================================================
# 8. CLIENTELING
# ============================================================
class BoutiqueClientProfile(Base):
    __tablename__ = "bout_client_profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    tipo_cliente = Column(String(30), default="regular")
    fecha_alta = Column(DateTime(timezone=True), default=_utcnow)
    ultima_visita = Column(DateTime(timezone=True))
    genero_preferido = Column(String(20))
    total_gastado = Column(Numeric(12, 2), default=0)
    total_compras = Column(Integer, default=0)
    talla_preferida_id = Column(UUID(as_uuid=True),
                                ForeignKey("bout_sizes.id", ondelete="SET NULL"))
    color_preferido_id = Column(UUID(as_uuid=True),
                                ForeignKey("bout_colors.id", ondelete="SET NULL"))
    marcas_preferidas = Column(ARRAY(String), default=[])
    estilo = Column(String(50))  # casual, formal, deportivo, bohemio, clasico
    temporada_preferida = Column(String(20))
    cumpleanos = Column(Date)
    aniversario = Column(Date)
    notas_estilista = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class BoutiqueClientInteraction(Base):
    __tablename__ = "bout_client_interactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # visita, compra, devolucion, consulta, fitting
    fecha = Column(DateTime(timezone=True), default=_utcnow)
    canal = Column(String(30))  # tienda, whatsapp, instagram, web
    notas = Column(Text)
    proximo_seguimiento = Column(Date)
    realizada_por = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class BoutiqueClientDocument(Base):
    __tablename__ = "bout_client_documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(50))  # selfie, documento, comprobante_domicilio
    url = Column(Text, nullable=False)
    verificado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 9. LOYALTY / FIDELIZACION
# ============================================================
class BoutiqueLoyaltyConfig(Base):
    __tablename__ = "bout_loyalty_config"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    puntos_por_guarani = Column(Numeric(10, 4), default=0.01)
    guarani_por_punto = Column(Numeric(10, 4), default=100)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    tiers = relationship("BoutiqueLoyaltyTier", back_populates="config",
                          cascade="all, delete-orphan")


class BoutiqueLoyaltyTier(Base):
    __tablename__ = "bout_loyalty_tiers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    config_id = Column(UUID(as_uuid=True),
                       ForeignKey("bout_loyalty_config.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    codigo = Column(String(30), nullable=False)  # bronze, silver, gold, platinum
    nombre = Column(String(100), nullable=False)
    nivel = Column(Integer, nullable=False)
    gasto_minimo_acumulado = Column(Numeric(12, 2))
    puntos_minimos = Column(Integer)
    multiplicador_puntos = Column(Numeric(5, 2), default=1.0)
    descuento_percent = Column(Numeric(5, 2), default=0)
    beneficio_envio_gratis = Column(Boolean, default=False)
    beneficio_acceso_anticipado = Column(Boolean, default=False)
    beneficio_gift_wrapping_gratis = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    config = relationship("BoutiqueLoyaltyConfig", back_populates="tiers")


class BoutiqueLoyaltyAccount(Base):
    __tablename__ = "bout_loyalty_accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    tier_id = Column(UUID(as_uuid=True),
                     ForeignKey("bout_loyalty_tiers.id", ondelete="RESTRICT"),
                     index=True)
    puntos_acumulados = Column(Integer, default=0)
    puntos_canjeados = Column(Integer, default=0)
    puntos_disponibles = Column(Integer, default=0)
    gasto_total = Column(Numeric(12, 2), default=0)
    ultima_actualizacion = Column(DateTime(timezone=True), default=_utcnow)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    tier = relationship("BoutiqueLoyaltyTier")


# ============================================================
# 10. MARKDOWN IA
# ============================================================
class BoutiqueMarkdownRule(Base):
    __tablename__ = "bout_markdown_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(30), nullable=False)  # fin_temporada, exceso_stock, lanzamiento, promocion
    temporada = Column(String(20))
    categoria_id = Column(UUID(as_uuid=True),
                          ForeignKey("bout_categories.id", ondelete="SET NULL"))
    descuento_maximo = Column(Numeric(5, 2), default=70)
    descuento_minimo = Column(Numeric(5, 2), default=5)
    dias_antes_fin_temporada = Column(Integer)
    factor_rotacion_minimo = Column(Numeric(5, 2))
    activo = Column(Boolean, default=True)
    prioridad = Column(Integer, default=0)  # mayor prioridad se aplica primero
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    items_aplicados = relationship("BoutiqueMarkdownItem", back_populates="rule",
                                    cascade="all, delete-orphan")


class BoutiqueMarkdownItem(Base):
    __tablename__ = "bout_markdown_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    rule_id = Column(UUID(as_uuid=True),
                     ForeignKey("bout_markdown_rules.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True),
                        ForeignKey("bout_product_variants.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True),
                         ForeignKey("bout_products.id", ondelete="CASCADE"),
                         nullable=False)
    descuento_aplicado = Column(Numeric(5, 2))
    precio_original = Column(Numeric(12, 2), nullable=False)
    precio_markdown = Column(Numeric(12, 2))
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    activo = Column(Boolean, default=True)
    aplicado_automaticamente = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    rule = relationship("BoutiqueMarkdownRule", back_populates="items_aplicados")
    variant = relationship("BoutiqueProductVariant")
    producto = relationship("BoutiqueProduct")


# ============================================================
# 11. AR TRY-ON (Realidad Aumentada)
# ============================================================
class BoutiqueProductARMetadata(Base):
    __tablename__ = "bout_product_ar"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id = Column(UUID(as_uuid=True),
                         ForeignKey("bout_products.id", ondelete="CASCADE"),
                         unique=True, nullable=False, index=True)
    modelo_3d_url = Column(Text)
    glb_url = Column(Text)
    usdz_url = Column(Text)
    puntos_anclaje = Column(JSONB, default=dict)
    talles_disponibles_ar = Column(ARRAY(String), default=[])
    color_calibration_hex = Column(String(7))
    proveedor_ar = Column(String(50))  # zelig, google_ar_core,自家
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    producto = relationship("BoutiqueProduct")


# ============================================================
# 12. GIFT WRAPPING
# ============================================================
class BoutiqueGiftWrappingOption(Base):
    __tablename__ = "bout_gift_wrapping"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    precio = Column(Numeric(10, 2), default=0)
    imagen_url = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 13. TALLAS PERSONALIZADAS (bespoke/alteraciones)
# ============================================================
class BoutiqueClientMeasurement(Base):
    __tablename__ = "bout_client_measurements"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo_medida = Column(String(30))  # cuerpo, prenda_referencia
    pecho_cm = Column(Numeric(6, 2))
    cintura_cm = Column(Numeric(6, 2))
    cadera_cm = Column(Numeric(6, 2))
    largo_torso_cm = Column(Numeric(6, 2))
    largo_brazo_cm = Column(Numeric(6, 2))
    hombro_cm = Column(Numeric(6, 2))
    talle_pantalon_cm = Column(Numeric(6, 2))
    contorno_pierna_cm = Column(Numeric(6, 2))
    zapato_br = Column(Integer)
    notas_adicionales = Column(Text)
    fecha_tomada = Column(Date, default=_utcnow)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 14. EVENTOS / POP-UPS
# ============================================================
class BoutiqueEvent(Base):
    __tablename__ = "bout_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(30))  # lanzamiento, pop_up, fashion_show, private_sale
    descripcion = Column(Text)
    fecha_inicio = Column(DateTime(timezone=True), nullable=False)
    fecha_fin = Column(DateTime(timezone=True))
    ubicacion = Column(String(300))
    capacidad_maxima = Column(Integer)
    invitados = Column(Integer, default=0)
    estado = Column(String(20), default="borrador")
    imagen_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class BoutiqueEventGuest(Base):
    __tablename__ = "bout_event_guests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id = Column(UUID(as_uuid=True),
                      ForeignKey("bout_events.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    confirmado = Column(Boolean, default=False)
    asistio = Column(Boolean, default=False)
    acompanantes = Column(Integer, default=1)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
