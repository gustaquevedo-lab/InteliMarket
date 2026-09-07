import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "43ca4fa0-f8ca-4b4f-a175-341ad97f13f9"
CUST_ID = "8476be07-5b16-4494-92b9-6a426848c59b" # JORGE DANIEL CASTELL MALDONADO (3425101)

async def analyze_sale_146():
    async with async_session_factory() as db:
        # 1. Analizar items y sus promociones/escalas
        res_items = await db.execute(text("""
            SELECT si.id, si.product_id, p.codigo_barra, p.nombre, p.sku, si.cantidad, si.precio_unitario, si.total
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid;
        """), {"sid": SALE_ID})
        items = res_items.fetchall()

        print(f"=== ANALISIS DE ITEMS DE FACTURA 146 ({len(items)} items) ===")
        total_facturado = Decimal("0")
        total_recalculado = Decimal("0")

        for it in items:
            iid, pid, bc, nom, sku, cant, pu_cobrado, tot_cobrado = it
            total_facturado += tot_cobrado

            # A. Verificar si tiene promocion activa
            res_promo = await db.execute(text("""
                SELECT pr.id, pr.nombre, pr.tipo, pr.valor, pr.precio_fijo_promocional
                FROM promotions pr
                WHERE pr.activo = true AND pr.estado = 'activa'
                  AND pr.producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promo = res_promo.fetchone()


            # B. Verificar escala mayorista
            res_tier = await db.execute(text("""
                SELECT min_qty, precio_unitario 
                FROM sp_tiered_prices
                WHERE product_id = :pid AND min_qty <= :qty AND activo = true AND price_list_id IS NULL
                ORDER BY min_qty DESC
                LIMIT 1;
            """), {"pid": pid, "qty": int(cant)})
            tier = res_tier.fetchone()

            # Determinar precio correcto
            pu_correcto = pu_cobrado
            motivo = "Precio base normal"

            if promo:
                if promo[2] == 'precio_fijo_oferta' and promo[4]:
                    pu_correcto = promo[4]
                    motivo = f"Promo '{promo[1]}' (Precio fijo {promo[4]})"
                elif promo[2] == 'porcentaje' and promo[3]:
                    pu_correcto = pu_cobrado * (1 - (promo[3] / Decimal("100")))
                    motivo = f"Promo '{promo[1]}' (-{promo[3]}%)"
            elif tier:
                if tier[1] < pu_cobrado:
                    pu_correcto = tier[1]
                    motivo = f"Escala x{tier[0]} un. ({tier[1]} Gs)"


            tot_correcto = pu_correcto * cant
            total_recalculado += tot_correcto

            diff = tot_cobrado - tot_correcto
            if diff != 0:
                print(f"⚠️ DISCREPANCIA: {nom} ({bc})")
                print(f"   Cant: {cant} | Cobrado: {pu_cobrado} Gs (Tot: {tot_cobrado}) | Correcto: {pu_correcto} Gs (Tot: {tot_correcto}) | Diff: -{diff} Gs")
                print(f"   Motivo: {motivo}\n")
            else:
                print(f"✓ Correcto: {nom} (Cant: {cant} x {pu_cobrado} = {tot_cobrado}) [{motivo}]")

        print("="*50)
        print(f"Total Facturado Original: {total_facturado:,.0f} Gs")
        print(f"Total Recalculado Correcto: {total_recalculado:,.0f} Gs")
        print(f"Diferencia a favor del cliente: {total_facturado - total_recalculado:,.0f} Gs")
        print("="*50)

        # 2. Analizar por qué Extra Club / Límite de Crédito está inestable para 3425101
        res_c = await db.execute(text("""
            SELECT id, ruc, razon_social, limite_credito, credito_limite, credito_usado, extra_club_numero, empresa_vinculada_nombre
            FROM customers WHERE id = :cid;
        """), {"cid": CUST_ID})
        cust = res_c.fetchone()
        print("\n=== ANALISIS CLIENTE EXTRA CLUB 3425101 ===")
        print(f"ID: {cust[0]}")
        print(f"RUC / CI: {cust[1]}")
        print(f"Razon Social: {cust[2]}")
        print(f"limite_credito (columna antigua): {cust[3]}")
        print(f"credito_limite (columna nueva): {cust[4]}")
        print(f"credito_usado: {cust[5]}")
        print(f"extra_club_numero: {cust[6]}")
        print(f"empresa_vinculada_nombre: {cust[7]}")

asyncio.run(analyze_sale_146())
