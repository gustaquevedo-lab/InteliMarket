"""Seed for Advanced Inventory - demo data"""
import asyncio
import asyncpg
from scripts.seed_data import (
    DB, CID, ADV_LOC1, ADV_PICK1, ADV_CYC1, ADV_CONS1, ADV_REPL1,
    WH_CENTRAL, WH_SUC1, WH_FRIGO, P001, P003, P005, SUPP01, SUPP02, USER_SA
)
from uuid import uuid4


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("""
            INSERT INTO adv_storage_locations (id, company_id, warehouse_id, codigo, pasillo, estante,
               posicion, capacidad_maxima, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        """, ADV_LOC1, CID, WH_CENTRAL, "A-01", "A", "1", None, None, True)

        for codigo, pasillo, estante in [
            ("A-02", "A", "2"), ("A-03", "A", "3"), ("A-04", "A", "4"), ("A-05", "A", "5"),
            ("B-01", "B", "1"), ("B-02", "B", "2"), ("B-03", "B", "3"),
        ]:
            await conn.execute("""
                INSERT INTO adv_storage_locations (id, company_id, warehouse_id, codigo, pasillo, estante,
                   posicion, capacidad_maxima, activo)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (company_id, warehouse_id, codigo) DO NOTHING
            """, uuid4(), CID, WH_CENTRAL, codigo, pasillo, estante, None, None, True)

        await conn.execute("""
            INSERT INTO adv_picking_lists (id, company_id, warehouse_id, numero, referencia_tipo, estado)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, ADV_PICK1, CID, WH_CENTRAL, "PL-001", "venta", "completado")

        for product_id, nombre, solicitado, pickeado in [
            (P001, "Arroz 1kg", 50, 50),
            (P003, "Leche Entera 1L", 30, 28),
            (P005, "Aceite de Cocina", 20, 20),
        ]:
            await conn.execute("""
                INSERT INTO adv_picking_list_items (id, picking_list_id, product_id, product_nombre,
                   cantidad_solicitada, cantidad_pickeada, estado)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            """, uuid4(), ADV_PICK1, product_id, nombre, solicitado, pickeado, "completado")

        await conn.execute("""
            INSERT INTO adv_cycle_counts (id, company_id, warehouse_id, numero, tipo, estado)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, ADV_CYC1, CID, WH_CENTRAL, "CC-001", "parcial", "pendiente")

        for product_id, nombre, sistema, fisica in [
            (P001, "Arroz 1kg", 150, 148),
            (P003, "Leche Entera 1L", 200, 202),
        ]:
            diff = fisica - sistema
            await conn.execute("""
                INSERT INTO adv_cycle_count_items (id, cycle_count_id, product_id, product_nombre,
                   cantidad_sistema, cantidad_fisica, diferencia, estado)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO NOTHING
            """, uuid4(), ADV_CYC1, product_id, nombre, sistema, fisica, diff, "completado")

        await conn.execute("""
            INSERT INTO adv_consignment_stock (id, company_id, warehouse_id, product_id, supplier_id,
               supplier_nombre, cantidad, costo_acordado, moneda, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """, ADV_CONS1, CID, WH_CENTRAL, P005, SUPP01, "Distribuidora ABC", 100, 25000, "PYG", True)

        await conn.execute("""
            INSERT INTO adv_auto_replenish_rules (id, company_id, product_id, warehouse_id,
               stock_minimo, stock_seguridad, cantidad_reorden, lead_time_dias, supplier_id, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """, ADV_REPL1, CID, P001, WH_CENTRAL, 50, 50, 200, 7, SUPP01, True)

        print("✅ Advanced Inventory seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
