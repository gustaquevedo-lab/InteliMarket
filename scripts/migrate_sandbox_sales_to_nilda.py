import asyncio
from sqlalchemy import text
from api.src.db import engine

async def migrate():
    async with engine.begin() as conn:
        print("=== 1. VERIFICAR SESIÓN ACTIVA DE NILDA EN PUBLIC ===")
        nilda_res = await conn.execute(text("""
            SELECT cs.id, cs.user_id, cs.cajero_nombre, cs.fecha_apertura, cs.estado, cs.register_id
            FROM public.cash_sessions cs
            WHERE cs.user_id = 'f2ce6e50-9a00-4127-a91c-c57b5e28f477'
              AND cs.fecha_apertura >= '2026-09-02 00:00:00+00'
            ORDER BY cs.fecha_apertura DESC
            LIMIT 1
        """))
        nilda_session = nilda_res.fetchone()
        if not nilda_session:
            print("ERROR: No se encontró sesión de Nilda hoy en public.cash_sessions.")
            return
        
        target_session_id = nilda_session[0]
        nilda_user_id = nilda_session[1]
        cajero_nombre = nilda_session[2]
        print(f"Sesión destino: {target_session_id} | Usuario: {cajero_nombre} ({nilda_user_id}) | Register: {nilda_session[5]}")

        print("\n=== 2. OBTENER LAS 4 VENTAS DE SANDBOX DE HOY ===")
        s_sales = await conn.execute(text("""
            SELECT id, company_id, branch_id, customer_id, tipo_comprobante, condicion, moneda,
                   tipo_cambio, estado, total, subtotal, base_gravada_5, base_gravada_10, base_exenta,
                   iva_5, iva_10, descuento_total, total_pagado, saldo, numero, observaciones,
                   recibo_html, recibo_escpos_b64, created_at, updated_at
            FROM sandbox.sales
            WHERE created_at >= '2026-09-02 00:00:00+00'
            ORDER BY created_at ASC
        """))
        sales_to_migrate = s_sales.fetchall()
        print(f"Total ventas a migrar: {len(sales_to_migrate)}")

        total_pyg_migrado = 0

        for s in sales_to_migrate:
            old_sale_id = s[0]
            numero = s[19]
            total_venta = s[9]
            total_pyg_migrado += int(total_venta)

            print(f"\nMigrando Venta #{numero} (ID: {old_sale_id}) | Total: ₲ {total_venta:,.0f}...")

            # 2.1 Insertar en public.sales
            exists = await conn.execute(text("SELECT id FROM public.sales WHERE id = :id"), {"id": old_sale_id})
            if exists.scalar():
                print(f"  -> Ya existe en public.sales, actualizando session_id y user_id.")
                await conn.execute(text("""
                    UPDATE public.sales
                    SET session_id = :session_id, user_id = :user_id
                    WHERE id = :id
                """), {"session_id": target_session_id, "user_id": nilda_user_id, "id": old_sale_id})
            else:
                await conn.execute(text("""
                    INSERT INTO public.sales (
                        id, company_id, branch_id, session_id, customer_id, user_id,
                        numero, fecha, tipo_comprobante, condicion, moneda, tipo_cambio, estado,
                        subtotal, descuento_total, base_gravada_10, base_gravada_5, base_exenta,
                        iva_10, iva_5, total, total_pagado, saldo, observaciones,
                        recibo_html, recibo_escpos_b64, created_at, updated_at
                    ) VALUES (
                        :id, :company_id, :branch_id, :session_id, :customer_id, :user_id,
                        :numero, :fecha, :tipo_comprobante, :condicion, :moneda, :tipo_cambio, :estado,
                        :subtotal, :descuento_total, :base_gravada_10, :base_gravada_5, :base_exenta,
                        :iva_10, :iva_5, :total, :total_pagado, :saldo, :observaciones,
                        :recibo_html, :recibo_escpos_b64, :created_at, :updated_at
                    )
                """), {
                    "id": old_sale_id,
                    "company_id": s[1],
                    "branch_id": s[2],
                    "session_id": target_session_id,
                    "customer_id": s[3],
                    "user_id": nilda_user_id,
                    "numero": numero,
                    "fecha": s[23],
                    "tipo_comprobante": s[4],
                    "condicion": s[5],
                    "moneda": s[6],
                    "tipo_cambio": s[7],
                    "estado": s[8],
                    "subtotal": s[10],
                    "descuento_total": s[16] or 0,
                    "base_gravada_10": s[12] or 0,
                    "base_gravada_5": s[11] or 0,
                    "base_exenta": s[13] or 0,
                    "iva_10": s[15] or 0,
                    "iva_5": s[14] or 0,
                    "total": s[9],
                    "total_pagado": s[17] or s[9],
                    "saldo": s[18] or 0,
                    "observaciones": s[20],
                    "recibo_html": s[21],
                    "recibo_escpos_b64": s[22],
                    "created_at": s[23],
                    "updated_at": s[24],
                })
                print("  -> Cabecera insertada en public.sales.")

            # 2.2 Migrar items (sandbox.sale_items -> public.sale_items)
            items_res = await conn.execute(text("""
                SELECT id, sale_id, product_id, variant_id, descripcion, cantidad,
                       precio_unitario, descuento_pct, descuento_monto, iva_tasa, iva_monto,
                       total, costo_unitario, created_at
                FROM sandbox.sale_items
                WHERE sale_id = :sid
            """), {"sid": old_sale_id})
            items = items_res.fetchall()
            for it in items:
                it_exists = await conn.execute(text("SELECT id FROM public.sale_items WHERE id = :id"), {"id": it[0]})
                if not it_exists.scalar():
                    await conn.execute(text("""
                        INSERT INTO public.sale_items (
                            id, sale_id, product_id, variant_id, descripcion, cantidad,
                            precio_unitario, descuento_pct, descuento_monto, iva_tasa, iva_monto,
                            total, costo_unitario, created_at
                        ) VALUES (
                            :id, :sale_id, :product_id, :variant_id, :descripcion, :cantidad,
                            :precio_unitario, :descuento_pct, :descuento_monto, :iva_tasa, :iva_monto,
                            :total, :costo_unitario, :created_at
                        )
                    """), {
                        "id": it[0],
                        "sale_id": it[1],
                        "product_id": it[2],
                        "variant_id": it[3],
                        "descripcion": it[4],
                        "cantidad": it[5],
                        "precio_unitario": it[6],
                        "descuento_pct": it[7] or 0,
                        "descuento_monto": it[8] or 0,
                        "iva_tasa": it[9] or 10,
                        "iva_monto": it[10] or 0,
                        "total": it[11],
                        "costo_unitario": it[12] or 0,
                        "created_at": it[13],
                    })
            print(f"  -> {len(items)} items migrados a public.sale_items.")

            # 2.3 Migrar pagos si existen en sandbox.sale_payments
            pays_res = await conn.execute(text("""
                SELECT id, company_id, sale_id, forma_pago, monto, moneda, fecha, created_at
                FROM sandbox.sale_payments
                WHERE sale_id = :sid
            """), {"sid": old_sale_id})
            pays = pays_res.fetchall()
            for p in pays:
                p_exists = await conn.execute(text("SELECT id FROM public.sale_payments WHERE id = :id"), {"id": p[0]})
                if not p_exists.scalar():
                    await conn.execute(text("""
                        INSERT INTO public.sale_payments (
                            id, company_id, sale_id, forma_pago, monto, moneda, fecha, created_at
                        ) VALUES (
                            :id, :company_id, :sale_id, :forma_pago, :monto, :moneda, :fecha, :created_at
                        )
                    """), {
                        "id": p[0],
                        "company_id": p[1],
                        "sale_id": p[2],
                        "forma_pago": p[3],
                        "monto": p[4],
                        "moneda": p[5],
                        "fecha": p[6],
                        "created_at": p[7],
                    })
            print(f"  -> {len(pays)} pagos migrados a public.sale_payments.")

        # 3. Limpiar del esquema sandbox
        print("\n=== 3. LIMPIANDO DE SANDBOX.SALES PARA EVITAR CONFUSIÓN ===")
        await conn.execute(text("DELETE FROM sandbox.sale_payments WHERE sale_id IN (SELECT id FROM sandbox.sales WHERE created_at >= '2026-09-02 00:00:00+00')"))
        await conn.execute(text("DELETE FROM sandbox.sale_items WHERE sale_id IN (SELECT id FROM sandbox.sales WHERE created_at >= '2026-09-02 00:00:00+00')"))
        await conn.execute(text("DELETE FROM sandbox.sales WHERE created_at >= '2026-09-02 00:00:00+00'"))

        print(f"\n=======================================================")
        print(f"🎉 ÉXITO: 4 VENTAS (₲ {total_pyg_migrado:,.0f}) MIGRADAS")
        print(f"A LA SESIÓN OFICIAL DE NILDA AQUINO EN PRODUCCIÓN")
        print(f"=======================================================")

asyncio.run(migrate())
