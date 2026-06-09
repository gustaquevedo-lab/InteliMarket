"""Migracion: Modulo Boutique/Indumentaria (bout_*) - 25+ tablas.

Colecciones, talles, colores, categorias jerarquicas, productos con matriz
variante (talle x color), inventario por variante, ventas, devoluciones,
clienteling, loyalty, markdown IA, AR try-on, gift wrapping, medidas,
eventos.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "20260607000000"
down_revision = "20260604000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. BOUT_SIZES
    op.create_table(
        "bout_sizes",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(20), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("categoria", sa.String(50)),
        sa.Column("orden", sa.Integer, server_default="0"),
        sa.Column("medida_referencia_cm", sa.Numeric(8, 2)),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. BOUT_COLORS
    op.create_table(
        "bout_colors",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(30), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("hex", sa.String(7)),
        sa.Column("familia", sa.String(50)),
        sa.Column("es_basico", sa.Boolean, server_default="false"),
        sa.Column("orden", sa.Integer, server_default="0"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. BOUT_CATEGORIES (jerarquica)
    op.create_table(
        "bout_categories",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("parent_id", UUID, sa.ForeignKey("bout_categories.id", ondelete="SET NULL"), index=True),
        sa.Column("nivel", sa.Integer, server_default="0"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("imagen_url", sa.Text),
        sa.Column("orden", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. BOUT_COLLECTIONS
    op.create_table(
        "bout_collections",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("temporada", sa.String(20), nullable=False),
        sa.Column("anio", sa.Integer, nullable=False),
        sa.Column("fecha_inicio", sa.Date),
        sa.Column("fecha_fin", sa.Date),
        sa.Column("estado", sa.String(20), server_default="borrador"),
        sa.Column("imagen_url", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 5. BOUT_PRODUCTS
    op.create_table(
        "bout_products",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(300), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("categoria_id", UUID, sa.ForeignKey("bout_categories.id", ondelete="SET NULL"), index=True),
        sa.Column("tipo_producto", sa.String(30), server_default="indumentaria"),
        sa.Column("genero", sa.String(20)),
        sa.Column("marca", sa.String(200)),
        sa.Column("material", sa.String(200)),
        sa.Column("cuidados", sa.Text),
        sa.Column("precio_base", sa.Numeric(12, 2), nullable=False),
        sa.Column("costo_promedio", sa.Numeric(12, 2)),
        sa.Column("moneda", sa.String(10), server_default="PYG"),
        sa.Column("imagen_principal", sa.Text),
        sa.Column("imagenes_adicionales", JSONB, server_default="[]"),
        sa.Column("tags", ARRAY(sa.String), server_default="{}"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("destacado", sa.Boolean, server_default="false"),
        sa.Column("incluye_gift_wrapping", sa.Boolean, server_default="false"),
        sa.Column("gift_wrapping_surcharge", sa.Numeric(10, 2)),
        sa.Column("meta_title", sa.String(200)),
        sa.Column("meta_description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 6. BOUT_PRODUCT_VARIANTS
    op.create_table(
        "bout_product_variants",
        sa.Column("id", UUID, nullable=False),
        sa.Column("product_id", UUID, sa.ForeignKey("bout_products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("size_id", UUID, sa.ForeignKey("bout_sizes.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("color_id", UUID, sa.ForeignKey("bout_colors.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("sku", sa.String(80), nullable=False, index=True, unique=True),
        sa.Column("ean", sa.String(20)),
        sa.Column("precio_sobrecargo", sa.Numeric(10, 2), server_default="0"),
        sa.Column("stock_actual", sa.Integer, server_default="0"),
        sa.Column("stock_minimo", sa.Integer, server_default="0"),
        sa.Column("stock_reservado", sa.Integer, server_default="0"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "size_id", "color_id", name="uq_bout_variant_product_size_color"),
    )

    # 7. BOUT_COLLECTION_ITEMS
    op.create_table(
        "bout_collection_items",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("collection_id", UUID, sa.ForeignKey("bout_collections.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("producto_id", UUID, sa.ForeignKey("bout_products.id"), nullable=False, index=True),
        sa.Column("orden", sa.Integer, server_default="0"),
        sa.Column("destacado", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. BOUT_STOCK_MOVEMENTS
    op.create_table(
        "bout_stock_movements",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("variant_id", UUID, sa.ForeignKey("bout_product_variants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("stock_resultante", sa.Integer, nullable=False),
        sa.Column("referencia_tipo", sa.String(50)),
        sa.Column("referencia_id", sa.String(100)),
        sa.Column("nota", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 9. BOUT_SALES
    op.create_table(
        "bout_sales",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("customer_id", UUID, nullable=False, index=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("descuento", sa.Numeric(12, 2), server_default="0"),
        sa.Column("impuesto", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("moneda", sa.String(10), server_default="PYG"),
        sa.Column("tipo_venta", sa.String(20), server_default="tienda"),
        sa.Column("incluye_gift_wrapping", sa.Boolean, server_default="false"),
        sa.Column("gift_wrapping_fee", sa.Numeric(10, 2), server_default="0"),
        sa.Column("notas", sa.Text),
        sa.Column("external_order_id", UUID),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 10. BOUT_SALE_ITEMS
    op.create_table(
        "bout_sale_items",
        sa.Column("id", UUID, nullable=False),
        sa.Column("sale_id", UUID, sa.ForeignKey("bout_sales.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("producto_id", UUID, sa.ForeignKey("bout_products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("variant_id", UUID, sa.ForeignKey("bout_product_variants.id", ondelete="RESTRICT")),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("precio_unitario", sa.Numeric(12, 2), nullable=False),
        sa.Column("descuento_item", sa.Numeric(12, 2), server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 11. BOUT_RETURNS
    op.create_table(
        "bout_returns",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("sale_id", UUID, sa.ForeignKey("bout_sales.id", ondelete="SET NULL")),
        sa.Column("customer_id", UUID, nullable=False, index=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("motivo", sa.String(50), nullable=False),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("tipo_reintegro", sa.String(20)),
        sa.Column("total_reintegro", sa.Numeric(12, 2)),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 12. BOUT_RETURN_ITEMS
    op.create_table(
        "bout_return_items",
        sa.Column("id", UUID, nullable=False),
        sa.Column("return_id", UUID, sa.ForeignKey("bout_returns.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("sale_item_id", UUID, sa.ForeignKey("bout_sale_items.id", ondelete="SET NULL")),
        sa.Column("variant_id", UUID, sa.ForeignKey("bout_product_variants.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("cantidad", sa.Integer, nullable=False),
        sa.Column("motivo", sa.String(100)),
        sa.Column("estado_item", sa.String(20)),
        sa.PrimaryKeyConstraint("id"),
    )

    # 13. BOUT_CLIENT_PROFILES
    op.create_table(
        "bout_client_profiles",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("customer_id", UUID, nullable=False, index=True, unique=True),
        sa.Column("tipo_cliente", sa.String(30), server_default="regular"),
        sa.Column("fecha_alta", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ultima_visita", sa.DateTime(timezone=True)),
        sa.Column("genero_preferido", sa.String(20)),
        sa.Column("total_gastado", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_compras", sa.Integer, server_default="0"),
        sa.Column("talla_preferida_id", UUID, sa.ForeignKey("bout_sizes.id", ondelete="SET NULL")),
        sa.Column("color_preferido_id", UUID, sa.ForeignKey("bout_colors.id", ondelete="SET NULL")),
        sa.Column("marcas_preferidas", ARRAY(sa.String), server_default="{}"),
        sa.Column("estilo", sa.String(50)),
        sa.Column("temporada_preferida", sa.String(20)),
        sa.Column("cumpleanos", sa.Date),
        sa.Column("aniversario", sa.Date),
        sa.Column("notas_estilista", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 14. BOUT_CLIENT_INTERACTIONS
    op.create_table(
        "bout_client_interactions",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("customer_id", UUID, nullable=False, index=True),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("canal", sa.String(30)),
        sa.Column("notas", sa.Text),
        sa.Column("proximo_seguimiento", sa.Date),
        sa.Column("realizada_por", UUID),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 15. BOUT_CLIENT_DOCUMENTS
    op.create_table(
        "bout_client_documents",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("customer_id", UUID, nullable=False, index=True),
        sa.Column("tipo", sa.String(50)),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("verificado", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 16. BOUT_LOYALTY_CONFIG
    op.create_table(
        "bout_loyalty_config",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True, unique=True),
        sa.Column("puntos_por_guarani", sa.Numeric(10, 4), server_default="0.01"),
        sa.Column("guarani_por_punto", sa.Numeric(10, 4), server_default="100"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 17. BOUT_LOYALTY_TIERS
    op.create_table(
        "bout_loyalty_tiers",
        sa.Column("id", UUID, nullable=False),
        sa.Column("config_id", UUID, sa.ForeignKey("bout_loyalty_config.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("codigo", sa.String(30), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("nivel", sa.Integer, nullable=False),
        sa.Column("gasto_minimo_acumulado", sa.Numeric(12, 2)),
        sa.Column("puntos_minimos", sa.Integer),
        sa.Column("multiplicador_puntos", sa.Numeric(5, 2), server_default="1.0"),
        sa.Column("descuento_percent", sa.Numeric(5, 2), server_default="0"),
        sa.Column("beneficio_envio_gratis", sa.Boolean, server_default="false"),
        sa.Column("beneficio_acceso_anticipado", sa.Boolean, server_default="false"),
        sa.Column("beneficio_gift_wrapping_gratis", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 18. BOUT_LOYALTY_ACCOUNTS
    op.create_table(
        "bout_loyalty_accounts",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("customer_id", UUID, nullable=False, index=True, unique=True),
        sa.Column("tier_id", UUID, sa.ForeignKey("bout_loyalty_tiers.id", ondelete="RESTRICT"), index=True),
        sa.Column("puntos_acumulados", sa.Integer, server_default="0"),
        sa.Column("puntos_canjeados", sa.Integer, server_default="0"),
        sa.Column("puntos_disponibles", sa.Integer, server_default="0"),
        sa.Column("gasto_total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("ultima_actualizacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 19. BOUT_MARKDOWN_RULES
    op.create_table(
        "bout_markdown_rules",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("temporada", sa.String(20)),
        sa.Column("categoria_id", UUID, sa.ForeignKey("bout_categories.id", ondelete="SET NULL")),
        sa.Column("descuento_maximo", sa.Numeric(5, 2), server_default="70"),
        sa.Column("descuento_minimo", sa.Numeric(5, 2), server_default="5"),
        sa.Column("dias_antes_fin_temporada", sa.Integer),
        sa.Column("factor_rotacion_minimo", sa.Numeric(5, 2)),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("prioridad", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 20. BOUT_MARKDOWN_ITEMS
    op.create_table(
        "bout_markdown_items",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("rule_id", UUID, sa.ForeignKey("bout_markdown_rules.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("variant_id", UUID, sa.ForeignKey("bout_product_variants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("producto_id", UUID, sa.ForeignKey("bout_products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("descuento_aplicado", sa.Numeric(5, 2)),
        sa.Column("precio_original", sa.Numeric(12, 2), nullable=False),
        sa.Column("precio_markdown", sa.Numeric(12, 2)),
        sa.Column("fecha_inicio", sa.Date),
        sa.Column("fecha_fin", sa.Date),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("aplicado_automaticamente", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 21. BOUT_PRODUCT_AR
    op.create_table(
        "bout_product_ar",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("producto_id", UUID, sa.ForeignKey("bout_products.id", ondelete="CASCADE"), nullable=False, index=True, unique=True),
        sa.Column("modelo_3d_url", sa.Text),
        sa.Column("glb_url", sa.Text),
        sa.Column("usdz_url", sa.Text),
        sa.Column("puntos_anclaje", JSONB, server_default="{}"),
        sa.Column("talles_disponibles_ar", ARRAY(sa.String), server_default="{}"),
        sa.Column("color_calibration_hex", sa.String(7)),
        sa.Column("proveedor_ar", sa.String(50)),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 22. BOUT_GIFT_WRAPPING
    op.create_table(
        "bout_gift_wrapping",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("precio", sa.Numeric(10, 2), server_default="0"),
        sa.Column("imagen_url", sa.Text),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 23. BOUT_CLIENT_MEASUREMENTS
    op.create_table(
        "bout_client_measurements",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("customer_id", UUID, nullable=False, index=True),
        sa.Column("tipo_medida", sa.String(30)),
        sa.Column("pecho_cm", sa.Numeric(6, 2)),
        sa.Column("cintura_cm", sa.Numeric(6, 2)),
        sa.Column("cadera_cm", sa.Numeric(6, 2)),
        sa.Column("largo_torso_cm", sa.Numeric(6, 2)),
        sa.Column("largo_brazo_cm", sa.Numeric(6, 2)),
        sa.Column("hombro_cm", sa.Numeric(6, 2)),
        sa.Column("talle_pantalon_cm", sa.Numeric(6, 2)),
        sa.Column("contorno_pierna_cm", sa.Numeric(6, 2)),
        sa.Column("zapato_br", sa.Integer),
        sa.Column("notas_adicionales", sa.Text),
        sa.Column("fecha_tomada", sa.Date, server_default=sa.func.current_date()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 24. BOUT_EVENTS
    op.create_table(
        "bout_events",
        sa.Column("id", UUID, nullable=False),
        sa.Column("company_id", UUID, nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True, unique=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(30)),
        sa.Column("descripcion", sa.Text),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fecha_fin", sa.DateTime(timezone=True)),
        sa.Column("ubicacion", sa.String(300)),
        sa.Column("capacidad_maxima", sa.Integer),
        sa.Column("invitados", sa.Integer, server_default="0"),
        sa.Column("estado", sa.String(20), server_default="borrador"),
        sa.Column("imagen_url", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # 25. BOUT_EVENT_GUESTS
    op.create_table(
        "bout_event_guests",
        sa.Column("id", UUID, nullable=False),
        sa.Column("event_id", UUID, sa.ForeignKey("bout_events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("customer_id", UUID, nullable=False, index=True),
        sa.Column("confirmado", sa.Boolean, server_default="false"),
        sa.Column("asistio", sa.Boolean, server_default="false"),
        sa.Column("acompanantes", sa.Integer, server_default="1"),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    tables = [
        "bout_event_guests", "bout_events", "bout_client_measurements",
        "bout_gift_wrapping", "bout_product_ar", "bout_markdown_items",
        "bout_markdown_rules", "bout_loyalty_accounts", "bout_loyalty_tiers",
        "bout_loyalty_config", "bout_client_documents", "bout_client_interactions",
        "bout_client_profiles", "bout_return_items", "bout_returns",
        "bout_sale_items", "bout_sales", "bout_stock_movements",
        "bout_collection_items", "bout_product_variants", "bout_products",
        "bout_collections", "bout_categories", "bout_colors", "bout_sizes",
    ]
    for t in tables:
        op.drop_table(t)
