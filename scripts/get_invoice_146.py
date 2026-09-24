import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def get_invoice_146():
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT id, numero_comprobante, customer_id, user_id, total, subtotal, descuento, impuesto, estado, created_at, metadatos
            FROM sales 
            WHERE numero_comprobante LIKE '%146%' OR numero_comprobante LIKE '%015%'
            ORDER BY created_at DESC
            LIMIT 10;
        """))
        cols = res.keys()
        sales = res.fetchall()
        print("=== VENTAS ENCONTRADAS ===")
        for s in sales:
            print(dict(zip(cols, s)))
            sid = s[0]
            
            # Detalle de items
            res_items = await db.execute(text("""
                SELECT si.id, si.product_id, si.cantidad, si.precio_unitario, si.descuento, si.subtotal, si.impuesto, si.total,
                       p.nombre, p.codigo_barra, p.sku
                FROM sale_items si
                LEFT JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = :sid;
            """), {"sid": sid})
            cols_items = res_items.keys()
            for it in res_items.fetchall():
                print("   Item:", dict(zip(cols_items, it)))

asyncio.run(get_invoice_146())
