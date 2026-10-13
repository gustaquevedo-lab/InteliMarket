-- Migración: Órdenes de Pago a Proveedores (AP Multifactura & Multimedio)
-- Extra Supermercado (RUC 80150377-9 / GRUPO SANTA TERESA E.A.S.)

CREATE TABLE IF NOT EXISTS supplier_payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    numero_orden VARCHAR(50) NOT NULL UNIQUE,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_pago DATE,
    estado VARCHAR(30) NOT NULL DEFAULT 'registrado',
    moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
    monto_total NUMERIC(15, 0) NOT NULL DEFAULT 0,
    monto_retenido NUMERIC(15, 0) NOT NULL DEFAULT 0,
    monto_neto NUMERIC(15, 0) NOT NULL DEFAULT 0,
    observaciones TEXT,
    recibo_proveedor VARCHAR(100),
    created_by UUID,
    paid_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_supplier_payment_orders_company_id ON supplier_payment_orders(company_id);
CREATE INDEX IF NOT EXISTS ix_supplier_payment_orders_supplier_id ON supplier_payment_orders(supplier_id);
CREATE INDEX IF NOT EXISTS ix_supplier_payment_orders_numero_orden ON supplier_payment_orders(numero_orden);

CREATE TABLE IF NOT EXISTS supplier_payment_order_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID NOT NULL REFERENCES supplier_payment_orders(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES supplier_invoices(id),
    monto_aplicado NUMERIC(15, 0) NOT NULL,
    monto_retencion NUMERIC(15, 0) DEFAULT 0,
    saldo_anterior NUMERIC(15, 0) NOT NULL,
    saldo_restante NUMERIC(15, 0) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_supplier_payment_order_allocations_payment_order_id ON supplier_payment_order_allocations(payment_order_id);
CREATE INDEX IF NOT EXISTS ix_supplier_payment_order_allocations_invoice_id ON supplier_payment_order_allocations(invoice_id);

CREATE TABLE IF NOT EXISTS supplier_payment_order_disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID NOT NULL REFERENCES supplier_payment_orders(id) ON DELETE CASCADE,
    forma_pago VARCHAR(30) NOT NULL,
    monto NUMERIC(15, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
    tipo_cambio NUMERIC(10, 2) DEFAULT 1,
    monto_pyg NUMERIC(15, 0) NOT NULL,
    bank_account_id UUID REFERENCES bank_accounts(id),
    referencia_transferencia VARCHAR(100),
    cheque_id UUID,
    numero_cheque VARCHAR(50),
    banco_cheque VARCHAR(100),
    fecha_cheque_emision DATE,
    fecha_cheque_vencimiento DATE,
    es_cheque_diferido BOOLEAN DEFAULT FALSE,
    titular_cheque VARCHAR(200),
    petty_cash_fund_id UUID,
    credit_note_id UUID REFERENCES supplier_credit_notes(id),
    comprobante_url TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_supplier_payment_order_disbursements_payment_order_id ON supplier_payment_order_disbursements(payment_order_id);
