"""Sales targets (metas de venta) — service.

Scoping por rol se aplica aca (no solo en el router): un vendedor solo ve
su propia fila, un supervisor ve su equipo, gerente_comercial/admin ven todo.
"""

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.sales_targets.models import (
    SalesRep, ProductLine, SalesTarget, SalesTargetCascadeConfig, SalesTargetHistoryBaseline,
)
from api.src.sales_targets.schemas import (
    SalesRepCreate, SalesRepUpdate, CascadeConfigUpdate, SalesTargetCreate, SalesTargetUpdate,
    SuggestTargetsRequest,
)


async def get_own_rep(db: AsyncSession, user_id: str) -> SalesRep | None:
    result = await db.execute(select(SalesRep).where(SalesRep.user_id == uuid.UUID(user_id)))
    return result.scalar_one_or_none()


async def list_sales_reps_scoped(db: AsyncSession, company_id: str, user: dict) -> list[SalesRep]:
    """Lista de sales_reps visibles segun el rol del usuario autenticado."""
    rol = user.get("rol")
    if user.get("is_superadmin") or rol in ("admin", "super_admin", "gerente_comercial"):
        result = await db.execute(select(SalesRep).where(SalesRep.company_id == uuid.UUID(company_id)))
        return list(result.scalars().all())

    own = await get_own_rep(db, user.get("sub"))
    if not own:
        return []

    if rol == "supervisor":
        result = await db.execute(
            select(SalesRep).where(
                SalesRep.company_id == uuid.UUID(company_id),
                (SalesRep.supervisor_id == own.id) | (SalesRep.id == own.id),
            )
        )
        return list(result.scalars().all())

    # vendedor: solo su propia fila
    return [own]


async def get_sales_rep(db: AsyncSession, rep_id: str) -> SalesRep | None:
    result = await db.execute(select(SalesRep).where(SalesRep.id == uuid.UUID(rep_id)))
    return result.scalar_one_or_none()


async def create_sales_rep(db: AsyncSession, company_id: str, data: SalesRepCreate) -> SalesRep:
    rep = SalesRep(
        company_id=uuid.UUID(company_id),
        nombre=data.nombre,
        cedula=data.cedula,
        rama=data.rama,
        rol=data.rol,
        supervisor_id=data.supervisor_id,
        activo=True,
    )
    db.add(rep)
    await db.flush()
    await db.refresh(rep)
    return rep


async def update_sales_rep(db: AsyncSession, rep_id: str, data: SalesRepUpdate) -> SalesRep | None:
    rep = await get_sales_rep(db, rep_id)
    if not rep:
        return None
    update_fields = data.model_dump(exclude_unset=True)
    for key, value in update_fields.items():
        setattr(rep, key, value)
    await db.flush()
    await db.refresh(rep)
    return rep


async def list_product_lines(db: AsyncSession, company_id: str) -> list[ProductLine]:
    result = await db.execute(
        select(ProductLine).where(ProductLine.company_id == uuid.UUID(company_id), ProductLine.activo == True)
        .order_by(ProductLine.nombre)
    )
    return list(result.scalars().all())


async def get_cascade_config(db: AsyncSession, company_id: str) -> SalesTargetCascadeConfig:
    result = await db.execute(
        select(SalesTargetCascadeConfig).where(SalesTargetCascadeConfig.company_id == uuid.UUID(company_id))
    )
    config = result.scalar_one_or_none()
    if not config:
        config = SalesTargetCascadeConfig(company_id=uuid.UUID(company_id), umbral_pct=80, activo=True)
        db.add(config)
        await db.flush()
        await db.refresh(config)
    return config


async def update_cascade_config(db: AsyncSession, company_id: str, data: CascadeConfigUpdate) -> SalesTargetCascadeConfig:
    config = await get_cascade_config(db, company_id)
    config.umbral_pct = data.umbral_pct
    if data.activo is not None:
        config.activo = data.activo
    await db.flush()
    await db.refresh(config)
    return config


# ── Metas (sales_targets) ──────────────────────────────────────────────────

async def create_sales_target(db: AsyncSession, company_id: str, data: SalesTargetCreate, created_by: str) -> SalesTarget:
    target = SalesTarget(
        company_id=uuid.UUID(company_id),
        sales_rep_id=data.sales_rep_id,
        periodo_tipo=data.periodo_tipo,
        periodo_inicio=data.periodo_inicio,
        periodo_fin=data.periodo_fin,
        product_line_id=data.product_line_id,
        monto_gs=data.monto_gs,
        cantidad_unidades=data.cantidad_unidades,
        origen=data.origen,
        created_by=uuid.UUID(created_by) if created_by else None,
    )
    db.add(target)
    await db.flush()
    await db.refresh(target)
    return target


async def update_sales_target(db: AsyncSession, target_id: str, data: SalesTargetUpdate) -> SalesTarget | None:
    result = await db.execute(select(SalesTarget).where(SalesTarget.id == uuid.UUID(target_id)))
    target = result.scalar_one_or_none()
    if not target:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(target, key, value)
    await db.flush()
    await db.refresh(target)
    return target


async def list_sales_targets(db: AsyncSession, company_id: str, sales_rep_id: str | None = None) -> list[SalesTarget]:
    query = select(SalesTarget).where(SalesTarget.company_id == uuid.UUID(company_id))
    if sales_rep_id:
        query = query.where(SalesTarget.sales_rep_id == uuid.UUID(sales_rep_id))
    query = query.order_by(SalesTarget.periodo_inicio.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


# ── Motor de progreso ────────────────────────────────────────────────────
#
# venta_gs/unidades se calculan con SIGN(sales.total) sobre cantidad —
# mismo ajuste que se aplico en gerencial/service.py::get_ranking() esta
# misma sesion: sale_items.cantidad se guarda siempre en positivo (magnitud)
# incluso en notas de credito, que solo llevan el signo real en `total`.
# Sin este ajuste una devolucion sumaria unidades como si fuera venta nueva.

async def _real_sales(db: AsyncSession, company_id: str, vendedor_codigo: str,
                       periodo_inicio: date, periodo_fin: date, product_line_id: str | None) -> tuple[Decimal, Decimal]:
    # hasta_exclusiva calculado en Python — s.fecha (timestamptz) < :hasta + INTERVAL
    # en SQL con parametro `date` de asyncpg tira "operator does not exist:
    # timestamp with time zone < interval" (mismo problema ya visto antes esta
    # sesion en scripts de verificacion ad-hoc).
    hasta_exclusiva = periodo_fin + timedelta(days=1)
    params = {
        "company_id": company_id, "vendedor_codigo": vendedor_codigo,
        "desde": periodo_inicio, "hasta": hasta_exclusiva,
    }
    linea_filter = ""
    if product_line_id:
        linea_filter = "AND p.linea_id = :linea_id"
        params["linea_id"] = product_line_id

    query = text(f"""
        SELECT
            COALESCE(SUM(si.total), 0) AS venta_gs,
            COALESCE(SUM(SIGN(si.total) * si.cantidad), 0) AS unidades
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        JOIN products p ON p.id = si.product_id
        WHERE s.company_id = :company_id
          AND s.vendedor_codigo = :vendedor_codigo
          AND s.fecha >= :desde AND s.fecha < :hasta
          AND s.estado <> 'anulado'
          {linea_filter}
    """)
    result = await db.execute(query, params)
    row = result.first()
    return Decimal(row.venta_gs or 0), Decimal(row.unidades or 0)


async def get_rep_progress(db: AsyncSession, rep: SalesRep, periodo_inicio: date, periodo_fin: date,
                            product_line_id: str | None = None) -> dict:
    # Si se pide una linea puntual, esa fila especifica. Si no, se SUMA todo
    # lo que haya cargado para el periodo (normalmente una sola fila total
    # con product_line_id=NULL, pero es tolerante a que ademas existan filas
    # de desglose por linea sin duplicar el total del vendedor).
    meta_gs, meta_unidades = Decimal("0"), Decimal("0")
    if rep.funcionario_codigo:
        target_query = select(
            func.coalesce(func.sum(SalesTarget.monto_gs), 0),
            func.coalesce(func.sum(SalesTarget.cantidad_unidades), 0),
        ).where(
            SalesTarget.sales_rep_id == rep.id,
            SalesTarget.periodo_inicio == periodo_inicio,
            SalesTarget.periodo_fin == periodo_fin,
        )
        if product_line_id:
            target_query = target_query.where(SalesTarget.product_line_id == product_line_id)
        else:
            target_query = target_query.where(SalesTarget.product_line_id.is_(None))
        result = await db.execute(target_query)
        row = result.first()
        if row:
            meta_gs, meta_unidades = Decimal(row[0]), Decimal(row[1])

    venta_gs, unidades = (Decimal("0"), Decimal("0"))
    if rep.funcionario_codigo:
        venta_gs, unidades = await _real_sales(
            db, str(rep.company_id), rep.funcionario_codigo, periodo_inicio, periodo_fin, product_line_id
        )

    pct_gs = round((venta_gs / meta_gs) * 100, 1) if meta_gs > 0 else Decimal("0")
    pct_unidades = round((unidades / meta_unidades) * 100, 1) if meta_unidades > 0 else Decimal("0")

    return {
        "sales_rep_id": rep.id, "nombre": rep.nombre,
        "periodo_inicio": str(periodo_inicio), "periodo_fin": str(periodo_fin),
        "venta_gs": venta_gs, "unidades": unidades,
        "meta_gs": meta_gs, "meta_unidades": meta_unidades,
        "pct_gs": pct_gs, "pct_unidades": pct_unidades,
        "cumplido": pct_gs >= 100,
    }


# ── Motor de cascada ─────────────────────────────────────────────────────

async def get_cascade_status(db: AsyncSession, lider: SalesRep, periodo_inicio: date, periodo_fin: date) -> dict:
    """Estado de cascada de un lider (supervisor sobre sus vendedores, o
    gerente sobre sus supervisores): cumple si el % de su equipo ACTIVO que
    alcanzo su meta individual (>=100%) supera el umbral configurable."""
    config = await get_cascade_config(db, str(lider.company_id))

    result = await db.execute(
        select(SalesRep).where(SalesRep.supervisor_id == lider.id, SalesRep.activo == True)
    )
    equipo = list(result.scalars().all())

    progresos = [await get_rep_progress(db, r, periodo_inicio, periodo_fin) for r in equipo]
    cumplieron = sum(1 for p in progresos if p["cumplido"])
    pct_equipo = round((Decimal(cumplieron) / len(equipo)) * 100, 1) if equipo else Decimal("0")

    return {
        "lider_id": lider.id, "lider_nombre": lider.nombre,
        "umbral_pct": config.umbral_pct,
        "equipo_total": len(equipo), "equipo_cumplieron": cumplieron,
        "pct_equipo_cumplio": pct_equipo,
        "cascada_cumplida": pct_equipo >= config.umbral_pct if equipo else False,
        "equipo": progresos,
    }


# ── Forecast (baseline estadistico) ─────────────────────────────────────

async def list_baseline(db: AsyncSession, company_id: str, mes: int | None = None) -> list[dict]:
    query = select(SalesTargetHistoryBaseline, ProductLine.nombre).join(
        ProductLine, ProductLine.id == SalesTargetHistoryBaseline.product_line_id
    ).where(SalesTargetHistoryBaseline.company_id == uuid.UUID(company_id))
    if mes:
        query = query.where(SalesTargetHistoryBaseline.mes == mes)
    query = query.order_by(ProductLine.nombre, SalesTargetHistoryBaseline.mes)
    result = await db.execute(query)
    rows = result.all()
    out = []
    for baseline, nombre in rows:
        tendencia = baseline.tendencia_pct or Decimal("0")
        sugerido = (baseline.promedio_gs or Decimal("0")) * (1 + tendencia / 100)
        out.append({
            "product_line_id": baseline.product_line_id, "linea_nombre": nombre, "mes": baseline.mes,
            "promedio_gs": baseline.promedio_gs or Decimal("0"),
            "promedio_unidades": baseline.promedio_unidades or Decimal("0"),
            "tendencia_pct": tendencia, "desvio_gs": baseline.desvio_gs or Decimal("0"),
            "objetivo_legacy_ref_gs": baseline.objetivo_legacy_ref_gs,
            "sugerido_gs": round(sugerido),
        })
    return out


async def suggest_targets(db: AsyncSession, company_id: str, req: SuggestTargetsRequest) -> list[dict]:
    """Meta TOTAL simple por vendedor (un numero en Gs por periodo, sin
    fragmentar en filas por linea) — se prorratea internamente el baseline
    de cada linea segun la participacion historica real del vendedor en esa
    linea y se suma todo, pero lo que se devuelve/publica es un unico total
    por vendedor. El desglose por linea queda solo como informacion
    secundaria (`desglose`) para quien quiera verlo, no como filas separadas.
    No persiste — es un preview; publicar es un paso aparte."""
    baseline = await list_baseline(db, company_id, req.mes_referencia)
    ajuste = 1 + (req.ajuste_manual_pct / 100)

    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == uuid.UUID(company_id), SalesRep.rol == "vendedor", SalesRep.activo == True,
            SalesRep.funcionario_codigo.is_not(None),
        )
    )
    vendedores = list(result.scalars().all())

    # Una sola query agregada para TODAS las lineas de una — el diseño
    # original hacia una query por linea (N+1: ~70+ queries de agregacion
    # sobre 11,6M filas cada una), tardaba mas de 90s. Agrupar todo junto
    # y prorratear en Python es lo mismo trabajo de agregacion pero en un
    # solo scan.
    shares_result = await db.execute(text("""
        SELECT p.linea_id, s.vendedor_codigo, SUM(si.total) AS venta
        FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
        WHERE s.company_id = :company_id AND s.estado <> 'anulado'
          AND s.vendedor_codigo IS NOT NULL AND p.linea_id IS NOT NULL
        GROUP BY p.linea_id, s.vendedor_codigo
    """), {"company_id": company_id})

    venta_por_linea_vendedor = defaultdict(dict)
    for row in shares_result.all():
        v = float(row.venta or 0)
        if v > 0:
            venta_por_linea_vendedor[str(row.linea_id)][row.vendedor_codigo] = v

    # Acumular por vendedor: {rep_id: {"monto_gs":..., "cantidad_unidades":..., "desglose":[...]}}
    por_vendedor: dict = {}
    for b in baseline:
        if not b["sugerido_gs"] or b["sugerido_gs"] <= 0:
            continue
        linea_id = str(b["product_line_id"])
        venta_por_vendedor = venta_por_linea_vendedor.get(linea_id, {})
        total_linea = sum(venta_por_vendedor.values())
        if total_linea <= 0:
            continue

        meta_total_gs = b["sugerido_gs"] * ajuste
        meta_total_unidades = (b["promedio_unidades"] or Decimal("0")) * ajuste

        for rep in vendedores:
            venta_rep = venta_por_vendedor.get(rep.funcionario_codigo, 0)
            if venta_rep <= 0:
                continue
            share = Decimal(str(venta_rep / total_linea))
            monto_linea = round(meta_total_gs * share)
            unidades_linea = round(meta_total_unidades * share, 2)

            acc = por_vendedor.setdefault(rep.id, {
                "sales_rep_id": rep.id, "nombre": rep.nombre, "rama": rep.rama,
                "monto_gs": Decimal("0"), "cantidad_unidades": Decimal("0"), "desglose": [],
            })
            acc["monto_gs"] += monto_linea
            acc["cantidad_unidades"] += unidades_linea
            if monto_linea > 0:
                acc["desglose"].append({"linea_nombre": b["linea_nombre"], "monto_gs": monto_linea})

    return list(por_vendedor.values())


async def publish_suggested_targets(db: AsyncSession, company_id: str, req: SuggestTargetsRequest, created_by: str) -> int:
    """Publica UNA meta total por vendedor (product_line_id=NULL) — simple,
    sin fragmentar por linea. El desglose por linea del preview es solo
    informativo, no se persiste como filas separadas."""
    sugeridas = await suggest_targets(db, company_id, req)
    rows = []
    for s in sugeridas:
        if s["monto_gs"] <= 0:
            continue
        rows.append(SalesTarget(
            company_id=uuid.UUID(company_id), sales_rep_id=s["sales_rep_id"],
            periodo_tipo=req.periodo_tipo, periodo_inicio=req.periodo_inicio, periodo_fin=req.periodo_fin,
            product_line_id=None, monto_gs=s["monto_gs"], cantidad_unidades=s["cantidad_unidades"],
            origen="ajustado" if req.ajuste_manual_pct else "forecast",
            created_by=uuid.UUID(created_by) if created_by else None,
        ))
    db.add_all(rows)
    await db.flush()
    return len(rows)
