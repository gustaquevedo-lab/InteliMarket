"""Loyalty / gamification service for B2B Client App."""
from decimal import Decimal
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.client_app.models import LoyaltyTransaction

# Points configuration
POINTS_PER_1000_GS = 1  # 1 point per 1000 Gs spent
SIGNUP_BONUS_POINTS = 100
REFERRAL_BONUS_POINTS = 50


async def get_loyalty_summary(db: AsyncSession, customer_id: str) -> dict:
    try:
        r = await db.execute(
            select(LoyaltyTransaction)
            .where(LoyaltyTransaction.customer_id == UUID(customer_id))
            .order_by(LoyaltyTransaction.created_at.desc())
        )
        txns = list(r.scalars().all())
    except Exception:
        txns = []

    balance = sum(
        t.puntos if t.tipo == "acumulacion" else -t.puntos
        for t in txns
    ) if txns else 0

    return {
        "balance": int(balance),
        "total_earned": int(sum(t.puntos for t in txns if t.tipo == "acumulacion")) if txns else 0,
        "total_redeemed": int(sum(t.puntos for t in txns if t.tipo == "canje")) if txns else 0,
        "transactions": [
            {
                "id": str(t.id),
                "tipo": t.tipo,
                "puntos": int(t.puntos),
                "concepto": t.concepto,
                "created_at": t.created_at,
            }
            for t in txns[:20]
        ] if txns else [],
    }


async def earn_points(
    db: AsyncSession, customer_id: str, company_id: str,
    total_amount: float, order_id: str, concepto: str = "Compra",
) -> int:
    points = int(total_amount // 1000 * POINTS_PER_1000_GS)
    if points <= 0:
        return 0
    try:
        txn = LoyaltyTransaction(
            customer_id=UUID(customer_id),
            company_id=UUID(company_id),
            order_id=UUID(order_id) if order_id else None,
            tipo="acumulacion",
            puntos=points,
            concepto=concepto,
        )
        db.add(txn)
        await db.flush()
    except Exception:
        pass
    return points


async def signup_bonus(db: AsyncSession, customer_id: str, company_id: str) -> int:
    try:
        txn = LoyaltyTransaction(
            customer_id=UUID(customer_id),
            company_id=UUID(company_id),
            tipo="acumulacion",
            puntos=SIGNUP_BONUS_POINTS,
            concepto="Bienvenida",
        )
        db.add(txn)
        await db.flush()
    except Exception:
        pass
    return SIGNUP_BONUS_POINTS


async def redeem_points(
    db: AsyncSession, customer_id: str, company_id: str,
    points_to_redeem: int, concepto: str = "Canje",
) -> dict:
    summary = await get_loyalty_summary(db, customer_id)
    if summary["balance"] < points_to_redeem:
        return {"success": False, "error": "Puntos insuficientes"}
    try:
        txn = LoyaltyTransaction(
            customer_id=UUID(customer_id),
            company_id=UUID(company_id),
            tipo="canje",
            puntos=points_to_redeem,
            concepto=concepto,
        )
        db.add(txn)
        await db.flush()
    except Exception:
        return {"success": False, "error": "Error al procesar canje"}
    return {"success": True, "redeemed_points": points_to_redeem}


REWARDS_CATALOG = [
    {"id": "desc-50", "nombre": "Gs. 50.000 de descuento", "puntos": 500, "tipo": "descuento", "valor": 50000},
    {"id": "desc-100", "nombre": "Gs. 100.000 de descuento", "puntos": 900, "tipo": "descuento", "valor": 100000},
    {"id": "desc-200", "nombre": "Gs. 200.000 de descuento", "puntos": 1500, "tipo": "descuento", "valor": 200000},
    {"id": "envio-free", "nombre": "Envío gratis en tu próxima compra", "puntos": 200, "tipo": "envio_gratis", "valor": 0},
    {"id": "prod-gratis", "nombre": "Producto sorpresa de regalo", "puntos": 300, "tipo": "producto_gratis", "valor": 0},
]


def get_rewards_catalog() -> list[dict]:
    return REWARDS_CATALOG


async def create_loyalty_tables_if_not_exist(db: AsyncSession):
    """Ensure loyalty_transactions table exists (created via migration)."""
    pass
