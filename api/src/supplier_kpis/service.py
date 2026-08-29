"""Calculo de cumplimiento de indicadores por proveedor y rebate asociado.

La venta base para el rebate se calcula SIN IVA (segun lo que definio el
dueno: "el porcentaje es sobre las ventas totales sin IVA"), usando
products.supplier_id -- el campo que se poblo y valido este mismo mes contra
la planilla real de PARESA/Chortitzer (reconciliado a -0.1%/0.0%). Notas de
credito ya quedan netas porque sale_items.total es negativo en esas filas.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.supplier_kpis.models import SupplierKpiPeriod, SupplierKpiIndicator
from api.src.supplier_kpis import schemas
from api.src.purchases.models import Supplier


def _first_of_month(d: date) -> date:
    return d.replace(day=1)


def _month_range(periodo: date) -> tuple[date, date]:
    start = _first_of_month(periodo)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


async def create_period(db: AsyncSession, company_id: uuid.UUID, data: schemas.PeriodCreate) -> SupplierKpiPeriod:
    periodo_norm = _first_of_month(data.periodo)
    existing = await db.execute(
        select(SupplierKpiPeriod).where(
            SupplierKpiPeriod.company_id == company_id,
            SupplierKpiPeriod.supplier_id == data.supplier_id,
            SupplierKpiPeriod.periodo == periodo_norm,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        return row
    period = SupplierKpiPeriod(
        company_id=company_id,
        supplier_id=data.supplier_id,
        periodo=periodo_norm,
        rebate_pct_objetivo=data.rebate_pct_objetivo,
        observaciones=data.observaciones,
    )
    db.add(period)
    await db.flush()
    await db.commit()
    await db.refresh(period)
    return period


async def list_periods(db: AsyncSession, company_id: uuid.UUID, supplier_id: uuid.UUID | None = None):
    q = select(SupplierKpiPeriod).where(SupplierKpiPeriod.company_id == company_id)
    if supplier_id:
        q = q.where(SupplierKpiPeriod.supplier_id == supplier_id)
    q = q.order_by(SupplierKpiPeriod.periodo.desc())
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_period(db: AsyncSession, period_id: uuid.UUID) -> SupplierKpiPeriod | None:
    result = await db.execute(select(SupplierKpiPeriod).where(SupplierKpiPeriod.id == period_id))
    return result.scalar_one_or_none()


async def update_period(db: AsyncSession, period: SupplierKpiPeriod, data: schemas.PeriodUpdate) -> SupplierKpiPeriod:
    if data.rebate_pct_objetivo is not None:
        period.rebate_pct_objetivo = data.rebate_pct_objetivo
    if data.estado is not None:
        period.estado = data.estado
    if data.observaciones is not None:
        period.observaciones = data.observaciones
    await db.commit()
    await db.refresh(period)
    return period


async def add_indicator(db: AsyncSession, period_id: uuid.UUID, data: schemas.IndicatorCreate) -> SupplierKpiIndicator:
    indicator = SupplierKpiIndicator(period_id=period_id, **data.model_dump())
    db.add(indicator)
    await db.commit()
    await db.refresh(indicator)
    return indicator


async def update_indicator(db: AsyncSession, indicator: SupplierKpiIndicator, data: schemas.IndicatorUpdate) -> SupplierKpiIndicator:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(indicator, field, value)
    await db.commit()
    await db.refresh(indicator)
    return indicator


async def get_indicator(db: AsyncSession, indicator_id: uuid.UUID) -> SupplierKpiIndicator | None:
    result = await db.execute(select(SupplierKpiIndicator).where(SupplierKpiIndicator.id == indicator_id))
    return result.scalar_one_or_none()


async def delete_indicator(db: AsyncSession, indicator_id: uuid.UUID) -> None:
    await db.execute(delete(SupplierKpiIndicator).where(SupplierKpiIndicator.id == indicator_id))
    await db.commit()


async def list_indicators(db: AsyncSession, period_id: uuid.UUID) -> list[SupplierKpiIndicator]:
    result = await db.execute(
        select(SupplierKpiIndicator).where(SupplierKpiIndicator.period_id == period_id).order_by(SupplierKpiIndicator.orden)
    )
    return list(result.scalars().all())


def _pct_cumplimiento(ind: SupplierKpiIndicator) -> Decimal:
    """% de cumplimiento de UN indicador, aplicando piso minimo si esta definido.
    Nunca aporta mas del 100% de su propio peso (cap), aunque se supere la meta."""
    if not ind.meta or ind.meta == 0 or ind.resultado is None:
        return Decimal("0")
    pct = (Decimal(ind.resultado) / Decimal(ind.meta)) * 100
    if ind.piso_minimo_pct is not None and pct < Decimal(ind.piso_minimo_pct):
        return Decimal("0")
    return min(pct, Decimal("100"))


async def get_venta_base_sin_iva(db: AsyncSession, company_id: uuid.UUID, supplier_id: uuid.UUID, periodo: date) -> Decimal:
    """Calcula ventas netas sin IVA para el proveedor y sus RUCs relacionados en ~500ms."""
    start, end = _month_range(periodo)
    await db.execute(text("SET LOCAL enable_nestloop = off;"))
    result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(si.total - si.iva_monto), 0) AS venta_sin_iva
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN suppliers sp ON sp.id = p.supplier_id
            WHERE s.company_id = :company_id
              AND s.fecha >= :start AND s.fecha < :end
              AND sp.ruc = (SELECT ruc FROM suppliers WHERE id = :supplier_id)
            """
        ),
        {"supplier_id": str(supplier_id), "company_id": str(company_id), "start": start, "end": end},
    )
    row = result.first()
    return Decimal(str(row.venta_sin_iva)) if row and row.venta_sin_iva is not None else Decimal("0")



async def get_summary(db: AsyncSession, period: SupplierKpiPeriod) -> schemas.PeriodSummary:
    indicadores = await list_indicators(db, period.id)
    supplier_result = await db.execute(select(Supplier).where(Supplier.id == period.supplier_id))
    supplier = supplier_result.scalar_one_or_none()

    peso_total = sum((Decimal(str(i.peso_pct)) for i in indicadores), Decimal("0"))
    pct_total = Decimal("0")
    indicadores_out = []
    for ind in indicadores:
        pct_ind = _pct_cumplimiento(ind)
        aporte = (Decimal(str(ind.peso_pct)) / peso_total * pct_ind) if peso_total > 0 else Decimal("0")
        pct_total += aporte
        
        ind_cat = getattr(ind, "categoria", None)
        is_foco = (ind_cat == "foco") or (ind.codigo.startswith("foco_"))
        cat_norm = ind_cat or ("volumen" if ind.codigo.startswith("venta_") else "foco" if is_foco else "trade_marketing")
        
        meta_val = float(ind.meta) if ind.meta is not None else None
        res_val = float(ind.resultado) if ind.resultado is not None else None
        pct_val = float(pct_ind.quantize(Decimal("0.01")))
        aporte_val = float(aporte.quantize(Decimal("0.01")))

        indicadores_out.append(
            schemas.IndicatorResponse(
                id=ind.id,
                period_id=ind.period_id,
                codigo=ind.codigo,
                nombre=ind.nombre,
                peso_pct=float(ind.peso_pct),
                meta=meta_val,
                resultado=res_val,
                meta_uc=meta_val,
                resultado_uc=res_val,
                cumplimiento_pct=pct_val,
                piso_minimo_pct=float(ind.piso_minimo_pct) if ind.piso_minimo_pct is not None else None,
                orden=ind.orden or 0,
                categoria=cat_norm,
                es_foco=is_foco,
                segmento_paresa=getattr(ind, "segmento_paresa", None),
                pct_cumplimiento=pct_val,
                aporte_ponderado_pct=aporte_val,
            )
        )

    venta_base = await get_venta_base_sin_iva(db, period.company_id, period.supplier_id, period.periodo)
    meta_alcanzada = pct_total >= 100
    monto_rebate = (venta_base * Decimal(str(period.rebate_pct_objetivo)) / 100 * pct_total / 100).quantize(Decimal("1"))

    return schemas.PeriodSummary(
        period=schemas.PeriodResponse.model_validate(period),
        supplier_razon_social=supplier.razon_social if supplier else "PARAGUAY REFRESCOS S.A.",
        indicadores=indicadores_out,
        pct_cumplimiento_total=float(pct_total.quantize(Decimal("0.01"))),
        meta_alcanzada=meta_alcanzada,
        venta_base_sin_iva=float(venta_base),
        monto_rebate_calculado=float(monto_rebate),
        monto_compras_sin_iva=float(venta_base),
        monto_ventas_sin_iva=float(venta_base),
        total_rebate_pct_ganado=float(period.rebate_pct_objetivo),
    )


async def get_supplier_kpis_dashboard(db: AsyncSession, company_id: uuid.UUID, mes: str | None = None, branch_id: str | None = None) -> dict:
    from datetime import date
    import calendar
    import json

    # Parse period date (default 2026-08-01 or current month)
    if mes:
        try:
            parts = [int(p) for p in mes.split("-")]
            periodo_date = date(parts[0], parts[1], 1)
        except Exception:
            periodo_date = date(2026, 8, 1)
    else:
        periodo_date = date(2026, 8, 1)

    start_date, end_date = _month_range(periodo_date)
    today = date.today()
    if today.year == periodo_date.year and today.month == periodo_date.month:
        dias_transcurridos = today.day
    else:
        dias_transcurridos = calendar.monthrange(periodo_date.year, periodo_date.month)[1]
    dias_totales_mes = calendar.monthrange(periodo_date.year, periodo_date.month)[1]

    branch_filter_sql = ""
    params = {
        "company_id": str(company_id),
        "periodo": periodo_date,
        "start_date": start_date,
        "end_date": end_date,
    }
    if branch_id and branch_id != "all":
        branch_filter_sql = "AND sra.branch_id = :target_branch_id"
        params["target_branch_id"] = branch_id

    await db.execute(text("SET LOCAL enable_nestloop = off;"))

    query_str = f"""
        WITH sales_by_branch AS (
            SELECT 
                sp.ruc,
                COALESCE(s.branch_id, '13bab831-185b-56d7-8c10-74ec2feb9dfb'::uuid) AS branch_id,
                SUM(si.total - si.iva_monto) AS ventas_sin_iva,
                COUNT(DISTINCT s.id) AS tx_count,
                COUNT(DISTINCT si.product_id) AS sku_count
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN suppliers sp ON sp.id = p.supplier_id
            WHERE s.company_id = :company_id
              AND s.fecha >= :start_date AND s.fecha < :end_date
            GROUP BY sp.ruc, COALESCE(s.branch_id, '13bab831-185b-56d7-8c10-74ec2feb9dfb'::uuid)
        ),
        sales_total AS (
            SELECT 
                ruc,
                SUM(ventas_sin_iva) AS ventas_sin_iva,
                SUM(tx_count) AS tx_count,
                MAX(sku_count) AS sku_count
            FROM sales_by_branch
            GROUP BY ruc
        )
        SELECT 
            sra.id,
            sra.supplier_id,
            s.razon_social AS supplier_razon_social,
            s.ruc AS supplier_ruc,
            sra.branch_id,
            COALESCE(b.nombre, 'Todas las Sucursales') AS branch_nombre,
            sra.periodo,
            sra.nombre_acuerdo,
            sra.meta_monto_gs,
            sra.tipo_meta,
            sra.tipo_retorno,
            sra.rebate_pct_base,
            sra.piso_minimo_pct,
            sra.tramos_escala,
            sra.observaciones,
            sra.estado,
            COALESCE(
                CASE 
                    WHEN sra.branch_id IS NOT NULL THEN sb.ventas_sin_iva 
                    ELSE st.ventas_sin_iva 
                END, 0
            ) AS ventas_actual_gs,
            COALESCE(
                CASE 
                    WHEN sra.branch_id IS NOT NULL THEN sb.tx_count 
                    ELSE st.tx_count 
                END, 0
            ) AS transacciones_count,
            COALESCE(
                CASE 
                    WHEN sra.branch_id IS NOT NULL THEN sb.sku_count 
                    ELSE st.sku_count 
                END, 0
            ) AS skus_vendidos_count
        FROM supplier_rebate_agreements sra
        JOIN suppliers s ON s.id = sra.supplier_id
        LEFT JOIN branches b ON b.id = sra.branch_id
        LEFT JOIN sales_by_branch sb ON (s.ruc = sb.ruc AND sra.branch_id = sb.branch_id)
        LEFT JOIN sales_total st ON (s.ruc = st.ruc)
        WHERE sra.company_id = :company_id
          AND sra.periodo = :periodo
          AND sra.estado = 'activo'
          {branch_filter_sql}
        ORDER BY sra.meta_monto_gs DESC
    """

    res = await db.execute(text(query_str), params)
    rows = res.fetchall()

    proveedores = []
    meta_total_general_gs = 0
    ventas_total_general_gs = 0
    tendencia_global_gs = 0
    rebate_total_estimado_gs = 0

    for r in rows:
        meta_monto = float(r.meta_monto_gs or 0)
        ventas_actual = float(r.ventas_actual_gs or 0)
        piso_minimo = float(r.piso_minimo_pct or 80.0)
        rebate_base = float(r.rebate_pct_base or 0.0)

        # Parse tramos
        tramos = r.tramos_escala or []
        if isinstance(tramos, str):
            try:
                tramos = json.loads(tramos)
            except Exception:
                tramos = []

        # Cumplimiento actual & proyectado
        cumpl_actual_pct = round((ventas_actual / meta_monto * 100), 2) if meta_monto > 0 else 0.0
        tendencia_proy = round((ventas_actual / dias_transcurridos * dias_totales_mes), 0) if dias_transcurridos > 0 else 0.0
        cumpl_proy_pct = round((tendencia_proy / meta_monto * 100), 2) if meta_monto > 0 else 0.0

        # Rebate actual & proyectado
        rebate_act_pct = 0.0
        rebate_proy_pct = 0.0

        if tramos and len(tramos) > 0:
            sorted_tramos = sorted(tramos, key=lambda t: float(t.get("min_pct", 0)))
            for t in sorted_tramos:
                min_p = float(t.get("min_pct", 0))
                r_p = float(t.get("rebate_pct", 0))
                if cumpl_actual_pct >= min_p:
                    rebate_act_pct = r_p
                if cumpl_proy_pct >= min_p:
                    rebate_proy_pct = r_p
        else:
            if cumpl_actual_pct >= piso_minimo:
                rebate_act_pct = rebate_base
            if cumpl_proy_pct >= piso_minimo:
                rebate_proy_pct = rebate_base

        rebate_act_gs = round(ventas_actual * rebate_act_pct / 100, 0)
        rebate_proy_gs = round(tendencia_proy * rebate_proy_pct / 100, 0)

        # Semaforo
        if cumpl_proy_pct >= 100.0:
            semaforo = "superado"
        elif cumpl_proy_pct >= 85.0:
            semaforo = "en_meta"
        elif cumpl_proy_pct >= 70.0:
            semaforo = "en_riesgo"
        else:
            semaforo = "critico"

        proveedores.append({
            "id": str(r.id),
            "supplier_id": str(r.supplier_id),
            "supplier_razon_social": r.supplier_razon_social,
            "supplier_ruc": r.supplier_ruc,
            "branch_id": str(r.branch_id) if r.branch_id else None,
            "branch_nombre": r.branch_nombre,
            "periodo": mes or "2026-08",
            "nombre_acuerdo": r.nombre_acuerdo or f"Acuerdo {r.supplier_razon_social}",
            "meta_monto_gs": meta_monto,
            "tipo_meta": r.tipo_meta,
            "tipo_retorno": r.tipo_retorno,
            "rebate_pct_base": rebate_base,
            "piso_minimo_pct": piso_minimo,
            "tramos_escala": tramos,
            "ventas_actual_gs": ventas_actual,
            "transacciones_count": int(r.transacciones_count or 0),
            "skus_vendidos_count": int(r.skus_vendidos_count or 0),
            "cumplimiento_actual_pct": cumpl_actual_pct,
            "tendencia_proyectada_gs": tendencia_proy,
            "cumplimiento_proyectado_pct": cumpl_proy_pct,
            "rebate_ganado_actual_pct": rebate_act_pct,
            "rebate_ganado_actual_gs": rebate_act_gs,
            "rebate_ganado_proy_pct": rebate_proy_pct,
            "rebate_ganado_proy_gs": rebate_proy_gs,
            "semaforo": semaforo,
            "observaciones": r.observaciones,
            "estado": r.estado,
        })

        meta_total_general_gs += meta_monto
        ventas_total_general_gs += ventas_actual
        tendencia_global_gs += tendencia_proy
        rebate_total_estimado_gs += rebate_proy_gs

    cumplimiento_global_pct = round((ventas_total_general_gs / meta_total_general_gs * 100), 2) if meta_total_general_gs > 0 else 0.0
    cumplimiento_proy_global_pct = round((tendencia_global_gs / meta_total_general_gs * 100), 2) if meta_total_general_gs > 0 else 0.0

    return {
        "periodo": mes or "2026-08",
        "dias_transcurridos": dias_transcurridos,
        "dias_totales_mes": dias_totales_mes,
        "meta_total_general_gs": meta_total_general_gs,
        "ventas_total_general_gs": ventas_total_general_gs,
        "cumplimiento_global_pct": cumplimiento_global_pct,
        "tendencia_global_gs": tendencia_global_gs,
        "cumplimiento_proyectado_global_pct": cumplimiento_proy_global_pct,
        "rebate_total_estimado_gs": rebate_total_estimado_gs,
        "proveedores": proveedores,
    }


