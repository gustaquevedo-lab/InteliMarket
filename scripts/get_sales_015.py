import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def get_sales_015():
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT s.id, s.numero, s.numero_interno, s.fecha, s.customer_id, c.razon_social, s.subtotal, s.descuento_total, s.total, s.total_pagado, s.condicion, s.estado
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.numero LIKE '%015%' OR s.numero LIKE '%146%' OR s.created_at >= '2026-08-31'
            ORDER BY s.created_at DESC
            LIMIT 20;
        """))
        cols = list(res.keys())
        sales = res.fetchall()
        print(f"=== VENTAS RECIENTES (Total {len(sales)}) ===")
        for s in sales:
            sd = dict(zip(cols, s))
            print(f"ID: {sd['id']} | Numero: {sd['numero']} | Int: {sd['numero_interno']} | Total: {sd['total']} | Cliente: {sd['razon_social']} | Condicion: {sd['condicion']}")
            
            # Si el numero contiene 146 o es la ultima de Zunilda
            if '146' in str(sd['numero']) or '146' in str(sd['numero_interno']):
                print("\n>>> DETALLE DE FACTURA 146 <<<")
                res_it = await db.execute(text("""
                    SELECT si.id, si.product_id, p.codigo_barra, p.nombre, si.cantidad, si.precio_unitario, si.total
                    FROM sale_items si
                    LEFT JOIN products p ON si.product_id = p.id
                    WHERE si.sale_id = :sid;
                """), {"sid": sd['id']})

                cols_it = list(res_it.keys())
                for it in res_it.fetchall():
                    print("   Item:", dict(zip(cols_it, it)))

asyncio.run(get_sales_015())
