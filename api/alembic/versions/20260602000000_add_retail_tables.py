"""add_retail_tables

Creates rt_* tables for the Retail/Tienda vertical module:
- rt_store_config: per-branch retail configuration (m², hours, POS config)
- rt_kpi_snapshot: cached daily/weekly/monthly KPIs
- rt_hour_heatmap: sales by hour x day
- rt_coupon + rt_coupon_redemption: digital coupons
- rt_calendar_event + rt_event_promo: Paraguay-aware events and promos
- rt_cash_session: POS cash register sessions
- rt_quick_customer: rapid customer identification log
- rt_online_storefront: per-branch online store config

Revision ID: 20260602000000
Revises: 20260601420000
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = "20260602000000"
down_revision = "20260601420000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Store Config ───────────────────────────────────────
    op.create_table(
        "rt_store_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("metros_cuadrados", sa.Numeric(10, 2), server_default="0"),
        sa.Column("tipo", sa.String(50), server_default="retail"),
        sa.Column("hora_apertura", sa.String(5), server_default="08:00"),
        sa.Column("hora_cierre", sa.String(5), server_default="20:00"),
        sa.Column("dias_abiertos", sa.String(50), server_default="1,2,3,4,5,6"),
        sa.Column("capacidad_horaria", sa.Integer, server_default="20"),
        sa.Column("config_pos", JSONB, server_default="{}"),
        sa.Column("config_online", JSONB, server_default="{}"),
        sa.Column("activo", sa.Boolean, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_rt_store_config_company_branch", "rt_store_config", ["company_id", "branch_id"], unique=True)

    # ── KPI Snapshot ───────────────────────────────────────
    op.create_table(
        "rt_kpi_snapshot",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), index=True),
        sa.Column("fecha", sa.Date, nullable=False, index=True),
        sa.Column("periodo", sa.String(10), nullable=False),
        sa.Column("ventas_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("ventas_count", sa.Integer, server_default="0"),
        sa.Column("ticket_promedio", sa.Numeric(15, 0), server_default="0"),
        sa.Column("ventas_m2", sa.Numeric(15, 2), server_default="0"),
        sa.Column("margen_bruto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("clientes_unicos", sa.Integer, server_default="0"),
        sa.Column("productos_vendidos", sa.Integer, server_default="0"),
        sa.Column("descuento_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("delta_ventas_pct", sa.Numeric(6, 2), server_default="0"),
        sa.Column("delta_ticket_pct", sa.Numeric(6, 2), server_default="0"),
        sa.Column("delta_clientes_pct", sa.Numeric(6, 2), server_default="0"),
        sa.Column("hora_pico", sa.Integer),
        sa.Column("hora_pico_ventas", sa.Numeric(15, 0), server_default="0"),
        sa.Column("conversion_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("payload", JSONB, server_default="{}"),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Hour Heatmap ───────────────────────────────────────
    op.create_table(
        "rt_hour_heatmap",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), index=True),
        sa.Column("fecha", sa.Date, nullable=False, index=True),
        sa.Column("hora", sa.Integer, nullable=False),
        sa.Column("ventas_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("ventas_count", sa.Integer, server_default="0"),
        sa.Column("clientes_count", sa.Integer, server_default="0"),
        sa.Column("duracion_promedio_min", sa.Integer, server_default="0"),
        sa.Column("personal_sugerido", sa.Integer, server_default="0"),
    )
    op.create_index("ix_rt_hour_heatmap_company_fecha", "rt_hour_heatmap", ["company_id", "fecha", "hora"])

    # ── Coupons ────────────────────────────────────────────
    op.create_table(
        "rt_coupon",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("codigo", sa.String(20), nullable=False, unique=True, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("valor", sa.Numeric(15, 2), server_default="0"),
        sa.Column("compra_minima", sa.Numeric(15, 0), server_default="0"),
        sa.Column("segmento_id", UUID(as_uuid=True)),
        sa.Column("segmento_nombre", sa.String(200)),
        sa.Column("clientes_target", JSONB, server_default="[]"),
        sa.Column("aplicar_a", sa.String(20), server_default="todos"),
        sa.Column("categorias_ids", JSONB, server_default="[]"),
        sa.Column("productos_ids", JSONB, server_default="[]"),
        sa.Column("fecha_desde", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fecha_hasta", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usos_maximos", sa.Integer, server_default="0"),
        sa.Column("usos_por_cliente", sa.Integer, server_default="1"),
        sa.Column("usos_actuales", sa.Integer, server_default="0"),
        sa.Column("estado", sa.String(20), server_default="activo"),
        sa.Column("canal", sa.String(20), server_default="todos"),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "rt_coupon_redemption",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("coupon_id", UUID(as_uuid=True), sa.ForeignKey("rt_coupon.id"), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True)),
        sa.Column("sale_id", UUID(as_uuid=True)),
        sa.Column("branch_id", UUID(as_uuid=True)),
        sa.Column("monto_descuento", sa.Numeric(15, 0), server_default="0"),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("vendedor", sa.String(200)),
        sa.Column("foto_ticket", sa.String(500)),
        sa.Column("notas", sa.Text),
    )

    # ── Calendar Events ────────────────────────────────────
    op.create_table(
        "rt_calendar_event",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("codigo", sa.String(50), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("fecha_evento", sa.Date, nullable=False, index=True),
        sa.Column("fecha_fin", sa.Date),
        sa.Column("categoria", sa.String(50)),
        sa.Column("icono", sa.String(20), server_default="🎉"),
        sa.Column("recurrente", sa.Boolean, server_default=sa.true()),
        sa.Column("activo", sa.Boolean, server_default=sa.true()),
        sa.Column("notas_planificacion", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "rt_event_promo",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("rt_calendar_event.id"), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("valor", sa.Numeric(15, 2), server_default="0"),
        sa.Column("fecha_desde", sa.Date, nullable=False),
        sa.Column("fecha_hasta", sa.Date, nullable=False),
        sa.Column("estado", sa.String(20), server_default="planificada"),
        sa.Column("productos_ids", JSONB, server_default="[]"),
        sa.Column("categorias_ids", JSONB, server_default="[]"),
        sa.Column("bundle_config", JSONB, server_default="{}"),
        sa.Column("presupuesto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("inversion_marketing", sa.Numeric(15, 0), server_default="0"),
        sa.Column("ventas_atribuidas", sa.Numeric(15, 0), server_default="0"),
        sa.Column("roi_pct", sa.Numeric(8, 2), server_default="0"),
        sa.Column("copy_sugerido", sa.Text),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Cash Sessions ──────────────────────────────────────
    op.create_table(
        "rt_cash_session",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("usuario_id", UUID(as_uuid=True), nullable=False),
        sa.Column("usuario_nombre", sa.String(200)),
        sa.Column("monto_apertura", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_cierre", sa.Numeric(15, 0)),
        sa.Column("monto_teorico", sa.Numeric(15, 0)),
        sa.Column("diferencia", sa.Numeric(15, 0)),
        sa.Column("ventas_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("ventas_count", sa.Integer, server_default="0"),
        sa.Column("descuentos_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("movimientos", JSONB, server_default="[]"),
        sa.Column("fecha_apertura", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_cierre", sa.DateTime(timezone=True)),
        sa.Column("estado", sa.String(20), server_default="abierta"),
        sa.Column("notas", sa.Text),
    )

    # ── Quick Customer ─────────────────────────────────────
    op.create_table(
        "rt_quick_customer",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("identificador", sa.String(100), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True)),
        sa.Column("customer_nombre", sa.String(300)),
        sa.Column("puntos", sa.Integer, server_default="0"),
        sa.Column("segmento", sa.String(50)),
        sa.Column("proxima_recompensa", sa.String(200)),
        sa.Column("descuento_aplicable", sa.Numeric(15, 0), server_default="0"),
        sa.Column("ultima_consulta", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("conteo_consultas", sa.Integer, server_default="1"),
    )

    # ── Online Storefront ──────────────────────────────────
    op.create_table(
        "rt_online_storefront",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("nombre_publico", sa.String(200)),
        sa.Column("mensaje_bienvenida", sa.Text),
        sa.Column("color_primario", sa.String(20), server_default="#0d9488"),
        sa.Column("logo_url", sa.String(500)),
        sa.Column("banner_url", sa.String(500)),
        sa.Column("metodos_pago", JSONB, server_default='["pagopar", "contra_entrega"]'),
        sa.Column("delivery_activo", sa.Boolean, server_default=sa.true()),
        sa.Column("delivery_km_max", sa.Integer, server_default="10"),
        sa.Column("delivery_costo_km", sa.Numeric(15, 0), server_default="5000"),
        sa.Column("pickup_activo", sa.Boolean, server_default=sa.true()),
        sa.Column("pickup_horas", sa.Integer, server_default="2"),
        sa.Column("senia_pct", sa.Numeric(5, 2), server_default="20"),
        sa.Column("productos_destacados", JSONB, server_default="[]"),
        sa.Column("horarios_atencion", JSONB, server_default="{}"),
        sa.Column("politicas", sa.Text),
        sa.Column("seo_meta", JSONB, server_default="{}"),
        sa.Column("activo", sa.Boolean, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("rt_online_storefront")
    op.drop_table("rt_quick_customer")
    op.drop_table("rt_cash_session")
    op.drop_table("rt_event_promo")
    op.drop_table("rt_calendar_event")
    op.drop_table("rt_coupon_redemption")
    op.drop_table("rt_coupon")
    op.drop_table("rt_hour_heatmap")
    op.drop_table("rt_kpi_snapshot")
    op.drop_table("rt_store_config")
