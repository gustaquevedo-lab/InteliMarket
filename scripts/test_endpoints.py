#!/usr/bin/env python3
"""
Prueba masiva de endpoints GET de la API (para endurecer módulos).
Loguea, descubre los GET sin parámetros de ruta, los llama con el token, y
reporta cuáles fallan (500) con un extracto del error.

    python3 scripts/test_endpoints.py            # todos los GET sin params
    python3 scripts/test_endpoints.py core       # solo el núcleo distribuidora
    python3 scripts/test_endpoints.py reports     # filtra por palabra clave
"""
import sys
import json
import urllib.request

BASE = "http://localhost:8000"
EMAIL, PASSWORD = "admin@casagonzalito.py", "casa1234"

CORE = ("customer", "product", "sale", "purchase", "supplier", "inventory",
        "stock", "warehouse", "report", "dashboard", "gerencial", "caja",
        "account", "credit", "price", "categ", "company", "branch", "currency")


def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


def main():
    filt = sys.argv[1] if len(sys.argv) > 1 else None

    st, body = req("POST", "/api/v1/auth/login", body={"email": EMAIL, "password": PASSWORD})
    if st != 200:
        print(f"Login falló ({st}): {body[:200]}")
        return
    token = json.loads(body)["access_token"]

    st, body = req("GET", "/api/openapi.json", token)
    paths = json.loads(body)["paths"]

    targets = []
    for p, methods in paths.items():
        if "get" not in methods or "{" in p:
            continue
        if p.startswith("/api/public") or "login" in p or "openapi" in p:
            continue
        if filt == "core" and not any(k in p.lower() for k in CORE):
            continue
        if filt and filt not in ("core",) and filt not in p.lower():
            continue
        targets.append(p)

    ok, fails = 0, []
    for p in sorted(targets):
        st, body = req("GET", p, token)
        if st == 200:
            ok += 1
        else:
            snippet = body[:160].replace("\n", " ")
            fails.append((st, p, snippet))

    print(f"\nProbados: {len(targets)}  |  ✅ OK: {ok}  |  ❌ fallas: {len(fails)}\n")
    print("=== FALLAS ===")
    for st, p, snip in sorted(fails):
        print(f"[{st}] {p}\n      {snip}")


if __name__ == "__main__":
    main()
