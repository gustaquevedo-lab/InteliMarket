import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def find_invoice_146():
    async with async_session_factory() as db:
        # 1. Ver columnas de sales
        res_col = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales';"))
        print("COLUMNAS DE SALES:", [r[0] for r in res_col.fetchall()])

        # 2. Ver ventas del día de hoy en sales
        res_today = await db.execute(text("SELECT * FROM sales WHERE created_at >= '2026-08-31' ORDER BY created_at DESC LIMIT 5;"))
        cols = list(res_today.keys())
        print("\n=== VENTAS DE HOY EN SALES ===")
        for r in res_today.fetchall():
            print(dict(zip(cols, r)))

        # 3. Buscar en pos_terminal_transactions
        res_pos = await db.execute(text("SELECT * FROM pos_terminal_transactions WHERE numero_factura LIKE '%146%' OR ticket_numero LIKE '%146%' OR id::text LIKE '%146%' LIMIT 5;"))
        cols_pos = list(res_pos.keys())
        print("\n=== EN POS_TERMINAL_TRANSACTIONS ===")
        for r in res_pos.fetchall():
            print(dict(zip(cols_pos, r)))

        # 4. Buscar cliente 3425101 en todas las tablas de clientes
        print("\n=== BUSQUEDA DE CLIENTE 3425101 ===")
        res_c = await db.execute(text("""
            SELECT id, ruc_sin_dv, ruc, razon_social, nombre_fantasia, limite_credito, saldo_actual, activo, es_extra_club
            FROM customers
            WHERE ruc_sin_dv LIKE '%3425101%' OR ruc LIKE '%3425101%' OR cedula LIKE '%3425101%' OR razon_social LIKE '%3425101%';
        """))
        cols_c = list(res_c.keys())
        for r in res_c.fetchall():
            print(dict(zip(cols_c, r)))

asyncio.run(find_invoice_146())
