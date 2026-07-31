"""Caja (Cash Register) service"""

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.caja.models import CashRegister, CashSession, CashCount, CashRegisterMovement
from api.src.sales.models import Sale, SalePayment


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
        cajero_nombre=data.get("cajero_nombre"),
        monto_apertura=data.get("monto_apertura", 0),
    )
    db.add(session_obj)
    await db.flush()
    await db.refresh(session_obj)
    return session_obj


async def _efectivo_esperado_por_moneda(db: AsyncSession, session_id, moneda: str) -> Decimal:
    """Efectivo recibido en una moneda durante la sesion (sin conversion — el
    legado tampoco convierte, cada moneda de caja se cuenta por separado)."""
    result = await db.execute(
        select(func.coalesce(func.sum(SalePayment.monto), 0))
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(
            Sale.session_id == session_id,
            SalePayment.forma_pago == "EFECTIVO",
            SalePayment.moneda == moneda,
        )
    )
    return Decimal(str(result.scalar() or 0))


async def close_session(
    db: AsyncSession,
    session_id: str,
    monto_cierre_real: Decimal,
    monto_cierre_usd: Decimal = Decimal("0"),
    monto_cierre_brl: Decimal = Decimal("0"),
    observaciones: str | None = None,
) -> dict | None:
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

    efectivo_usd_esperado = await _efectivo_esperado_por_moneda(db, session_obj.id, "USD")
    efectivo_brl_esperado = await _efectivo_esperado_por_moneda(db, session_obj.id, "BRL")
    diferencia_usd = monto_cierre_usd - efectivo_usd_esperado
    diferencia_brl = monto_cierre_brl - efectivo_brl_esperado

    register_result = await db.execute(select(CashRegister).where(CashRegister.id == session_obj.register_id))
    register = register_result.scalar_one_or_none()
    requiere_revision = bool(
        register and register.diferencia_maxima_tolerada is not None
        and abs(diferencia) > register.diferencia_maxima_tolerada
    )

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
        monto_efectivo_usd=monto_cierre_usd,
        monto_efectivo_brl=monto_cierre_brl,
        diferencia_usd=diferencia_usd,
        diferencia_brl=diferencia_brl,
    ))
    await db.flush()
    await db.refresh(session_obj)

    return {
        "session": session_obj,
        "monto_cierre_esperado": monto_cierre_esperado,
        "diferencia": diferencia,
        "diferencia_usd": diferencia_usd,
        "diferencia_brl": diferencia_brl,
        "requiere_revision": requiere_revision,
    }


async def list_register_movements(db: AsyncSession, company_id: str, tipo: str | None = None, limit: int = 100) -> list[dict]:
    query = select(CashRegisterMovement).where(CashRegisterMovement.company_id == uuid.UUID(company_id))
    if tipo:
        query = query.where(CashRegisterMovement.tipo == tipo)
    query = query.order_by(CashRegisterMovement.fecha.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(m.id),
            "register_id": str(m.register_id),
            "tipo": m.tipo,
            "monto": float(m.monto),
            "moneda": m.moneda,
            "fecha": m.fecha.isoformat(),
            "usuario": m.usuario,
            "observaciones": m.observaciones,
        }
        for m in result.scalars().all()
    ]


async def list_sessions_with_totals(
    db: AsyncSession,
    company_id: str,
    register_id: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Sesiones con el monto realmente cobrado (ventas confirmadas vinculadas
    a la sesion real, no una aproximacion por sucursal) y alerta de cash drop."""
    query = select(CashSession).join(CashRegister, CashRegister.id == CashSession.register_id).where(
        CashRegister.company_id == uuid.UUID(company_id)
    )
    if register_id:
        query = query.where(CashSession.register_id == uuid.UUID(register_id))
    if estado:
        query = query.where(CashSession.estado == estado)
    query = query.order_by(CashSession.fecha_apertura.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    sessions = list(result.scalars().all())

    out = []
    for s in sessions:
        cobrado_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total), 0)).where(
                Sale.session_id == s.id,
                Sale.estado == "confirmado",
            )
        )
        monto_cobrado = float(cobrado_result.scalar() or 0)

        cash_drop_alert = False
        efectivo_acumulado = 0.0
        efectivo_usd_acumulado = 0.0
        efectivo_brl_acumulado = 0.0
        if s.estado == "abierta":
            register_result = await db.execute(select(CashRegister).where(CashRegister.id == s.register_id))
            register = register_result.scalar_one_or_none()
            if register:
                desde = s.ultimo_cash_drop_at or s.fecha_apertura
                # Los pagos sincronizados del legado solo tienen granularidad de dia
                # (fin_recebimento.DT_RECEBIMENTO es DATE, sin hora) — comparar por
                # dia en vez de timestamp exacto, o una sesion abierta hoy nunca
                # verian sus propios cobros de hoy (medianoche < hora de apertura).
                # Solo PYG entra en el acumulado que dispara la alerta — el efectivo
                # en USD/BRL se informa aparte, sin mezclarlo (el legado tampoco
                # convierte moneda al arquear).
                monedas_result = await db.execute(
                    select(SalePayment.moneda, func.coalesce(func.sum(SalePayment.monto), 0))
                    .select_from(SalePayment)
                    .join(Sale, Sale.id == SalePayment.sale_id)
                    .where(
                        Sale.session_id == s.id,
                        SalePayment.forma_pago == "EFECTIVO",
                        func.date(SalePayment.fecha) >= func.date(desde),
                    )
                    .group_by(SalePayment.moneda)
                )
                por_moneda = {row[0]: float(row[1]) for row in monedas_result.all()}
                efectivo_acumulado = por_moneda.get("PYG", 0.0)
                efectivo_usd_acumulado = por_moneda.get("USD", 0.0)
                efectivo_brl_acumulado = por_moneda.get("BRL", 0.0)
                if register.cash_drop_threshold:
                    cash_drop_alert = efectivo_acumulado >= float(register.cash_drop_threshold)

        # Arqueo real (CashCount) — antes el historial calculaba una
        # "diferencia" en el frontend como monto_cierre - monto_apertura (eso
        # es la recaudacion del turno, no un descuadre de caja) y nunca
        # mostraba el diferencia real ya sincronizado del legado.
        diferencia = None
        diferencia_usd = None
        diferencia_brl = None
        monto_cierre_esperado = None
        if s.estado == "cerrada":
            count_result = await db.execute(
                select(CashCount).where(CashCount.session_id == s.id).order_by(CashCount.created_at.desc()).limit(1)
            )
            count = count_result.scalar_one_or_none()
            if count:
                diferencia = float(count.diferencia) if count.diferencia is not None else None
                diferencia_usd = float(count.diferencia_usd) if count.diferencia_usd is not None else None
                diferencia_brl = float(count.diferencia_brl) if count.diferencia_brl is not None else None
            monto_cierre_esperado = float(s.monto_apertura) + monto_cobrado

        out.append({
            "id": str(s.id),
            "register_id": str(s.register_id),
            "user_id": str(s.user_id),
            "cajero_nombre": s.cajero_nombre,
            "fecha_apertura": s.fecha_apertura.isoformat(),
            "fecha_cierre": s.fecha_cierre.isoformat() if s.fecha_cierre else None,
            "monto_apertura": float(s.monto_apertura),
            "monto_cierre": float(s.monto_cierre) if s.monto_cierre is not None else None,
            "monto_cierre_esperado": monto_cierre_esperado,
            "diferencia": diferencia,
            "diferencia_usd": diferencia_usd,
            "diferencia_brl": diferencia_brl,
            "monto_cobrado": monto_cobrado,
            "estado": s.estado,
            "cash_drop_alert": cash_drop_alert,
            "efectivo_acumulado": efectivo_acumulado,
            "efectivo_usd_acumulado": efectivo_usd_acumulado,
            "efectivo_brl_acumulado": efectivo_brl_acumulado,
            "ultimo_cash_drop_at": s.ultimo_cash_drop_at.isoformat() if s.ultimo_cash_drop_at else None,
        })
    return out


async def get_session_payment_breakdown(db: AsyncSession, session_id: str) -> dict:
    """Desglose por forma de pago. Se separa PYG (base de los % mostrados) de
    otras monedas (USD/BRL) — mezclarlas en un mismo total daria un porcentaje
    sin sentido, ya que el legado tampoco convierte esos montos."""
    result = await db.execute(
        select(
            SalePayment.forma_pago,
            SalePayment.moneda,
            func.count().label("cantidad"),
            func.sum(SalePayment.monto).label("monto"),
        )
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(Sale.session_id == uuid.UUID(session_id))
        .group_by(SalePayment.forma_pago, SalePayment.moneda)
        .order_by(func.sum(SalePayment.monto).desc())
    )
    rows = result.all()
    pyg_rows = [r for r in rows if r.moneda == "PYG"]
    otras_rows = [r for r in rows if r.moneda != "PYG"]
    total_pyg = float(sum(r.monto for r in pyg_rows)) or 1
    return {
        "pyg": [
            {
                "forma_pago": r.forma_pago,
                "cantidad": r.cantidad,
                "monto": float(r.monto),
                "porcentaje": round((float(r.monto) / total_pyg) * 100, 1),
            }
            for r in pyg_rows
        ],
        "otras_monedas": [
            {
                "forma_pago": r.forma_pago,
                "moneda": r.moneda,
                "cantidad": r.cantidad,
                "monto": float(r.monto),
            }
            for r in otras_rows
        ],
    }


async def register_cash_drop(db: AsyncSession, session_id: str, monto: Decimal, observaciones: str | None = None) -> CashRegisterMovement | None:
    result = await db.execute(select(CashSession).where(CashSession.id == uuid.UUID(session_id)))
    session_obj = result.scalar_one_or_none()
    if not session_obj or session_obj.estado != "abierta":
        return None

    register_result = await db.execute(select(CashRegister).where(CashRegister.id == session_obj.register_id))
    register = register_result.scalar_one_or_none()

    movement = CashRegisterMovement(
        company_id=register.company_id,
        register_id=session_obj.register_id,
        tipo="retiro",
        monto=monto,
        moneda="PYG",
        fecha=datetime.now(timezone.utc),
        observaciones=f"Cash drop sesión {session_id}" + (f" — {observaciones}" if observaciones else ""),
    )
    db.add(movement)
    session_obj.ultimo_cash_drop_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(movement)
    return movement
