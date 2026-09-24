import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "43ca4fa0-f8ca-4b4f-a175-341ad97f13f9"

async def get_clean_discrepancies():
    async with async_session_factory() as db:
        res_items = await db.execute(text("""
            SELECT si.id, si.product_id, p.codigo_barra, p.nombre, p.sku, si.cantidad, si.precio_unitario, si.total
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid;
        """), {"sid": SALE_ID})
        items = res_items.fetchall()

        discrepancies = []
        total_cobrado = Decimal("0")
        total_correcto = Decimal("0")

        for it in items:
            iid, pid, bc, nom, sku, cant, pu_cobrado, tot_cobrado = it
            total_cobrado += tot_cobrado

            res_promo = await db.execute(text("""
                SELECT pr.id, pr.nombre, pr.tipo, pr.valor, pr.precio_fijo_promocional
                FROM promotions pr
                WHERE pr.activo = true AND pr.estado = 'activa'
                  AND pr.producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promo = res_promo.fetchone()

            res_tier = await db.execute(text("""
                SELECT min_qty, precio_unitario 
                FROM sp_tiered_prices
                WHERE product_id = :pid AND min_qty <= :qty AND activo = true AND price_list_id IS NULL
                ORDER BY min_qty DESC
                LIMIT 1;
            """), {"pid": pid, "qty": int(cant)})
            tier = res_tier.fetchone()

            pu_corr = pu_cobrado
            motivo = ""

            if promo:
                if promo[2] == 'precio_fijo_oferta' and promo[4]:
                    pu_corr = promo[4]
                    motivo = f"Oferta: {promo[1]} ({promo[4]} Gs)"
                elif promo[2] == 'porcentaje' and promo[3]:
                    pu_corr = pu_cobrado * (1 - (promo[3] / Decimal("100")))
                    motivo = f"Oferta: {promo[1]} (-{promo[3]}%)"
            elif tier and tier[1] < pu_cobrado:
                pu_corr = tier[1]
                motivo = f"Escala x{tier[0]} un. ({tier[1]} Gs)"

            tot_corr = pu_corr * cant
            total_correcto += tot_corr

            diff = tot_cobrado - tot_corr
            if diff != 0:
                discrepancies.append({
                    "nombre": nom,
                    "codigo_barra": bc,
                    "cantidad": cant,
                    "pu_cobrado": pu_cobrado,
                    "pu_correcto": pu_corr,
                    "tot_cobrado": tot_cobrado,
                    "tot_correcto": tot_corr,
                    "diferencia": diff,
                    "motivo": motivo
                })

        print(f"Total productos en la factura: {len(items)}")
        print(f"Productos con discrepancia: {len(discrepancies)}")
        print("\n--- LISTADO DE DISCREPANCIAS ---")
        for d in discrepancies:
            print(f"- {d['nombre']} ({d['codigo_barra']}): Cant {d['cantidad']} | Cobrado {d['pu_cobrado']:,.0f} Gs -> Correcto {d['pu_correcto']:,.0f} Gs | Dif: -{d['diferencia']:,.0f} Gs [{d['motivo']}]")

        print("\n" + "="*50)
        print(f"TOTAL COBRADO FACTURA: {total_cobrado:,.0f} Gs")
        print(f"TOTAL RECALCULADO: {total_correcto:,.0f} Gs")
        print(f"DIFERENCIA A FAVOR DEL CLIENTE: {total_cobrado - total_correcto:,.0f} Gs")
        print("="*50)

asyncio.run(get_clean_discrepancies())
