import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "43ca4fa0-f8ca-4b4f-a175-341ad97f13f9"
CUST_ID = "8476be07-5b16-4494-92b9-6a426848c59b"

async def fix_sale_and_credit():
    async with async_session_factory() as db:
        print("=== 1. SINCRONIZANDO LÍMITES DE CRÉDITO EXTRA CLUB ===")
        res_sync = await db.execute(text("""
            UPDATE customers 
            SET limite_credito = credito_limite, updated_at = NOW()
            WHERE (limite_credito = 0 OR limite_credito IS NULL) AND credito_limite > 0;
        """))
        print(f"Clientes actualizados con límite de crédito activo: {res_sync.rowcount}")

        # Sincronizar también desde credit_accounts si corresponde
        res_sync_ca = await db.execute(text("""
            UPDATE customers c
            SET limite_credito = ca.limite_credito, updated_at = NOW()
            FROM credit_accounts ca
            WHERE c.id = ca.customer_id AND (c.limite_credito = 0 OR c.limite_credito IS NULL) AND ca.limite_credito > 0;
        """))
        print(f"Clientes sincronizados desde credit_accounts: {res_sync_ca.rowcount}")

        print("\n=== 2. CORRIGIENDO FACTURA 001-015-0000146 ===")
        # A. Actualizar items con precios de promoción
        # Discrepancias identificadas:
        # - TOMATE SALSA KG (2000077): 8777 Gs
        # - AJO KG (2000179): 17877 Gs
        # - CEBOLLA KG (2000078): 4577 Gs
        # - PAPA ESPECIAL KG (2000164): 5877 Gs
        # - BANANA DE ORO KG (2000134): 8977 Gs
        # - LECHUGA PIRATI UND (2000109): 1577 Gs
        # - COAMO ACEITE DE SOJA 900ML (7896279600538): 7677 Gs
        # - MAESTRA PASTA MOÑITOS 400GR (7840023001997): 4455 Gs
        # - MAESTRA PASTA NIDO SPAGUETTI 400GR (7840023002253): 4455 Gs
        # - MILMATE COCIDO 200GR (117272): 9014 Gs

        res_items = await db.execute(text("""
            SELECT si.id, si.product_id, si.cantidad, si.precio_unitario, si.total
            FROM sale_items si
            WHERE si.sale_id = :sid;
        """), {"sid": SALE_ID})
        items = res_items.fetchall()

        total_corregido = Decimal("0")
        descuento_total = Decimal("0")

        for it in items:
            iid, pid, cant, pu, tot = it

            # Verificar promo
            res_promo = await db.execute(text("""
                SELECT pr.id, pr.tipo, pr.valor, pr.precio_fijo_promocional
                FROM promotions pr
                WHERE pr.activo = true AND pr.estado = 'activa'
                  AND pr.producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promo = res_promo.fetchone()

            # Verificar escala
            res_tier = await db.execute(text("""
                SELECT min_qty, precio_unitario 
                FROM sp_tiered_prices
                WHERE product_id = :pid AND min_qty <= :qty AND activo = true AND price_list_id IS NULL
                ORDER BY min_qty DESC
                LIMIT 1;
            """), {"pid": pid, "qty": int(cant)})
            tier = res_tier.fetchone()

            pu_corr = pu
            if promo:
                if promo[1] == 'precio_fijo_oferta' and promo[3]:
                    pu_corr = promo[3]
                elif promo[1] == 'porcentaje' and promo[2]:
                    pu_corr = pu * (1 - (promo[2] / Decimal("100")))
            elif tier and tier[1] < pu:
                pu_corr = tier[1]


            tot_corr = (pu_corr * cant).quantize(Decimal('1'))
            diff_item = tot - tot_corr
            descuento_total += diff_item
            total_corregido += tot_corr

            if diff_item != 0:
                await db.execute(text("""
                    UPDATE sale_items 
                    SET precio_unitario = :pu, total = :tot
                    WHERE id = :iid;
                """), {"pu": pu_corr, "tot": tot_corr, "iid": iid})

        # B. Actualizar cabecera de la factura en sales
        await db.execute(text("""
            UPDATE sales 
            SET customer_id = :cid,
                subtotal = :sub,
                descuento_total = :desc,
                total = :tot,
                total_pagado = :tot,
                observaciones = COALESCE(observaciones, '') || ' [Corregido a cliente Extra Club 3425101 con recalculo de promociones vigentes]',
                updated_at = NOW()
            WHERE id = :sid;
        """), {
            "cid": CUST_ID,
            "sub": total_corregido + descuento_total,
            "desc": descuento_total,
            "tot": total_corregido,
            "sid": SALE_ID
        })

        await db.commit()
        print(f"\nFactura {SALE_ID} corregida exitosamente:")
        print(f"- Cliente asociado: JORGE DANIEL CASTELL MALDONADO ({CUST_ID})")
        print(f"- Total anterior: 362.336 Gs")
        print(f"- Total nuevo: {total_corregido:,.0f} Gs (Descuento aplicado: {descuento_total:,.0f} Gs)")

asyncio.run(fix_sale_and_credit())
