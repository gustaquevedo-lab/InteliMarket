"""Compare DB schema vs expected model columns and generate ALTER TABLE statements."""
import asyncio
import asyncpg

MODEL_COLS = {
    "branches": {
        "id", "company_id", "codigo", "nombre", "direccion", "ciudad",
        "departamento", "telefono", "email", "ruc", "punto_emision",
        "activo", "created_at", "updated_at",
    },
    "warehouses": {
        "id", "company_id", "branch_id", "codigo", "nombre", "direccion",
        "tipo", "activo", "created_at", "updated_at",
    },
    "products": {
        "id", "company_id", "codigo", "codigo_barra", "nombre", "descripcion",
        "categoria", "marca", "unidad_medida", "impuesto_porcentaje",
        "precio_costo", "precio_venta", "precio_mayorista", "stock_actual",
        "stock_minimo", "stock_maximo", "activo", "created_at", "updated_at",
        "perecedero", "controla_stock", "peso_variable", "categoria_compra",
        "codigo_interno", "lleva_vencimiento", "porcentaje_iva", "tiene_scale",
    },
    "suppliers": {
        "id", "company_id", "codigo", "nombre", "ruc", "contacto_nombre",
        "telefono", "email", "direccion", "ciudad", "departamento", "tipo",
        "condicion_pago", "plazo_pago_dias", "cupo_credito", "activo",
        "created_at", "updated_at", "saldo_pendiente", "saldo_disponible",
    },
    "customers": {
        "id", "company_id", "codigo", "nombre", "ruc", "direccion", "ciudad",
        "departamento", "telefono", "email", "tipo", "condicion_pago",
        "plazo_pago_dias", "cupo_credito", "saldo_pendiente",
        "saldo_disponible", "activo", "latitud", "longitud", "ruta_id",
        "created_at", "updated_at",
    },
    "sales": {
        "id", "company_id", "branch_id", "customer_id", "numero_factura",
        "timbrado", "fecha_emision", "fecha_vencimiento", "subtotal",
        "descuento", "iva", "total", "moneda", "tipo_pago", "estado",
        "notas", "created_at", "updated_at", "total_gravado", "total_exento",
        "total_iva",
    },
    "sale_items": {
        "id", "sale_id", "product_id", "codigo", "nombre", "cantidad",
        "precio_unitario", "subtotal", "iva", "descuento",
    },
    "purchase_orders": {
        "id", "company_id", "supplier_id", "numero_oc", "fecha_emision",
        "fecha_entrega", "estado", "subtotal", "descuento", "iva", "total",
        "moneda", "notas", "created_at", "updated_at", "aprobado_por",
        "fecha_aprobacion",
    },
    "purchase_order_items": {
        "id", "purchase_order_id", "product_id", "codigo", "nombre",
        "cantidad", "precio_unitario", "subtotal", "iva", "cantidad_recibida",
    },
    "products_categories": {
        "id", "company_id", "nombre", "descripcion", "activo", "created_at",
        "updated_at",
    },
    "price_lists": {
        "id", "company_id", "nombre", "tipo", "activo", "created_at",
        "updated_at",
    },
    "price_list_items": {
        "id", "price_list_id", "product_id", "precio", "created_at",
        "updated_at",
    },
    "promotions": {
        "id", "company_id", "nombre", "descripcion", "tipo", "valor",
        "aplica_a", "aplica_id", "monto_minimo", "activo", "fecha_inicio",
        "fecha_fin", "created_at", "updated_at",
    },
    "petty_cash": {
        "id", "company_id", "branch_id", "codigo", "descripcion",
        "monto_asignado", "monto_actual", "moneda", "estado", "responsable",
        "created_at", "updated_at",
    },
    "petty_cash_movements": {
        "id", "petty_cash_id", "tipo", "monto", "concepto", "comprobante",
        "created_by", "created_at",
    },
    "bank_accounts": {
        "id", "company_id", "banco", "tipo", "numero_cuenta", "moneda",
        "saldo_inicial", "saldo_actual", "titular", "activo", "created_at",
        "updated_at",
    },
    "accounting_entries": {
        "id", "company_id", "numero_asiento", "fecha", "concepto", "tipo",
        "moneda", "monto_total", "created_at", "updated_at",
    },
    "accounting_entry_items": {
        "id", "entry_id", "cuenta", "debe", "haber", "created_at",
    },
}


async def main():
    conn = await asyncpg.connect(
        "postgresql://intelimarket:intelimarket@db:5432/intelimarket"
    )

    rows = await conn.fetch(
        "SELECT table_name, column_name FROM information_schema.columns "
        "WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
    )
    db_cols = {}
    for r in rows:
        db_cols.setdefault(r["table_name"], set()).add(r["column_name"])

    missing_total = 0
    for tbl, expected in sorted(MODEL_COLS.items()):
        actual = db_cols.get(tbl, set())
        missing = expected - actual
        if missing:
            missing_total += len(missing)
            print(f"\n--- {tbl} ---")
            for col in sorted(missing):
                print(f"  ALTER TABLE {tbl} ADD COLUMN {col} VARCHAR(255);")

    print(f"\nTotal missing: {missing_total} columns")
    await conn.close()


asyncio.run(main())
