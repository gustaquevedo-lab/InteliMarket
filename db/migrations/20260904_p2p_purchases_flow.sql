-- ==============================================================================
-- MIGRACIÓN P2P COMPRAS: FLUJO COMPLETO, XML SIFEN, 3-WAY MATCH Y SOLICITUDES NC
-- Extra Supermercado (Rama vertical/supermercado)
-- ==============================================================================

-- 1. Configuración de Bandeja de Entrada IMAP (cPanel) por Empresa
CREATE TABLE IF NOT EXISTS purchase_inbox_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE,
    imap_host VARCHAR(100) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_user VARCHAR(150) NOT NULL,
    imap_password VARCHAR(255) NOT NULL,
    imap_ssl BOOLEAN DEFAULT TRUE,
    imap_folder VARCHAR(50) DEFAULT 'INBOX',
    activo BOOLEAN DEFAULT TRUE,
    ultimo_sync TIMESTAMP WITH TIME ZONE,
    ultimo_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_purchase_inbox_configs_company_id ON purchase_inbox_configs(company_id);

-- 2. Items detallados de Facturas de Proveedores
CREATE TABLE IF NOT EXISTS supplier_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    codigo_proveedor VARCHAR(50),
    descripcion VARCHAR(300) NOT NULL,
    cantidad NUMERIC(12, 3) NOT NULL,
    precio_unitario NUMERIC(15, 2) NOT NULL,
    descuento NUMERIC(15, 2) DEFAULT 0,
    iva_tasa NUMERIC(5, 2) DEFAULT 10,
    total NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_supplier_invoice_items_invoice_id ON supplier_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS ix_supplier_invoice_items_product_id ON supplier_invoice_items(product_id);

-- 3. Columnas de Control Financiero y Bloqueo en Facturas de Proveedores
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS bloqueada_para_pago BOOLEAN DEFAULT FALSE;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS motivo_bloqueo TEXT;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS monto_retenido_nc NUMERIC(15, 0) DEFAULT 0;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS requiere_nc BOOLEAN DEFAULT FALSE;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS xml_sifen_url TEXT;

-- 4. Solicitudes de Notas de Crédito / Reclamos a Proveedores ("Sin NC no hay pago")
CREATE TABLE IF NOT EXISTS supplier_nc_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    invoice_id UUID NOT NULL REFERENCES supplier_invoices(id),
    receipt_id UUID REFERENCES purchase_receipts(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    numero_solicitud VARCHAR(30) NOT NULL UNIQUE,
    tipo_motivo VARCHAR(50) NOT NULL,
    monto_reclamado NUMERIC(15, 0) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente_entrega',
    nc_recibida_numero VARCHAR(50),
    nc_recibida_timbrado VARCHAR(20),
    nc_recibida_cdc VARCHAR(64),
    nc_recibida_monto NUMERIC(15, 0),
    nc_recibida_fecha DATE,
    observaciones TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS ix_supplier_nc_requests_company_id ON supplier_nc_requests(company_id);
CREATE INDEX IF NOT EXISTS ix_supplier_nc_requests_supplier_id ON supplier_nc_requests(supplier_id);
CREATE INDEX IF NOT EXISTS ix_supplier_nc_requests_invoice_id ON supplier_nc_requests(invoice_id);

-- 5. Adiciones Extraordinarias en Recepción de Muelle
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS es_extraordinario BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS autorizado_por UUID;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS autorizacion_motivo TEXT;
