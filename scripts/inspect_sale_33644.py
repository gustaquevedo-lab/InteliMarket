import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

INVOICE_NO = "001-013-0033644"

async def inspect_sale():
    async with async_session_factory() as db:
        res_s = await db.execute(text("""
            SELECT s.id, s.numero, s.numero_interno, s.fecha, s.customer_id, s.user_id, s.session_id,
                   s.subtotal, s.descuento_total, s.total, s.total_pagado, s.condicion, s.estado, s.observaciones
            FROM sales s
            WHERE s.numero = :inv OR s.numero LIKE '%33644%';
        """), {"inv": INVOICE_NO})
        sale = res_s.fetchone()
        
        if not sale:
            print(f"Factura {INVOICE_NO} no encontrada por 'numero'. Buscando en ultimas ventas de punto 013...")
            res_all = await db.execute(text("SELECT id, numero, total, created_at FROM sales WHERE numero LIKE '%013%' ORDER BY created_at DESC LIMIT 10;"))
            for r in res_all.fetchall():
                print(r)
            return

        cols_s = list(res_s.keys())
        sale_dict = dict(zip(cols_s, sale))
        print("=== CABECERA DE LA VENTA ===")
        for k, v in sale_dict.items():
            print(f"{k}: {v}")

        sid = sale[0]
        res_it = await db.execute(text("""
            SELECT si.id, si.product_id, p.codigo_barra, p.sku, p.nombre, p.precio_venta as precio_base,
                   si.cantidad, si.precio_unitario, si.total
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid
            ORDER BY si.id ASC;
        """), {"sid": sid})
        items = res_it.fetchall()

        print(f"\n=== ITEMS DE LA VENTA ({len(items)} items) ===")
        total_recalculado = Decimal("0")
        descuento_escalas = Decimal("0")

        for it in items:
            iid, pid, bc, sku, nom, p_base, cant, pu_cobrado, tot_cobrado = it
            
            # Buscar escala mayorista por cantidad
            res_tier = await db.execute(text("""
                SELECT min_qty, precio_unitario 
                FROM sp_tiered_prices
                WHERE product_id = :pid AND min_qty <= :qty AND activo = true AND price_list_id IS NULL
                ORDER BY min_qty DESC
                LIMIT 1;
            """), {"pid": pid, "qty": int(cant)})
            tier = res_tier.fetchone()

            # Buscar promocion
            res_promo = await db.execute(text("""
                SELECT pr.id, pr.nombre, pr.tipo, pr.valor, pr.precio_fijo_promocional
                FROM promotions pr
                WHERE pr.activo = true AND pr.estado = 'activa'
                  AND pr.producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promo = res_promo.fetchone()

            pu_correcto = pu_cobrado
            motivo = "Precio base"

            if tier and tier[1] < p_base:
                pu_correcto = tier[1]
                motivo = f"Escala x{tier[0]} un. ({tier[1]} Gs)"
            elif promo:
                if promo[2] == 'precio_fijo_oferta' and promo[4]:
                    pu_correcto = promo[4]
                    motivo = f"Promo '{promo[1]}' ({promo[4]} Gs)"

            tot_correcto = (pu_correcto * cant).quantize(Decimal('1'))
            diff = tot_cobrado - tot_correcto
            descuento_escalas += diff
            total_recalculado += tot_correcto

            print(f"• {nom} ({bc or sku}):")
            print(f"  Cant: {cant} | Base: {p_base} | Cobrado: {pu_cobrado} (Tot: {tot_cobrado}) | Correcto: {pu_correcto} (Tot: {tot_correcto})")
            if diff != 0:
                print(f"  ⚠️ Dif: {diff:,.0f} Gs -> {motivo}")

        # Pagos registrados
        res_pay = await db.execute(text("SELECT * FROM sale_payments WHERE sale_id = :sid;"), {"sid": sid})
        cols_pay = list(res_pay.keys())
        print(f"\n=== MEDIOS DE PAGO REGISTRADOS ===")
        for p in res_pay.fetchall():
            print(dict(zip(cols_pay, p)))

        print("\n" + "="*50)
        print(f"Total Registrado en Venta: {sale_dict['total']:,.0f} Gs (Descuento actual: {sale_dict['descuento_total']:,.0f} Gs)")
        print(f"Total Recalculado con Escalas: {total_recalculado:,.0f} Gs (Descuento escalas: {descuento_escalas:,.0f} Gs)")
        print("="*50)

asyncio.run(inspect_sale())
