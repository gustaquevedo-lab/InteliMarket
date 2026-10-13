import asyncio
import uuid
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.promotions.models import Promotion
from api.src.smart_pricing.service import get_applicable_tier_price

COMPANY_ID = "00000000-0000-0000-0000-000000000010"
PROD_ID = "6da38c88-7bab-4514-bff1-18597d1fda58" # MAESTRA PASTA MOÑITOS

async def test_promo_query():
    async with async_session_factory() as db:
        res = await get_applicable_tier_price(db, COMPANY_ID, PROD_ID, 1)
        print("RESULTADO get_applicable_tier_price:", res)

asyncio.run(test_promo_query())
