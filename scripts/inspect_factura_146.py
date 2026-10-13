import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def inspect_invoice_and_customer():
    async with async_session_factory() as db:
        print("=== 1. BUSCAR FACTURA 001-015-0000146 ===")
        # Buscar en sales / pos_terminal_transactions / cualquier tabla de ventas
        res_tables = await db.execute(text("""
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%sale%' OR table_name ILIKE '%factura%' OR table_name ILIKE '%pos%';
        """))
        print("Tablas encontradas:", [r[0] for r in res_tables.fetchall()])

        # Buscar en sales
        res_sale = await db.execute(text("""
            SELECT * FROM sales WHERE numero_factura LIKE '%146%' OR numero_factura LIKE '%001-015-0000146%';
        """))
        sales = res_sale.fetchall()
        cols_sale = res_sale.keys()
        print(f"\nVentas encontradas en 'sales': {len(sales)}")
        for s in sales:
            print(dict(zip(cols_sale, s)))
            sale_id = s[0]

            # Buscar items de la venta
            res_items = await db.execute(text("""
                SELECT si.*, p.nombre, p.codigo_barra, p.sku 
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = :sid;
            """), {"sid": sale_id})
            items = res_items.fetchall()
            cols_items = res_items.keys()
            print(f"\n--- ITEMS DE LA VENTA ({len(items)} items) ---")
            for it in items:
                print(dict(zip(cols_items, it)))

        # 2. Buscar cliente 3425101
        print("\n=== 2. BUSCAR CLIENTE 3425101 ===")
        res_cust = await db.execute(text("""
            SELECT * FROM customers WHERE ruc_sin_dv = '3425101' OR ruc LIKE '%3425101%' OR cedula = '3425101' OR telefono LIKE '%3425101%';
        """))
        custs = res_cust.fetchall()
        cols_cust = res_cust.keys()
        print(f"Clientes encontrados: {len(custs)}")
        for c in custs:
            print(dict(zip(cols_cust, c)))
            cust_id = c[0]
            
            # Ver cuentas de crédito / Extra Club
            res_cred = await db.execute(text("""
                SELECT * FROM credit_accounts WHERE customer_id = :cid;
            """), {"cid": cust_id})
            creds = res_cred.fetchall()
            cols_cred = res_cred.keys()
            print("Cuentas de crédito:")
            for cr in creds:
                print(dict(zip(cols_cred, cr)))

asyncio.run(inspect_invoice_and_customer())
