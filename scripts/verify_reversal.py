import asyncio
from api.src.db import async_session_factory
from sqlalchemy import text

async def verify():
    RETURN_ID = "31579c32-8eef-494e-9ea1-a696fd1c42cc"
    NC_ID = "92893072-b062-4e12-990d-a5ddab3a612f"
    AR_ID = "d3910ba6-5536-4403-b52d-a93760cc4c46"
    CREDIT_ACC_ID = "b09bdd5e-b482-4b85-ab2e-5a9f7837fbfc"

    async with async_session_factory() as db:
        print("=== 1. RETURN ===")
        r = (await db.execute(text("SELECT id, numero, estado, total, observaciones FROM returns WHERE id = :id"), {"id": RETURN_ID})).mappings().first()
        print(dict(r))

        print("\n=== 2. NOTA CREDITO ===")
        nc = (await db.execute(text("SELECT id, numero, estado, motivo FROM notas_credito_debito WHERE id = :id"), {"id": NC_ID})).mappings().first()
        print(dict(nc))

        print("\n=== 3. STOCK ===")
        stocks = (await db.execute(text("""
            SELECT s.product_id, s.warehouse_id, s.cantidad, p.nombre
            FROM stock s
            JOIN products p ON p.id = s.product_id
            WHERE s.product_id = ANY(ARRAY['341be333-9e2d-4d66-a91b-f952c254ac9c'::uuid, 'a48baebb-5827-4b78-bcaa-12b17c0a937b'::uuid])
              AND s.warehouse_id = 'e160a76f-c00e-4816-8ef4-fe788a759977'::uuid
        """))).mappings().fetchall()
        for s in stocks:
            print(dict(s))

        print("\n=== 4. ACCOUNTS RECEIVABLE ===")
        ar = (await db.execute(text("SELECT id, numero_documento, monto_original, saldo_pendiente, estado, notas_cobranza FROM accounts_receivable WHERE id = :id"), {"id": AR_ID})).mappings().first()
        print(dict(ar))

        print("\n=== 5. CREDIT ACCOUNT ===")
        ca = (await db.execute(text("SELECT id, limite_credito, saldo_utilizado, saldo_disponible FROM credit_accounts WHERE id = :id"), {"id": CREDIT_ACC_ID})).mappings().first()
        print(dict(ca))

        print("\n=== 6. CREDIT MOVEMENTS ===")
        cm = (await db.execute(text("SELECT id, tipo, monto, saldo_anterior, saldo_nuevo, observaciones, created_at FROM credit_movements WHERE referencia_id = :id ORDER BY created_at DESC"), {"id": RETURN_ID})).mappings().fetchall()
        for m in cm:
            print(dict(m))

        print("\n=== 7. INVENTORY MOVEMENTS ===")
        im = (await db.execute(text("SELECT id, product_id, tipo, cantidad, motivo, referencia_type, created_at FROM inventory_movements WHERE referencia_id = :id ORDER BY created_at DESC"), {"id": RETURN_ID})).mappings().fetchall()
        for m in im:
            print(dict(m))

        print("\n=== 8. AUDIT LOG ===")
        al = (await db.execute(text("SELECT id, accion, entidad, entidad_id, datos_nuevos, created_at FROM audit_logs WHERE entidad_id = :id ORDER BY created_at DESC LIMIT 1"), {"id": RETURN_ID})).mappings().first()
        print(dict(al))

if __name__ == "__main__":
    asyncio.run(verify())
