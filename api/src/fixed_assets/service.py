"""Fixed Assets (Activos Fijos) service — registro, depreciación en línea
recta, posteo real de asiento contable via create_manual_entry (reusa el
motor ya construido en Contabilidad Integrada, no reinventa el posteo)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timezone, datetime
from decimal import Decimal
import calendar
import uuid

from api.src.fixed_assets.models import FixedAsset

ACC_ACTIVOS_FIJOS = ("1.1.06", "Activos Fijos", "activo")
ACC_DEPRECIACION_ACUMULADA = ("1.1.07", "Depreciación Acumulada", "activo")
ACC_GASTO_DEPRECIACION = "6.1.06"  # ya existe (Depreciaciones), ver integrated_finance/auto_posting.py


def _valor_libros(a: FixedAsset) -> Decimal:
    return Decimal(str(a.valor_adquisicion)) - Decimal(str(a.depreciacion_acumulada))


def _to_response(a: FixedAsset) -> dict:
    return {
        "id": a.id, "company_id": a.company_id, "nombre": a.nombre, "categoria": a.categoria,
        "fecha_adquisicion": a.fecha_adquisicion, "valor_adquisicion": a.valor_adquisicion,
        "valor_residual": a.valor_residual, "vida_util_meses": a.vida_util_meses,
        "meses_depreciados": a.meses_depreciados, "depreciacion_acumulada": a.depreciacion_acumulada,
        "valor_libros": _valor_libros(a), "estado": a.estado,
        "fecha_baja": a.fecha_baja, "motivo_baja": a.motivo_baja, "created_at": a.created_at,
    }


async def _get_or_create_account(db: AsyncSession, company_id: str, codigo: str, nombre: str, tipo: str) -> uuid.UUID:
    from api.src.integrated_finance.models import AccountPlan

    result = await db.execute(
        select(AccountPlan).where(AccountPlan.company_id == uuid.UUID(company_id), AccountPlan.codigo == codigo)
    )
    acc = result.scalar_one_or_none()
    if acc:
        return acc.id
    acc = AccountPlan(company_id=company_id, codigo=codigo, nombre=nombre, tipo=tipo, nivel=3, acepta_asientos=True)
    db.add(acc)
    await db.flush()
    return acc.id


async def create_asset(db: AsyncSession, company_id: str, data) -> dict:
    asset = FixedAsset(
        company_id=company_id,
        nombre=data.nombre,
        categoria=data.categoria,
        fecha_adquisicion=data.fecha_adquisicion,
        valor_adquisicion=data.valor_adquisicion,
        valor_residual=data.valor_residual,
        vida_util_meses=data.vida_util_meses,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return _to_response(asset)


async def list_assets(db: AsyncSession, company_id: str, estado: str | None = None) -> list[dict]:
    query = select(FixedAsset).where(FixedAsset.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(FixedAsset.estado == estado)
    query = query.order_by(FixedAsset.fecha_adquisicion.desc())
    result = await db.execute(query)
    return [_to_response(a) for a in result.scalars().all()]


async def get_asset(db: AsyncSession, company_id: str, asset_id: str) -> dict | None:
    result = await db.execute(
        select(FixedAsset).where(FixedAsset.id == uuid.UUID(asset_id), FixedAsset.company_id == uuid.UUID(company_id))
    )
    asset = result.scalar_one_or_none()
    return _to_response(asset) if asset else None


async def retire_asset(db: AsyncSession, company_id: str, asset_id: str, motivo: str, fecha_baja: date | None) -> dict | None:
    result = await db.execute(
        select(FixedAsset).where(FixedAsset.id == uuid.UUID(asset_id), FixedAsset.company_id == uuid.UUID(company_id))
    )
    asset = result.scalar_one_or_none()
    if not asset or asset.estado == "dado_de_baja":
        return None
    asset.estado = "dado_de_baja"
    asset.motivo_baja = motivo
    asset.fecha_baja = fecha_baja or date.today()
    await db.commit()
    await db.refresh(asset)
    return _to_response(asset)


async def post_monthly_depreciation(db: AsyncSession, company_id: str, periodo: str, user_id: str | None = None) -> dict:
    """periodo = 'YYYY-MM'. Postea un asiento por cada activo activo que
    todavia no completo su vida util y no fue depreciado en este periodo."""
    from api.src.integrated_finance.service import create_manual_entry
    from api.src.integrated_finance.schemas import ManualEntryCreate, ManualEntryLine

    year, month = (int(p) for p in periodo.split("-"))
    ultimo_dia = calendar.monthrange(year, month)[1]
    fecha_asiento = date(year, month, ultimo_dia)

    result = await db.execute(
        select(FixedAsset).where(
            FixedAsset.company_id == uuid.UUID(company_id),
            FixedAsset.estado == "activo",
        )
    )
    assets = list(result.scalars().all())

    acc_gasto_id = await _get_or_create_account(db, company_id, ACC_GASTO_DEPRECIACION, "Depreciaciones", "gasto")
    acc_acumulada_id = await _get_or_create_account(db, company_id, *ACC_DEPRECIACION_ACUMULADA)
    await db.commit()

    posteados = 0
    omitidos = 0
    for asset in assets:
        if asset.ultima_depreciacion_periodo == periodo:
            omitidos += 1
            continue
        if asset.meses_depreciados >= asset.vida_util_meses:
            omitidos += 1
            continue

        base = Decimal(str(asset.valor_adquisicion)) - Decimal(str(asset.valor_residual))
        cuota = (base / asset.vida_util_meses).quantize(Decimal("1"))
        if cuota <= 0:
            omitidos += 1
            continue

        entry_data = ManualEntryCreate(
            fecha=fecha_asiento,
            concepto=f"Depreciación {periodo} — {asset.nombre}",
            lines=[
                ManualEntryLine(account_id=str(acc_gasto_id), tipo="debe", monto=float(cuota), concepto=asset.nombre),
                ManualEntryLine(account_id=str(acc_acumulada_id), tipo="haber", monto=float(cuota), concepto=asset.nombre),
            ],
        )
        posted = await create_manual_entry(db, company_id, entry_data, user_id or "00000000-0000-0000-0000-000000000000")
        if "error" in posted:
            omitidos += 1
            continue

        asset.meses_depreciados += 1
        asset.depreciacion_acumulada = Decimal(str(asset.depreciacion_acumulada)) + cuota
        asset.ultima_depreciacion_periodo = periodo
        posteados += 1

    await db.commit()
    return {"periodo": periodo, "posteados": posteados, "omitidos": omitidos, "total_activos": len(assets)}
