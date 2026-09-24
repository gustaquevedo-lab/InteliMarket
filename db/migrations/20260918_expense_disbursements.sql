-- Migración: Soporte para Liquidación Multimedio de Gastos (Bóveda, Fondo Fijo, Bancos, Cheques)

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS fecha_pago DATE,
ADD COLUMN IF NOT EXISTS pagado_por UUID,
ADD COLUMN IF NOT EXISTS pagado_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS forma_pago_resumen VARCHAR(100);

CREATE TABLE IF NOT EXISTS expense_disbursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    medio_pago VARCHAR(30) NOT NULL, -- boveda | fondo_fijo | transferencia | cheque | otro
    monto NUMERIC(15, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    petty_cash_fund_id UUID REFERENCES petty_cash_funds(id) ON DELETE SET NULL,
    cheque_id UUID REFERENCES cheques(id) ON DELETE SET NULL,
    numero_comprobante VARCHAR(100),
    fecha_efectiva DATE NOT NULL DEFAULT CURRENT_DATE,
    detalles JSONB,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_disbursements_expense_id ON expense_disbursements(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_disbursements_company_id ON expense_disbursements(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_disbursements_medio ON expense_disbursements(medio_pago);
