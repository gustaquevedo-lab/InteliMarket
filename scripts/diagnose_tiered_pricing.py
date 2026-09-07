import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

async def diagnose_tiered_prices():
    # 1. Consultar sp_tiered_prices en Postgres
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT count(*) FROM sp_tiered_prices;
        """))
        total_tiers = res.scalar()
        print(f"=== POSTGRES: Total registros en sp_tiered_prices: {total_tiers} ===")

        res_null = await db.execute(text("""
            SELECT 
                COUNT(*) FILTER (WHERE price_list_id IS NULL) as global_null,
                COUNT(*) FILTER (WHERE price_list_id IS NOT NULL) as with_price_list,
                COUNT(*) FILTER (WHERE activo = true) as activos,
                COUNT(*) FILTER (WHERE activo = false) as inactivos
            FROM sp_tiered_prices;
        """))
        r_null = res_null.fetchone()
        print(f"Globales (price_list_id IS NULL): {r_null[0]} | Con Lista de Precios: {r_null[1]} | Activos: {r_null[2]} | Inactivos: {r_null[3]}")

        # Muestra de 10 escalas en Postgres
        res_sample = await db.execute(text("""
            SELECT tp.id, tp.product_id, p.codigo_barra, p.nombre, tp.min_qty, tp.max_qty, tp.precio_unitario, tp.price_list_id, tp.activo
            FROM sp_tiered_prices tp
            JOIN products p ON tp.product_id = p.id
            ORDER BY tp.created_at DESC
            LIMIT 10;

        """))
        print("\n=== MUESTRA DE ESCALAS EN POSTGRES ===")
        for r in res_sample.fetchall():
            print(f"Producto: {r[3]} ({r[2]}) | Min: {r[4]} | Max: {r[5]} | Precio: {r[6]} | ListID: {r[7]} | Activo: {r[8]}")

        # Promociones activas que podrían poner en HOLD escalas
        res_promos = await db.execute(text("""
            SELECT count(*) FROM promotions WHERE activo = true AND estado = 'activa';
        """))
        print(f"\nTotal Promociones Activas en HOLD/Promos: {res_promos.scalar()}")

    # 2. Consultar escalas en MySQL (Legacy)
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn.cursor() as cur:
        # Ver tablas de escalas o precios mayoristas en MySQL
        cur.execute("""
            SHOW TABLES LIKE '%escala%' 
            UNION SHOW TABLES LIKE '%preco%' 
            UNION SHOW TABLES LIKE '%preco_venda%'
            UNION SHOW TABLES LIKE '%preco_escala%'
            UNION SHOW TABLES LIKE '%tabela%';
        """)
        tables_mysql = cur.fetchall()
        print("\n=== TABLAS DE PRECIOS/ESCALAS EN MYSQL (LEGACY) ===")
        for t in tables_mysql:
            print(t)

        # Si existe pro_produto_preco o similar
        cur.execute("""
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'comercial_extra_py' AND COLUMN_NAME LIKE '%escala%' OR COLUMN_NAME LIKE '%atacado%' OR COLUMN_NAME LIKE '%mayorista%';
        """)
        cols_mysql = cur.fetchall()
        print("\n=== COLUMNAS DE ESCALA/MAYORISTA EN MYSQL ===")
        for c in cols_mysql[:15]:
            print(f"{c['TABLE_NAME']}.{c['COLUMN_NAME']}")

    conn.close()

asyncio.run(diagnose_tiered_prices())
