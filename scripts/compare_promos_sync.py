import pymysql, asyncio, asyncpg, os
from datetime import date

host = os.getenv("NEMUHA_MYSQL_HOST", "100.76.95.42")
conn_m = pymysql.connect(host=host, port=3306, user="intelimarket_ro", password="Luzma7834", database="comercial_extra_py", cursorclass=pymysql.cursors.DictCursor)

with conn_m.cursor() as cur:
    cur.execute("""
        SELECT ID_PROMOCAO, ID_PRODUTO, DT_INICIO_PROMOCAO, DT_FIM_PROMOCAO, VL_PRECO_VAREJO, VL_PRECO_VAREJO_PRODUTO,
               BO_DOMINGO, BO_SEGUNDA, BO_TERCA, BO_QUARTA, BO_QUINTA, BO_SEXTA, BO_SABADO, DT_PROMOCAO, USUARIO
        FROM ven_promocao
        WHERE DT_FIM_PROMOCAO >= CURDATE()
        ORDER BY ID_PROMOCAO DESC
    """)
    mysql_promos = cur.fetchall()

print(f"Total promos in MySQL with DT_FIM_PROMOCAO >= CURDATE(): {len(mysql_promos)}")

async def check_pg():
    conn_p = await asyncpg.connect(host="localhost", port=5432, user="intelimarket", password="password", database="intelimarket")
    pg_rows = await conn_p.fetch("SELECT legacy_id, activo, estado, valido_hasta, precio_fijo_promocional, producto_ids FROM public.promotions WHERE legacy_id IS NOT NULL")
    pg_map = {r["legacy_id"]: r for r in pg_rows}
    
    missing_in_pg = []
    inactive_in_pg = []
    no_product_in_pg = []
    
    for mp in mysql_promos:
        lid = mp["ID_PROMOCAO"]
        if lid not in pg_map:
            missing_in_pg.append(mp)
        else:
            pgr = pg_map[lid]
            if not pgr["activo"] or pgr["estado"] != "activa":
                inactive_in_pg.append((mp, pgr))
            if not pgr["producto_ids"]:
                no_product_in_pg.append((mp, pgr))
                
    print(f"Missing in Postgres: {len(missing_in_pg)}")
    for m in missing_in_pg[:15]:
        print(f"  - Legacy ID {m['ID_PROMOCAO']}: prod {m['ID_PRODUTO']}, promo_price {m['VL_PRECO_VAREJO']}, date {m['DT_INICIO_PROMOCAO']} to {m['DT_FIM_PROMOCAO']}, created {m['DT_PROMOCAO']} by {m['USUARIO']}")
    
    print(f"Inactive in Postgres but valid in MySQL: {len(inactive_in_pg)}")
    for m, p in inactive_in_pg[:10]:
        print(f"  - Legacy ID {m['ID_PROMOCAO']}: pg_activo={p['activo']}, pg_estado={p['estado']}, pg_valido_hasta={p['valido_hasta']}, mysql_fim={m['DT_FIM_PROMOCAO']}")
        
    print(f"No product linked in Postgres: {len(no_product_in_pg)}")
    for m, p in no_product_in_pg[:10]:
        print(f"  - Legacy ID {m['ID_PROMOCAO']}: prod {m['ID_PRODUTO']}")

    await conn_p.close()

asyncio.run(check_pg())
