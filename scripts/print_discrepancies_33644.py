import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "603e16c0-be07-4b97-90fc-52ededc39d43"

async def print_discrepancies_33644():
    async with async_session_factory() as db:
        res_it = await db.execute(text("""
            SELECT si.id, si.product_id, p.codigo_barra, p.sku, p.nombre, p.precio_venta as precio_base,
                   si.cantidad, si.precio_unitario, si.total
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid
            ORDER BY si.id ASC;
        """), {"sid": SALE_ID})
        items = res_it.fetchall()

        print(f"=== DETALLE DE ITEMS FACTURA 001-013-0033644 ({len(items)} items) ===")
        total_cobrado = Decimal("0")
        total_correcto = Decimal("0")
        discrepancies = []

        for it in items:
            iid, pid, bc, sku, nom, p_base, cant, pu_cobrado, tot_cobrado = it
            total_cobrado += tot_cobrado

            res_tier = await db.execute(text("""
                SELECT min_qty, precio_unitario 
                FROM sp_tiered_prices
                WHERE product_id = :pid AND min_qty <= :qty AND activo = true AND price_list_id IS NULL
                ORDER BY min_qty DESC
                LIMIT 1;
            """), {"pid": pid, "qty": int(cant)})
            tier = res_tier.fetchone()

            res_promo = await db.execute(text("""
                SELECT pr.id, pr.nombre, pr.tipo, pr.valor, pr.precio_fijo_promocional
                FROM promotions pr
                WHERE pr.activo = true AND pr.estado = 'activa'
                  AND pr.producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promo = res_promo.fetchone()

            pu_corr = pu_cobrado
            motivo = ""

            if tier and tier[1] < p_base:
                pu_corr = tier[1]
                motivo = f"Escala x{tier[0]} un. ({tier[1]:,.0f} Gs)"
            elif promo and promo[2] == 'precio_fijo_oferta' and promo[4]:
                pu_corr = promo[4]
                motivo = f"Promo '{promo[1]}' ({promo[4]:,.0f} Gs)"

            tot_corr = (pu_corr * cant).quantize(Decimal('1'))
            diff = tot_cobrado - tot_corr
            total_correcto += tot_corr

            if diff != 0:
                discrepancies.append({
                    "id": iid,
                    "nombre": nom,
                    "codigo_barra": bc or sku,
                    "cant": cant,
                    "pu_cobrado": pu_cobrado,
                    "pu_corr": pu_corr,
                    "tot_cobrado": tot_cobrado,
                    "tot_corr": tot_corr,
                    "diff": diff,
                    "motivo": motivo
                })

        print("\n--- ITEMS CON DISCREPANCIA ---")
        for d in discrepancies:
            print(f"• {d['nombre']} ({d['codigo_barra']})")
            print(f"  Cant: {d['cant']} | Cobrado: {d['pu_cobrado']:,.0f} Gs (Tot: {d['tot_cobrado']:,.0f}) -> Correcto: {d['pu_corr']:,.0f} Gs (Tot: {d['tot_corr']:,.0f})")
            print(f"  Diferencia: {d['diff']:,.0f} Gs | Razón: {d['motivo']}\n")

        print("="*50)
        print(f"TOTAL COBRADO EN FACTURA: {total_cobrado:,.0f} Gs")
        print(f"TOTAL RECALCULADO: {total_correcto:,.0f} Gs")
        print(f"DESCUENTO TOTAL A APLICAR: {total_cobrado - total_correcto:,.0f} Gs")
        print("="*50)

asyncio.run(print_discrepancies_33644())
