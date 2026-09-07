import pymysql, asyncio, asyncpg, os
from datetime import date, datetime
from decimal import Decimal

host = os.getenv("NEMUHA_MYSQL_HOST", "100.76.95.42")
conn_m = pymysql.connect(host=host, port=3306, user="intelimarket_ro", password="Luzma7834", database="comercial_extra_py", cursorclass=pymysql.cursors.DictCursor)

with conn_m.cursor() as cur:
    cur.execute("""
        SELECT ID_PROMOCAO, ID_PRODUTO, DT_INICIO_PROMOCAO, DT_FIM_PROMOCAO, VL_PRECO_VAREJO, VL_PRECO_VAREJO_PRODUTO,
               BO_DOMINGO, BO_SEGUNDA, BO_TERCA, BO_QUARTA, BO_QUINTA, BO_SEXTA, BO_SABADO, DT_PROMOCAO, USUARIO, OBSERVACAO
        FROM ven_promocao
        WHERE DT_FIM_PROMOCAO >= CURDATE()
        ORDER BY ID_PROMOCAO DESC
    """)
    mysql_promos = cur.fetchall()

async def analyze():
    conn_p = await asyncpg.connect(host="localhost", port=5432, user="intelimarket", password="password", database="intelimarket")
    
    # Load all products
    prods = await conn_p.fetch("SELECT id, sku, codigo_barra, nombre, precio_venta, activo FROM public.products")
    prod_by_sku = {p["sku"]: p for p in prods if p["sku"]}
    prod_by_barcode = {p["codigo_barra"]: p for p in prods if p["codigo_barra"]}
    
    # Load all postgres promotions
    pg_promos = await conn_p.fetch("SELECT * FROM public.promotions")
    pg_by_legacy = {p["legacy_id"]: p for p in pg_promos if p["legacy_id"] is not None}
    
    today = date.today()
    # Monday = 1 in legacy (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab)
    dow = (today.weekday() + 1) % 7
    print(f"Date today: {today}, Day of week index (Sunday=0, Monday=1): {dow}")
    
    not_in_pg = []
    prod_not_found = []
    prod_inactive = []
    promo_inactive_in_pg = []
    not_valid_today_dow = []
    not_valid_today_date = []
    promo_price_not_lower = []
    active_and_valid = []
    
    for mp in mysql_promos:
        lid = mp["ID_PROMOCAO"]
        sku = str(mp["ID_PRODUTO"])
        prod = prod_by_sku.get(sku) or prod_by_barcode.get(sku)
        
        if not prod:
            prod_not_found.append((mp, sku))
            continue
            
        if not prod["activo"]:
            prod_inactive.append((mp, prod))
            
        pgr = pg_by_legacy.get(lid)
        if not pgr:
            not_in_pg.append((mp, prod))
            continue
            
        if not pgr["activo"] or pgr["estado"] != "activa":
            promo_inactive_in_pg.append((mp, pgr, prod))
            
        # check dates
        v_desde = pgr["valido_desde"]
        v_hasta = pgr["valido_hasta"]
        if not (v_desde <= today <= v_hasta):
            not_valid_today_date.append((mp, pgr, prod))
            
        # check dow
        dias = pgr["dias_semana"]
        if dias and dow not in dias:
            not_valid_today_dow.append((mp, pgr, prod))
            
        # check price
        p_price = pgr["precio_fijo_promocional"]
        if p_price is None or p_price >= prod["precio_venta"]:
            promo_price_not_lower.append((mp, pgr, prod))
        else:
            active_and_valid.append((mp, pgr, prod))
            
    print(f"Total active/valid in MySQL: {len(mysql_promos)}")
    print(f"1. Not in Postgres at all: {len(not_in_pg)}")
    for m, p in not_in_pg:
        print(f"   Legacy {m['ID_PROMOCAO']}: SKU {m['ID_PRODUTO']}, Prod '{p['nombre']}', PromoPrice {m['VL_PRECO_VAREJO']}")
        
    print(f"2. Product not found in Postgres: {len(prod_not_found)}")
    for m, s in prod_not_found[:5]:
        print(f"   Legacy {m['ID_PROMOCAO']}: SKU {s}")
        
    print(f"3. In Postgres but marked inactive/not 'activa': {len(promo_inactive_in_pg)}")
    for m, pr, p in promo_inactive_in_pg[:5]:
        print(f"   Legacy {m['ID_PROMOCAO']}: activo={pr['activo']}, estado={pr['estado']}")
        
    print(f"4. Date outside today ({today}): {len(not_valid_today_date)}")
    for m, pr, p in not_valid_today_date[:5]:
        print(f"   Legacy {m['ID_PROMOCAO']}: desde={pr['valido_desde']} hasta={pr['valido_hasta']}")
        
    print(f"5. DOW not today (today is {dow}): {len(not_valid_today_dow)}")
    for m, pr, p in not_valid_today_dow[:5]:
        print(f"   Legacy {m['ID_PROMOCAO']}: dias={pr['dias_semana']} Prod={p['nombre']}")
        
    print(f"6. Promo price >= Product regular price (or promo price is 0/null): {len(promo_price_not_lower)}")
    for m, pr, p in promo_price_not_lower[:10]:
        print(f"   Legacy {m['ID_PROMOCAO']}: PromoPrice={pr['precio_fijo_promocional']} vs ProdPrice={p['precio_venta']} Prod='{p['nombre']}'")
        
    print(f"7. Active, valid, and cheaper today: {len(active_and_valid)}")
    
    # Check today sales in Postgres to see if any items were sold with/without promo
    today_sales = await conn_p.fetch("""
        SELECT s.id, s.numero_factura, s.total, si.product_id, si.precio_unitario, si.cantidad, p.nombre, p.precio_venta, pr.precio_fijo_promocional
        FROM public.sales s
        JOIN public.sale_items si ON si.sale_id = s.id
        JOIN public.products p ON p.id = si.product_id
        LEFT JOIN public.promotions pr ON p.id = ANY(pr.producto_ids) AND pr.activo = true AND pr.estado = 'activa'
        WHERE s.created_at >= CURRENT_DATE
        ORDER BY s.created_at DESC
        LIMIT 20
    """)
    print(f"\nRecent sale items today: {len(today_sales)}")
    for ts in today_sales[:10]:
        print(f"   Ticket {ts['numero_factura']}: {ts['nombre']} Qty={ts['cantidad']} SoldAt={ts['precio_unitario']} (ProdRegPrice={ts['precio_venta']}, PromoPrice={ts['precio_fijo_promocional']})")

    await conn_p.close()

asyncio.run(analyze())
