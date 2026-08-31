from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import uuid

from api.src.plugpay.models import PlugpayTransaction


async def log_transaction(db: AsyncSession, company_id: str, **kwargs) -> PlugpayTransaction:
    row = PlugpayTransaction(company_id=uuid.UUID(company_id), **kwargs)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def link_sale(db: AsyncSession, txn_id: str, sale_id: str) -> PlugpayTransaction | None:
    result = await db.execute(select(PlugpayTransaction).where(PlugpayTransaction.id == uuid.UUID(txn_id)))
    row = result.scalar_one_or_none()
    if not row:
        return None
    row.sale_id = uuid.UUID(sale_id)
    await db.commit()
    await db.refresh(row)
    return row


async def list_transactions(
    db: AsyncSession,
    company_id: str,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    tipo_operacion: str | None = None,
    exitosa: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[PlugpayTransaction], int]:
    conditions = [PlugpayTransaction.company_id == uuid.UUID(company_id)]

    if fecha_desde:
        conditions.append(PlugpayTransaction.created_at >= fecha_desde)
    if fecha_hasta:
        conditions.append(PlugpayTransaction.created_at <= fecha_hasta)
    if tipo_operacion and tipo_operacion != "all":
        conditions.append(PlugpayTransaction.tipo_operacion == tipo_operacion)
    if exitosa is not None:
        conditions.append(PlugpayTransaction.exitosa == exitosa)

    # Count total
    count_query = select(func.count(PlugpayTransaction.id)).where(and_(*conditions))
    total_result = await db.execute(count_query)
    total = total_result.scalar_one() or 0

    # Query items
    query = (
        select(PlugpayTransaction)
        .where(and_(*conditions))
        .order_by(desc(PlugpayTransaction.created_at))
        .limit(limit)
        .offset(offset)
    )
    items_result = await db.execute(query)
    items = list(items_result.scalars().all())

    return items, total


async def get_summary(
    db: AsyncSession,
    company_id: str,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
) -> dict:
    conditions = [PlugpayTransaction.company_id == uuid.UUID(company_id)]
    if fecha_desde:
        conditions.append(PlugpayTransaction.created_at >= fecha_desde)
    if fecha_hasta:
        conditions.append(PlugpayTransaction.created_at <= fecha_hasta)

    query = select(PlugpayTransaction).where(and_(*conditions))
    result = await db.execute(query)
    rows = result.scalars().all()

    total_transacciones = len(rows)
    total_exitosas = 0
    total_fallidas = 0
    volumen_pix_brl = 0.0
    volumen_pix_pyg = 0.0
    volumen_parcelado_brl = 0.0
    volumen_parcelado_pyg = 0.0
    transacciones_con_venta = 0

    for r in rows:
        if r.sale_id:
            transacciones_con_venta += 1

        if r.exitosa:
            total_exitosas += 1
            brl = float(r.value_brl or 0.0)
            pyg = float(r.monto_origen or 0.0) if (r.moneda_origen == "PYG" or not r.moneda_origen) else 0.0

            if r.tipo_operacion == "pix":
                volumen_pix_brl += brl
                volumen_pix_pyg += pyg
            elif r.tipo_operacion == "credito_parcelado":
                volumen_parcelado_brl += brl
                volumen_parcelado_pyg += pyg
        else:
            total_fallidas += 1

    tasa_exito_pct = (
        round((total_exitosas / total_transacciones) * 100, 2)
        if total_transacciones > 0
        else 0.0
    )

    return {
        "ok": True,
        "total_transacciones": total_transacciones,
        "total_exitosas": total_exitosas,
        "total_fallidas": total_fallidas,
        "tasa_exito_pct": tasa_exito_pct,
        "volumen_pix_brl": round(volumen_pix_brl, 2),
        "volumen_pix_pyg": round(volumen_pix_pyg, 2),
        "volumen_parcelado_brl": round(volumen_parcelado_brl, 2),
        "volumen_parcelado_pyg": round(volumen_parcelado_pyg, 2),
        "total_volumen_brl": round(volumen_pix_brl + volumen_parcelado_brl, 2),
        "total_volumen_pyg": round(volumen_pix_pyg + volumen_parcelado_pyg, 2),
        "transacciones_con_venta": transacciones_con_venta,
    }

