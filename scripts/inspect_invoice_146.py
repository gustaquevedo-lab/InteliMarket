import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def inspect_invoice_146():
    async with async_session_factory() as db:
        print("=== 1. BUSCANDO FACTURA 001-015-0000146 ===")
        res_sale = await db.execute(text("""
            SELECT id, numero, numero_interno, fecha, customer_id, user_id, subtotal, descuento_total, total, total_pagado, estado, created_at
            FROM sales 
            WHERE numero LIKE '%146%' OR numero LIKE '%001-015%'
            ORDER BY created_at DESC
            LIMIT 10;
        """))
        cols_sale = res_sale.keys()
        sales = res_sale.fetchall()
        print(f"Ventas encontradas: {len(sales)}")
        for s in sales:
            print("\nVENTA:", dict(zip(cols_sale, s)))
            sale_id = s[0]

            # Items
            res_items = await db.execute(text("""
                SELECT si.*, p.codigo_barra, p.sku, p.nombre
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = :sid;
            """), {"sid": sale_id})

            cols_it = res_items.keys()
            for it in res_items.fetchall():
                print("   Item:", dict(zip(cols_it, it)))

        print("\n=== 2. BUSCANDO CLIENTE 3425101 ===")
        res_cust = await db.execute(text("""
            SELECT id, ruc, ruc_sin_dv, dv, razon_social, nombre_fantasia, limite_credito, saldo_actual, activo, es_extra_club, telefono, email
            FROM customers
            WHERE ruc_sin_dv = '3425101' OR ruc LIKE '%3425101%' OR razon_social LIKE '%3425101%'
               OR telefono LIKE '%3425101%' OR cedula LIKE '%3425101%';
        """))
        cols_c = res_cust.keys()
        for c in res_cust.fetchall():
            print("Cliente:", dict(zip(cols_c, c)))

asyncio.run(inspect_invoice_146())
