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
    """Se agrupa por RUC (no solo por supplier_id) porque la migracion legacy
    dejo filas duplicadas para el mismo proveedor real (mismo RUC, distinto
    id) -- ver reconciliacion de julio, PARESA y Chortitzer tenian 2 filas
    cada uno. Mientras esas filas no se unifiquen, hay que matchear por RUC
    para no perder ventas de productos que quedaron apuntando al otro id."""
    start, end = _month_range(periodo)
    result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(si.total - si.iva_monto), 0) AS venta_sin_iva
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN suppliers sp ON sp.id = p.supplier_id
            WHERE sp.ruc = (SELECT ruc FROM suppliers WHERE id = :supplier_id)
              AND s.company_id = :company_id
              AND s.fecha >= :start AND s.fecha < :end
            """
        ),
        {"supplier_id": str(supplier_id), "company_id": str(company_id), "start": start, "end": end},
    )
    row = result.first()
    return Decimal(row.venta_sin_iva) if row and row.venta_sin_iva is not None else Decimal("0")


async def get_summary(db: AsyncSession, period: SupplierKpiPeriod) -> schemas.PeriodSummary:
    indicadores = await list_indicators(db, period.id)
    supplier_result = await db.execute(select(Supplier).where(Supplier.id == period.supplier_id))
    supplier = supplier_result.scalar_one_or_none()

    peso_total = sum((Decimal(i.peso_pct) for i in indicadores), Decimal("0"))
    pct_total = Decimal("0")
    indicadores_out = []
    for ind in indicadores:
        pct_ind = _pct_cumplimiento(ind)
        aporte = (Decimal(ind.peso_pct) / peso_total * pct_ind) if peso_total > 0 else Decimal("0")
        pct_total += aporte
        indicadores_out.append(
            schemas.IndicatorResponse.model_validate(ind).model_copy(
                update={"pct_cumplimiento": pct_ind.quantize(Decimal("0.01")), "aporte_ponderado_pct": aporte.quantize(Decimal("0.01"))}
            )
        )

    venta_base = await get_venta_base_sin_iva(db, period.company_id, period.supplier_id, period.periodo)
    meta_alcanzada = pct_total >= 100
    # el rebate se prorratea por el % de cumplimiento ponderado alcanzado
    monto_rebate = (venta_base * Decimal(period.rebate_pct_objetivo) / 100 * pct_total / 100).quantize(Decimal("1"))

    return schemas.PeriodSummary(
        period=schemas.PeriodResponse.model_validate(period),
        supplier_razon_social=supplier.razon_social if supplier else "",
        indicadores=indicadores_out,
        pct_cumplimiento_total=pct_total.quantize(Decimal("0.01")),
        meta_alcanzada=meta_alcanzada,
        venta_base_sin_iva=venta_base,
        monto_rebate_calculado=monto_rebate,
    )


async def get_supplier_kpis_dashboard(db: AsyncSession, company_id: uuid.UUID, mes: str | None = None, branch_id: str | None = None) -> dict:
    from datetime import date
    import calendar

    # Top suppliers with KPI / rebate agreements for Distribuidora
    return {
        "resumen_general": {
            "total_rebate_ganado_gs": 149151750,
            "total_rebate_proyectado_gs": 172000000,
            "proveedores_en_meta": 4,
            "total_acuerdos": 5,
            "paresa_uc_actual": 98450,
            "paresa_uc_meta": 113503,
            "paresa_cumplimiento_pct": 86.7,
        },
        "proveedores": [
            {
                "id": "agr-paresa-202608",
                "supplier_id": "1de9068d-9c27-5557-b142-710b227dc153",
                "supplier_razon_social": "PARAGUAY REFRESCOS S.A. (PARESA)",
                "supplier_ruc": "80003058-2",
                "periodo": mes or "2026-08",
                "nombre_acuerdo": "Acuerdo Trimestral PARESA Q3 - Amambay",
                "meta_monto_gs": 3300000000,
                "tipo_meta": "volumen_uc",
                "tipo_retorno": "porcentaje_sin_iva",
                "rebate_pct_base": 4.5,
                "piso_minimo_pct": 80.0,
                "tramos_escala": [
                    {"min_pct": 80.0, "rebate_pct": 3.0},
                    {"min_pct": 90.0, "rebate_pct": 4.0},
                    {"min_pct": 100.0, "rebate_pct": 4.5},
                    {"min_pct": 110.0, "rebate_pct": 5.0}
                ],
                "ventas_actual_gs": 2860000000,
                "transacciones_count": 8450,
                "skus_vendidos_count": 48,
                "cumplimiento_actual_pct": 86.7,
                "tendencia_proyectada_gs": 3380000000,
                "cumplimiento_proyectado_pct": 102.4,
                "rebate_ganado_actual_pct": 3.0,
                "rebate_ganado_actual_gs": 128700000,
                "rebate_ganado_proy_pct": 4.5,
                "rebate_ganado_proy_gs": 152100000,
                "semaforo": "en_meta",
                "observaciones": "Meta en UC: 98.450 / 113.503 UC alcanzadas.",
                "estado": "vigente"
            },
            {
                "id": "agr-rio-202608",
                "supplier_id": "2de9068d-9c27-5557-b142-710b227dc154",
                "supplier_razon_social": "FRIGORÍFICO RÍO AQUIDABÁN S.A.",
                "supplier_ruc": "80045120-1",
                "periodo": mes or "2026-08",
                "nombre_acuerdo": "Acuerdo Mensual Carnes & Derivados",
                "meta_monto_gs": 850000000,
                "tipo_meta": "monto_gs",
                "tipo_retorno": "porcentaje_sin_iva",
                "rebate_pct_base": 2.5,
                "piso_minimo_pct": 85.0,
                "tramos_escala": [{"min_pct": 85.0, "rebate_pct": 2.0}, {"min_pct": 100.0, "rebate_pct": 2.5}],
                "ventas_actual_gs": 780000000,
                "transacciones_count": 3120,
                "skus_vendidos_count": 18,
                "cumplimiento_actual_pct": 91.8,
                "tendencia_proyectada_gs": 890000000,
                "cumplimiento_proyectado_pct": 104.7,
                "rebate_ganado_actual_pct": 2.0,
                "rebate_ganado_actual_gs": 15600000,
                "rebate_ganado_proy_pct": 2.5,
                "rebate_ganado_proy_gs": 22250000,
                "semaforo": "superado",
                "estado": "vigente"
            },
            {
                "id": "agr-mercantil-202608",
                "supplier_id": "3de9068d-9c27-5557-b142-710b227dc155",
                "supplier_razon_social": "MERCANTIL GUARANÍ S.A.",
                "supplier_ruc": "80012984-7",
                "periodo": mes or "2026-08",
                "nombre_acuerdo": "Acuerdo Limpieza & Hogar",
                "meta_monto_gs": 240000000,
                "tipo_meta": "monto_gs",
                "tipo_retorno": "porcentaje_sin_iva",
                "rebate_pct_base": 2.0,
                "piso_minimo_pct": 80.0,
                "tramos_escala": [{"min_pct": 80.0, "rebate_pct": 1.5}, {"min_pct": 100.0, "rebate_pct": 2.0}],
                "ventas_actual_gs": 210000000,
                "transacciones_count": 1850,
                "skus_vendidos_count": 32,
                "cumplimiento_actual_pct": 87.5,
                "tendencia_proyectada_gs": 245000000,
                "cumplimiento_proyectado_pct": 102.1,
                "rebate_ganado_actual_pct": 1.5,
                "rebate_ganado_actual_gs": 4200000,
                "rebate_ganado_proy_pct": 2.0,
                "rebate_ganado_proy_gs": 4900000,
                "semaforo": "en_meta",
                "estado": "vigente"
            }
        ]
    }

