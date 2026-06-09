"""E2E test for Boutique module."""
import asyncio
import secrets
import httpx

async def test():
    s = secrets.token_hex(3).upper()
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as c:
        r = await c.post("/api/v1/auth/login", json={"email": "admin@supermer.com", "password": "admin123"})
        tok = r.json().get("access_token")
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

        ok, fail = 0, 0
        def check(label, r, expected=200, expected2=None):
            nonlocal ok, fail
            if r.status_code == expected or r.status_code == expected2:
                ok += 1; print(f"  PASS {label} -> {r.status_code}")
            else:
                fail += 1; print(f"  FAIL {label} -> {r.status_code} {r.text[:120]}")

        r = await c.get("/api/v1/boutique/dashboard", headers=h)
        check("Dashboard", r, 200)

        r = await c.post("/api/v1/boutique/sizes", headers=h, json={"codigo": f"M-{s}", "nombre": "Mediano", "categoria": "ropa", "orden": 3})
        check("Create Size", r, 201)
        r = await c.get("/api/v1/boutique/sizes", headers=h)
        check("List Sizes", r, 200)

        r = await c.post("/api/v1/boutique/colors", headers=h, json={"codigo": f"ROJO-{s}", "nombre": "Rojo Passion", "hex": "#FF0000", "familia": "rojos"})
        check("Create Color", r, 201)

        r = await c.post("/api/v1/boutique/categories", headers=h, json={"codigo": f"MUJER-{s}", "nombre": "Mujer", "nivel": 0})
        cat_id = r.json().get("id", "")
        check("Create Category", r, 201)
        if cat_id:
            r = await c.post("/api/v1/boutique/categories", headers=h, json={"codigo": f"VESTIDOS-{s}", "nombre": "Vestidos", "parent_id": cat_id})
            check("Subcategory", r, 201)

        r = await c.post("/api/v1/boutique/collections", headers=h, json={"codigo": f"COL-{s}", "nombre": f"Coleccion {s}", "temporada": "primavera_verano", "anio": 2026})
        check("Create Collection", r, 201)

        r = await c.post("/api/v1/boutique/products", headers=h, json={
            "codigo": f"VESTIDO-{s}", "nombre": "Vestido Floral Verano", "precio_base": 250000,
            "genero": "mujer", "marca": "PyFashion",
            "variantes": [{"size_id": None, "color_id": None, "sku": f"SKU-{s}", "stock_actual": 10, "stock_minimo": 2}]
        })
        pid = r.json().get("id", "") if r.status_code == 201 else ""
        check("Create Product", r, 201, 409)

        r = await c.get("/api/v1/boutique/products", headers=h)
        check("List Products", r, 200)

        r = await c.post("/api/v1/boutique/loyalty/config", headers=h)
        check("Loyalty Config", r, 201, 409)

        r = await c.post("/api/v1/boutique/markdown/rules", headers=h, json={
            "codigo": f"FIN-{s}", "nombre": f"Fin Temporada {s}", "tipo": "fin_temporada",
            "temporada": "primavera_verano", "descuento_maximo": 50, "descuento_minimo": 10, "prioridad": 10
        })
        check("Markdown Rule", r, 201)

        r = await c.put(f"/api/v1/boutique/client-profiles/00000000-0000-0000-0000-00000000030a", headers=h, json={
            "tipo_cliente": "vip", "estilo": "casual", "marcas_preferidas": ["PyFashion", "MBO"]
        })
        check("Client Profile", r, 200)

        r = await c.post("/api/v1/boutique/interactions", headers=h, json={
            "customer_id": "00000000-0000-0000-0000-00000000030a", "tipo": "visita", "canal": "tienda"
        })
        check("Interaction", r, 201)

        if pid:
            r = await c.get(f"/api/v1/boutique/cross-sell/{pid}?limit=5", headers=h)
            check("Cross-Sell", r, 200)
            r = await c.put(f"/api/v1/boutique/ar/{pid}", headers=h, json={"glb_url": "https://models.example.com/vestido.glb", "proveedor_ar": "zeling"})
            check("AR Metadata", r, 200)

        r = await c.post("/api/v1/boutique/gift-wrapping", headers=h, json={"codigo": f"BASIC-{s}", "nombre": "Empaque Estandar", "precio": 15000})
        check("Gift Wrapping", r, 201)

        r = await c.post("/api/v1/boutique/events", headers=h, json={
            "codigo": f"FS-{s}", "nombre": f"Fashion Show {s}",
            "tipo": "fashion_show", "fecha_inicio": "2026-06-15T19:00:00", "estado": "borrador"
        })
        check("Event", r, 201)

        print(f"\n{'='*40}\n{fail} failures / {ok+fail} tests" if fail else f"\n{'='*40}\nALL {ok+fail} TESTS PASSED ✅")


asyncio.run(test())
