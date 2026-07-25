"""add distribuidora module tables (import, customer agreements, routes, credit)

Revision ID: 20260525060000
Revises: 20260525050000
Create Date: 2026-05-25 06:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260525060000"
down_revision: Union[str, None] = "20260525050000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Import containers
    op.create_table(
        "import_containers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero_contenedor", sa.String(30), nullable=False),
        sa.Column("booking", sa.String(50)),
        sa.Column("viaje", sa.String(50)),
        sa.Column("conocimiento_embarque", sa.String(50)),
        sa.Column("puerto_origen", sa.String(100), nullable=False),
        sa.Column("puerto_destino", sa.String(100), nullable=False),
        sa.Column("incoterm", sa.String(10), nullable=False, server_default="FOB"),
        sa.Column("fecha_zarpe", sa.Date()),
        sa.Column("fecha_llegada", sa.Date()),
        sa.Column("fecha_estiba", sa.Date()),
        sa.Column("fecha_nacionalizacion", sa.Date()),
        sa.Column("estado", sa.String(20), nullable=False, server_default="en_transito"),
        sa.Column("proveedor_transporte", sa.String(200)),
        sa.Column("agente_aduanero", sa.String(200)),
        sa.Column("referencia_aduana", sa.String(100)),
        sa.Column("moneda_origen", sa.String(3), server_default="USD"),
        sa.Column("tipo_cambio", sa.Numeric(12, 4), server_default="1"),
        sa.Column("valor_fob_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("flete_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("seguro_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("arancel_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("desaduanamiento_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("almacenaje_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("transporte_local_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("otros_costos", postgresql.JSON),
        sa.Column("otros_costos_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("costo_landed_total", sa.Numeric(15, 2), server_default="0"),
        sa.Column("factura_proveedor_url", sa.Text()),
        sa.Column("documentos_url", postgresql.JSON),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "import_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("container_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("import_containers.id"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("unidad_medida", sa.String(10), server_default="UN"),
        sa.Column("precio_unitario_fob", sa.Numeric(15, 4), nullable=False),
        sa.Column("costo_unitario_flete", sa.Numeric(15, 4), server_default="0"),
        sa.Column("costo_unitario_seguro", sa.Numeric(15, 4), server_default="0"),
        sa.Column("costo_unitario_arancel", sa.Numeric(15, 2), server_default="0"),
        sa.Column("costo_unitario_desaduanamiento", sa.Numeric(15, 2), server_default="0"),
        sa.Column("costo_unitario_almacenaje", sa.Numeric(15, 2), server_default="0"),
        sa.Column("costo_unitario_transporte_local", sa.Numeric(15, 2), server_default="0"),
        sa.Column("costo_unitario_otros", sa.Numeric(15, 2), server_default="0"),
        sa.Column("costo_unitario_landed", sa.Numeric(15, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Customer agreements
    op.create_table(
        "customer_agreements",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(30), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("renovacion_automatica", sa.Boolean(), server_default="false"),
        sa.Column("descuento_general_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("plazo_pago_dias", sa.Integer(), server_default="0"),
        sa.Column("limite_credito", sa.Numeric(15, 0), server_default="0"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("observaciones", sa.Text()),
        sa.Column("archivo_url", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "customer_agreement_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("agreement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customer_agreements.id"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("precio_especial", sa.Numeric(15, 2)),
        sa.Column("descuento_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("cantidad_minima", sa.Numeric(12, 3), server_default="0"),
        sa.Column("precio_lista_referencia", sa.Numeric(15, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Routes
    op.create_table(
        "sales_routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("codigo", sa.String(20)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("dias_semana", postgresql.JSON),
        sa.Column("zona", sa.String(100)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="activo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "route_customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("route_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales_routes.id"), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("orden_visita", sa.Integer(), server_default="0"),
        sa.Column("dia_semana", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "route_visits",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("route_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sales_routes.id"), nullable=False, index=True),
        sa.Column("route_customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("route_customers.id")),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("fecha_planificada", sa.Date(), nullable=False),
        sa.Column("fecha_visita", sa.DateTime(timezone=True)),
        sa.Column("latitud", sa.Numeric(10, 7)),
        sa.Column("longitud", sa.Numeric(10, 7)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("resultado", sa.String(30)),
        sa.Column("monto_cobrado", sa.Numeric(15, 2), server_default="0"),
        sa.Column("notas", sa.Text()),
        sa.Column("fotos_url", postgresql.JSON),
        sa.Column("firma_url", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Credit
    op.create_table(
        "customer_credit_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True, unique=True),
        sa.Column("limite_credito", sa.Numeric(15, 0), nullable=False, server_default="0"),
        sa.Column("limite_disponible", sa.Numeric(15, 0), server_default="0"),
        sa.Column("saldo_utilizado", sa.Numeric(15, 0), server_default="0"),
        sa.Column("dias_credito", sa.Integer(), server_default="0"),
        sa.Column("scoring", sa.Integer()),
        sa.Column("bloqueado_por_mora", sa.Boolean(), server_default="false"),
        sa.Column("dias_mora_maximo", sa.Integer(), server_default="0"),
        sa.Column("fecha_ultima_mora", sa.Date()),
        sa.Column("motivo_bloqueo", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "credit_authorizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("monto_solicitado", sa.Numeric(15, 2), nullable=False),
        sa.Column("monto_autorizado", sa.Numeric(15, 2)),
        sa.Column("motivo", sa.Text()),
        sa.Column("autorizado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("credit_authorizations")
    op.drop_table("customer_credit_limits")
    op.drop_table("route_visits")
    op.drop_table("route_customers")
    op.drop_table("sales_routes")
    op.drop_table("customer_agreement_items")
    op.drop_table("customer_agreements")
    op.drop_table("import_items")
    op.drop_table("import_containers")
