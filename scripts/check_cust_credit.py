import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

CUST_ID = "8476be07-5b16-4494-92b9-6a426848c59b"

async def check_cust_credit():
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT * FROM credit_accounts WHERE customer_id = :cid;
        """), {"cid": CUST_ID})
        rows = res.fetchall()
        print(f"credit_accounts para {CUST_ID}: {len(rows)} cuentas.")
        for r in rows:
            print(dict(zip(res.keys(), r)))

        # Sincronizar limite_credito = credito_limite donde limite_credito = 0 pero credito_limite > 0
        res_diff = await db.execute(text("""
            SELECT count(*) FROM customers 
            WHERE (limite_credito = 0 OR limite_credito IS NULL) AND credito_limite > 0;
        """))
        print(f"Total clientes con limite_credito=0 pero credito_limite>0: {res_diff.scalar()}")

asyncio.run(check_cust_credit())
