import asyncio
from decimal import Decimal
from api.src.db import async_session_factory
from sqlalchemy import text

# id -> saldo real al 31/jul/2026, sacado del "Saldo Anterior" del extracto de agosto 2026
ANCHORS = {
    "ad6991e3-281d-49b8-aee7-65a00d421214": Decimal("14696562"),   # Continental Ahorro
    "2fe1c1ec-d3c8-4446-ab85-5239a4418e1c": Decimal("886183"),     # Continental Ahorro PIX
    "a8835482-cdb6-40d2-9310-1ac67936425b": Decimal("138324153"),  # Interfisa Cta. Cte.
    "3b7d6fb5-0b21-4b94-b793-4d0f88d7e51a": Decimal("20825373"),   # Interfisa Ahorro
}


async def main():
    async with async_session_factory() as db:
        for account_id, anchor in ANCHORS.items():
            r = await db.execute(
                text("SELECT tipo, sum(monto) FROM bank_transactions WHERE bank_account_id = :id GROUP BY tipo"),
                {"id": account_id},
            )
            creditos = debitos = Decimal("0")
            for tipo, s in r:
                if tipo == "credito":
                    creditos = s
                else:
                    debitos = s

            r2 = await db.execute(
                text("SELECT tipo, sum(monto) FROM bank_transactions WHERE bank_account_id = :id AND fecha <= '2026-07-31' GROUP BY tipo"),
                {"id": account_id},
            )
            creditos_jul = debitos_jul = Decimal("0")
            for tipo, s in r2:
                if tipo == "credito":
                    creditos_jul = s
                else:
                    debitos_jul = s

            saldo_inicial = anchor - (creditos_jul - debitos_jul)
            saldo_actual = saldo_inicial + creditos - debitos

            await db.execute(
                text("UPDATE bank_accounts SET saldo_inicial = :si, saldo_actual = :sa, updated_at = now() WHERE id = :id"),
                {"si": saldo_inicial, "sa": saldo_actual, "id": account_id},
            )
            print(f"{account_id}: saldo_inicial={saldo_inicial}  saldo_actual={saldo_actual}")

        await db.commit()
        print("COMMIT OK")


if __name__ == "__main__":
    asyncio.run(main())
