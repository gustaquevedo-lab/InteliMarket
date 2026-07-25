"""Add SIFEN Avanzado tables (DGR vehicles, e-Kuatia documents, CDC logs, IVA book config)

Revision ID: 20260601100000
Revises: 20260601000000
Create Date: 2026-06-01 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601100000"
down_revision: Union[str, None] = "20260601000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # DGR Vehicles
    op.create_table(
        "dgr_vehicles",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("patente", sa.String(10), nullable=False, index=True),
        sa.Column("marca", sa.String(50), nullable=False),
        sa.Column("modelo", sa.String(50), nullable=False),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("chasis", sa.String(50)),
        sa.Column("motor", sa.String(50)),
        sa.Column("capacidad_toneladas", sa.Numeric(8, 2)),
        sa.Column("propietario", sa.String(200)),
        sa.Column("ruc_propietario", sa.String(20)),
        sa.Column("color", sa.String(30)),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "patente", name="uq_dgr_vehicle_patente"),
    )

    # e-Kuatia Documents (digitized)
    op.create_table(
        "ekuatia_documents",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("sale_id", UUID(as_uuid=True), index=True),
        sa.Column("tipo_documento", sa.String(30), nullable=False),
        sa.Column("nombre_original", sa.String(300), nullable=False),
        sa.Column("archivo_path", sa.String(500)),
        sa.Column("hash_sha256", sa.String(64)),
        sa.Column("validez_legal", sa.Boolean(), server_default="false"),
        sa.Column("fecha_digitalizacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("metadata", sa.JSON()),
        sa.Column("uploaded_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # CDC Validation Logs
    op.create_table(
        "cdc_validation_logs",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("sale_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("cdc", sa.String(44), nullable=False),
        sa.Column("valido", sa.Boolean()),
        sa.Column("request_data", sa.JSON()),
        sa.Column("response_data", sa.JSON()),
        sa.Column("codigo_error", sa.String(50)),
        sa.Column("mensaje_error", sa.String(500)),
        sa.Column("fecha_consulta", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # IVA Book Config
    op.create_table(
        "iva_book_configs",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("regimen", sa.String(30), server_default="general"),
        sa.Column("periodicidad", sa.String(10), server_default="mensual"),
        sa.Column("ultimo_periodo_generado", sa.String(7)),
        sa.Column("exportar_con_desglose", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # DGR Reports
    op.create_table(
        "dgr_report_generated",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("periodo", sa.String(7), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("archivo_path", sa.String(500)),
        sa.Column("cantidad_vehiculos", sa.Integer(), server_default="0"),
        sa.Column("monto_total_impuesto", sa.Numeric(15, 0)),
        sa.Column("fecha_generacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("dgr_report_generated")
    op.drop_table("iva_book_configs")
    op.drop_table("cdc_validation_logs")
    op.drop_table("ekuatia_documents")
    op.drop_table("dgr_vehicles")
