"""
Script para sanear y conciliar los movimientos importados del extracto de Banco Continental Cta Cte:
1. Eliminar las 3 transacciones de depósito duplicadas importadas por el extracto
   (1b7f5c08..., dae0ad42..., 8844a5bf...) que ya estaban registradas por Bóveda.
2. Conciliar las boletas de Bóveda (41398769, 41398770) con su comprobante bancario.
3. Re-etiquetar los 4 débitos de CLEARING/CHEQUES con el nombre del proveedor, número de cheque y vincularlos a su cheque_id.
4. Recalcular dinámicamente el saldo_actual de BANCO CONTINENTAL-CTE (saldo_inicial + creditos - debitos).
"""
import asyncio
import os
import sys
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DB_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://intelimarket:password@localhost:5432/intelimarket")
ACCOUNT_ID = "5d3f3160-e963-4564-bdae-c864b217d79c"

async def main():
    engine = create_async_engine(DB_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        print("=== INICIANDO SANEAMIENTO Y CONCILIACIÓN CONTINENTAL CTE ===")

        # 1. Eliminar las 3 transacciones de depósito duplicadas del extracto
        dup_ids = [
            '1b7f5c08-5134-42c8-8b0b-a2645b76460f', # 34.325.523 (duplicado de 41398769 + 41398770)
            'dae0ad42-8594-4819-b6c5-7a9c21cca437', # 3.881.815 (duplicado de 41398771)
            '8844a5bf-96a7-49e6-bf38-930638603fe0', # 11.575.393 (duplicado de 41398774)
        ]
        del_res = await session.execute(
            text("DELETE FROM bank_transactions WHERE id = ANY(:ids) RETURNING id, monto, referencia"),
            {"ids": dup_ids}
        )
        deleted = del_res.fetchall()
        print(f"1. Transacciones duplicadas eliminadas: {len(deleted)}")
        for r in deleted:
            print(f"   - ID: {r.id} | Monto: {r.monto:,.0f} | Ref: {r.referencia}")

        # 2. Conciliar los depósitos de Bóveda
        now = datetime.now(timezone.utc)
        boveda_ids = [
            '30530aa2-e53d-40b0-8441-d7b4eca975a1', # 41398769
            'ea551958-844e-46a9-ac0c-2cfaf4abb814', # 41398770
        ]
        await session.execute(
            text("""
                UPDATE bank_transactions 
                SET conciliado = true, fecha_conciliacion = :now
                WHERE id = ANY(:ids)
            """),
            {"ids": boveda_ids, "now": now}
        )
        print("2. Boletas de Bóveda 41398769 y 41398770 marcadas como CONCILIADAS con éxito.")

        # 3. Re-etiquetar los 4 débitos de CLEARING/CHEQUES
        cheque_updates = [
            {
                "id": "ccb66d5f-7a57-425a-a816-e87b85da1383",
                "desc": "PAGO A CASA GONZALITO S.R.L. (Clearing Cheque #353747)",
                "ref": "353747",
                "chq_id": "206b52fb-e71a-4e49-972c-71efdea55e02",
                "cat": "pago_proveedor",
            },
            {
                "id": "d7302a4c-1578-4893-b85f-8cbd49875930",
                "desc": "PAGO A DIST. DE CARNE SAN GABRIEL (Clearing Cheque #808361)",
                "ref": "808361",
                "chq_id": "e7318d9d-0bef-405b-ac7c-f9e32776b3da",
                "cat": "pago_proveedor",
            },
            {
                "id": "57351fd0-d9d5-4c76-8e28-82a266556163",
                "desc": "PAGO A LÁCTEOS UNIDOS S.A. (Clearing Cheque #808298)",
                "ref": "808298",
                "chq_id": "7d3661c4-042a-4e00-8316-1d1dc56f7b21",
                "cat": "pago_proveedor",
            },
            {
                "id": "ad4065c8-6ffa-4f97-8281-2d58e6d6e40a",
                "desc": "PAGO A PETRONOR S.A.C.I. (Depósito Cheque #353736)",
                "ref": "353736",
                "chq_id": "e5d43d41-6b48-4a0d-bd92-463e440e9b3b",
                "cat": "pago_proveedor",
            },
        ]
        for cu in cheque_updates:
            await session.execute(
                text("""
                    UPDATE bank_transactions
                    SET descripcion = :desc,
                        referencia = :ref,
                        cheque_id = :chq_id,
                        categoria = :cat,
                        conciliado = true,
                        fecha_conciliacion = :now
                    WHERE id = :id
                """),
                {**cu, "now": now}
            )
            print(f"3. Débito {cu['id']} re-etiquetado -> {cu['desc']}")

        # 4. Recalcular el saldo_actual canónico dinámico
        bal_res = await session.execute(
            text("""
                SELECT 
                    ba.saldo_inicial,
                    COALESCE(SUM(CASE WHEN bt.tipo = 'credito' THEN bt.monto ELSE 0 END), 0) as creditos,
                    COALESCE(SUM(CASE WHEN bt.tipo = 'debito' THEN bt.monto ELSE 0 END), 0) as debitos
                FROM bank_accounts ba
                LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id
                WHERE ba.id = :aid
                GROUP BY ba.saldo_inicial
            """),
            {"aid": ACCOUNT_ID}
        )
        bal_row = bal_res.fetchone()
        nuevo_saldo = bal_row.saldo_inicial + bal_row.creditos - bal_row.debitos

        await session.execute(
            text("UPDATE bank_accounts SET saldo_actual = :saldo, updated_at = :now WHERE id = :aid"),
            {"saldo": nuevo_saldo, "now": now, "aid": ACCOUNT_ID}
        )
        await session.commit()

        print(f"4. Saldo recalcula y actualizado con éxito:")
        print(f"   - Saldo Inicial:  {bal_row.saldo_inicial:,.0f} Gs.")
        print(f"   - Total Créditos: {bal_row.creditos:,.0f} Gs.")
        print(f"   - Total Débitos:  {bal_row.debitos:,.0f} Gs.")
        print(f"   - Saldo Actual:   {nuevo_saldo:,.0f} Gs.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
