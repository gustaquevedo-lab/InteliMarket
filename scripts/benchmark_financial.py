import asyncio
import time
import httpx
import asyncpg
import sys

sys.path.insert(0, '/home/intellihouse/intelimarket')
from api.src.auth.jwt import create_access_token

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def main():
    db_url = ''
    with open('/home/intellihouse/intelimarket/.env') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip("'\"")
                break
    clean_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(clean_url)
    user = await conn.fetchrow("SELECT id, email, rol FROM users WHERE rol = 'admin' LIMIT 1")
    await conn.close()

    token = create_access_token({
        "sub": str(user['id']),
        "email": user['email'],
        "rol": user['rol'],
        "company_id": COMPANY_ID,
    })

    async with httpx.AsyncClient(timeout=60.0) as client:
        base = "http://127.0.0.1:8000/api"
        endpoints = [
            f"/v1/financial/dashboard?company_id={COMPANY_ID}",
            f"/v1/financial/invoices?company_id={COMPANY_ID}",
            f"/v1/financial/aging?company_id={COMPANY_ID}",
            f"/v1/financial/cash-flow/list?company_id={COMPANY_ID}",
            f"/v1/financial/budgets?company_id={COMPANY_ID}",
            f"/v1/financial/supplier-credit-notes?company_id={COMPANY_ID}",
            f"/v1/financial/ap/payment-queue?company_id={COMPANY_ID}",
            f"/v1/financial/banks?company_id={COMPANY_ID}",
            f"/v1/purchases/suppliers?company_id={COMPANY_ID}",
            f"/v1/cheques?limit=5000&company_id={COMPANY_ID}",
        ]

        headers = {"Authorization": f"Bearer {token}"}
        print("=== TIMING FINANCIAL ENDPOINTS ===")
        for ep in endpoints:
            t0 = time.time()
            try:
                r = await client.get(f"{base}{ep}", headers=headers)
                t1 = time.time()
                print(f"Status: {r.status_code} | Time: {t1-t0:.3f}s | {ep}")
            except Exception as e:
                print(f"Error {ep}: {e}")

asyncio.run(main())
