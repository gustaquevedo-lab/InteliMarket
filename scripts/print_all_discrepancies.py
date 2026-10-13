import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "43ca4fa0-f8ca-4b4f-a175-341ad97f13f9"

async def print_all_discrepancies():
    async with async_session_factory() as db:
        res_items = await db.execute(text("""
            SELECT si.id, si.product_id, p.codigo_barra, p.nombre, p.sku, si.cantidad, si.precio_unitario, si.total
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid;
        """), {"sid": SALE_ID})
        items = res_items.fetchall()

        print(f"=== PRODUCTOS CON DISCREPANCIA EN FACTURA 146 ===")
        for it in items:
            iid, pid, bc, nom, sku, cant, pu_cobrado, tot_cobrado = it

            # Promo
            res_promo = await db.execute(text("""
                SELECT pr.id, pr.nombre, pr.tipo, pr.valor, pr.precio_fijo_promocional
                FROM promotions pr
                WHERE pr.activo = true AND pr.estado = 'activa'
                  AND pr.producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promo = res_promo.fetchone()

            # Tier
            res_tier = await db.execute(text("""
                SELECT min_qty, precio_unitario 
                FROM sp_tiered_prices
                WHERE product_id = :pid AND min_qty <= :qty AND activo = true AND price_list_id IS NULL
                ORDER BY min_qty DESC
                LIMIT 1;
            """), {"pid": pid, "qty": int(cant)})
            tier = res_tier.fetchone()

            pu_correcto = pu_cobrado
            motivo = ""

            if promo:
                if promo[2] == 'precio_fijo_oferta' and promo[4]:
                    pu_correcto = promo[4]
                    motivo = f"Promo '{promo[1]}' (Precio oferta {promo[4]} Gs)"
                elif promo[2] == 'porcentaje' and promo[3]:
                    pu_correcto = pu_cobrado * (1 - (promo[3] / Decimal("100")))
                    motivo = f"Promo '{promo[1]}' (-{promo[3]}%)"
            elif tier and tier[1] < pu_cobrado:
                pu_correcto = tier[1]
                motivo = f"Escala x{tier[0]} un. ({tier[1]} Gs)"

            tot_correcto = pu_correcto * cant
            diff = tot_cobrado - tot_correcto
            if diff != 0:
                print(f"• {nom} ({bc})")
                print(f"  - Cantidad: {cant}")
                print(f"  - Cobrado: {pu_cobrado:,.0f} Gs c/u (Total: {tot_cobrado:,.0f} Gs)")
                print(f"  - Precio Correcto: {pu_correcto:,.0f} Gs c/u (Total: {tot_correcto:,.0f} Gs)")
                print(f"  - Diferencia a devolver: {diff:,.0f} Gs")
                print(f"  - Razón: {motivo}\n")

asyncio.run(print_all_discrepancies())
