"""add institutional vouchers table

Revision ID: 20260922120000
Revises: 20260922100000
Create Date: 2026-09-22 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260922120000"
down_revision: Union[str, Sequence[str], None] = "20260922100000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "institutional_vouchers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("convenio_nombre", sa.String(150), nullable=False, index=True),
        sa.Column("cliente_ruc", sa.String(30), nullable=True, index=True),
        sa.Column("cliente_razon_social", sa.String(255), nullable=True),
        sa.Column("factura_emision_numero", sa.String(50), nullable=True),
        sa.Column("numero_vale", sa.String(50), nullable=False, index=True),
        sa.Column("codigo_barras", sa.String(100), nullable=False, index=True),
        sa.Column("monto_inicial", sa.Numeric(15, 0), nullable=False, server_default=sa.text("100000")),
        sa.Column("saldo_disponible", sa.Numeric(15, 0), nullable=False, server_default=sa.text("100000")),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("estado", sa.String(30), nullable=False, server_default="ACTIVO", index=True),
        sa.Column("beneficiario_nombre", sa.String(255), nullable=True),
        sa.Column("canjeado_en_sale_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("canjeado_en_caja_session_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("canjeado_at", TS, nullable=True),
        sa.Column("canjeado_por_usuario_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("canjeado_caja_numero", sa.String(50), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("created_at", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", TS, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_vouchers_company_convenio", "institutional_vouchers", ["company_id", "convenio_nombre"])
    op.create_index("ix_vouchers_company_barcode", "institutional_vouchers", ["company_id", "codigo_barras"])
    op.create_index("ix_vouchers_company_numero", "institutional_vouchers", ["company_id", "numero_vale"])


def downgrade() -> None:
    op.drop_index("ix_vouchers_company_numero", table_name="institutional_vouchers")
    op.drop_index("ix_vouchers_company_barcode", table_name="institutional_vouchers")
    op.drop_index("ix_vouchers_company_convenio", table_name="institutional_vouchers")
    op.drop_table("institutional_vouchers")
