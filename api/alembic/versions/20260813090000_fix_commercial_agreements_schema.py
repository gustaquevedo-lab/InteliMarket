"""fix commercial_agreements schema drift and add missing agreement child tables

The commercial_agreements table was created by 20260525050000 with a bare-bones
schema (tenant_id, proveedor_id, condiciones text, archivo_url) for what appears
to have been an early/different feature. The commercial_agreements Python module
(models.py/service.py), used by SupplierContractsPage.tsx's Acuerdos/Negociaciones/
Cumplimiento tabs, expects a much richer schema (company_id, supplier_id, numero,
monto_ejecutado, rebate thresholds, etc.) that was never migrated -- so those tabs
have been crashing in production. The table is empty (0 rows), so this only adds
columns/tables, it does not touch or drop any existing column/data.

Revision ID: 20260813090000
Revises: 20260813080000
Create Date: 2026-08-13 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260813090000"
down_revision: Union[str, None] = "20260813080000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("commercial_agreements", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True, index=True))
    op.add_column("commercial_agreements", sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=True, index=True))
    op.add_column("commercial_agreements", sa.Column("numero", sa.String(30), nullable=True))
    op.add_column("commercial_agreements", sa.Column("nombre", sa.String(200), nullable=True))
    op.add_column("commercial_agreements", sa.Column("prioridad", sa.String(20), server_default="normal"))
    op.add_column("commercial_agreements", sa.Column("dias_aviso_renovacion", sa.Integer(), server_default="30"))
    op.add_column("commercial_agreements", sa.Column("condiciones_pago", sa.Text()))
    op.add_column("commercial_agreements", sa.Column("plazo_pago_dias", sa.Integer(), server_default="30"))
    op.add_column("commercial_agreements", sa.Column("moneda", sa.String(3), server_default="PYG"))
    op.add_column("commercial_agreements", sa.Column("tipo_cambio_fijo", sa.Numeric(10, 4)))
    op.add_column("commercial_agreements", sa.Column("forma_pago", sa.String(50)))
    op.add_column("commercial_agreements", sa.Column("aplica_iragru", sa.Boolean(), server_default="false"))
    op.add_column("commercial_agreements", sa.Column("tasa_iragru", sa.Numeric(5, 2)))
    op.add_column("commercial_agreements", sa.Column("aplica_retencion_iva", sa.Boolean(), server_default="false"))
    op.add_column("commercial_agreements", sa.Column("tasa_retencion_iva", sa.Numeric(5, 2)))
    op.add_column("commercial_agreements", sa.Column("categoria_retencion", sa.String(30)))
    op.add_column("commercial_agreements", sa.Column("exclusividad", sa.Boolean(), server_default="false"))
    op.add_column("commercial_agreements", sa.Column("zona_exclusividad", sa.String(200)))
    op.add_column("commercial_agreements", sa.Column("tipo_envio", sa.String(30)))
    op.add_column("commercial_agreements", sa.Column("porto_destino", sa.String(200)))
    op.add_column("commercial_agreements", sa.Column("monto_minimo_orden", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("monto_maximo_orden", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("monto_total_acordado", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("monto_ejecutado", sa.Numeric(15, 0), server_default="0"))
    op.add_column("commercial_agreements", sa.Column("volumen_minimo_mensual", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("unidad_medida", sa.String(30)))
    op.add_column("commercial_agreements", sa.Column("aplica_rebate", sa.Boolean(), server_default="false"))
    op.add_column("commercial_agreements", sa.Column("tipo_rebate", sa.String(20)))
    op.add_column("commercial_agreements", sa.Column("umbral_rebate_1", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("porcentaje_rebate_1", sa.Numeric(5, 2)))
    op.add_column("commercial_agreements", sa.Column("umbral_rebate_2", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("porcentaje_rebate_2", sa.Numeric(5, 2)))
    op.add_column("commercial_agreements", sa.Column("umbral_rebate_3", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("porcentaje_rebate_3", sa.Numeric(5, 2)))
    op.add_column("commercial_agreements", sa.Column("frecuencia_liquidacion_rebate", sa.String(20)))
    op.add_column("commercial_agreements", sa.Column("multa_incumplimiento", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("bonificacion_cumplimiento", sa.Numeric(15, 0)))
    op.add_column("commercial_agreements", sa.Column("nota_penalidad", sa.Text()))
    op.add_column("commercial_agreements", sa.Column("objeto", sa.Text()))
    op.add_column("commercial_agreements", sa.Column("observaciones", sa.Text()))
    op.add_column("commercial_agreements", sa.Column("user_id", postgresql.UUID(as_uuid=True)))
    op.add_column("commercial_agreements", sa.Column("aprobado_por", postgresql.UUID(as_uuid=True)))
    op.add_column("commercial_agreements", sa.Column("fecha_aprobacion", sa.DateTime(timezone=True)))
    # numero necesita ser unico para el modelo, pero la tabla ya existe (vacia) -- se agrega el
    # indice unico aparte de la columna para no chocar con create_table
    op.create_unique_constraint("uq_commercial_agreements_numero", "commercial_agreements", ["numero"])

    op.create_table(
        "agreement_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("agreement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("commercial_agreements.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("precio_acordado", sa.Numeric(15, 0), nullable=False),
        sa.Column("precio_lista", sa.Numeric(15, 0)),
        sa.Column("descuento_pct", sa.Numeric(5, 2)),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("tipo_precio", sa.String(20)),
        sa.Column("cantidad_minima", sa.Numeric(10, 3)),
        sa.Column("cantidad_multiple", sa.Numeric(10, 3)),
        sa.Column("iva_tasa", sa.Numeric(5, 2), server_default="10"),
        sa.Column("incluye_iva", sa.Boolean(), server_default="true"),
        sa.Column("lead_time_dias", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "agreement_rebates",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("agreement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("commercial_agreements.id"), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("periodo", sa.String(20), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("umbral_desde", sa.Numeric(15, 0), nullable=False),
        sa.Column("umbral_hasta", sa.Numeric(15, 0)),
        sa.Column("valor_rebate", sa.Numeric(15, 0), nullable=False),
        sa.Column("monto_aplicado", sa.Numeric(15, 0), server_default="0"),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("fecha_calculo", sa.DateTime(timezone=True)),
        sa.Column("fecha_aprobacion", sa.DateTime(timezone=True)),
        sa.Column("aprobado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "agreement_volumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("agreement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("commercial_agreements.id"), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("periodo", sa.String(20), nullable=False),
        sa.Column("tipo_periodo", sa.String(20), nullable=False),
        sa.Column("volumen_comprometido", sa.Numeric(15, 0), nullable=False),
        sa.Column("volumen_real", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_comprometido", sa.Numeric(15, 0), nullable=False),
        sa.Column("monto_real", sa.Numeric(15, 0), server_default="0"),
        sa.Column("porcentaje_cumplimiento", sa.Numeric(5, 1)),
        sa.Column("bonificacion_ganada", sa.Numeric(15, 0), server_default="0"),
        sa.Column("multa_aplicada", sa.Numeric(15, 0), server_default="0"),
        sa.Column("estado", sa.String(20), server_default="abierto"),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "supplier_negotiations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("estado", sa.String(20), server_default="abierta"),
        sa.Column("meta_precio", sa.Numeric(15, 0)),
        sa.Column("meta_descuento", sa.Numeric(5, 2)),
        sa.Column("precio_final", sa.Numeric(15, 0)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("supplier_negotiations")
    op.drop_table("agreement_volumes")
    op.drop_table("agreement_rebates")
    op.drop_table("agreement_items")
    op.drop_constraint("uq_commercial_agreements_numero", "commercial_agreements", type_="unique")
    for col in [
        "company_id", "supplier_id", "numero", "nombre", "prioridad", "dias_aviso_renovacion",
        "condiciones_pago", "plazo_pago_dias", "moneda", "tipo_cambio_fijo", "forma_pago",
        "aplica_iragru", "tasa_iragru", "aplica_retencion_iva", "tasa_retencion_iva", "categoria_retencion",
        "exclusividad", "zona_exclusividad", "tipo_envio", "porto_destino",
        "monto_minimo_orden", "monto_maximo_orden", "monto_total_acordado", "monto_ejecutado",
        "volumen_minimo_mensual", "unidad_medida", "aplica_rebate", "tipo_rebate",
        "umbral_rebate_1", "porcentaje_rebate_1", "umbral_rebate_2", "porcentaje_rebate_2",
        "umbral_rebate_3", "porcentaje_rebate_3", "frecuencia_liquidacion_rebate",
        "multa_incumplimiento", "bonificacion_cumplimiento", "nota_penalidad",
        "objeto", "observaciones", "user_id", "aprobado_por", "fecha_aprobacion",
    ]:
        op.drop_column("commercial_agreements", col)
