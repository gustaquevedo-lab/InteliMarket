"""Test promo auto-revert lifecycle on PostgreSQL.

Tests:
1. Product price lowered and precio_regular set when added to active promo.
2. Product price immediately restored to precio_regular and precio_regular set to NULL
   when product is REMOVED from the active promo.
3. Product price immediately restored when active promo is DELETED.
"""
import asyncio
import json
import uuid
from decimal import Decimal
from datetime import date, timedelta
from sqlalchemy import text
from api.src.db import async_session_factory


async def run_lifecycle_test():
    cid = uuid.UUID("00000000-0000-0000-0000-000000000010")
    pid1 = uuid.uuid4()
    pid2 = uuid.uuid4()
    promo_id = uuid.uuid4()
    run_id = uuid.uuid4().hex[:6]
    sku1 = f"T-SKU1-{run_id}"
    sku2 = f"T-SKU2-{run_id}"
    bar1 = f"991{run_id}"
    bar2 = f"992{run_id}"

    async with async_session_factory() as db:
        print("1. Creating 2 test products...")
        await db.execute(text("""
            INSERT INTO products (
                id, company_id, sku, codigo_barra, nombre, precio_venta, costo_promedio, activo, created_at, updated_at
            ) VALUES 
            (:p1, :cid, :sku1, :bar1, 'PRODUCTO TEST PROMO 1', 20000.00, 10000.00, true, NOW(), NOW()),
            (:p2, :cid, :sku2, :bar2, 'PRODUCTO TEST PROMO 2', 30000.00, 15000.00, true, NOW(), NOW());
        """), {
            "p1": pid1, "p2": pid2, "cid": cid,
            "sku1": sku1, "sku2": sku2, "bar1": bar1, "bar2": bar2
        })
        await db.commit()

        # Check initial state
        r1 = (await db.execute(text("SELECT precio_venta, precio_regular FROM products WHERE id = :p1"), {"p1": pid1})).first()
        r2 = (await db.execute(text("SELECT precio_venta, precio_regular FROM products WHERE id = :p2"), {"p2": pid2})).first()
        assert r1.precio_venta == Decimal("20000.00") and r1.precio_regular is None, f"Initial p1 mismatch: {r1}"
        assert r2.precio_venta == Decimal("30000.00") and r2.precio_regular is None, f"Initial p2 mismatch: {r2}"
        print("   -> Products created with regular prices: P1=20000, P2=30000.")

        print("2. Creating active promo with both products (P1=15000, P2=22000)...")
        today = date.today()
        tomorrow = today + timedelta(days=2)
        precios_json = json.dumps({str(pid1): 15000, str(pid2): 22000})
        await db.execute(text("""
            INSERT INTO promotions (
                id, company_id, nombre, tipo, aplica_a, activo, estado, valido_desde, valido_hasta,
                producto_ids, precios_por_producto, created_at, updated_at
            ) VALUES (
                :prm, :cid, 'PROMO TEST LIFECYCLE', 'precio_fijo_oferta', 'producto', true, 'activa',
                :vdesde, :vhasta, ARRAY[:p1, :p2]::uuid[],
                CAST(:p_json AS json),
                NOW(), NOW()
            );
        """), {
            "prm": promo_id, "cid": cid, "vdesde": today, "vhasta": tomorrow,
            "p1": pid1, "p2": pid2, "p_json": precios_json
        })
        await db.commit()

        # Check promo applied
        r1 = (await db.execute(text("SELECT precio_venta, precio_regular FROM products WHERE id = :p1"), {"p1": pid1})).first()
        r2 = (await db.execute(text("SELECT precio_venta, precio_regular FROM products WHERE id = :p2"), {"p2": pid2})).first()
        print(f"   -> P1 in promo: precio_venta={r1.precio_venta}, precio_regular={r1.precio_regular}")
        print(f"   -> P2 in promo: precio_venta={r2.precio_venta}, precio_regular={r2.precio_regular}")
        assert r1.precio_venta == Decimal("15000.00") and r1.precio_regular == Decimal("20000.00"), f"Promo p1 mismatch: {r1}"
        assert r2.precio_venta == Decimal("22000.00") and r2.precio_regular == Decimal("30000.00"), f"Promo p2 mismatch: {r2}"
        print("   -> Promo applied successfully! P1: 15000 (regular 20000), P2: 22000 (regular 30000).")

        print("3. Updating promo to REMOVE Product 1 (only Product 2 remains)...")
        precios_json_2 = json.dumps({str(pid2): 22000})
        await db.execute(text("""
            UPDATE promotions
            SET producto_ids = ARRAY[:p2]::uuid[],
                precios_por_producto = CAST(:p_json AS json),
                updated_at = NOW()
            WHERE id = :prm;
        """), {"prm": promo_id, "p2": pid2, "p_json": precios_json_2})
        await db.commit()

        # Check Product 1 is REVERTED and Product 2 is STILL in promo
        r1 = (await db.execute(text("SELECT precio_venta, precio_regular FROM products WHERE id = :p1"), {"p1": pid1})).first()
        r2 = (await db.execute(text("SELECT precio_venta, precio_regular FROM products WHERE id = :p2"), {"p2": pid2})).first()
        print(f"   -> P1 after removal: precio_venta={r1.precio_venta}, precio_regular={r1.precio_regular}")
        print(f"   -> P2 after removal: precio_venta={r2.precio_venta}, precio_regular={r2.precio_regular}")
        assert r1.precio_venta == Decimal("20000.00"), f"P1 was not reverted to 20000: got {r1.precio_venta}"
        assert r1.precio_regular is None, f"P1 precio_regular was not cleared: got {r1.precio_regular}"
        assert r2.precio_venta == Decimal("22000.00") and r2.precio_regular == Decimal("30000.00"), f"P2 was corrupted: {r2}"
        print("   -> [SUCCESS] Product 1 was immediately reverted to regular price (20000) and precio_regular cleared to NULL!")

        print("4. Deleting the active promo...")
        await db.execute(text("DELETE FROM promotions WHERE id = :prm;"), {"prm": promo_id})
        await db.commit()

        # Check Product 2 is ALSO reverted on promo delete
        r2 = (await db.execute(text("SELECT precio_venta, precio_regular FROM products WHERE id = :p2"), {"p2": pid2})).first()
        print(f"   -> P2 after promo delete: precio_venta={r2.precio_venta}, precio_regular={r2.precio_regular}")
        assert r2.precio_venta == Decimal("30000.00"), f"P2 was not reverted to 30000: got {r2.precio_venta}"
        assert r2.precio_regular is None, f"P2 precio_regular was not cleared: got {r2.precio_regular}"
        print("   -> [SUCCESS] Product 2 was immediately reverted to regular price (30000) on promo DELETE!")

        print("5. Cleaning up test products...")
        await db.execute(text("DELETE FROM products WHERE id IN (:p1, :p2);"), {"p1": pid1, "p2": pid2})
        await db.commit()
        print("\n==========================================")
        print(">>> ALL TESTS PASSED WITH 100% SUCCESS! <<<")
        print("==========================================")


if __name__ == "__main__":
    asyncio.run(run_lifecycle_test())
