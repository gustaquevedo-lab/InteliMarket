import asyncio, asyncpg

async def f():
    conn = await asyncpg.connect("postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket")
    for t in ["ir_route_optimizations", "ir_vehicle_load_configs", "ir_load_optimization_results", 
              "ir_dynamic_reroute_requests", "ir_eta_predictions", "ir_route_efficiency_metrics",
              "sr_subscription_logs", "di_delivery_integrations", "ekuatia_documents"]:
        print(f"\n=== {t} ===")
        rows = await conn.fetch(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='{t}' ORDER BY ordinal_position")
        for r in rows:
            print(f"  {r['column_name']} ({r['data_type']})")
    await conn.close()

asyncio.run(f())
