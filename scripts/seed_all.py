"""Unified orchestrator — seeds ALL 21 modules in dependency order.
Usage inside container: python /app/scripts/seed_all.py
Usage from repo root:   python scripts/seed_all.py
"""

import asyncio
import sys
import os
import time

HERE = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(HERE, "..", "api")
APP_DIR = os.path.normpath(os.path.join(HERE, ".."))

# (script_path_no_ext, description)
ORDER = [
    # Level 0: Core foundation
    (os.path.join(API_DIR, "seed"),                  "Core (company, products, customers, suppliers)"),
    # Level 1: Base modules
    (os.path.join(API_DIR, "seed_supermer"),         "Supermercado completo (104+ tablas)"),
    (os.path.join(HERE, "seed_farmacia"),            "Farmacia (principios activos, medicamentos)"),
    # Level 2: Vertical modules
    (os.path.join(HERE, "seed_boutique"),            "Boutique (talles, colores, productos, ventas)"),
    (os.path.join(HERE, "seed_servicios"),           "Servicios (técnicos, WOs, contratos)"),
    # Level 3: Data-dependent modules
    (os.path.join(HERE, "seed_smart_pricing"),       "Smart Pricing (asignaciones, tiered, promos)"),
    (os.path.join(HERE, "seed_credit_scoring"),      "Credit Scoring (scores, alertas, eventos)"),
    (os.path.join(HERE, "seed_comerciales"),         "Comerciales (oportunidades, churn, cross-sell)"),
    (os.path.join(HERE, "seed_demand_forecast"),     "Demand Forecast (predicciones, anomalías)"),
    (os.path.join(HERE, "seed_intelligent_routing"), "Intelligent Routing (rutas, ETA, carga)"),
    (os.path.join(HERE, "seed_cold_chain"),          "Cold Chain (sensores, lecturas, alertas)"),
    (os.path.join(HERE, "seed_asistente_virtual"),   "Asistente Virtual (conversaciones, tickets)"),
    (os.path.join(HERE, "seed_retail"),              "Retail (store config, cupones, eventos)"),
    (os.path.join(HERE, "seed_loyalty"),             "Loyalty (puntos, rewards)"),
    (os.path.join(HERE, "seed_suscripciones"),       "Suscripciones (planes, órdenes recurrentes)"),
    (os.path.join(HERE, "seed_delivery_integrations"), "Delivery Integrations (PedidosYa, etc)"),
    (os.path.join(HERE, "seed_advanced_inventory"),  "Advanced Inventory (ubicaciones, picking)"),
    (os.path.join(HERE, "seed_integrated_finance"),  "Integrated Finance (retenciones, asientos)"),
    (os.path.join(HERE, "seed_sifen_avanzado"),      "SIFEN Avanzado (DGR, e-Kuatia, CDC)"),
    (os.path.join(HERE, "seed_bancard"),             "Bancard (transacciones demo)"),
    (os.path.join(HERE, "seed_dinelco"),             "Dinelco (transacciones demo)"),
]


async def run_seed(script_base: str, description: str) -> bool:
    script_path = f"{script_base}.py"
    if not os.path.exists(script_path):
        print(f"  ⚠️  Archivo no encontrado: {script_path}")
        return False
    print(f"\n  ▶ {description}")
    print(f"    ({os.path.relpath(script_path)})")
    env = os.environ.copy()
    env["PYTHONPATH"] = APP_DIR + os.pathsep + env.get("PYTHONPATH", "")
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, script_path,
            cwd=APP_DIR,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        out = (stdout or b"").decode().strip()
        err = (stderr or b"").decode().strip()
        if proc.returncode == 0:
            for line in out.split("\n"):
                if line.strip():
                    print(f"    {line}")
            return True
        else:
            print(f"  ❌ FAILED (code {proc.returncode})")
            if out:
                for line in out.split("\n")[-3:]:
                    print(f"    | {line}")
            if err:
                for line in err.split("\n")[-3:]:
                    print(f"    ! {line}")
            return False
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False


async def main():
    start = time.time()
    total = len(ORDER)
    results = []

    print("=" * 60)
    print(f"  InteliMarket — Seed All ({total} modules)")
    print("=" * 60)

    for script_base, description in ORDER:
        ok = await run_seed(script_base, description)
        results.append((description, ok))

    elapsed = time.time() - start
    ok_count = sum(1 for _, ok in results if ok)
    fail_count = sum(1 for _, ok in results if not ok)

    print()
    print("=" * 60)
    print(f"  Resumen: {ok_count}/{total} OK, {fail_count} fallos ({elapsed:.1f}s)")
    print("=" * 60)
    for desc, ok in results:
        status = "+" if ok else "-"
        print(f"  [{status}] {desc}")

    return fail_count == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
