import asyncio
import uuid
from datetime import datetime
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.promotions.models import Promotion

COMPANY_ID = "00000000-0000-0000-0000-000000000010"
PROD_ID = "6da38c88-7bab-4514-bff1-18597d1fda58"

async def test_direct_promo():
    async with async_session_factory() as db:
        cid = uuid.UUID(COMPANY_ID)
        pid = uuid.UUID(PROD_ID)
        today = datetime.now().date()

        try:
            promo_q = select(Promotion).where(
                Promotion.company_id == cid,
                Promotion.activo == True,
                Promotion.estado == "activa",
                Promotion.valido_desde <= today,
                Promotion.valido_hasta >= today,
                Promotion.producto_ids.any(pid)
            )
            res = await db.execute(promo_q)
            promo = res.scalars().first()
            print("Promo encontrada con .any():", promo.nombre if promo else None, promo.precio_fijo_promocional if promo else None)
        except Exception as e:
            print("Error con .any():", e)

        try:
            promo_q_sql = select(Promotion).where(
                Promotion.company_id == cid,
                Promotion.activo == True,
                Promotion.estado == "activa",
                Promotion.valido_desde <= today,
                Promotion.valido_hasta >= today,
                text(":pid = ANY(promotions.producto_ids)").bindparams(pid=pid)
            )
            res2 = await db.execute(promo_q_sql)
            promo2 = res2.scalars().first()
            print("Promo encontrada con ANY SQL:", promo2.nombre if promo2 else None, promo2.precio_fijo_promocional if promo2 else None)
        except Exception as e2:
            print("Error con ANY SQL:", e2)

asyncio.run(test_direct_promo())
