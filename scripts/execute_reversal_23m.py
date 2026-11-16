import asyncio
import json
from api.src.db import async_session_factory
from sqlalchemy import text

async def execute_reversal():
    RETURN_ID = "31579c32-8eef-494e-9ea1-a696fd1c42cc"
    NC_ID = "92893072-b062-4e12-990d-a5ddab3a612f"
    AR_ID = "d3910ba6-5536-4403-b52d-a93760cc4c46"
    CREDIT_ACC_ID = "b09bdd5e-b482-4b85-ab2e-5a9f7837fbfc"
    CUSTOMER_ID = "ea25c873-edb1-4181-bad7-8e85298f7068"
    COMPANY_ID = "00000000-0000-0000-0000-000000000010"
    WAREHOUSE_ID = "e160a76f-c00e-4816-8ef4-fe788a759977"
    USER_ID = "f8dda96f-fd3e-4445-9e63-e7d9bdca482e"
    
    PROD_CORONITA = "341be333-9e2d-4d66-a91b-f952c254ac9c"
    QTY_CORONITA = 1754
    PROD_MICHELOB = "a48baebb-5827-4b78-bcaa-12b17c0a937b"
    QTY_MICHELOB = 3632
    
    TOTAL_MONTO = 23575106

    async with async_session_factory() as db:
        async with db.begin():
            print(">>> 1. ANULANDO DEVOLUCION EN 'returns'...")
            await db.execute(text("""
                UPDATE returns
                SET estado = 'anulado',
                    observaciones = COALESCE(observaciones, '') || E' [ANULADO 2026-11-16] Reversión administrativa de devolución y NC 001-013-0000088',
                    updated_at = NOW()
                WHERE id = :rid
            """), {"rid": RETURN_ID})

            print(">>> 2. ANULANDO NOTA DE CREDITO EN 'notas_credito_debito'...")
            await db.execute(text("""
                UPDATE notas_credito_debito
                SET estado = 'anulado',
                    motivo = COALESCE(motivo, '') || E' [ANULADA 2026-11-16: Reversión administrativa]',
                    updated_at = NOW()
                WHERE id = :ncid
            """), {"ncid": NC_ID})

            print(">>> 3. DESCONTANDO STOCK INGRESADO (STOCK REVERTIDO)...")
            await db.execute(text("""
                UPDATE stock
                SET cantidad = cantidad - :qty,
                    updated_at = NOW()
                WHERE product_id = :pid AND warehouse_id = :wid
            """), {"qty": QTY_CORONITA, "pid": PROD_CORONITA, "wid": WAREHOUSE_ID})

            await db.execute(text("""
                UPDATE stock
                SET cantidad = cantidad - :qty,
                    updated_at = NOW()
                WHERE product_id = :pid AND warehouse_id = :wid
            """), {"qty": QTY_MICHELOB, "pid": PROD_MICHELOB, "wid": WAREHOUSE_ID})

            print(">>> 4. REGISTRANDO MOVIMIENTOS COMPENSATORIOS DE STOCK...")
            await db.execute(text("""
                INSERT INTO inventory_movements (
                    company_id, warehouse_id, product_id, tipo, cantidad,
                    referencia_type, referencia_id, motivo, user_id, created_at
                ) VALUES (
                    :cid, :wid, :pid, 'salida_ajuste', :qty,
                    'return_reversal', :rid, 'Reversión por anulación de devolución DEV-20261116-000410',
                    :uid, NOW()
                )
            """), {
                "cid": COMPANY_ID, "wid": WAREHOUSE_ID, "pid": PROD_CORONITA,
                "qty": QTY_CORONITA, "rid": RETURN_ID, "uid": USER_ID
            })

            await db.execute(text("""
                INSERT INTO inventory_movements (
                    company_id, warehouse_id, product_id, tipo, cantidad,
                    referencia_type, referencia_id, motivo, user_id, created_at
                ) VALUES (
                    :cid, :wid, :pid, 'salida_ajuste', :qty,
                    'return_reversal', :rid, 'Reversión por anulación de devolución DEV-20261116-000410',
                    :uid, NOW()
                )
            """), {
                "cid": COMPANY_ID, "wid": WAREHOUSE_ID, "pid": PROD_MICHELOB,
                "qty": QTY_MICHELOB, "rid": RETURN_ID, "uid": USER_ID
            })

            print(">>> 5. RESTAURANDO SALDO ORIGINAL EN 'accounts_receivable'...")
            await db.execute(text("""
                UPDATE accounts_receivable
                SET saldo_pendiente = 34261917,
                    notas_cobranza = COALESCE(notas_cobranza, '') || E'\\n[ANULADA DEV-20261116-000410] +₲ 23.575.106 Reversión total y anulación',
                    updated_at = NOW()
                WHERE id = :arid
            """), {"arid": AR_ID})

            print(">>> 6. RESTAURANDO SALDOS EN 'credit_accounts'...")
            await db.execute(text("""
                UPDATE credit_accounts
                SET saldo_utilizado = 35715252.00,
                    saldo_disponible = 1284748.00,
                    updated_at = NOW()
                WHERE id = :caid
            """), {"caid": CREDIT_ACC_ID})

            print(">>> 7. REGISTRANDO MOVIMIENTO COMPENSATORIO EN 'credit_movements'...")
            await db.execute(text("""
                INSERT INTO credit_movements (
                    company_id, credit_account_id, customer_id, tipo,
                    monto, saldo_anterior, saldo_nuevo, referencia_type,
                    referencia_id, observaciones, created_at
                ) VALUES (
                    :cid, :caid, :cust_id, 'anulacion_devolucion',
                    :monto, 12140146.00, 35715252.00, 'return',
                    :rid, 'Anulación Devolución DEV-20261116-000410 — Reintegro deuda factura 001-013-0003811',
                    NOW()
                )
            """), {
                "cid": COMPANY_ID, "caid": CREDIT_ACC_ID, "cust_id": CUSTOMER_ID,
                "monto": TOTAL_MONTO, "rid": RETURN_ID
            })

            print(">>> 8. REGISTRANDO AUDIT LOG...")
            datos_anteriores = {
                "estado": "aprobado",
                "nc_id": NC_ID,
                "nc_numero": "001-013-0000088",
                "total": TOTAL_MONTO,
                "ar_saldo_pendiente": 10686811,
                "credit_saldo_utilizado": 12140146.00,
                "credit_saldo_disponible": 24859854.00
            }
            datos_nuevos = {
                "estado": "anulado",
                "nc_estado": "anulado",
                "motivo": "Reversión de devolución y anulación de nota de crédito por solicitud administrativa",
                "stock_revertido": {
                    "coronita": QTY_CORONITA,
                    "michelob": QTY_MICHELOB
                },
                "ar_saldo_pendiente_restaurado": 34261917,
                "credit_saldo_utilizado_restaurado": 35715252.00,
                "credit_saldo_disponible_restaurado": 1284748.00
            }
            await db.execute(text("""
                INSERT INTO audit_logs (
                    company_id, user_id, accion, entidad, entidad_id,
                    datos_anteriores, datos_nuevos, created_at
                ) VALUES (
                    :cid, :uid, 'anulacion_devolucion', 'returns', :rid,
                    CAST(:anteriores AS jsonb), CAST(:nuevos AS jsonb), NOW()
                )
            """), {
                "cid": COMPANY_ID, "uid": USER_ID, "rid": RETURN_ID,
                "anteriores": json.dumps(datos_anteriores),
                "nuevos": json.dumps(datos_nuevos)
            })

        print(">>> TRANSACCION COMPLETADA CON EXITO (COMMIT OK) <<<")

if __name__ == "__main__":
    asyncio.run(execute_reversal())
