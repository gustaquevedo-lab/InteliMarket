import asyncio, asyncpg, httpx

async def check_db():
    conn = await asyncpg.connect(host="localhost", port=5432, user="intelimarket", password="password", database="intelimarket")
    skus = ["120099", "120096", "95463", "103997", "120176", "99109", "52458"]
    rows = await conn.fetch("SELECT id, sku, nombre, precio_venta, precio_regular FROM public.products WHERE sku = ANY($1)", skus)
    print("=== DATABASE STATE ===")
    for r in rows:
        nom = r["nombre"]
        sku = r["sku"]
        pv = r["precio_venta"]
        pr = r["precio_regular"]
        print(f"• {nom} (SKU {sku}): precio_venta={pv}, precio_regular={pr}")
    
    act_cnt = await conn.fetchval("SELECT count(*) FROM public.promotions WHERE activo = true AND estado = 'activa'")
    print(f"Total active promotions in Postgres: {act_cnt}")
    await conn.close()

asyncio.run(check_db())

print("\n=== HTTP API /products STATE ===")
res = httpx.post("http://localhost:8000/api/v1/auth/login", json={"email": "dev@superextra.com.py", "password": "@Luzma7834"})
token = res.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

for sku in ["120099", "120096", "95463", "103997", "120176", "99109", "52458"]:
    res_p = httpx.get(f"http://localhost:8000/api/v1/products?search={sku}", headers=headers)
    items = res_p.json()
    if items:
        p = items[0]
        nom = p.get("nombre")
        pv = p.get("precio_venta")
        pr = p.get("precio_regular")
        en_p = p.get("en_promocion")
        pp = p.get("precio_promo")
        pnom = p.get("promocion_nombre")
        print(f"• {nom}: precio_venta={pv}, precio_regular={pr}, en_promocion={en_p}, precio_promo={pp}, promo='{pnom}'")
