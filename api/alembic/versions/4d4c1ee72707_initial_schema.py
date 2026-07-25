"""initial schema

Revision ID: 4d4c1ee72707
Revises: 
Create Date: 2026-05-04 15:03:12.400672
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d4c1ee72707'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Auth
    op.create_table('users',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('telefono', sa.String(20)),
        sa.Column('rol', sa.String(30), nullable=False, server_default=sa.text("'operador'")),
        sa.Column('mfa_enabled', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('mfa_secret', sa.String(100)),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('last_login', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # Tenants
    op.create_table('tenants',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('nombre', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('schema_name', sa.String(100), nullable=False, unique=True),
        sa.Column('plan', sa.String(20), nullable=False, server_default=sa.text("'starter'")),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'activo'")),
        sa.Column('fecha_inicio', sa.Date(), server_default=sa.func.now()),
        sa.Column('fecha_vencimiento', sa.Date()),
        sa.Column('contacto_email', sa.String(200)),
        sa.Column('contacto_phone', sa.String(20)),
        sa.Column('config', sa.JSON()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('user_tenants',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('rol', sa.String(30), nullable=False, server_default=sa.text("'usuario'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Companies
    op.create_table('companies',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('ruc', sa.String(20), nullable=False, unique=True),
        sa.Column('razon_social', sa.String(200), nullable=False),
        sa.Column('nombre_fantasia', sa.String(200)),
        sa.Column('direccion', sa.Text()),
        sa.Column('telefono', sa.String(20)),
        sa.Column('email', sa.String(200)),
        sa.Column('condicion_iva', sa.String(30), nullable=False, server_default=sa.text("'contribuyente'")),
        sa.Column('config', sa.JSON()),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Products
    op.create_table('product_categories',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.Text()),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('products',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('categoria_id', sa.UUID()),
        sa.Column('nombre', sa.String(200), nullable=False),
        sa.Column('descripcion', sa.Text()),
        sa.Column('sku', sa.String(50), unique=True),
        sa.Column('codigo_barra', sa.String(50)),
        sa.Column('unidad_medida', sa.String(20), server_default=sa.text("'unidad'")),
        sa.Column('iva_tasa', sa.Numeric(5, 2), server_default=sa.text('10.00')),
        sa.Column('stock_minimo', sa.Integer(), server_default=sa.text('0')),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Inventory
    op.create_table('warehouses',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID()),
        sa.Column('codigo', sa.String(10), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('direccion', sa.Text()),
        sa.Column('tipo', sa.String(20), server_default=sa.text("'principal'")),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('stock',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('variant_id', sa.UUID()),
        sa.Column('cantidad', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('cantidad_reservada', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('costo_unitario', sa.Numeric(15, 0)),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('warehouse_id', 'product_id', 'variant_id'),
    )

    op.create_table('stock_lots',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('variant_id', sa.UUID()),
        sa.Column('cantidad', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('cantidad_disponible', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('costo_unitario', sa.Numeric(15, 0), nullable=False),
        sa.Column('costo_total', sa.Numeric(18, 0), nullable=False),
        sa.Column('referencia', sa.String(100)),
        sa.Column('fecha_ingreso', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('fecha_vencimiento', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_stock_lots_product', 'stock_lots', ['product_id'])
    op.create_index('ix_stock_lots_company', 'stock_lots', ['company_id'])
    op.create_index('ix_stock_lots_fecha', 'stock_lots', ['fecha_ingreso'])

    op.create_table('inventory_movements',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('variant_id', sa.UUID()),
        sa.Column('tipo', sa.String(30), nullable=False),
        sa.Column('cantidad', sa.Integer(), nullable=False),
        sa.Column('costo_unitario', sa.Numeric(15, 0)),
        sa.Column('referencia_type', sa.String(30)),
        sa.Column('referencia_id', sa.UUID()),
        sa.Column('motivo', sa.Text()),
        sa.Column('user_id', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('stock_transfers',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('codigo', sa.String(20), nullable=False, unique=True),
        sa.Column('warehouse_origen_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_destino_id', sa.UUID(), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'pendiente'")),
        sa.Column('fecha_envio', sa.DateTime(timezone=True)),
        sa.Column('fecha_recepcion', sa.DateTime(timezone=True)),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id_envio', sa.UUID()),
        sa.Column('user_id_recepcion', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('stock_transfer_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('transfer_id', sa.UUID(), sa.ForeignKey('stock_transfers.id'), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('variant_id', sa.UUID()),
        sa.Column('cantidad_enviada', sa.Integer(), nullable=False),
        sa.Column('cantidad_recibida', sa.Integer()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('inventory_adjustments',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('warehouse_id', sa.UUID(), nullable=False),
        sa.Column('codigo', sa.String(20), nullable=False, unique=True),
        sa.Column('motivo', sa.String(50), nullable=False),
        sa.Column('estado', sa.String(20), server_default=sa.text("'pendiente'")),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id', sa.UUID()),
        sa.Column('aprobado_por', sa.UUID()),
        sa.Column('fecha_aprobacion', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('inventory_adjustment_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('adjustment_id', sa.UUID(), sa.ForeignKey('inventory_adjustments.id'), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('variant_id', sa.UUID()),
        sa.Column('cantidad_sistema', sa.Integer(), nullable=False),
        sa.Column('cantidad_fisica', sa.Integer(), nullable=False),
        sa.Column('diferencia', sa.Integer(), nullable=False),
        sa.Column('costo_unitario', sa.Numeric(15, 0)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Customers
    op.create_table('customers',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False, server_default=sa.text("'contribuyente'")),
        sa.Column('ruc', sa.String(20)),
        sa.Column('ci', sa.String(20)),
        sa.Column('razon_social', sa.String(200), nullable=False),
        sa.Column('nombre_fantasia', sa.String(200)),
        sa.Column('direccion', sa.Text()),
        sa.Column('telefono', sa.String(20)),
        sa.Column('email', sa.String(200)),
        sa.Column('contacto', sa.String(200)),
        sa.Column('limite_credito', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Sales
    op.create_table('sales',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID()),
        sa.Column('customer_id', sa.UUID()),
        sa.Column('emission_point_id', sa.UUID()),
        sa.Column('numero', sa.String(20), nullable=False, unique=True),
        sa.Column('fecha', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('tipo_comprobante', sa.String(20), nullable=False),
        sa.Column('condicion', sa.String(20), nullable=False, server_default=sa.text("'contado'")),
        sa.Column('moneda', sa.String(3), nullable=False, server_default=sa.text("'PYG'")),
        sa.Column('tipo_cambio', sa.Numeric(10, 2), server_default=sa.text('1')),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'pendiente'")),
        sa.Column('subtotal', sa.Numeric(15, 0), nullable=False),
        sa.Column('descuento_total', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('base_gravada_10', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('base_gravada_5', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('base_exenta', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('iva_10', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('iva_5', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('total', sa.Numeric(15, 0), nullable=False),
        sa.Column('total_pagado', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('saldo', sa.Numeric(15, 0)),
        sa.Column('cdc', sa.String(44)),
        sa.Column('sifen_estado', sa.String(20)),
        sa.Column('sifen_fecha_respuesta', sa.DateTime(timezone=True)),
        sa.Column('sifen_xml_sent', sa.Text()),
        sa.Column('sifen_xml_response', sa.Text()),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('sale_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('sale_id', sa.UUID(), sa.ForeignKey('sales.id'), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('variant_id', sa.UUID()),
        sa.Column('descripcion', sa.String(300)),
        sa.Column('cantidad', sa.Numeric(10, 3), nullable=False),
        sa.Column('precio_unitario', sa.Numeric(15, 0), nullable=False),
        sa.Column('descuento_pct', sa.Numeric(5, 2), server_default=sa.text('0')),
        sa.Column('descuento_monto', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('iva_tasa', sa.Numeric(5, 2), nullable=False),
        sa.Column('iva_monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('total', sa.Numeric(15, 0), nullable=False),
        sa.Column('costo_unitario', sa.Numeric(15, 0)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # SIFEN
    op.create_table('sifen_timbrados',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('numero', sa.String(20), nullable=False),
        sa.Column('fecha_inicio', sa.Date(), nullable=False),
        sa.Column('fecha_fin', sa.Date(), nullable=False),
        sa.Column('punto_emision_inicio', sa.Integer(), nullable=False),
        sa.Column('punto_emision_fin', sa.Integer(), nullable=False),
        sa.Column('tipo_comprobante', sa.String(20), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'activo'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('sifen_responses',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('cdc', sa.String(44), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False),
        sa.Column('codigo_error', sa.String(10)),
        sa.Column('mensaje', sa.Text()),
        sa.Column('xml_sent', sa.Text()),
        sa.Column('xml_response', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Purchases
    op.create_table('suppliers',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('ruc', sa.String(20)),
        sa.Column('razon_social', sa.String(200), nullable=False),
        sa.Column('nombre_fantasia', sa.String(200)),
        sa.Column('direccion', sa.Text()),
        sa.Column('telefono', sa.String(20)),
        sa.Column('email', sa.String(200)),
        sa.Column('contacto', sa.String(200)),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('purchase_orders',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('supplier_id', sa.UUID(), nullable=False),
        sa.Column('numero', sa.String(20), nullable=False, unique=True),
        sa.Column('fecha', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'pendiente'")),
        sa.Column('total', sa.Numeric(15, 0), nullable=False),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('purchase_order_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('order_id', sa.UUID(), sa.ForeignKey('purchase_orders.id'), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('cantidad', sa.Numeric(10, 3), nullable=False),
        sa.Column('precio_unitario', sa.Numeric(15, 0), nullable=False),
        sa.Column('total', sa.Numeric(15, 0), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('purchase_receipts',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID()),
        sa.Column('supplier_id', sa.UUID(), nullable=False),
        sa.Column('numero', sa.String(20), nullable=False, unique=True),
        sa.Column('fecha', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('total', sa.Numeric(15, 0), nullable=False),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('purchase_receipt_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('receipt_id', sa.UUID(), sa.ForeignKey('purchase_receipts.id'), nullable=False),
        sa.Column('product_id', sa.UUID(), nullable=False),
        sa.Column('cantidad', sa.Numeric(10, 3), nullable=False),
        sa.Column('precio_unitario', sa.Numeric(15, 0), nullable=False),
        sa.Column('costo_unitario', sa.Numeric(15, 0), nullable=False),
        sa.Column('total', sa.Numeric(15, 0), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Payments
    op.create_table('payment_methods',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.String(50), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('payments',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('sale_id', sa.UUID()),
        sa.Column('customer_id', sa.UUID()),
        sa.Column('method_id', sa.UUID(), nullable=False),
        sa.Column('monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('moneda', sa.String(3), nullable=False, server_default=sa.text("'PYG'")),
        sa.Column('tipo_cambio', sa.Numeric(10, 2), server_default=sa.text('1')),
        sa.Column('referencia', sa.String(100)),
        sa.Column('fecha', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'confirmado'")),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id', sa.UUID()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('payment_allocations',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('payment_id', sa.UUID(), sa.ForeignKey('payments.id'), nullable=False),
        sa.Column('sale_id', sa.UUID(), nullable=False),
        sa.Column('monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('customer_wallets',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('customer_id', sa.UUID(), nullable=False, unique=True),
        sa.Column('saldo', sa.Numeric(15, 0), nullable=False, server_default=sa.text('0')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('wallet_transactions',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('wallet_id', sa.UUID(), sa.ForeignKey('customer_wallets.id'), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('referencia', sa.String(100)),
        sa.Column('descripcion', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('customer_accounts',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('saldo', sa.Numeric(15, 0), nullable=False, server_default=sa.text('0')),
        sa.Column('limite', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('account_movements',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('account_id', sa.UUID(), sa.ForeignKey('customer_accounts.id'), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('saldo_anterior', sa.Numeric(15, 0), nullable=False),
        sa.Column('saldo_nuevo', sa.Numeric(15, 0), nullable=False),
        sa.Column('referencia', sa.String(100)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('financings',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('sale_id', sa.UUID(), nullable=False),
        sa.Column('monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('cuotas', sa.Integer(), nullable=False),
        sa.Column('tasa_interes', sa.Numeric(5, 2), server_default=sa.text('0')),
        sa.Column('fecha_inicio', sa.Date(), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'activa'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('financing_installments',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('financing_id', sa.UUID(), sa.ForeignKey('financings.id'), nullable=False),
        sa.Column('numero', sa.Integer(), nullable=False),
        sa.Column('monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=False),
        sa.Column('fecha_pago', sa.Date()),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'pendiente'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Currency
    op.create_table('currencies',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('codigo', sa.String(3), nullable=False, unique=True),
        sa.Column('nombre', sa.String(50), nullable=False),
        sa.Column('simbolo', sa.String(5)),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('exchange_rates',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('moneda_origen', sa.String(3), nullable=False),
        sa.Column('moneda_destino', sa.String(3), nullable=False),
        sa.Column('tasa', sa.Numeric(10, 4), nullable=False),
        sa.Column('fuente', sa.String(20)),
        sa.Column('fecha', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Caja
    op.create_table('cash_registers',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID()),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('codigo', sa.String(20), nullable=False, unique=True),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('cash_sessions',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('register_id', sa.UUID(), sa.ForeignKey('cash_registers.id'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('monto_apertura', sa.Numeric(15, 0), nullable=False),
        sa.Column('fecha_apertura', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('fecha_cierre', sa.DateTime(timezone=True)),
        sa.Column('monto_cierre', sa.Numeric(15, 0)),
        sa.Column('estado', sa.String(20), nullable=False, server_default=sa.text("'abierta'")),
        sa.Column('observaciones', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('cash_counts',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('session_id', sa.UUID(), sa.ForeignKey('cash_sessions.id'), nullable=False),
        sa.Column('monto_efectivo', sa.Numeric(15, 0), nullable=False),
        sa.Column('monto_tarjeta', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('monto_transferencia', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('monto_cheque', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('monto_otro', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('monto_total', sa.Numeric(15, 0), nullable=False),
        sa.Column('diferencia', sa.Numeric(15, 0)),
        sa.Column('observaciones', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Integrations
    op.create_table('integration_configs',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('app_name', sa.String(50), nullable=False),
        sa.Column('webhook_url', sa.String(500), nullable=False),
        sa.Column('api_key', sa.String(200)),
        sa.Column('hmac_secret', sa.String(200)),
        sa.Column('enabled', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('config', sa.JSON()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('webhook_deliveries',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('config_id', sa.UUID(), sa.ForeignKey('integration_configs.id'), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('response_status', sa.String(10)),
        sa.Column('response_body', sa.Text()),
        sa.Column('success', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('retry_count', sa.Integer(), server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # InteliCont
    op.create_table('intelicont_sync_config',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('webhook_url', sa.String(500), nullable=False),
        sa.Column('api_key', sa.String(200)),
        sa.Column('enabled', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('auto_sync', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('sync_interval_minutes', sa.Integer(), server_default=sa.text('60')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table('intelicont_entries',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('fecha', sa.DateTime(timezone=True), nullable=False),
        sa.Column('tipo', sa.String(50), nullable=False),
        sa.Column('descripcion', sa.Text()),
        sa.Column('referencia', sa.String(100)),
        sa.Column('monto', sa.Numeric(15, 0), nullable=False),
        sa.Column('sync_status', sa.String(20), server_default=sa.text("'pending'")),
        sa.Column('sync_error', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('intelicont_entry_lines',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('entry_id', sa.UUID(), sa.ForeignKey('intelicont_entries.id'), nullable=False),
        sa.Column('cuenta', sa.String(20), nullable=False),
        sa.Column('descripcion', sa.String(200)),
        sa.Column('debe', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('haber', sa.Numeric(15, 0), server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # InteliAudit
    op.create_table('inteliaudit_sync_config',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('webhook_url', sa.String(500), nullable=False),
        sa.Column('api_key', sa.String(200)),
        sa.Column('hmac_secret', sa.String(200)),
        sa.Column('enabled', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('auto_sync', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # SueldOK
    op.create_table('sueldok_sync_config',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('api_url', sa.String(500), nullable=False),
        sa.Column('api_key', sa.String(200)),
        sa.Column('enabled', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('commission_rate', sa.Numeric(5, 2), server_default=sa.text('2.00')),
        sa.Column('auto_sync', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Pagopar
    op.create_table('pagopar_transactions',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.String(100), nullable=False),
        sa.Column('amount', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column('payment_method', sa.String(50)),
        sa.Column('card_brand', sa.String(50)),
        sa.Column('card_last4', sa.String(4)),
        sa.Column('customer_email', sa.String(200), nullable=False),
        sa.Column('customer_name', sa.String(200), nullable=False),
        sa.Column('checkout_url', sa.Text()),
        sa.Column('pagopar_id', sa.String(100)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_pagopar_transactions_order', 'pagopar_transactions', ['order_id'])
    op.create_index('ix_pagopar_transactions_company', 'pagopar_transactions', ['company_id'])

    # Backups
    op.create_table('backups',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID()),
        sa.Column('tenant_slug', sa.String(100)),
        sa.Column('schema_name', sa.String(100), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False, server_default=sa.text('0')),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column('backup_type', sa.String(20), nullable=False, server_default=sa.text("'manual'")),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('expires_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_backups_tenant', 'backups', ['tenant_id'])
    op.create_index('ix_backups_status', 'backups', ['status'])
    op.create_index('ix_backups_expires', 'backups', ['expires_at'])

    op.create_table('backup_schedule_config',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID()),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('frequency', sa.String(20), nullable=False, server_default=sa.text("'daily'")),
        sa.Column('hour', sa.Integer(), nullable=False, server_default=sa.text('2')),
        sa.Column('minute', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('day_of_week', sa.Integer()),
        sa.Column('day_of_month', sa.Integer()),
        sa.Column('retention_days', sa.Integer(), nullable=False, server_default=sa.text('30')),
        sa.Column('max_backups', sa.Integer()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_backup_schedule_tenant', 'backup_schedule_config', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_backup_schedule_tenant', 'backup_schedule_config')
    op.drop_table('backup_schedule_config')
    op.drop_index('ix_backups_expires', 'backups')
    op.drop_index('ix_backups_status', 'backups')
    op.drop_index('ix_backups_tenant', 'backups')
    op.drop_table('backups')
    op.drop_index('ix_pagopar_transactions_company', 'pagopar_transactions')
    op.drop_index('ix_pagopar_transactions_order', 'pagopar_transactions')
    op.drop_table('pagopar_transactions')
    op.drop_table('sueldok_sync_config')
    op.drop_table('inteliaudit_sync_config')
    op.drop_table('intelicont_entry_lines')
    op.drop_table('intelicont_entries')
    op.drop_table('intelicont_sync_config')
    op.drop_table('webhook_deliveries')
    op.drop_table('integration_configs')
    op.drop_table('cash_counts')
    op.drop_table('cash_sessions')
    op.drop_table('cash_registers')
    op.drop_table('exchange_rates')
    op.drop_table('currencies')
    op.drop_table('financing_installments')
    op.drop_table('financings')
    op.drop_table('account_movements')
    op.drop_table('customer_accounts')
    op.drop_table('wallet_transactions')
    op.drop_table('customer_wallets')
    op.drop_table('payment_allocations')
    op.drop_table('payments')
    op.drop_table('payment_methods')
    op.drop_table('purchase_receipt_items')
    op.drop_table('purchase_receipts')
    op.drop_table('purchase_order_items')
    op.drop_table('purchase_orders')
    op.drop_table('suppliers')
    op.drop_table('sifen_responses')
    op.drop_table('sifen_timbrados')
    op.drop_table('sale_items')
    op.drop_table('sales')
    op.drop_table('customers')
    op.drop_table('inventory_adjustment_items')
    op.drop_table('inventory_adjustments')
    op.drop_table('stock_transfer_items')
    op.drop_table('stock_transfers')
    op.drop_table('inventory_movements')
    op.drop_index('ix_stock_lots_fecha', 'stock_lots')
    op.drop_index('ix_stock_lots_company', 'stock_lots')
    op.drop_index('ix_stock_lots_product', 'stock_lots')
    op.drop_table('stock_lots')
    op.drop_table('stock')
    op.drop_table('warehouses')
    op.drop_table('products')
    op.drop_table('product_categories')
    op.drop_table('companies')
    op.drop_table('user_tenants')
    op.drop_table('tenants')
    op.drop_index('ix_users_email', 'users')
    op.drop_table('users')
