"""
Script de remediación quirúrgica para REM-202609-001 (PREFORMAX PARAGUAY S.A.):
1. Desvincula las 3 facturas de compras institucionales directas de Preformax:
   - 001-014-0033524: ₲ 259.462
   - 001-013-0034035: ₲ 617.140
   - 001-014-0035872: ₲ 114.200
   Total = ₲ 990.802.
   Pasan a: corporate_remission_id = NULL, remitido_empresa_at = NULL, estado = 'pendiente', saldo_pendiente = monto_original, ultimo_pago = NULL.
2. Restaura la línea de crédito institucional de Preformax (+990.802 utilizado, -990.802 disponible).
3. Actualiza el lote de remisión REM-202609-001:
   - monto_total = 17389626
   - saldo_pendiente = 0
   - cantidad_documentos = 89
   - cantidad_funcionarios = 41
   - estado = 'PAGADO'
4. Ajusta el movimiento bancario en bank_transactions (c6e2974f-0aa3-4603-adb5-a2852fcd3083):
   - monto = 17389626.00
   - descripcion = 'Cobro Remisión REM-202609-001 (Nómina Funcionarios) - PREFORMAX PARAGUAY SOCIEDAD ANONIMA'
5. Descuenta los ₲ 990.802 sobreacreditados en la cuenta bancaria Banco Interfisa (id a8835482-cdb6-40d2-9310-1ac67936425b).
"""
import asyncio
import os
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://intelimarket:password@localhost:5432/intelimarket")

PREFORMAX_DOC_IDS = [
    "66d53e8c-2a96-4a2d-a1d0-61c2a268e35f",  # 001-014-0033524 (259.462)
    "da043af1-305e-4028-80c3-be17e52abd3f",  # 001-013-0034035 (617.140)
    "3160e8b2-109e-40c7-8343-b083b77f6a61",  # 001-014-0035872 (114.200)
]
REMISSION_ID = "dbedb37d-0cfa-4a52-8d79-665d42afc517"
BANK_TX_ID = "c6e2974f-0aa3-4603-adb5-a2852fcd3083"
BANK_ACCOUNT_ID = "a8835482-cdb6-40d2-9310-1ac67936425b"
PREFORMAX_CUSTOMER_ID = "f29feddb-6147-457e-b80e-eb6b8aeafb01"
MONTO_INSTITUCIONAL = Decimal("990802")
MONTO_NOMINA_PAGADO = Decimal("17389626")

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with async_session() as db:
        async with db.begin():
            print("==> 1. Desvinculando 3 facturas de la remisión y restableciendo a pendiente...")
            r_docs = await db.execute(
                text("""
                    UPDATE accounts_receivable
                    SET corporate_remission_id = NULL,
                        remitido_empresa_at = NULL,
                        estado = 'pendiente',
                        saldo_pendiente = monto_original,
                        ultimo_pago = NULL,
                        updated_at = NOW()
                    WHERE id = ANY(:ids)
                    RETURNING id, numero_documento, monto_original, saldo_pendiente, estado
                """),
                {"ids": PREFORMAX_DOC_IDS}
            )
            docs = r_docs.fetchall()
            for d in docs:
                print(f"   ✓ Doc {d.numero_documento}: monto={d.monto_original}, saldo={d.saldo_pendiente}, estado={d.estado}")

            print("==> 2. Restaurando línea de crédito de Preformax...")
            await db.execute(
                text("""
                    UPDATE credit_accounts
                    SET saldo_utilizado = saldo_utilizado + :monto,
                        saldo_disponible = GREATEST(0, saldo_disponible - :monto),
                        updated_at = NOW()
                    WHERE customer_id = :cid
                """),
                {"monto": float(MONTO_INSTITUCIONAL), "cid": PREFORMAX_CUSTOMER_ID}
            )
            print(f"   ✓ Línea de crédito ajustada (+{MONTO_INSTITUCIONAL} saldo utilizado)")

            print("==> 3. Actualizando remisión REM-202609-001 (exclusiva funcionarios)...")
            await db.execute(
                text("""
                    UPDATE ar_corporate_remissions
                    SET monto_total = :monto,
                        saldo_pendiente = 0,
                        cantidad_documentos = 89,
                        cantidad_funcionarios = 41,
                        estado = 'PAGADO',
                        notas = COALESCE(notas, '') || ' [Remediación: Desvinculadas 3 facturas directas de empresa (₲ 990.802). Lote nómina final ₲ 17.389.626 cancelado.]',
                        updated_at = NOW()
                    WHERE id = :rem_id
                """),
                {"monto": float(MONTO_NOMINA_PAGADO), "rem_id": REMISSION_ID}
            )
            print(f"   ✓ Remisión actualizada: monto_total={MONTO_NOMINA_PAGADO}, docs=89, func=41, estado=PAGADO")

            print("==> 4. Ajustando movimiento bancario bank_transactions...")
            await db.execute(
                text("""
                    UPDATE bank_transactions
                    SET monto = :monto,
                        descripcion = 'Cobro Remisión REM-202609-001 (Nómina Funcionarios) - PREFORMAX PARAGUAY SOCIEDAD ANONIMA'
                    WHERE id = :tx_id
                """),
                {"monto": float(MONTO_NOMINA_PAGADO), "tx_id": BANK_TX_ID}
            )
            print(f"   ✓ Movimiento bancario ajustado a ₲ {MONTO_NOMINA_PAGADO}")

            print("==> 5. Descontando ₲ 990.802 de la cuenta bancaria...")
            await db.execute(
                text("""
                    UPDATE bank_accounts
                    SET saldo_actual = saldo_actual - :monto,
                        updated_at = NOW()
                    WHERE id = :acc_id
                """),
                {"monto": float(MONTO_INSTITUCIONAL), "acc_id": BANK_ACCOUNT_ID}
            )
            print(f"   ✓ Cuenta bancaria ajustada (-₲ {MONTO_INSTITUCIONAL})")

    print("\n✓ Remediación ejecutada y confirmada con éxito.")

if __name__ == "__main__":
    asyncio.run(main())
