"""add_caja_bank_mappings_and_shortages

Revision ID: 20260909140000
Revises: 20260906160000
Create Date: 2026-09-09 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20260909140000'
down_revision: Union[str, None] = '20260906160000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Mapeo de medios de pago a cuentas bancarias
    op.create_table(
        "payment_method_bank_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("canal_key", sa.String(50), nullable=False),
        sa.Column("canal_label", sa.String(100), nullable=False),
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bank_accounts.id"), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_pm_bank_mappings_company_id", "payment_method_bank_mappings", ["company_id"])

    # 2. Solicitudes de descuento de faltantes de caja hacia SueldOK
    op.create_table(
        "cash_shortage_deduction_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cash_sessions.id"), nullable=False),
        sa.Column("caja_nombre", sa.String(100)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cajero_nombre", sa.String(100), nullable=False),
        sa.Column("monto_faltante_gs", sa.Numeric(15, 0), nullable=False),
        sa.Column("estado", sa.String(30), nullable=False, server_default="pendiente"),
        sa.Column("resolucion", sa.String(50)),
        sa.Column("cuotas", sa.Integer(), server_default="1"),
        sa.Column("monto_cuota_gs", sa.Numeric(15, 0)),
        sa.Column("periodo_nomina", sa.String(7)),
        sa.Column("sueldok_sync_status", sa.String(30), server_default="no_sincronizado"),
        sa.Column("sueldok_sync_id", sa.String(100)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("aprobado_por", sa.String(100)),
        sa.Column("aprobado_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_cash_shortage_company_id", "cash_shortage_deduction_requests", ["company_id"])
    op.create_index("ix_cash_shortage_session_id", "cash_shortage_deduction_requests", ["session_id"])

    # 3. Políticas y umbrales de faltantes de caja
    op.create_table(
        "cash_shortage_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("umbral_aprobacion_gs", sa.Numeric(15, 0), server_default="10000"),
        sa.Column("requerir_aprobacion_siempre", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("permitir_cuotas", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("max_cuotas", sa.Integer(), server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("cash_shortage_configs")
    op.drop_index("ix_cash_shortage_session_id", table_name="cash_shortage_deduction_requests")
    op.drop_index("ix_cash_shortage_company_id", table_name="cash_shortage_deduction_requests")
    op.drop_table("cash_shortage_deduction_requests")
    op.drop_index("ix_pm_bank_mappings_company_id", table_name="payment_method_bank_mappings")
    op.drop_table("payment_method_bank_mappings")
