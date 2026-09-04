"""Financial models — AP, banking, cash flow, budgets, payment runs"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, Text, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from api.src.db import Base


class SupplierInvoice(Base):
    __tablename__ = "supplier_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero_factura = Column(String(50), nullable=False)
    timbrado = Column(String(20))
    cdc = Column(String(64))
    fecha_emision = Column(Date, nullable=False)
    fecha_recepcion = Column(Date, server_default=func.current_date())
    fecha_vencimiento = Column(Date, nullable=False)
    subtotal = Column(Numeric(15, 0), default=0)
    descuento = Column(Numeric(15, 0), default=0)
    iva_10 = Column(Numeric(15, 0), default=0)
    iva_5 = Column(Numeric(15, 0), default=0)
    total = Column(Numeric(15, 0), nullable=False)
    saldo_pendiente = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    tipo_cambio = Column(Numeric(10, 2), default=1)
    purchase_order_id = Column(UUID(as_uuid=True))
    receipt_id = Column(UUID(as_uuid=True))
    condicion = Column(String(20), default="credito")
    tipo_comprobante = Column(String(20), default="factura")
    estado = Column(String(20), nullable=False, default="pendiente")
    concepto = Column(String(300))
    bloqueada_para_pago = Column(Boolean, default=False)
    motivo_bloqueo = Column(Text)
    monto_retenido_nc = Column(Numeric(15, 0), default=0)
    requiere_nc = Column(Boolean, default=False)
    xml_sifen_url = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    approved_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    payments = relationship("SupplierInvoicePayment", back_populates="invoice", cascade="all, delete-orphan")
    items = relationship("SupplierInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class SupplierInvoiceItem(Base):
    __tablename__ = "supplier_invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("supplier_invoices.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True, index=True)
    codigo_proveedor = Column(String(50))
    descripcion = Column(String(300), nullable=False)
    cantidad = Column(Numeric(12, 3), nullable=False)
    precio_unitario = Column(Numeric(15, 2), nullable=False)
    descuento = Column(Numeric(15, 2), default=0)
    iva_tasa = Column(Numeric(5, 2), default=10)
    total = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("SupplierInvoice", back_populates="items")



class SupplierInvoicePayment(Base):
    __tablename__ = "supplier_invoice_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("supplier_invoices.id"), nullable=False, index=True)
    payment_method = Column(String(30), nullable=False)
    monto = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    fecha_pago = Column(Date, nullable=False, server_default=func.current_date())
    referencia = Column(String(100))
    comprobante_url = Column(String(500))
    bank_account_id = Column(UUID(as_uuid=True))
    estado = Column(String(20), default="pendiente")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("SupplierInvoice", back_populates="payments")


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    banco = Column(String(100), nullable=False)
    tipo = Column(String(20), nullable=False)
    numero_cuenta = Column(String(50), nullable=False)
    moneda = Column(String(3), default="PYG")
    saldo_inicial = Column(Numeric(15, 2), default=0)
    saldo_actual = Column(Numeric(15, 2), default=0)
    titular = Column(String(200))
    activo = Column(Boolean, default=True)
    saldo_minimo_alerta = Column(Numeric(15, 2))  # NULL = alerta de saldo bajo desactivada
    saldo_verificado_manualmente = Column(Boolean, nullable=False, default=False)
    saldo_verificado_at = Column(DateTime(timezone=True))
    saldo_verificado_por = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    transactions = relationship("BankTransaction", back_populates="bank_account", cascade="all, delete-orphan")


class BankBalanceCorrectionRequest(Base):
    """Divergencia grande detectada por sync_bank_balances contra un saldo ya
    verificado manualmente (origen='auto_divergencia'), o una corrección de
    saldo pedida a mano (origen='manual') -- en ambos casos el saldo NO se
    toca hasta que Supervisor Y Gerente aprueben, mismo patrón de dos slots
    que CreditApprovalRequest en Cuentas por Cobrar."""
    __tablename__ = "bank_balance_correction_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=False, index=True)
    origen = Column(String(20), nullable=False)  # auto_divergencia | manual
    saldo_actual = Column(Numeric(15, 2), nullable=False)
    saldo_propuesto = Column(Numeric(15, 2), nullable=False)
    motivo = Column(Text)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente, aprobado, rechazado
    solicitado_por = Column(UUID(as_uuid=True))
    aprobado_supervisor_id = Column(UUID(as_uuid=True))
    aprobado_supervisor_at = Column(DateTime(timezone=True))
    aprobado_gerente_id = Column(UUID(as_uuid=True))
    aprobado_gerente_at = Column(DateTime(timezone=True))
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_at = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=False, index=True)
    fecha = Column(Date, nullable=False)
    tipo = Column(String(10), nullable=False)
    monto = Column(Numeric(15, 2), nullable=False)
    moneda = Column(String(3), default="PYG")
    descripcion = Column(String(300))
    referencia = Column(String(100))
    contraparte = Column(String(200))
    conciliado = Column(Boolean, default=False)
    fecha_conciliacion = Column(DateTime(timezone=True))
    invoice_id = Column(UUID(as_uuid=True))
    cheque_id = Column(UUID(as_uuid=True))
    categoria = Column(String(30), default="otros")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bank_account = relationship("BankAccount", back_populates="transactions")


class CashFlowProjection(Base):
    __tablename__ = "cash_flow_projections"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fecha = Column(Date, nullable=False)
    saldo_inicial = Column(Numeric(15, 2), default=0)
    ingresos_estimados = Column(Numeric(15, 2), default=0)
    egresos_estimados = Column(Numeric(15, 2), default=0)
    saldo_final_proyectado = Column(Numeric(15, 2), default=0)
    ingresos_reales = Column(Numeric(15, 2))
    egresos_reales = Column(Numeric(15, 2))
    saldo_final_real = Column(Numeric(15, 2))
    fuente = Column(String(20), default="automatico")
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "fecha", name="uq_cashflow_company_date"),
    )


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    periodo = Column(String(7), nullable=False)
    categoria = Column(String(100))
    monto_presupuestado = Column(Numeric(15, 2), nullable=False)
    monto_ejecutado = Column(Numeric(15, 2), default=0)
    monto_disponible = Column(Numeric(15, 2))
    area = Column(String(50), default="general")
    tipo = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PaymentRun(Base):
    __tablename__ = "payment_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    fecha_programada = Column(Date, nullable=False)
    total_monto = Column(Numeric(15, 2), default=0)
    estado = Column(String(20), nullable=False, default="borrador")
    metodo_pago = Column(String(30))
    bank_account_id = Column(UUID(as_uuid=True))
    created_by = Column(UUID(as_uuid=True))
    approved_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items = relationship("PaymentRunItem", back_populates="payment_run", cascade="all, delete-orphan")


class PaymentRunItem(Base):
    __tablename__ = "payment_run_items"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    payment_run_id = Column(UUID(as_uuid=True), ForeignKey("payment_runs.id"), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("supplier_invoices.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)
    monto_programado = Column(Numeric(15, 2), nullable=False)
    monto_pagado = Column(Numeric(15, 2))
    estado = Column(String(20), default="pendiente")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    payment_run = relationship("PaymentRun", back_populates="items")


class SupplierCreditNote(Base):
    """Notas de credito recibidas de proveedores (devoluciones, descuentos)."""
    __tablename__ = "supplier_credit_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(30), nullable=False)
    numero_factura_origen = Column(String(50))
    timbrado = Column(String(30))
    fecha = Column(Date, nullable=False)
    motivo = Column(String(150))
    monto = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    observaciones = Column(Text)
    cancelado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SupplierReturn(Base):
    """Mercaderia devuelta a un proveedor (vencidos, sobrestock, premios/bonif.)
    — acredita el saldo del proveedor, distinto de una nota de credito recibida."""
    __tablename__ = "supplier_returns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero_factura_origen = Column(String(50))
    numero_nota_credito = Column(String(30))
    timbrado = Column(String(30))
    fecha = Column(Date, nullable=False)
    monto = Column(Numeric(15, 0), nullable=False)
    moneda = Column(String(3), default="PYG")
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PayrollMovement(Base):
    """Detalle de nomina por empleado y concepto (salario base, horas extra,
    aguinaldo, adelantos, faltante en caja descontado, etc.) — mas granular
    que el gasto agregado 'SUELDOS Y JORNALES' que ya se sincroniza como gasto
    de caja chica; se muestra aparte para no duplicar esa cifra."""
    __tablename__ = "payroll_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    empleado_nombre = Column(String(150), nullable=False)
    concepto = Column(String(100), nullable=False)
    es_credito = Column(Boolean, nullable=False, default=True)  # False = descuento (adelanto, falta, multa, faltante de caja)
    monto = Column(Numeric(15, 0), nullable=False)
    fecha = Column(Date, nullable=False)
    cerrado = Column(Boolean, default=False)  # BO_FINALIZADO — ya incluido en una liquidacion cerrada
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class APPaymentApprovalRequest(Base):
    """Pago de factura individual o ejecucion de lote de pago que supera el
    umbral configurado (Cuentas por Pagar Fase 3) -- retenido hasta que
    Supervisor Y Gerente aprueben, mismo patron de dos slots que
    CreditApprovalRequest y BankBalanceCorrectionRequest."""
    __tablename__ = "ap_payment_approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entidad_tipo = Column(String(20), nullable=False)  # invoice | payment_run
    entidad_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    monto = Column(Numeric(15, 2), nullable=False)
    payment_method = Column(String(30))
    moneda = Column(String(3))
    fecha_pago = Column(Date)
    referencia = Column(String(100))
    comprobante_url = Column(Text)
    bank_account_id = Column(UUID(as_uuid=True))
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente, aprobado, rechazado
    solicitado_por = Column(UUID(as_uuid=True))
    aprobado_supervisor_id = Column(UUID(as_uuid=True))
    aprobado_supervisor_at = Column(DateTime(timezone=True))
    aprobado_gerente_id = Column(UUID(as_uuid=True))
    aprobado_gerente_at = Column(DateTime(timezone=True))
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_at = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
