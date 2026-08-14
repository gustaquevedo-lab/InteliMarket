"""Caja (Cash Register) service"""

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.caja.models import CashRegister, CashSession
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
        .where(CashSession.cash_register_id == uuid.UUID(register_id))
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
        query = query.where(CashSession.cash_register_id == uuid.UUID(register_id))
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
            Sale.branch_id == session_obj.cash_register_id,
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
    existing = await get_open_session(db, str(data["cash_register_id"]))
    if existing:
        raise ValueError("Ya existe una sesi\u00f3n abierta para esta caja")

    session_obj = CashSession(**data)
    db.add(session_obj)
    await db.flush()
    await db.refresh(session_obj)
    return session_obj


async def close_session(db: AsyncSession, session_id: str, monto_cierre_real: Decimal, observaciones: str | None = None) -> CashSession | None:
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id))
    )
    session_obj = result.scalar_one_or_none()
    if not session_obj or session_obj.estado != "abierta":
        return None

    sales_result = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.branch_id == session_obj.cash_register_id,
            Sale.fecha >= session_obj.fecha_apertura,
            Sale.estado == "confirmado",
        )
    )
    total_cobrado = sales_result.scalar() or 0

    monto_cierre_esperado = Decimal(str(session_obj.monto_apertura)) + Decimal(str(total_cobrado))
    diferencia = Decimal(str(monto_cierre_real)) - monto_cierre_esperado

    session_obj.fecha_cierre = datetime.now(timezone.utc)
    session_obj.monto_cierre_esperado = monto_cierre_esperado
    session_obj.monto_cierre_real = monto_cierre_real
    session_obj.diferencia = diferencia
    session_obj.observaciones_cierre = observaciones
    session_obj.estado = "cerrada"

    await db.flush()
    await db.refresh(session_obj)
    return session_obj


# ── Liquidaciones de caja por cobrador/ruta (route_cash_settlements) ──────────

async def list_route_settlements(
    db: AsyncSession, company_id: str,
    fecha_desde=None, fecha_hasta=None, cobrador_codigo: str | None = None,
    cerrado: bool | None = None, search: str | None = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    where = "rcs.company_id = :company_id"
    params = {"company_id": company_id, "limit": limit, "offset": offset}
    if fecha_desde:
        where += " AND rcs.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND rcs.fecha <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta
    if cobrador_codigo:
        where += " AND (rcs.cobrador_codigo = :cobrador_codigo OR rcs.funcionario_codigo = :cobrador_codigo)"
        params["cobrador_codigo"] = cobrador_codigo
    if cerrado is not None:
        where += " AND rcs.cerrado = :cerrado"
        params["cerrado"] = cerrado
    if search:
        where += " AND (rcs.observaciones ILIKE :search OR rcs.codigo_legacy ILIKE :search OR rcs.cobrador_codigo ILIKE :search OR sr_cob.nombre ILIKE :search)"
        params["search"] = f"%{search}%"

    result = await db.execute(
        text(f"""
            SELECT 
                rcs.id, rcs.codigo_legacy, rcs.cobrador_codigo, rcs.funcionario_codigo,
                COALESCE(sr_cob.nombre, CASE WHEN rcs.cobrador_codigo != '0' THEN 'Cobrador #' || rcs.cobrador_codigo ELSE 'Caja Salón' END) as cobrador_nombre,
                COALESCE(sr_fun.nombre, 'Operador #' || rcs.funcionario_codigo) as funcionario_nombre,
                sr_cob.rama as cobrador_rama,
                rcs.fecha, rcs.fecha_cierre, rcs.cerrado, 
                COALESCE(rcs.a_rendir, 0) as a_rendir,
                COALESCE(rcs.total, 0) as total,
                COALESCE(rcs.efectivo, 0) as efectivo,
                COALESCE(rcs.anticipo, 0) as anticipo,
                COALESCE(rcs.descuentos, 0) as descuentos,
                COALESCE(rcs.otro_egreso, 0) as otro_egreso,
                COALESCE(rcs.otro_ingreso, 0) as otro_ingreso,
                COALESCE(rcs.pagares, 0) as pagares,
                rcs.observaciones, rcs.usuario_cierre,
                ((COALESCE(rcs.total, 0) + COALESCE(rcs.anticipo, 0) + COALESCE(rcs.descuentos, 0) + COALESCE(rcs.otro_egreso, 0) + COALESCE(rcs.otro_ingreso, 0) + COALESCE(rcs.pagares, 0)) - COALESCE(rcs.a_rendir, 0)) as diferencia
            FROM route_cash_settlements rcs
            LEFT JOIN sales_reps sr_cob ON sr_cob.funcionario_codigo = rcs.cobrador_codigo AND sr_cob.company_id = rcs.company_id
            LEFT JOIN sales_reps sr_fun ON sr_fun.funcionario_codigo = rcs.funcionario_codigo AND sr_fun.company_id = rcs.company_id
            WHERE {where}
            ORDER BY rcs.fecha DESC, rcs.id DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def get_route_settlement_detail(db: AsyncSession, company_id: str, settlement_id: str) -> dict | None:
    q_main = text("""
        SELECT 
            rcs.id, rcs.codigo_legacy, rcs.cobrador_codigo, rcs.funcionario_codigo,
            COALESCE(sr_cob.nombre, CASE WHEN rcs.cobrador_codigo != '0' THEN 'Cobrador #' || rcs.cobrador_codigo ELSE 'Caja Salón' END) as cobrador_nombre,
            COALESCE(sr_fun.nombre, 'Operador #' || rcs.funcionario_codigo) as funcionario_nombre,
            sr_cob.rama as cobrador_rama, sr_cob.cedula as cobrador_cedula,
            rcs.fecha, rcs.fecha_cierre, rcs.cerrado, 
            COALESCE(rcs.a_rendir, 0) as a_rendir,
            COALESCE(rcs.total, 0) as total,
            COALESCE(rcs.efectivo, 0) as efectivo,
            COALESCE(rcs.anticipo, 0) as anticipo,
            COALESCE(rcs.descuentos, 0) as descuentos,
            COALESCE(rcs.otro_egreso, 0) as otro_egreso,
            COALESCE(rcs.otro_ingreso, 0) as otro_ingreso,
            COALESCE(rcs.pagares, 0) as pagares,
            rcs.observaciones, rcs.usuario_cierre,
            ((COALESCE(rcs.total, 0) + COALESCE(rcs.anticipo, 0) + COALESCE(rcs.descuentos, 0) + COALESCE(rcs.otro_egreso, 0) + COALESCE(rcs.otro_ingreso, 0) + COALESCE(rcs.pagares, 0)) - COALESCE(rcs.a_rendir, 0)) as diferencia
        FROM route_cash_settlements rcs
        LEFT JOIN sales_reps sr_cob ON sr_cob.funcionario_codigo = rcs.cobrador_codigo AND sr_cob.company_id = rcs.company_id
        LEFT JOIN sales_reps sr_fun ON sr_fun.funcionario_codigo = rcs.funcionario_codigo AND sr_fun.company_id = rcs.company_id
        WHERE rcs.id = :id AND rcs.company_id = :company_id
    """)
    res = await db.execute(q_main, {"id": settlement_id, "company_id": company_id})
    row = res.fetchone()
    if not row:
        return None

    data = dict(row._mapping)

    # Fetch Detailed Movements
    q_movs = text("""
        SELECT id, fecha, monto, observaciones, recibo, moneda, created_at
        FROM route_cash_settlement_movements
        WHERE settlement_id = :id
        ORDER BY fecha DESC, id DESC
        LIMIT 100
    """)
    m_rows = (await db.execute(q_movs, {"id": settlement_id})).fetchall()
    data["movimientos"] = [dict(m._mapping) for m in m_rows]
    data["total_movimientos_count"] = len(data["movimientos"])

    return data


async def get_route_settlements_summary(db: AsyncSession, company_id: str, fecha_desde=None, fecha_hasta=None) -> dict:
    where = "company_id = :company_id"
    params = {"company_id": company_id}
    if fecha_desde:
        where += " AND fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND fecha <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta

    result = await db.execute(
        text(f"""
            SELECT
                COUNT(*) as total_liquidaciones,
                COUNT(*) FILTER (WHERE NOT cerrado) as activas_hoy,
                COUNT(*) FILTER (WHERE cerrado) as cerradas,
                COUNT(*) FILTER (WHERE cerrado AND usuario_cierre IS NOT NULL) as autorizadas_tesoreria,
                COUNT(*) FILTER (WHERE NOT cerrado OR usuario_cierre IS NULL) as pendientes_autorizacion,
                COUNT(DISTINCT cobrador_codigo) as cobradores_activos,
                COALESCE(SUM(a_rendir), 0) as total_a_rendir,
                COALESCE(SUM(total), 0) as total_liquidado,
                COALESCE(SUM(efectivo), 0) as efectivo,
                COALESCE(SUM(anticipo), 0) as anticipo,
                COALESCE(SUM(descuentos), 0) as descuentos,
                COALESCE(SUM(otro_egreso), 0) as otro_egreso,
                COALESCE(SUM(otro_ingreso), 0) as otro_ingreso,
                COALESCE(SUM(pagares), 0) as pagares,
                COALESCE(SUM((total + anticipo + descuentos + otro_egreso + otro_ingreso + pagares) - a_rendir), 0) as diferencia_neta
            FROM route_cash_settlements
            WHERE {where}
        """),
        params,
    )
    row = result.first()
    return dict(row._mapping) if row else {}


async def authorize_route_settlement(db: AsyncSession, company_id: str, settlement_id: str, usuario_tesorero: str = "Tesoreria Central", observaciones: str | None = None) -> dict | None:
    q = text("""
        UPDATE route_cash_settlements
        SET cerrado = true,
            fecha_cierre = CURRENT_DATE,
            usuario_cierre = :usuario,
            observaciones = CASE 
                WHEN :obs IS NOT NULL AND :obs != '' THEN COALESCE(observaciones, '') || ' | ' || :obs 
                ELSE observaciones 
            END
        WHERE id = :id AND company_id = :company_id
        RETURNING id, codigo_legacy, cerrado, fecha_cierre, usuario_cierre, total, efectivo
    """)
    res = await db.execute(q, {
        "id": settlement_id,
        "company_id": company_id,
        "usuario": usuario_tesorero,
        "obs": observaciones or "Autorizado por Tesorería"
    })
    row = res.fetchone()
    if not row:
        return None
    return dict(row._mapping)


async def close_route_settlement_with_count(
    db: AsyncSession, company_id: str, settlement_id: str,
    efectivo: Decimal, pagares: Decimal = Decimal(0),
    descuentos: Decimal = Decimal(0), otro_egreso: Decimal = Decimal(0),
    anticipo: Decimal = Decimal(0), observaciones: str | None = None,
    usuario: str = "Cajero"
) -> dict | None:
    total_declarado = efectivo + pagares + anticipo
    q = text("""
        UPDATE route_cash_settlements
        SET cerrado = true,
            fecha_cierre = CURRENT_DATE,
            total = :total,
            efectivo = :efectivo,
            pagares = :pagares,
            descuentos = :descuentos,
            otro_egreso = :otro_egreso,
            anticipo = :anticipo,
            usuario_cierre = :usuario,
            observaciones = CASE 
                WHEN :obs IS NOT NULL AND :obs != '' THEN COALESCE(observaciones, '') || ' | ' || :obs 
                ELSE observaciones 
            END
        WHERE id = :id AND company_id = :company_id
        RETURNING id, codigo_legacy, cerrado, a_rendir, total, efectivo, usuario_cierre
    """)
    res = await db.execute(q, {
        "id": settlement_id,
        "company_id": company_id,
        "total": float(total_declarado),
        "efectivo": float(efectivo),
        "pagares": float(pagares),
        "descuentos": float(descuentos),
        "otro_egreso": float(otro_egreso),
        "anticipo": float(anticipo),
        "usuario": usuario,
        "obs": observaciones or "Arqueo y Cierre Físico Declarado"
    })
    row = res.fetchone()
    if not row:
        return None
    return dict(row._mapping)


async def open_route_settlement(
    db: AsyncSession, company_id: str, data: dict
) -> dict:
    cobrador_codigo = str(data.get("cobrador_codigo", "0"))
    funcionario_codigo = str(data.get("funcionario_codigo", "1001"))
    a_rendir = Decimal(str(data.get("a_rendir", 0)))
    observaciones = str(data.get("observaciones", "Apertura de Caja / Ruta"))
    import uuid
    legacy_code = f"CJ-{uuid.uuid4().hex[:6].upper()}"

    q = text("""
        INSERT INTO route_cash_settlements (
            id, company_id, codigo_legacy, cobrador_codigo, funcionario_codigo,
            fecha, cerrado, a_rendir, total, efectivo, anticipo, descuentos,
            otro_egreso, otro_ingreso, pagares, observaciones, created_at
        ) VALUES (
            gen_random_uuid(), :company_id, :codigo_legacy, :cobrador, :funcionario,
            CURRENT_DATE, false, :a_rendir, 0, 0, 0, 0, 0, 0, 0, :obs, NOW()
        )
        RETURNING id, codigo_legacy, cobrador_codigo, funcionario_codigo, fecha, cerrado, a_rendir, observaciones
    """)
    res = await db.execute(q, {
        "company_id": company_id,
        "codigo_legacy": legacy_code,
        "cobrador": cobrador_codigo,
        "funcionario": funcionario_codigo,
        "a_rendir": float(a_rendir),
        "obs": observaciones
    })
    row = res.fetchone()
    return dict(row._mapping)
