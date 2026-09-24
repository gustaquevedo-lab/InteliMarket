"""add purchase RFQ / cotizacion comparativa tables

Revision ID: 20260813100000
Revises: 20260813091000
Create Date: 2026-08-13 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260813100000"
down_revision: Union[str, None] = "20260813091000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "purchase_rfqs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("requisition_id", postgresql.UUID(as_uuid=True)),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_limite", sa.Date()),
        sa.Column("estado", sa.String(20), nullable=False, server_default="enviada"),
        sa.Column("motivo", sa.Text()),
        sa.Column("observaciones", sa.Text()),
        sa.Column("ganador_supplier_id", postgresql.UUID(as_uuid=True)),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "purchase_rfq_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_rfqs.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("cantidad_solicitada", sa.Numeric(10, 3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "purchase_rfq_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("rfq_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_rfqs.id"), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="invitada"),
        sa.Column("fecha_respuesta", sa.DateTime(timezone=True)),
        sa.Column("plazo_entrega_dias", sa.Integer()),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "purchase_rfq_response_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("response_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_rfq_responses.id"), nullable=False),
        sa.Column("rfq_item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_rfq_items.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(15, 0), nullable=False),
        sa.Column("plazo_entrega_dias", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("purchase_rfq_response_items")
    op.drop_table("purchase_rfq_responses")
    op.drop_table("purchase_rfq_items")
    op.drop_table("purchase_rfqs")
