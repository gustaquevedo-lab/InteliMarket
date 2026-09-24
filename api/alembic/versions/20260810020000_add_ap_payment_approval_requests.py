"""Aprobacion con doble firma para pagos grandes en Cuentas por Pagar
(Fase 3) -- pagos individuales de factura o ejecucion de lotes de pago que
superen el umbral configurado quedan retenidos hasta que Supervisor Y
Gerente aprueben, mismo patron de dos slots que credit_approval_requests
(Cuentas por Cobrar) y bank_balance_correction_requests (Bancos Fase 5).

Revision ID: 20260810020000
Revises: 20260810010000
Create Date: 2026-08-10 02:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810020000"
down_revision: Union[str, None] = "20260810010000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ap_payment_approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("entidad_tipo", sa.String(20), nullable=False),  # invoice | payment_run
        sa.Column("entidad_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("monto", sa.Numeric(15, 2), nullable=False),
        # datos del pago original, para poder ejecutarlo tal cual una vez
        # completadas las dos aprobaciones (solo aplica a entidad_tipo='invoice')
        sa.Column("payment_method", sa.String(30), nullable=True),
        sa.Column("moneda", sa.String(3), nullable=True),
        sa.Column("fecha_pago", sa.Date(), nullable=True),
        sa.Column("referencia", sa.String(100), nullable=True),
        sa.Column("comprobante_url", sa.Text(), nullable=True),
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),  # pendiente, aprobado, rechazado
        sa.Column("solicitado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_supervisor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_supervisor_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aprobado_gerente_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_gerente_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rechazado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rechazado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rechazado_motivo", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("ap_payment_approval_requests")
