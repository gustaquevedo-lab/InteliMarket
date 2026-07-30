"""Caja (Cash Register) service"""

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.caja.models import CashRegister, CashSession, CashCount
from api.src.sales.models import Sale


async def list_registers(db: AsyncSession, branch_id: str | None = None) -> list[CashRegister]:
    query = select(CashRegister).where(CashRegister.activo == True)
    if branch_id:
        query = query.where(CashRegister.branch_id == branch_id)
    query = query.order_by(CashRegister.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_register(db: AsyncSession, register_id: str) -> CashRegister | None:
    result = await db.execute(
        select(CashRegister).where(CashRegister.id == uuid.UUID(register_id))
    )
    return result.scalar_one_or_none()


async def create_register(db: AsyncSession, data: dict) -> CashRegister:
    register = CashRegister(**data)
    db.add(register)
    await db.flush()
    await db.refresh(register)
    return register


async def update_register(db: AsyncSession, register_id: str, data: dict) -> CashRegister | None:
    register = await get_register(db, register_id)
    if not register:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(register, key, value)
    await db.flush()
    await db.refresh(register)
    return register


async def delete_register(db: AsyncSession, register_id: str) -> bool:
    register = await get_register(db, register_id)
    if not register:
        return False
    register.activo = False
    await db.flush()
    return True


async def get_open_session(db: AsyncSession, register_id: str) -> CashSession | None:
    result = await db.execute(
        select(CashSession)
        .where(CashSession.register_id == uuid.UUID(register_id))
        .where(CashSession.estado == "abierta")
        .order_by(CashSession.fecha_apertura.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_sessions(
    db: AsyncSession,
    register_id: str | None = None,
    user_id: str | None = None,
    estado: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CashSession]:
    query = select(CashSession)
    if register_id:
        query = query.where(CashSession.register_id == uuid.UUID(register_id))
    if user_id:
        query = query.where(CashSession.user_id == uuid.UUID(user_id))
    if estado:
        query = query.where(CashSession.estado == estado)
    if fecha_desde:
        query = query.where(CashSession.fecha_apertura >= fecha_desde)
    if fecha_hasta:
        query = query.where(CashSession.fecha_apertura <= fecha_hasta)
    query = query.order_by(CashSession.fecha_apertura.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_session_with_summary(db: AsyncSession, session_id: str) -> dict | None:
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id))
    )
    session_obj = result.scalar_one_or_none()
    if not session_obj:
        return None

    sales_result = await db.execute(
        select(
            func.count(Sale.id).label("total_ventas"),
            func.coalesce(func.sum(Sale.total), 0).label("total_cobrado"),
        ).where(
            Sale.branch_id == session_obj.register_id,
            Sale.fecha >= session_obj.fecha_apertura,
            Sale.estado == "confirmado",
        )
    )
    row = sales_result.first()
    return {
        "session": session_obj,
        "total_ventas": row.total_ventas if row else 0,
        "total_cobrado": row.total_cobrado if row else 0,
    }


async def open_session(db: AsyncSession, data: dict) -> CashSession:
    register_id = data["cash_register_id"]
    existing = await get_open_session(db, str(register_id))
    if existing:
        raise ValueError("Ya existe una sesión abierta para esta caja")

    session_obj = CashSession(
        register_id=register_id,
        user_id=data["user_id"],
        monto_apertura=data.get("monto_apertura", 0),
    )
    db.add(session_obj)
    await db.flush()
    await db.refresh(session_obj)
    return session_obj


async def close_session(db: AsyncSession, session_id: str, monto_cierre_real: Decimal, observaciones: str | None = None) -> dict | None:
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id))
    )
    session_obj = result.scalar_one_or_none()
    if not session_obj or session_obj.estado != "abierta":
        return None

    sales_result = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.branch_id == session_obj.register_id,
            Sale.fecha >= session_obj.fecha_apertura,
            Sale.estado == "confirmado",
        )
    )
    total_cobrado = sales_result.scalar() or 0

    monto_cierre_esperado = Decimal(str(session_obj.monto_apertura)) + Decimal(str(total_cobrado))
    diferencia = Decimal(str(monto_cierre_real)) - monto_cierre_esperado

    session_obj.fecha_cierre = datetime.now(timezone.utc)
    session_obj.monto_cierre = monto_cierre_real
    session_obj.observaciones = observaciones
    session_obj.estado = "cerrada"
    await db.flush()

    db.add(CashCount(
        session_id=session_obj.id,
        monto_efectivo=monto_cierre_real,
        monto_total=monto_cierre_real,
        diferencia=diferencia,
    ))
    await db.flush()
    await db.refresh(session_obj)

    return {
        "session": session_obj,
        "monto_cierre_esperado": monto_cierre_esperado,
        "diferencia": diferencia,
    }
