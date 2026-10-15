"""Add whatsapp_ai_training_examples table

Revision ID: 20261015070000
Revises: 20261014160000
Create Date: 2026-10-15 07:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261015070000"
down_revision = "20261014160000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_ai_training_examples",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("categoria", sa.String(50), nullable=False, server_default="general"),
        sa.Column("mensaje_usuario", sa.Text(), nullable=False),
        sa.Column("respuesta_ideal", sa.Text(), nullable=False),
        sa.Column("directiva_asociada", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("origen", sa.String(50), nullable=False, server_default="manual_admin"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(
        "ix_wa_ai_training_tenant_cat",
        "whatsapp_ai_training_examples",
        ["tenant_id", "categoria", "activo"],
    )


def downgrade() -> None:
    op.drop_index("ix_wa_ai_training_tenant_cat", table_name="whatsapp_ai_training_examples")
    op.drop_table("whatsapp_ai_training_examples")
