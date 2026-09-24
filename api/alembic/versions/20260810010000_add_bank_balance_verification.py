"""blindar saldo bancario -- saldo_verificado_manualmente en bank_accounts
(baseline confiable que sync_bank_balances ya no pisa a ciegas) + tabla
bank_balance_correction_requests, espejo de credit_approval_requests, para
que una divergencia grande o una correccion manual requiera doble
aprobacion Supervisor+Gerente (Bancos Fase 5).

Revision ID: 20260810010000
Revises: 20260810000000
Create Date: 2026-08-10 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810010000"
down_revision: Union[str, None] = "20260810000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bank_accounts", sa.Column("saldo_verificado_manualmente", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("bank_accounts", sa.Column("saldo_verificado_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bank_accounts", sa.Column("saldo_verificado_por", postgresql.UUID(as_uuid=True), nullable=True))

    # api/src/inteliaudit/service.py::record_audit_event inserta en "audit_logs"
    # a ciegas -- la unica definicion de esa tabla vivia en un CREATE TABLE
    # IF NOT EXISTS por-tenant-schema en tenants/service.py que nunca se
    # ejecuto en este deploy (la base solo tiene el schema "public"), asi que
    # la tabla no existia y cualquier llamado a record_audit_event iba a
    # tirar "relation audit_logs does not exist" -- se crea aca en "public",
    # que es donde vive el resto del esquema real, para que el registro de
    # auditoria de divergencias (usado por sync_bank_balances) no rompa el
    # sync horario.
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("accion", sa.String(50), nullable=False),
        sa.Column("entidad", sa.String(50), nullable=False),
        sa.Column("entidad_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("datos_anteriores", postgresql.JSONB(), nullable=True),
        sa.Column("datos_nuevos", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "bank_balance_correction_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bank_accounts.id"), nullable=False, index=True),
        sa.Column("origen", sa.String(20), nullable=False),  # auto_divergencia | manual
        sa.Column("saldo_actual", sa.Numeric(15, 2), nullable=False),
        sa.Column("saldo_propuesto", sa.Numeric(15, 2), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
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
    op.drop_table("bank_balance_correction_requests")
    op.drop_column("bank_accounts", "saldo_verificado_por")
    op.drop_column("bank_accounts", "saldo_verificado_at")
    op.drop_column("bank_accounts", "saldo_verificado_manualmente")
