"""add_pharma_and_intelientregas_tables

Revision ID: 20260519191915
Revises: d8e9f0a1b2c3
Create Date: 2026-05-19 19:19:15.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260519191915'
down_revision: Union[str, None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # PHARMA TABLES
    # ============================================================
    
    # pharma_active_ingredients
    op.create_table(
        'pharma_active_ingredients',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.String(200), nullable=False),
        sa.Column('nombre_comun', sa.String(200)),
        sa.Column('categoria', sa.String(100)),
        sa.Column('descripcion', sa.Text()),
        sa.Column('dosis_maxima_diaria', sa.String(50)),
        sa.Column('contraindicaciones', sa.Text()),
        sa.Column('interactua_con', postgresql.ARRAY(sa.String())),
        sa.Column('embarazo_categoria', sa.String(5)),
        sa.Column('requiere_receta', sa.Boolean(), server_default='false'),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_pharma_ai_company', 'company_id'),
        sa.Index('ix_pharma_ai_nombre', 'nombre'),
    )
    
    # pharma_medications
    op.create_table(
        'pharma_medications',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('principio_activo_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('concentracion', sa.String(50), nullable=False),
        sa.Column('concentracion_numerica', sa.Numeric(10, 2)),
        sa.Column('concentracion_unidad', sa.String(20)),
        sa.Column('forma_farmaceutica', sa.String(20), nullable=False),
        sa.Column('via_administracion', sa.String(20)),
        sa.Column('registro_sanitario', sa.String(50)),
        sa.Column('laboratorio', sa.String(100)),
        sa.Column('marca_comercial', sa.String(200)),
        sa.Column('es_generico', sa.Boolean(), server_default='false'),
        sa.Column('es_referencia', sa.Boolean(), server_default='false'),
        sa.Column('es_controlado', sa.Boolean(), server_default='false'),
        sa.Column('categoria_controlado', sa.String(20)),
        sa.Column('requiere_receta_retencion', sa.Boolean(), server_default='false'),
        sa.Column('requiere_cadena_frio', sa.Boolean(), server_default='false'),
        sa.Column('temp_min', sa.Numeric(4, 1)),
        sa.Column('temp_max', sa.Numeric(4, 1)),
        sa.Column('protege_luz', sa.Boolean(), server_default='false'),
        sa.Column('posologia_habitual', sa.Text()),
        sa.Column('contraindicaciones', sa.Text()),
        sa.Column('efectos_adversos', sa.Text()),
        sa.Column('interactua_con', postgresql.ARRAY(sa.String())),
        sa.Column('necesita_autorizacion_obra_social', sa.Boolean(), server_default='false'),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id'),
        sa.ForeignKeyConstraint(['principio_activo_id'], ['pharma_active_ingredients.id']),
        sa.Index('ix_pharma_med_company', 'company_id'),
        sa.Index('ix_pharma_med_pa', 'principio_activo_id'),
        sa.Index('ix_pharma_med_marca', 'marca_comercial'),
        sa.Index('ix_pharma_med_lab', 'laboratorio'),
        sa.Index('ix_pharma_med_generico', 'es_generico'),
    )
    
    # pharma_equivalents
    op.create_table(
        'pharma_equivalents',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medication_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('equivalent_medication_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tipo', sa.String(20), server_default='generico'),
        sa.Column('diferencia_precio_pct', sa.Numeric(5, 2)),
        sa.Column('sustitucion_automatica', sa.Boolean(), server_default='true'),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['medication_id'], ['pharma_medications.id']),
        sa.ForeignKeyConstraint(['equivalent_medication_id'], ['pharma_medications.id']),
        sa.Index('ix_pharma_eq_company', 'company_id'),
        sa.Index('ix_pharma_eq_medication', 'medication_id'),
        sa.Index('ix_pharma_eq_equivalent', 'equivalent_medication_id'),
        sa.Index('ix_pharma_eq_pair', 'medication_id', 'equivalent_medication_id', unique=True),
    )
    
    # pharma_prescriptions
    op.create_table(
        'pharma_prescriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True)),
        sa.Column('medico_nombre', sa.String(200), nullable=False),
        sa.Column('medico_matricula', sa.String(50)),
        sa.Column('medico_especialidad', sa.String(100)),
        sa.Column('fecha_emision', sa.Date(), nullable=False),
        sa.Column('fecha_vencimiento', sa.Date()),
        sa.Column('numero_receta', sa.String(50)),
        sa.Column('es_controlada', sa.Boolean(), server_default='false'),
        sa.Column('categoria_controlado', sa.String(20)),
        sa.Column('items', postgresql.JSONB()),
        sa.Column('estado', sa.String(20), server_default='pending'),
        sa.Column('dispensado_parcial', sa.Boolean(), server_default='false'),
        sa.Column('imagen_url', sa.Text()),
        sa.Column('imagen_retencion_url', sa.Text()),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_pharma_rx_company', 'company_id'),
        sa.Index('ix_pharma_rx_customer', 'customer_id'),
        sa.Index('ix_pharma_rx_fecha', 'fecha_emision'),
    )
    
    # pharma_controlled_logs
    op.create_table(
        'pharma_controlled_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medication_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True)),
        sa.Column('prescription_id', postgresql.UUID(as_uuid=True)),
        sa.Column('lote', sa.String(50)),
        sa.Column('cantidad', sa.Numeric(10, 3), nullable=False),
        sa.Column('tipo_movimiento', sa.String(20), nullable=False),
        sa.Column('patient_nombre', sa.String(200)),
        sa.Column('patient_ci', sa.String(20)),
        sa.Column('patient_direccion', sa.Text()),
        sa.Column('receta_numero', sa.String(50)),
        sa.Column('receta_fecha', sa.Date()),
        sa.Column('receta_medico_nombre', sa.String(200)),
        sa.Column('receta_medico_matricula', sa.String(50)),
        sa.Column('receta_retencion', sa.Boolean()),
        sa.Column('receta_archivada', sa.Boolean()),
        sa.Column('reportado_dinalfa', sa.Boolean(), server_default='false'),
        sa.Column('reporte_fecha', sa.DateTime(timezone=True)),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['medication_id'], ['pharma_medications.id']),
        sa.ForeignKeyConstraint(['prescription_id'], ['pharma_prescriptions.id']),
        sa.Index('ix_pharma_ctrl_company', 'company_id'),
        sa.Index('ix_pharma_ctrl_medication', 'medication_id'),
        sa.Index('ix_pharma_ctrl_patient_ci', 'patient_ci'),
        sa.Index('ix_pharma_ctrl_created', 'created_at'),
    )
    
    # pharma_expiration_alerts
    op.create_table(
        'pharma_expiration_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medication_id', postgresql.UUID(as_uuid=True)),
        sa.Column('warehouse_id', postgresql.UUID(as_uuid=True)),
        sa.Column('lote', sa.String(50)),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=False),
        sa.Column('cantidad', sa.Integer(), nullable=False),
        sa.Column('alerta_tipo', sa.String(20), nullable=False),
        sa.Column('dias_restantes', sa.Integer()),
        sa.Column('notificado', sa.Boolean(), server_default='false'),
        sa.Column('notificado_at', sa.DateTime(timezone=True)),
        sa.Column('resuelto', sa.Boolean(), server_default='false'),
        sa.Column('resuelto_at', sa.DateTime(timezone=True)),
        sa.Column('resuelto_motivo', sa.String(100)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_pharma_exp_company', 'company_id'),
        sa.Index('ix_pharma_exp_vencimiento', 'fecha_vencimiento'),
        sa.Index('ix_pharma_exp_tipo', 'alerta_tipo'),
    )
    
    # pharma_insurance_coverage
    op.create_table(
        'pharma_insurance_coverage',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medication_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('obra_social_nombre', sa.String(100), nullable=False),
        sa.Column('obra_social_codigo', sa.String(20)),
        sa.Column('cobertura_pct', sa.Numeric(5, 2), nullable=False),
        sa.Column('copago_fijo', sa.Numeric(15, 0)),
        sa.Column('requiere_autorizacion', sa.Boolean(), server_default='false'),
        sa.Column('autorizacion_previa_dias', sa.Integer()),
        sa.Column('limite_mensual', sa.Integer()),
        sa.Column('limite_tratamiento', sa.Integer()),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['medication_id'], ['pharma_medications.id']),
        sa.Index('ix_pharma_ins_company', 'company_id'),
        sa.Index('ix_pharma_ins_medication', 'medication_id'),
        sa.Index('ix_pharma_ins_obra_social', 'obra_social_nombre'),
    )
    
    # pharma_cold_chain
    op.create_table(
        'pharma_cold_chain',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medication_id', postgresql.UUID(as_uuid=True)),
        sa.Column('warehouse_id', postgresql.UUID(as_uuid=True)),
        sa.Column('lote', sa.String(50)),
        sa.Column('temperatura', sa.Numeric(5, 2), nullable=False),
        sa.Column('temp_min_esperada', sa.Numeric(5, 2)),
        sa.Column('temp_max_esperada', sa.Numeric(5, 2)),
        sa.Column('fuera_rango', sa.Boolean(), server_default='false'),
        sa.Column('tipo_registro', sa.String(20), server_default='manual'),
        sa.Column('sensor_id', sa.String(50)),
        sa.Column('ubicacion', sa.String(100)),
        sa.Column('alerta_generada', sa.Boolean(), server_default='false'),
        sa.Column('alerta_motivo', sa.String(200)),
        sa.Column('observaciones', sa.Text()),
        sa.Column('user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_pharma_cc_company', 'company_id'),
        sa.Index('ix_pharma_cc_product', 'product_id'),
        sa.Index('ix_pharma_cc_created', 'created_at'),
        sa.Index('ix_pharma_cc_fuera_rango', 'fuera_rango'),
    )
    
    # pharma_patient_history
    op.create_table(
        'pharma_patient_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medication_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True)),
        sa.Column('prescription_id', postgresql.UUID(as_uuid=True)),
        sa.Column('cantidad', sa.Numeric(10, 3), nullable=False),
        sa.Column('posologia', sa.Text()),
        sa.Column('duracion_dias', sa.Integer()),
        sa.Column('medico_nombre', sa.String(200)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['medication_id'], ['pharma_medications.id']),
        sa.Index('ix_pharma_hist_company_customer', 'company_id', 'customer_id'),
        sa.Index('ix_pharma_hist_medication', 'medication_id'),
        sa.Index('ix_pharma_hist_created', 'created_at'),
    )
    
    # ============================================================
    # intelientregas TABLES
    # ============================================================
    
    # intelientregas_drivers
    op.create_table(
        'intelientregas_drivers',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('ci', sa.String(20)),
        sa.Column('telefono', sa.String(20), nullable=False),
        sa.Column('email', sa.String(100)),
        sa.Column('licencia_numero', sa.String(50)),
        sa.Column('licencia_vencimiento', sa.DateTime(timezone=True)),
        sa.Column('status', sa.String(20), server_default='available'),
        sa.Column('rating', sa.Numeric(3, 2), server_default='0'),
        sa.Column('total_deliveries', sa.Integer(), server_default='0'),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_intelientregas_drivers_company', 'company_id'),
        sa.Index('ix_intelientregas_drivers_status', 'status'),
    )
    
    # intelientregas_vehicles
    op.create_table(
        'intelientregas_vehicles',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('driver_id', postgresql.UUID(as_uuid=True)),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('marca', sa.String(50)),
        sa.Column('modelo', sa.String(50)),
        sa.Column('color', sa.String(30)),
        sa.Column('patente', sa.String(20)),
        sa.Column('anio', sa.Integer()),
        sa.Column('capacidad_kg', sa.Numeric(8, 2)),
        sa.Column('tiene_caja_termica', sa.Boolean(), server_default='false'),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['driver_id'], ['intelientregas_drivers.id']),
        sa.Index('ix_intelientregas_vehicles_company', 'company_id'),
        sa.Index('ix_intelientregas_vehicles_driver', 'driver_id'),
    )
    
    # intelientregas_routes
    op.create_table(
        'intelientregas_routes',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('driver_id', postgresql.UUID(as_uuid=True)),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True)),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('fecha', sa.DateTime(timezone=True), nullable=False),
        sa.Column('estado', sa.String(20), server_default='planificada'),
        sa.Column('total_stops', sa.Integer(), server_default='0'),
        sa.Column('completed_stops', sa.Integer(), server_default='0'),
        sa.Column('distancia_km', sa.Numeric(8, 2)),
        sa.Column('duracion_estimada_min', sa.Integer()),
        sa.Column('observaciones', sa.Text()),
        sa.Column('started_at', sa.DateTime(timezone=True)),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['driver_id'], ['intelientregas_drivers.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['intelientregas_vehicles.id']),
        sa.Index('ix_intelientregas_routes_company_fecha', 'company_id', 'fecha'),
        sa.Index('ix_intelientregas_routes_driver', 'driver_id'),
    )
    
    # intelientregas_deliveries
    op.create_table(
        'intelientregas_deliveries',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True)),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True)),
        sa.Column('branch_id', postgresql.UUID(as_uuid=True)),
        sa.Column('driver_id', postgresql.UUID(as_uuid=True)),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True)),
        sa.Column('route_id', postgresql.UUID(as_uuid=True)),
        sa.Column('customer_nombre', sa.String(200), nullable=False),
        sa.Column('customer_telefono', sa.String(20)),
        sa.Column('customer_ci', sa.String(20)),
        sa.Column('direccion', sa.Text(), nullable=False),
        sa.Column('barrio', sa.String(100)),
        sa.Column('ciudad', sa.String(100)),
        sa.Column('referencia', sa.Text()),
        sa.Column('latitud', sa.Float()),
        sa.Column('longitud', sa.Float()),
        sa.Column('estado', sa.String(20), server_default='pending'),
        sa.Column('prioridad', sa.String(20), server_default='normal'),
        sa.Column('observaciones', sa.Text()),
        sa.Column('instrucciones_entrega', sa.Text()),
        sa.Column('scheduled_from', sa.DateTime(timezone=True)),
        sa.Column('scheduled_to', sa.DateTime(timezone=True)),
        sa.Column('assigned_at', sa.DateTime(timezone=True)),
        sa.Column('picked_up_at', sa.DateTime(timezone=True)),
        sa.Column('in_transit_at', sa.DateTime(timezone=True)),
        sa.Column('delivered_at', sa.DateTime(timezone=True)),
        sa.Column('failed_at', sa.DateTime(timezone=True)),
        sa.Column('motivo_falla', sa.String(200)),
        sa.Column('costo_delivery', sa.Numeric(15, 0), server_default='0'),
        sa.Column('cobrado', sa.Boolean(), server_default='false'),
        sa.Column('tracking_code', sa.String(20)),
        sa.Column('external_order_id', sa.String(100)),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['driver_id'], ['intelientregas_drivers.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['intelientregas_vehicles.id']),
        sa.ForeignKeyConstraint(['route_id'], ['intelientregas_routes.id']),
        sa.Index('ix_intelientregas_deliveries_company_estado', 'company_id', 'estado'),
        sa.Index('ix_intelientregas_deliveries_driver', 'driver_id', 'estado'),
        sa.Index('ix_intelientregas_deliveries_route', 'route_id'),
        sa.Index('ix_intelientregas_deliveries_created', 'created_at'),
    )
    
    # intelientregas_route_stops
    op.create_table(
        'intelientregas_route_stops',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('route_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('delivery_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('estado', sa.String(20), server_default='pending'),
        sa.Column('latitud', sa.Float()),
        sa.Column('longitud', sa.Float()),
        sa.Column('direccion', sa.Text()),
        sa.Column('customer_nombre', sa.String(200)),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['route_id'], ['intelientregas_routes.id']),
        sa.ForeignKeyConstraint(['delivery_id'], ['intelientregas_deliveries.id']),
        sa.Index('ix_intelientregas_route_stops_route_orden', 'route_id', 'orden'),
    )
    
    # intelientregas_tracking_events
    op.create_table(
        'intelientregas_tracking_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('delivery_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('driver_id', postgresql.UUID(as_uuid=True)),
        sa.Column('latitud', sa.Float(), nullable=False),
        sa.Column('longitud', sa.Float(), nullable=False),
        sa.Column('velocidad_kmh', sa.Numeric(5, 2)),
        sa.Column('precision_m', sa.Float()),
        sa.Column('bateria_pct', sa.Integer()),
        sa.Column('evento', sa.String(30), server_default='location'),
        sa.Column('datos', postgresql.JSONB()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['delivery_id'], ['intelientregas_deliveries.id']),
        sa.ForeignKeyConstraint(['driver_id'], ['intelientregas_drivers.id']),
        sa.Index('ix_intelientregas_tracking_delivery', 'delivery_id', 'created_at'),
        sa.Index('ix_intelientregas_tracking_driver', 'driver_id', 'created_at'),
    )
    
    # intelientregas_delivery_proofs
    op.create_table(
        'intelientregas_delivery_proofs',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('delivery_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('url', sa.Text()),
        sa.Column('codigo_confirmacion', sa.String(10)),
        sa.Column('nombre_recibio', sa.String(100)),
        sa.Column('relacion', sa.String(50)),
        sa.Column('observaciones', sa.Text()),
        sa.Column('latitud', sa.Float()),
        sa.Column('longitud', sa.Float()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['delivery_id'], ['intelientregas_deliveries.id']),
        sa.Index('ix_intelientregas_proofs_delivery', 'delivery_id'),
    )
    
    # intelientregas_zones
    op.create_table(
        'intelientregas_zones',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.Text()),
        sa.Column('costo_base', sa.Numeric(15, 0), nullable=False),
        sa.Column('costo_km', sa.Numeric(15, 0), server_default='0'),
        sa.Column('tiempo_estimado_min', sa.Integer()),
        sa.Column('radio_km', sa.Numeric(5, 2)),
        sa.Column('centro_lat', sa.Float()),
        sa.Column('centro_lon', sa.Float()),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_intelientregas_zones_company', 'company_id'),
    )


def downgrade() -> None:
    op.drop_table('intelientregas_zones')
    op.drop_table('intelientregas_delivery_proofs')
    op.drop_table('intelientregas_tracking_events')
    op.drop_table('intelientregas_route_stops')
    op.drop_table('intelientregas_deliveries')
    op.drop_table('intelientregas_routes')
    op.drop_table('intelientregas_vehicles')
    op.drop_table('intelientregas_drivers')
    op.drop_table('pharma_patient_history')
    op.drop_table('pharma_cold_chain')
    op.drop_table('pharma_insurance_coverage')
    op.drop_table('pharma_expiration_alerts')
    op.drop_table('pharma_controlled_logs')
    op.drop_table('pharma_prescriptions')
    op.drop_table('pharma_equivalents')
    op.drop_table('pharma_medications')
    op.drop_table('pharma_active_ingredients')
