import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

BARCODE = '7840058001887'

async def inspect_specific_product():
    print(f"=== INSPECCIONANDO PRODUCTO {BARCODE} ===")
    
    # 1. En PostgreSQL
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT id, nombre, sku, codigo_barra, precio_venta, activo FROM products WHERE codigo_barra = :bc;"), {"bc": BARCODE})
        prod = res.fetchone()
        if prod:
            pid, nombre, sku, bc, p_venta, act = prod
            print(f"POSTGRES: ID={pid} | Nombre='{nombre}' | SKU={sku} | PrecioVenta={p_venta} | Activo={act}")

            # Buscar escalas en sp_tiered_prices
            res_tiers = await db.execute(text("SELECT id, min_qty, max_qty, precio_unitario, price_list_id, activo FROM sp_tiered_prices WHERE product_id = :pid ORDER BY min_qty ASC;"), {"pid": pid})
            tiers = res_tiers.fetchall()
            print(f"POSTGRES: Escalas en sp_tiered_prices ({len(tiers)} encontradas):")
            for t in tiers:
                print(f"   -> Min: {t[1]} | Max: {t[2]} | PrecioUnitario: {t[3]} | ListID: {t[4]} | Activo: {t[5]}")

            # Buscar si tiene promoción activa
            res_promos = await db.execute(text("""
                SELECT id, nombre, tipo, aplica_a, valido_desde, valido_hasta, activo, estado 
                FROM promotions 
                WHERE activo = true AND estado = 'activa' AND producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promos = res_promos.fetchall()
            print(f"POSTGRES: Promociones activas ({len(promos)} encontradas):")
            for pr in promos:
                print(f"   -> Promo: '{pr[1]}' | Tipo: {pr[2]} | AplicaA: {pr[3]}")
        else:
            print("POSTGRES: Producto no encontrado por codigo_barra.")

    # 2. En MySQL (Legacy)
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM est_produto WHERE ID_PRODUTO = %s OR DS_PRODUTO LIKE '%%' LIMIT 5;", (sku if prod and sku else 0,))
        # Buscar por codigo de barras en tablas de codigo de barra
        cur.execute("""
            SELECT ep.ID_PRODUTO, ep.DS_PRODUTO, ep.VL_PRECO_VENDA_VAREJO, ep.VL_PRECO_VENDA_ATACADO, ep.QTD_PARA_PRECO_ATACADO
            FROM est_produto ep
            WHERE ep.ID_PRODUTO = %s;
        """, (sku if prod and sku else 0,))
        ep_res = cur.fetchall()
        print(f"\nMYSQL: est_produto para SKU={sku}:")
        for ep in ep_res:
            print(ep)

        # Buscar en ven_preco_quantidade_produto
        cur.execute("SELECT * FROM ven_preco_quantidade_produto WHERE ID_PRODUTO = %s;", (sku if prod and sku else 0,))
        vp_res = cur.fetchall()
        print(f"\nMYSQL: ven_preco_quantidade_produto para ID_PRODUTO={sku} ({len(vp_res)} encontradas):")
        for vp in vp_res:
            print(vp)

    conn.close()

asyncio.run(inspect_specific_product())
