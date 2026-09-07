import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

BARCODE = '7891018427582'

async def inspect_specific_product():
    print(f"=== INSPECCIONANDO PRODUCTO {BARCODE} ===")
    
    sku = None
    # 1. En PostgreSQL
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT *
            FROM products 
            WHERE codigo_barra = :bc OR sku = :bc;
        """), {"bc": BARCODE})
        prod = res.mappings().fetchone()
        if prod:
            pid = prod.get('id')
            sku = prod.get('sku')
            print("POSTGRES product:")
            for k, v in dict(prod).items():
                print(f"   {k}: {v}")

            # Buscar escalas en sp_tiered_prices
            res_tiers = await db.execute(text("SELECT id, min_qty, max_qty, precio_unitario, price_list_id, activo FROM sp_tiered_prices WHERE product_id = :pid ORDER BY min_qty ASC;"), {"pid": pid})
            tiers = res_tiers.fetchall()
            print(f"POSTGRES: Escalas en sp_tiered_prices ({len(tiers)} encontradas):")
            for t in tiers:
                print(f"   -> Min: {t[1]} | Max: {t[2]} | PrecioUnitario: {t[3]} | ListID: {t[4]} | Activo: {t[5]}")

            # Buscar si tiene promoción activa
            res_promos = await db.execute(text("""
                SELECT *
                FROM promotions 
                WHERE activo = true AND estado = 'activa' AND producto_ids @> ARRAY[:pid]::uuid[];
            """), {"pid": pid})
            promos = res_promos.mappings().fetchall()
            print(f"POSTGRES: Promociones activas ({len(promos)} encontradas):")
            for pr in promos:
                print(f"   -> Promo: {dict(pr)}")
        else:
            print("POSTGRES: Producto no encontrado por codigo_barra ni sku.")

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
        # Primero buscar en est_produto por ID_PRODUTO
        cur.execute("SELECT * FROM est_produto WHERE ID_PRODUTO = %s;", (sku or '119308',))
        ep_res = cur.fetchall()
        print(f"\nMYSQL: est_produto para ID_PRODUTO={sku or '119308'} ({len(ep_res)} filas):")
        for ep in ep_res:
            print({k: v for k, v in ep.items() if 'PRECO' in k or 'QTD' in k or 'PRODUTO' in k or 'BARRAS' in k or 'ATIVO' in k or 'DT_' in k or 'VALOR' in k or 'CUSTO' in k})

        # Buscar en est_produto_cod_barras si existe
        try:
            cur.execute("SELECT * FROM est_produto_cod_barras WHERE ID_PRODUTO = %s OR CD_BARRAS = %s;", (sku or '119308', BARCODE))
            bar_res = cur.fetchall()
            print(f"\nMYSQL: est_produto_cod_barras ({len(bar_res)} filas):", bar_res)
        except Exception as e:
            print(f"Error est_produto_cod_barras: {e}")

        # Buscar en ven_preco_quantidade_produto
        target_id = ep_res[0]['ID_PRODUTO'] if ep_res else (sku or BARCODE)
        try:
            cur.execute("SELECT * FROM ven_preco_quantidade_produto WHERE ID_PRODUTO = %s;", (target_id,))
            vp_res = cur.fetchall()
            print(f"\nMYSQL: ven_preco_quantidade_produto para ID_PRODUTO={target_id} ({len(vp_res)} encontradas):")
            for vp in vp_res:
                print(vp)
        except Exception as e:
            print(f"Error ven_preco_quantidade_produto: {e}")

    conn.close()

if __name__ == '__main__':
    asyncio.run(inspect_specific_product())
