"""add promotions engine with rules, scheduling, coupons, usage tracking

Revision ID: 20260525000000
Revises: 20260524230000
Create Date: 2026-05-25 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260525000000"
down_revision: Union[str, None] = "20260524230000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promotions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("nombre", sa.String(150), nullable=False),
        sa.Column("descripcion", sa.Text()),
        # porcentaje | monto_fijo | dos_por_uno | combo_precio | cantidad_lleva
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("valor", sa.Numeric(15, 2)),
        sa.Column("valor_maximo", sa.Numeric(15, 2)),
        # producto | categoria | carrito | marca
        sa.Column("aplica_a", sa.String(20), nullable=False),
        sa.Column("producto_ids", postgresql.ARRAY(sa.UUID())),
        sa.Column("categoria_ids", postgresql.ARRAY(sa.UUID())),
        sa.Column("monto_minimo_compra", sa.Numeric(15, 2)),
        sa.Column("cantidad_minima", sa.Integer()),
        sa.Column("cantidad_maxima_items", sa.Integer()),
        sa.Column("aplicaciones_por_cliente", sa.Integer()),
        sa.Column("combinable", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("valido_desde", sa.Date(), nullable=False),
        sa.Column("valido_hasta", sa.Date(), nullable=False),
        sa.Column("horario_desde", sa.Time()),
        sa.Column("horario_hasta", sa.Time()),
        sa.Column("dias_semana", postgresql.ARRAY(sa.Integer())),
        sa.Column("codigo_cupon", sa.String(50)),
        sa.Column("requiere_cupon", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("usos_maximos", sa.Integer()),
        sa.Column("usos_actuales", sa.Integer(), server_default="0"),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_promotions_company", "promotions", ["company_id"])
    op.create_index("ix_promotions_vigencia", "promotions", ["valido_desde", "valido_hasta"])

    op.create_table(
        "promotion_usages",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("promotion_id", sa.UUID(), nullable=False, index=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("sale_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID()),
        sa.Column("branch_id", sa.UUID()),
        sa.Column("codigo_cupon", sa.String(50)),
        sa.Column("descuento_aplicado", sa.Numeric(15, 2), nullable=False),
        sa.Column("items_aplicados", postgresql.ARRAY(sa.UUID())),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_promotion_usages_promo", "promotion_usages", ["promotion_id", "company_id"])


def downgrade() -> None:
    op.drop_table("promotion_usages")
    op.drop_table("promotions")
