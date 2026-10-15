from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.ruta_caja.models import BankDeposit, RouteLiquidation, RouteLiquidationItem, RouteSession
from api.src.ruta_caja.schemas import BankDepositCreate


async def open_route_session(
    db: AsyncSession,
    company_id: str,
    cobrador_id: str,
    route_id: Optional[str],
    fecha: date,
    fondo_inicial: Decimal,
    created_by: str,
) -> RouteSession:
    result = await db.execute(
        select(RouteSession).where(
            RouteSession.company_id == company_id,
            RouteSession.cobrador_id == cobrador_id,
            RouteSession.fecha == fecha,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Sesión abierta del {fecha} pendiente de cierre")

    session = RouteSession(
        company_id=company_id,
        cobrador_id=cobrador_id,
        route_id=route_id,
        fecha=fecha,
        fondo_inicial=fondo_inicial,
        estado="abierta",
        created_by=created_by,
    )
    db.add(session)
    await db.flush()
    await db.commit()
    return session


async def list_route_sessions(
    db: AsyncSession,
    company_id: str,
    fecha: Optional[date] = None,
    cobrador_id: Optional[str] = None,
    estado: Optional[str] = None,
) -> list[RouteSession]:
    q = select(RouteSession).where(RouteSession.company_id == company_id)
    if fecha:
        q = q.where(RouteSession.fecha == fecha)
    if cobrador_id:
        q = q.where(RouteSession.cobrador_id == cobrador_id)
    if estado:
        q = q.where(RouteSession.estado == estado)
    result = await db.execute(q)
    return result.scalars().all()


async def get_route_session_detail(db: AsyncSession, session_id: str) -> dict:
    session = await db.get(RouteSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    liq_result = await db.execute(
        select(RouteLiquidation).where(RouteLiquidation.route_session_id == session_id)
    )
    liq = liq_result.scalar_one_or_none()

    # AR summary for the cobrador on this date
    ar_sql = text("""
        SELECT
            COALESCE(SUM(CASE WHEN tipo = 'efectivo' THEN monto ELSE 0 END), 0) AS total_efectivo,
            COALESCE(SUM(CASE WHEN tipo = 'cheque' THEN monto ELSE 0 END), 0) AS total_cheques,
            COALESCE(SUM(CASE WHEN tipo = 'pagare' THEN monto ELSE 0 END), 0) AS total_pagares,
            COALESCE(SUM(CASE WHEN tipo = 'nc' THEN monto ELSE 0 END), 0) AS total_nc
        FROM receivable_payments
        WHERE cobrador_id = :cobrador_id
          AND created_at AT TIME ZONE 'America/Asuncion' >= :fecha_start
          AND created_at AT TIME ZONE 'America/Asuncion' < :fecha_end
    """)
    ar_result = await db.execute(ar_sql, {
        "cobrador_id": str(session.cobrador_id),
        "fecha_start": str(session.fecha),
        "fecha_end": str(session.fecha),
    })
    ar_row = ar_result.fetchone()
    ar_summary = {
        "total_efectivo": int(ar_row[0]) if ar_row else 0,
        "total_cheques": int(ar_row[1]) if ar_row else 0,
        "total_pagares": int(ar_row[2]) if ar_row else 0,
        "total_nc": int(ar_row[3]) if ar_row else 0,
    }

    return {"session": session, "liquidation": liq, "ar_summary": ar_summary}


async def close_session(
    db: AsyncSession,
    session_id: str,
    efectivo_declarado: Decimal,
    cheques_declarado: Decimal,
    pagares_declarado: Decimal,
    nc_aplicadas: Decimal,
    descuentos_autorizados: Decimal,
    items: list,
) -> RouteLiquidation:
    session = await db.get(RouteSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.estado != "abierta":
        raise HTTPException(status_code=409, detail="La sesión no está en estado abierta")

    cobrador_id = str(session.cobrador_id)
    fecha = session.fecha

    # efectivo_esperado: sum of efectivo payments for this cobrador today
    efectivo_sql = text("""
        SELECT COALESCE(SUM(monto), 0)
        FROM receivable_payments
        WHERE cobrador_id = :cobrador_id
          AND created_at::date AT TIME ZONE 'America/Asuncion' = :fecha
          AND tipo = 'efectivo'
    """)
    ef_result = await db.execute(efectivo_sql, {"cobrador_id": cobrador_id, "fecha": str(fecha)})
    efectivo_esperado = Decimal(ef_result.scalar() or 0)

    # total_cobrado_ar: all payments for this cobrador today
    total_sql = text("""
        SELECT COALESCE(SUM(monto), 0)
        FROM receivable_payments
        WHERE cobrador_id = :cobrador_id
          AND created_at::date AT TIME ZONE 'America/Asuncion' = :fecha
    """)
    total_result = await db.execute(total_sql, {"cobrador_id": cobrador_id, "fecha": str(fecha)})
    total_cobrado_ar = Decimal(total_result.scalar() or 0)

    liq = RouteLiquidation(
        route_session_id=session_id,
        efectivo_declarado=efectivo_declarado,
        cheques_declarado=cheques_declarado,
        pagares_declarado=pagares_declarado,
        nc_aplicadas=nc_aplicadas,
        descuentos_autorizados=descuentos_autorizados,
        efectivo_esperado=efectivo_esperado,
        total_cobrado_ar=total_cobrado_ar,
        estado="pendiente",
    )
    db.add(liq)
    await db.flush()

    for item in items:
        item_obj = RouteLiquidationItem(
            liquidation_id=str(liq.id) if liq.id else None,
            tipo=item.tipo if hasattr(item, "tipo") else item["tipo"],
            numero=item.numero if hasattr(item, "numero") else item["numero"],
            banco=getattr(item, "banco", None) or item.get("banco") if not hasattr(item, "tipo") else getattr(item, "banco", None),
            monto=item.monto if hasattr(item, "monto") else item["monto"],
            customer_id=getattr(item, "customer_id", None),
            vencimiento=getattr(item, "vencimiento", None),
        )
        db.add(item_obj)

    session.estado = "cerrada"
    session.closed_at = datetime.now(tz=timezone.utc)
    await db.flush()
    await db.commit()
    return liq


async def get_liquidation(db: AsyncSession, liquidation_id: str) -> RouteLiquidation:
    liq = await db.get(RouteLiquidation, liquidation_id)
    if not liq:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    return liq


async def authorize_liquidation(db: AsyncSession, liquidation_id: str, supervisor_id: str) -> RouteLiquidation:
    liq = await db.get(RouteLiquidation, liquidation_id)
    if not liq:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    if liq.estado != "pendiente":
        raise HTTPException(status_code=409, detail="Liquidación ya procesada")
    liq.estado = "autorizada"
    liq.supervisor_id = supervisor_id
    liq.fecha_autorizacion = datetime.now(tz=timezone.utc)
    await db.flush()
    await db.commit()
    return liq


async def observe_liquidation(
    db: AsyncSession, liquidation_id: str, supervisor_id: str, observaciones: str
) -> RouteLiquidation:
    liq = await db.get(RouteLiquidation, liquidation_id)
    if not liq:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    liq.estado = "observada"
    liq.supervisor_id = supervisor_id
    liq.observaciones = observaciones
    await db.flush()
    await db.commit()
    return liq


async def reject_liquidation(
    db: AsyncSession, liquidation_id: str, supervisor_id: str, observaciones: str
) -> RouteLiquidation:
    liq = await db.get(RouteLiquidation, liquidation_id)
    if not liq:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    liq.estado = "rechazada"
    liq.supervisor_id = supervisor_id
    liq.observaciones = observaciones
    await db.flush()
    await db.commit()
    return liq


async def get_treasury_daily_summary(db: AsyncSession, company_id: str, fecha: date) -> dict:
    # Authorized route liquidations
    rutas_sql = text("""
        SELECT rl.id, rl.efectivo_declarado, rl.cheques_declarado, rl.pagares_declarado,
               rs.cobrador_id
        FROM route_liquidations rl
        JOIN route_sessions rs ON rs.id = rl.route_session_id
        WHERE rs.company_id = :company_id
          AND rs.fecha = :fecha
          AND rl.estado = 'autorizada'
    """)
    rutas_result = await db.execute(rutas_sql, {"company_id": company_id, "fecha": str(fecha)})
    rutas_rows = rutas_result.fetchall()

    rutas = []
    total_efectivo = Decimal(0)
    total_cheques = Decimal(0)
    total_pagares = Decimal(0)
    for row in rutas_rows:
        rutas.append({
            "liquidation_id": str(row[0]),
            "cobrador_id": str(row[4]),
            "efectivo": int(row[1]),
            "cheques": int(row[2]),
            "pagares": int(row[3]),
        })
        total_efectivo += Decimal(row[1])
        total_cheques += Decimal(row[2])
        total_pagares += Decimal(row[3])

    # Retail cash sessions (read-only)
    retail_sql = text("""
        SELECT COALESCE(SUM(efectivo_contado), 0), COUNT(*)
        FROM cash_sessions
        WHERE company_id = :company_id
          AND fecha::date = :fecha
          AND estado = 'cerrada'
    """)
    retail_result = await db.execute(retail_sql, {"company_id": company_id, "fecha": str(fecha)})
    retail_row = retail_result.fetchone()
    retail = {
        "total_efectivo": int(retail_row[0]) if retail_row else 0,
        "session_count": int(retail_row[1]) if retail_row else 0,
    }
    total_efectivo += Decimal(retail.get("total_efectivo", 0))

    return {
        "fecha": fecha,
        "rutas": rutas,
        "retail": retail,
        "totales": {
            "total_efectivo": int(total_efectivo),
            "total_cheques": int(total_cheques),
            "total_pagares": int(total_pagares),
        },
    }


async def create_bank_deposit(db: AsyncSession, data: BankDepositCreate) -> BankDeposit:
    deposit = BankDeposit(
        company_id=data.company_id,
        fecha=data.fecha,
        bank_name=data.bank_name,
        account_number=data.account_number,
        monto_efectivo=data.monto_efectivo,
        monto_cheques=data.monto_cheques,
        referencia=data.referencia,
        route_liquidation_ids=data.route_liquidation_ids,
        cash_session_ids=data.cash_session_ids,
        observaciones=data.observaciones,
        created_by=data.created_by,
    )
    db.add(deposit)
    await db.flush()
    await db.commit()
    return deposit
