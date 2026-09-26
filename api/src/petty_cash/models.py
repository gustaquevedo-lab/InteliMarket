from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from api.src.db import Base

# Asegurar registro de tablas foráneas para el resolver de SQLAlchemy
import api.src.fixed_assets.models  # noqa: F401
import api.src.financial.models     # noqa: F401
import api.src.cheques.models       # noqa: F401


class ExpenseCategory(Base):
    """Cost centers for expense tracking"""
    __tablename__ = "expense_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    presupuesto_mensual = Column(Numeric(15, 2))
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CostCenter(Base):
    """Sector/área del negocio (carnicería, panadería, caja, administración...) para
    imputar gastos y medir rentabilidad por centro de costo. tipo='global' es el
    centro especial cuyo saldo se prorratea entre los sectores activos según
    peso_prorateo — para gastos que no son atribuibles a un único sector
    (ej. alquiler, seguridad, gerencia)."""
    __tablename__ = "cost_centers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(20), nullable=False, server_default="sector")  # sector | global
    peso_prorateo = Column(Numeric(6, 2), nullable=False, server_default="1")
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PettyCashFund(Base):
    """Fondo fijo real de caja chica -- un monto autorizado por sucursal, con
    un custodio responsable y un saldo real que baja con cada gasto y sube
    con cada reposicion. Sin esto, 'caja chica' era solo un log de gastos sin
    ningun concepto de caja (Fase 1 del rediseño)."""
    __tablename__ = "petty_cash_funds"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), index=True)
    nombre = Column(String(100), nullable=False)
    custodio_id = Column(UUID(as_uuid=True))
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("cost_centers.id"))
    monto_autorizado = Column(Numeric(15, 0), nullable=False)
    saldo_actual = Column(Numeric(15, 0), nullable=False)
    monto_maximo_por_gasto = Column(Numeric(15, 0), default=500000)
    activo = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PettyCashFundMovement(Base):
    """Ledger de todo movimiento del fondo -- apertura, gasto, reposicion,
    ajuste -- para no perder el rastro de por que el saldo es el que es."""
    __tablename__ = "petty_cash_fund_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    fund_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # apertura | gasto | reposicion | ajuste
    monto = Column(Numeric(15, 0), nullable=False)
    saldo_anterior = Column(Numeric(15, 0), nullable=False)
    saldo_nuevo = Column(Numeric(15, 0), nullable=False)
    referencia_type = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    observaciones = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PettyCashFundCount(Base):
    """Arqueo de caja chica -- conteo ciego del efectivo fisico del fondo,
    mismo patron que CashCount en el modulo Caja: el custodio declara lo que
    cuenta SIN ver el saldo_actual del sistema; saldo_esperado se guarda como
    foto del momento (no se recalcula despues) y la diferencia se calcula en
    el backend recien al guardar. requiere_revision se dispara si la
    diferencia supera la tolerancia configurada -- ahi un Supervisor/Gerente
    tiene que confirmar el arqueo y decidir si ajusta el saldo del fondo."""
    __tablename__ = "petty_cash_fund_counts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fund_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    contado_por = Column(UUID(as_uuid=True), nullable=False)
    contado_por_nombre = Column(String(100))
    saldo_esperado = Column(Numeric(15, 0), nullable=False)
    monto_contado = Column(Numeric(15, 0), nullable=False)
    diferencia = Column(Numeric(15, 0), nullable=False)
    requiere_revision = Column(Boolean, nullable=False, server_default="false")
    estado = Column(String(20), nullable=False, server_default="pendiente")  # pendiente | confirmado
    confirmado_por = Column(UUID(as_uuid=True))
    confirmado_por_nombre = Column(String(100))
    fecha_confirmacion = Column(DateTime(timezone=True))
    ajusto_saldo = Column(Boolean, nullable=False, server_default="false")
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PettyCashRendicion(Base):
    """Expediente de Rendición de Cuentas y Solicitud de Reposición de Fondo Fijo."""
    __tablename__ = "petty_cash_rendiciones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fund_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id"), nullable=False, index=True)
    numero_rendicion = Column(String(50), nullable=False, index=True)  # REND-202609-0001

    # Responsables
    custodio_id = Column(UUID(as_uuid=True), nullable=False)
    custodio_nombre = Column(String(100), nullable=False)
    auditado_por_id = Column(UUID(as_uuid=True))
    auditado_por_nombre = Column(String(100))

    # Estado: borrador | presentada | en_revision | aprobada | pagada | rechazada
    estado = Column(String(30), nullable=False, default="borrador", index=True)

    # Cuadre de Arqueo Físico al Rendir
    monto_fondo_autorizado = Column(Numeric(15, 0), nullable=False)
    efectivo_remanente_contado = Column(Numeric(15, 0), nullable=False, default=0)
    total_comprobantes_presentados = Column(Numeric(15, 0), nullable=False, default=0)
    total_comprobantes_aprobados = Column(Numeric(15, 0), nullable=False, default=0)
    total_comprobantes_rechazados = Column(Numeric(15, 0), nullable=False, default=0)
    diferencia_arqueo = Column(Numeric(15, 0), nullable=False, default=0)

    # Desglose Fiscal Consolidado de Comprobantes Aprobados
    total_gravado_10 = Column(Numeric(15, 0), default=0)
    total_gravado_5 = Column(Numeric(15, 0), default=0)
    total_exentas = Column(Numeric(15, 0), default=0)
    total_iva_10 = Column(Numeric(15, 0), default=0)
    total_iva_5 = Column(Numeric(15, 0), default=0)
    total_inversion_activos = Column(Numeric(15, 0), default=0)
    total_gasto_operativo = Column(Numeric(15, 0), default=0)

    # Datos de Reposición por Tesorería
    monto_repuesto = Column(Numeric(15, 0), default=0)
    medio_reposicion = Column(String(30))  # EFECTIVO_BOVEDA | BANCO_TRANSFERENCIA | CHEQUE
    caja_boveda_id = Column(UUID(as_uuid=True))
    cash_movement_id = Column(UUID(as_uuid=True))
    bank_account_id = Column(UUID(as_uuid=True))
    bank_transaction_id = Column(UUID(as_uuid=True))
    comprobante_pago_ref = Column(String(100))

    # Integración Contable
    asiento_contable_id = Column(UUID(as_uuid=True))

    # Auditoría y Trazabilidad
    fecha_presentacion = Column(DateTime(timezone=True))
    fecha_aprobacion = Column(DateTime(timezone=True))
    fecha_pago = Column(DateTime(timezone=True))
    observaciones_custodio = Column(Text)
    observaciones_tesoreria = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Expense(Base):
    """Caja chica — daily expense tracking with fiscal & asset support"""
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    fund_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id"), index=True)
    rendicion_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_rendiciones.id"), index=True)
    category_id = Column(UUID(as_uuid=True))
    cost_center_id = Column(UUID(as_uuid=True), ForeignKey("cost_centers.id"))
    monto = Column(Numeric(15, 2), nullable=False)
    monto_brl = Column(Numeric(12, 2), nullable=True)
    descripcion = Column(String(300), nullable=False)
    proveedor = Column(String(100))
    comprobante_url = Column(String(500))  # receipt photo / pdf
    tipo_pago = Column(String(20))  # efectivo | tarjeta | transferencia
    fecha_gasto = Column(Date, nullable=False, server_default=func.current_date())

    # Campos Fiscales Paraguayos (DNIT / SET)
    ruc = Column(String(20), index=True)
    timbrado = Column(String(20))
    numero_factura = Column(String(50), index=True)
    tipo_comprobante = Column(String(30), default="FACTURA_CONTADO")  # FACTURA_CONTADO | AUTOFACTURA | RECIBO | BOLETA
    gravado_10 = Column(Numeric(15, 0), default=0)
    gravado_5 = Column(Numeric(15, 0), default=0)
    exentas = Column(Numeric(15, 0), default=0)
    iva_10 = Column(Numeric(15, 0), default=0)
    iva_5 = Column(Numeric(15, 0), default=0)

    # Clasificación Inversión vs Gasto (Activos Fijos)
    es_inversion = Column(Boolean, nullable=False, default=False)
    fixed_asset_id = Column(UUID(as_uuid=True), ForeignKey("fixed_assets.id"))
    vida_util_meses = Column(Integer)
    categoria_activo = Column(String(100))

    # Clasificación Mercadería vs Gasto Operativo (Cuentas por Pagar)
    es_pago_proveedor = Column(Boolean, nullable=False, default=False)
    supplier_id = Column(UUID(as_uuid=True), index=True)
    supplier_invoice_id = Column(UUID(as_uuid=True), ForeignKey("supplier_invoices.id", ondelete="SET NULL"), index=True)

    # Clasificación Anticipo de Sueldo (Nómina / SueldOK)
    es_anticipo_sueldo = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    employee_id = Column(String(100), index=True)
    employee_nombre = Column(String(150))
    employee_ci = Column(String(30))
    periodo_nomina = Column(String(7), index=True)  # ej. 2026-09
    cuotas_anticipo = Column(Integer, default=1, server_default="1")
    sueldok_sync_status = Column(String(30), default="pendiente", server_default="pendiente")
    sueldok_sync_id = Column(String(100))

    # Auditoría comprobante por comprobante
    auditoria_estado = Column(String(20), default="pendiente")  # pendiente | aprobado | observado | rechazado
    auditoria_motivo = Column(Text)

    # Control de Estados
    registrado_por = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    aprobado_at = Column(DateTime(timezone=True))
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_at = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    estado = Column(String(20), server_default="pendiente")  # pendiente | aprobado | pagado | rechazado
    anulado = Column(Boolean, nullable=False, server_default="false")
    anulado_por = Column(UUID(as_uuid=True))
    anulado_at = Column(DateTime(timezone=True))
    anulado_motivo = Column(Text)
    notas = Column(Text)

    # Liquidación / Pago Multimedio
    fecha_pago = Column(Date)
    pagado_por = Column(UUID(as_uuid=True))
    pagado_at = Column(DateTime(timezone=True))
    forma_pago_resumen = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExpenseSupplierInvoice(Base):
    """Tabla join N:M: un gasto puede imputarse a múltiples facturas
    comerciales de proveedores. Cada fila registra cuánto monto se
    aplicó a esa factura específica desde ese comprobante de gasto."""
    __tablename__ = "expense_supplier_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_invoice_id = Column(UUID(as_uuid=True), ForeignKey("supplier_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    monto_aplicado = Column(Numeric(15, 2), nullable=False, default=0)
    moneda = Column(String(3), nullable=False, server_default="PYG")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExpenseDisbursement(Base):
    """Línea de desembolso / medio de pago asignado a un gasto (bóveda, fondo fijo, banco, cheque, etc.)"""
    __tablename__ = "expense_disbursements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True)
    medio_pago = Column(String(30), nullable=False)  # boveda | fondo_fijo | transferencia | cheque | otro
    monto = Column(Numeric(15, 2), nullable=False)
    moneda = Column(String(3), nullable=False, default="PYG")
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    petty_cash_fund_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id", ondelete="SET NULL"))
    cheque_id = Column(UUID(as_uuid=True), ForeignKey("cheques.id", ondelete="SET NULL"))
    numero_comprobante = Column(String(100))
    fecha_efectiva = Column(Date, nullable=False, server_default=func.current_date())
    detalles = Column(JSONB)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


