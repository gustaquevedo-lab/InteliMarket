import asyncio
import asyncpg
import time

async def main():
    db_url = ''
    with open('/home/intellihouse/intelimarket/.env') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip("'\"")
                break
    clean_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(clean_url)

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_supplier_invoices_comp_estado_venc ON supplier_invoices (company_id, estado, fecha_vencimiento)",
        "CREATE INDEX IF NOT EXISTS ix_supplier_invoices_comp_fecha_emision ON supplier_invoices (company_id, fecha_emision DESC)",
        "CREATE INDEX IF NOT EXISTS ix_supplier_credit_notes_comp_cancel ON supplier_credit_notes (company_id, cancelado)",
        "CREATE INDEX IF NOT EXISTS ix_supplier_nc_requests_comp_inv ON supplier_nc_requests (company_id, invoice_id)",
        "CREATE INDEX IF NOT EXISTS ix_purchase_receipts_comp_po ON purchase_receipts (company_id, purchase_order_id)",
        "CREATE INDEX IF NOT EXISTS ix_purchase_receipts_comp_fecha ON purchase_receipts (company_id, fecha DESC)",
        "CREATE INDEX IF NOT EXISTS ix_purchase_receipts_supplier ON purchase_receipts (supplier_id)",
        "CREATE INDEX IF NOT EXISTS ix_suppliers_razon_social ON suppliers (razon_social)",
        "CREATE INDEX IF NOT EXISTS ix_suppliers_nombre_fantasia ON suppliers (nombre_fantasia)",
        "CREATE INDEX IF NOT EXISTS ix_supplier_invoices_receipt_id ON supplier_invoices (receipt_id)",
        "CREATE INDEX IF NOT EXISTS ix_supplier_invoices_po_id ON supplier_invoices (purchase_order_id)",
        "CREATE INDEX IF NOT EXISTS ix_supplier_invoices_numero_factura ON supplier_invoices (numero_factura)",
    ]

    print("=== CREATING MISSING INDEXES ===")
    for idx_sql in indexes:
        t0 = time.time()
        await conn.execute(idx_sql)
        t1 = time.time()
        idx_name = idx_sql.split()[5]
        print(f"Index {idx_name} created in {t1-t0:.3f}s")

    await conn.close()

asyncio.run(main())
