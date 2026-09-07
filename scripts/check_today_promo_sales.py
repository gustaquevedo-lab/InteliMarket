import asyncio, asyncpg

async def run():
    conn = await asyncpg.connect(host="localhost", port=5432, user="intelimarket", password="password", database="intelimarket")
    # All sale items today
    items = await conn.fetch("""
        SELECT s.numero, s.created_at, p.sku, p.nombre, si.precio_unitario, p.precio_venta as precio_regular,
               pr.id as promo_id, pr.nombre as promo_nombre, pr.precio_fijo_promocional, pr.dias_semana, pr.legacy_id
        FROM public.sales s
        JOIN public.sale_items si ON si.sale_id = s.id
        JOIN public.products p ON p.id = si.product_id
        LEFT JOIN public.promotions pr ON p.id = ANY(pr.producto_ids)
             AND pr.activo = true AND pr.estado = 'activa'
             AND pr.valido_desde <= CURRENT_DATE AND pr.valido_hasta >= CURRENT_DATE
        WHERE s.created_at >= CURRENT_DATE
        ORDER BY s.created_at DESC
    """)
    print("Total sale items today:", len(items))
    missed = []
    applied = []
    for r in items:
        if r["promo_id"]:
            # Check dow (today is Monday = 1)
            dias = r["dias_semana"]
            dow = (r["created_at"].weekday() + 1) % 7
            if not dias or dow in dias:
                if r["precio_unitario"] > r["precio_fijo_promocional"]:
                    missed.append(r)
                else:
                    applied.append(r)
    print(f"Items sold with promo applied: {len(applied)}")
    print(f"Items sold where promo was MISSED (sold at higher price): {len(missed)}")
    for m in missed:
        print(f"  MISSED: Ticket {m['numero']} - {m['nombre']} (SKU {m['sku']}): SoldAt={m['precio_unitario']} vs Promo={m['precio_fijo_promocional']}")
    await conn.close()

asyncio.run(run())
