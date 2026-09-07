import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def update_products_with_promo_prices():
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT p.id, p.nombre, p.codigo_barra, p.precio_venta as precio_anterior, pr.precio_fijo_promocional as precio_oferta, pr.nombre as promo_nombre
            FROM promotions pr
            CROSS JOIN LATERAL unnest(pr.producto_ids) as promo_pid
            JOIN products p ON p.id = promo_pid
            WHERE pr.activo = true AND pr.estado = 'activa' 
              AND pr.tipo = 'precio_fijo_oferta'
              AND pr.precio_fijo_promocional > 0
              AND p.precio_venta != pr.precio_fijo_promocional;
        """))
        prods_to_update = res.fetchall()
        print(f"Total productos en promo con precio_venta desactualizado: {len(prods_to_update)}")

        for p in prods_to_update[:10]:
            print(f"• {p[1]} ({p[2]}): {p[3]} -> {p[4]} Gs [{p[5]}]")

        # Actualizar en products
        res_up = await db.execute(text("""
            UPDATE products p
            SET precio_venta = pr.precio_fijo_promocional, updated_at = NOW()
            FROM (
                SELECT unnest(producto_ids) as pid, precio_fijo_promocional
                FROM promotions
                WHERE activo = true AND estado = 'activa' 
                  AND tipo = 'precio_fijo_oferta' 
                  AND precio_fijo_promocional > 0
            ) pr
            WHERE p.id = pr.pid AND p.precio_venta != pr.precio_fijo_promocional;
        """))
        await db.commit()
        print(f"\nProductos actualizados exitosamente en catálogo: {res_up.rowcount}")

asyncio.run(update_products_with_promo_prices())
