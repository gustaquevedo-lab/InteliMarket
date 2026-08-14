"""relax legacy NOT NULL constraints on commercial_agreements.tenant_id/proveedor_id

These two columns belong to the original bare-bones schema (20260525050000) and
are not populated by the current CommercialAgreement model (which uses company_id/
supplier_id instead) -- their leftover NOT NULL constraints blocked every insert
with a NotNullViolationError. Columns are kept (not dropped) for safety, just made
nullable so the real schema (added in 20260813090000) can actually be used.

Revision ID: 20260813091000
Revises: 20260813090000
Create Date: 2026-08-13 09:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260813091000"
down_revision: Union[str, None] = "20260813090000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("commercial_agreements", "tenant_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.alter_column("commercial_agreements", "proveedor_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)


def downgrade() -> None:
    op.alter_column("commercial_agreements", "proveedor_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.alter_column("commercial_agreements", "tenant_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
