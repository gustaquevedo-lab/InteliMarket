"""add_inteliforce_operational_tables

Revision ID: 20260923000002
Revises: 20260923000001
Create Date: 2026-09-23 00:02:00.000000

Crea las 5 tablas operacionales del backend Inteliforce standalone:
  - inteliforce_devices      : tokens FCM por dispositivo/rep
  - inteliforce_visits       : check-in/checkout GPS con validación de rango
  - inteliforce_incidents    : incidencias reportadas durante visitas
  - inteliforce_media        : fotos y videos adjuntos a visitas
  - inteliforce_lot_expiry   : lotes y vencimientos relevados por merchandisers

Además agrega la columna pin_hash a sales_reps para el login directo con PIN.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = '20260923000002'
down_revision: Union[str, Sequence[str], None] = '20260923000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PIN en sales_reps para auth directa
    op.add_column('sales_reps', sa.Column('pin_hash', sa.Text(), nullable=True))

    # inteliforce_devices
    op.create_table(
        'inteliforce_devices',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('sales_rep_id', UUID(as_uuid=True), sa.ForeignKey('sales_reps.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id', UUID(as_uuid=True), nullable=False),
        sa.Column('fcm_token', sa.Text(), nullable=False),
        sa.Column('platform', sa.String(10), nullable=False, server_default='android'),
        sa.Column('app_version', sa.String(20), nullable=True),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('last_seen', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('sales_rep_id', 'fcm_token', name='uq_inteliforce_device_rep_token'),
    )
    op.create_index('ix_inteliforce_devices_sales_rep_id', 'inteliforce_devices', ['sales_rep_id'])
    op.create_index('ix_inteliforce_devices_company_id', 'inteliforce_devices', ['company_id'])

    # inteliforce_visits
    op.create_table(
        'inteliforce_visits',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', UUID(as_uuid=True), nullable=False),
        sa.Column('sales_rep_id', UUID(as_uuid=True), sa.ForeignKey('sales_reps.id'), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('rol', sa.String(20), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default='abierta'),
        sa.Column('checkin_lat', sa.Numeric(10, 7), nullable=True),
        sa.Column('checkin_lng', sa.Numeric(10, 7), nullable=True),
        sa.Column('checkin_accuracy', sa.Numeric(8, 2), nullable=True),
        sa.Column('checkin_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('checkout_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('checkout_lat', sa.Numeric(10, 7), nullable=True),
        sa.Column('checkout_lng', sa.Numeric(10, 7), nullable=True),
        sa.Column('sale_id', UUID(as_uuid=True), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_inteliforce_visits_company_id', 'inteliforce_visits', ['company_id'])
    op.create_index('ix_inteliforce_visits_sales_rep_id', 'inteliforce_visits', ['sales_rep_id'])
    op.create_index('ix_inteliforce_visits_customer_id', 'inteliforce_visits', ['customer_id'])

    # inteliforce_incidents
    op.create_table(
        'inteliforce_incidents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('inteliforce_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id', UUID(as_uuid=True), nullable=False),
        sa.Column('sales_rep_id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('tipo', sa.String(30), nullable=False),
        sa.Column('producto_id', UUID(as_uuid=True), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=False),
        sa.Column('urgencia', sa.String(10), nullable=False, server_default='normal'),
        sa.Column('notificado', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_inteliforce_incidents_visit_id', 'inteliforce_incidents', ['visit_id'])
    op.create_index('ix_inteliforce_incidents_company_id', 'inteliforce_incidents', ['company_id'])
    op.create_index('ix_inteliforce_incidents_customer_id', 'inteliforce_incidents', ['customer_id'])

    # inteliforce_media
    op.create_table(
        'inteliforce_media',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('inteliforce_visits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id', UUID(as_uuid=True), nullable=False),
        sa.Column('sales_rep_id', UUID(as_uuid=True), nullable=False),
        sa.Column('tipo', sa.String(10), nullable=False, server_default='foto'),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('filename', sa.String(255), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('duracion_seg', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_inteliforce_media_visit_id', 'inteliforce_media', ['visit_id'])
    op.create_index('ix_inteliforce_media_company_id', 'inteliforce_media', ['company_id'])

    # inteliforce_lot_expiry
    op.create_table(
        'inteliforce_lot_expiry',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), nullable=False),
        sa.Column('visit_id', UUID(as_uuid=True), sa.ForeignKey('inteliforce_visits.id'), nullable=True),
        sa.Column('sales_rep_id', UUID(as_uuid=True), nullable=False),
        sa.Column('lote', sa.String(50), nullable=True),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=False),
        sa.Column('cantidad_unidades', sa.Integer(), nullable=True),
        sa.Column('alerta_enviada', sa.Boolean(), server_default='false'),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('customer_id', 'product_id', 'lote', name='uq_lot_expiry_customer_product_lote'),
    )
    op.create_index('ix_inteliforce_lot_expiry_company_id', 'inteliforce_lot_expiry', ['company_id'])
    op.create_index('ix_inteliforce_lot_expiry_customer_id', 'inteliforce_lot_expiry', ['customer_id'])
    op.create_index('ix_inteliforce_lot_expiry_product_id', 'inteliforce_lot_expiry', ['product_id'])
    op.create_index('ix_inteliforce_lot_expiry_fecha_vencimiento', 'inteliforce_lot_expiry', ['fecha_vencimiento'])

    # Columna de rango POI en customers (por si no existe)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='customers' AND column_name='inteliforce_rango_m'
            ) THEN
                ALTER TABLE customers ADD COLUMN inteliforce_rango_m NUMERIC(8,2);
            END IF;
        END$$;
    """)


def downgrade() -> None:
    op.drop_table('inteliforce_lot_expiry')
    op.drop_table('inteliforce_media')
    op.drop_table('inteliforce_incidents')
    op.drop_table('inteliforce_visits')
    op.drop_table('inteliforce_devices')
    op.drop_column('sales_reps', 'pin_hash')
