"""Fase 2 — Supplier Returns & Backhaul service"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import SupplierReturn, SupplierReturnItem, ReturnAuthorization, BackhaulSchedule
from .schemas_fase2 import SupplierReturnResponse
from api.src.purchases.models import Supplier
from api.src.financial.models import SupplierReturn as FinancialSupplierReturn, SupplierCreditNote


def _enrich_return(r: SupplierReturn, proveedor_nombre: Optional[str] = None) -> SupplierReturn:
    if proveedor_nombre:
        setattr(r, "proveedor_nombre", proveedor_nombre)
    val = r.valor_total_estimado or Decimal(0)
    nc = r.nota_credito_monto or Decimal(0)
    perd = r.monto_perdida or Decimal(0)
    setattr(r, "saldo_pendiente", max(Decimal(0), val - nc - perd))
    return r


# ---------------------------------------------------------------------------
# RETURNS
# ---------------------------------------------------------------------------

async def list_returns(company_id: UUID, db: AsyncSession, estado: Optional[str] = None, proveedor_id: Optional[UUID] = None):
    q = (
        select(SupplierReturn, Supplier.razon_social.label("proveedor_nombre"))
        .outerjoin(Supplier, Supplier.id == SupplierReturn.proveedor_id)
        .options(selectinload(SupplierReturn.items))
        .where(SupplierReturn.company_id == company_id)
    )
    if estado:
        q = q.where(SupplierReturn.estado == estado)
    if proveedor_id:
        q = q.where(SupplierReturn.proveedor_id == proveedor_id)
    q = q.order_by(SupplierReturn.fecha_creacion.desc())
    result = await db.execute(q)
    rows = result.all()
    return [_enrich_return(r, prov_nom) for r, prov_nom in rows]


async def get_return(return_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(SupplierReturn, Supplier.razon_social.label("proveedor_nombre"))
        .outerjoin(Supplier, Supplier.id == SupplierReturn.proveedor_id)
        .options(selectinload(SupplierReturn.items))
        .where(SupplierReturn.id == return_id)
    )
    row = result.first()
    if row:
        r, prov_nom = row
        return _enrich_return(r, prov_nom)

    # Fallback to FinancialSupplierReturn (tabla supplier_returns)
    res_fin = await db.execute(
        select(FinancialSupplierReturn, Supplier.razon_social.label("proveedor_nombre"))
        .outerjoin(Supplier, Supplier.id == FinancialSupplierReturn.supplier_id)
        .where(FinancialSupplierReturn.id == return_id)
    )
    row_fin = res_fin.first()
    if not row_fin:
        raise HTTPException(404, "Supplier return not found")

    fr, prov_nom = row_fin
    fecha_dt = datetime.combine(fr.fecha, datetime.min.time()) if isinstance(fr.fecha, date) and not isinstance(fr.fecha, datetime) else (fr.fecha or datetime.utcnow())
    is_anulado = bool(fr.observaciones and ("[ANULADO]" in fr.observaciones or "[ARCHIVADO]" in fr.observaciones))
    return SupplierReturnResponse(
        id=fr.id,
        proveedor_id=fr.supplier_id,
        proveedor_nombre=prov_nom or "Proveedor",
        codigo=fr.numero_factura_origen or f"DEV-{str(fr.id)[:8].upper()}",
        tipo="devolucion_fisica",
        fecha_creacion=fecha_dt,
        fecha_estimada_retiro=None,
        total_items=0,
        valor_total_estimado=fr.monto,
        nota_credito_numero=fr.numero_nota_credito,
        nota_credito_monto=None,
        notas_credito=[],
        monto_perdida=None,
        motivo_perdida=None,
        enviado_a_perdida=False,
        saldo_pendiente=Decimal(0) if is_anulado else (fr.monto or Decimal(0)),
        estado="anulado" if is_anulado else "pendiente",
        autorizado_por=None,
        autorizado_at=None,
        completado_por=None,
        completado_at=None,
        observaciones=fr.observaciones,
        items=[],
        created_at=fr.created_at or datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


async def create_return(company_id: UUID, data, db: AsyncSession):
    r = SupplierReturn(company_id=company_id, **data.model_dump(exclude={"items"}, exclude_none=True))
    db.add(r)
    await db.flush()
    for item_data in data.items or []:
        item = SupplierReturnItem(return_id=r.id, **item_data.model_dump(exclude_none=True))
        item.valor_total = None
        if item.valor_unitario and item.cantidad:
            item.valor_total = item.valor_unitario * item.cantidad
        db.add(item)
    await db.commit()
    return await get_return(r.id, db)


async def update_return(return_id: UUID, data, db: AsyncSession):
    r = await get_return(return_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    await db.commit()
    return await get_return(return_id, db)


async def authorize_return(return_id: UUID, user_id: UUID, db: AsyncSession):
    r = await get_return(return_id, db)
    r.estado = "autorizado"
    r.autorizado_por = user_id
    r.autorizado_at = datetime.utcnow()
    await db.commit()
    return await get_return(return_id, db)


async def complete_return(return_id: UUID, user_id: UUID, db: AsyncSession):
    r = await get_return(return_id, db)
    r.estado = "completado"
    r.completado_por = user_id
    r.completado_at = datetime.utcnow()
    # Calculate total
    total = sum(item.valor_total or 0 for item in r.items)
    r.valor_total_estimado = total
    r.total_items = len(r.items)
    await db.commit()
    return await get_return(return_id, db)


async def cancel_return(return_id: UUID, user_id: Optional[UUID], db: AsyncSession, motivo: Optional[str] = None):
    # 1. Buscar en supermer_supplier_returns
    result = await db.execute(
        select(SupplierReturn, Supplier.razon_social.label("proveedor_nombre"))
        .outerjoin(Supplier, Supplier.id == SupplierReturn.proveedor_id)
        .options(selectinload(SupplierReturn.items))
        .where(SupplierReturn.id == return_id)
    )
    row = result.first()
    if row:
        r, prov_nom = row
        r.estado = "anulado"
        r.rechazado_por = user_id
        r.rechazado_at = datetime.utcnow()
        r.motivo_rechazo = motivo or "Anulado/Archivado manualmente desde Gestión Financiera"
        r.observaciones = f"{(r.observaciones or '').strip()} [Archivado/Anulado manualmente]".strip()
        await db.commit()
        return _enrich_return(r, prov_nom)

    # 2. Si no está en supermer_supplier_returns, buscar en supplier_returns (financiero)
    res_fin = await db.execute(
        select(FinancialSupplierReturn, Supplier.razon_social.label("proveedor_nombre"))
        .outerjoin(Supplier, Supplier.id == FinancialSupplierReturn.supplier_id)
        .where(FinancialSupplierReturn.id == return_id)
    )
    row_fin = res_fin.first()
    if not row_fin:
        raise HTTPException(404, "Supplier return not found")

    fr, prov_nom = row_fin
    tag = "[ANULADO]"
    current_obs = (fr.observaciones or "").strip()
    if tag not in current_obs:
        fr.observaciones = f"{current_obs} {tag} - {motivo or 'Archivado manualmente desde Gestión Financiera'}".strip()
    await db.commit()

    fecha_dt = datetime.combine(fr.fecha, datetime.min.time()) if isinstance(fr.fecha, date) and not isinstance(fr.fecha, datetime) else (fr.fecha or datetime.utcnow())
    return SupplierReturnResponse(
        id=fr.id,
        proveedor_id=fr.supplier_id,
        proveedor_nombre=prov_nom or "Proveedor",
        codigo=fr.numero_factura_origen or f"DEV-{str(fr.id)[:8].upper()}",
        tipo="devolucion_fisica",
        fecha_creacion=fecha_dt,
        fecha_estimada_retiro=None,
        total_items=0,
        valor_total_estimado=fr.monto,
        nota_credito_numero=fr.numero_nota_credito,
        nota_credito_monto=None,
        notas_credito=[],
        monto_perdida=None,
        motivo_perdida=None,
        enviado_a_perdida=False,
        saldo_pendiente=Decimal(0),
        estado="anulado",
        autorizado_por=None,
        autorizado_at=None,
        completado_por=None,
        completado_at=None,
        observaciones=fr.observaciones,
        items=[],
        created_at=fr.created_at or datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


async def add_return_credit_note(return_id: UUID, data, company_id: UUID, db: AsyncSession):
    import uuid

    # 1. Buscar en supermer_supplier_returns
    result = await db.execute(
        select(SupplierReturn, Supplier.razon_social.label("proveedor_nombre"))
        .outerjoin(Supplier, Supplier.id == SupplierReturn.proveedor_id)
        .options(selectinload(SupplierReturn.items))
        .where(SupplierReturn.id == return_id)
    )
    row = result.first()
    if row:
        r, prov_nom = row
        nc_entry = {
            "id": str(uuid.uuid4()),
            "fecha": str(data.fecha or date.today()),
            "monto": float(data.monto),
            "motivo": data.motivo or f"Nota de Crédito sobre {r.codigo}",
            "numero": data.numero.strip(),
            "timbrado": data.timbrado.strip(),
            "cdc": (data.cdc or "").strip() or None,
            "observaciones": (data.observaciones or "").strip() or None,
            "ya_reconocida": True,
            "factura_numero": None,
        }

        current_ncs = list(r.notas_credito or [])
        current_ncs.append(nc_entry)
        r.notas_credito = current_ncs

        total_nc = sum(Decimal(str(x.get("monto", 0))) for x in current_ncs)
        r.nota_credito_monto = total_nc
        r.nota_credito_numero = ", ".join(dict.fromkeys(x.get("numero") for x in current_ncs if x.get("numero")))

        if data.monto_perdida is not None and data.monto_perdida >= 0:
            r.monto_perdida = data.monto_perdida
            if data.monto_perdida > 0:
                r.enviado_a_perdida = True

        total_val = r.valor_total_estimado or Decimal(0)
        perdida = r.monto_perdida or Decimal(0)
        saldo = max(Decimal(0), total_val - total_nc - perdida)

        if saldo <= Decimal(0):
            r.estado = "completado"
        else:
            r.estado = "acreditado_parcial"

        # Registrar en SupplierCreditNote si no existe ya
        existing_nc = (await db.execute(
            select(SupplierCreditNote).where(
                SupplierCreditNote.company_id == company_id,
                SupplierCreditNote.supplier_id == r.proveedor_id,
                SupplierCreditNote.numero == data.numero.strip(),
                SupplierCreditNote.timbrado == data.timbrado.strip(),
                SupplierCreditNote.cancelado == False,
            )
        )).scalar_one_or_none()

        if not existing_nc:
            new_scn = SupplierCreditNote(
                company_id=company_id,
                supplier_id=r.proveedor_id,
                numero=data.numero.strip(),
                numero_factura_origen=r.codigo,
                timbrado=data.timbrado.strip(),
                fecha=data.fecha or date.today(),
                fecha_recepcion=date.today(),
                motivo=f"Devolución {r.codigo} - {data.motivo or 'Mercadería Vencida / Averiada'}"[:150],
                motivo_categoria="devolucion_vencimiento",
                impacto_contable="recuperacion_merma",
                monto=data.monto,
                saldo_disponible=data.monto,
                moneda="PYG",
                observaciones=data.observaciones or f"Generada por acreditación (parcial/total) de devolución {r.codigo}",
            )
            db.add(new_scn)

        await db.commit()
        return _enrich_return(r, prov_nom)

    # 2. Si no es de supermer_supplier_returns, verificar en supplier_returns (financiero)
    res_fin = await db.execute(
        select(FinancialSupplierReturn, Supplier.razon_social.label("proveedor_nombre"))
        .outerjoin(Supplier, Supplier.id == FinancialSupplierReturn.supplier_id)
        .where(FinancialSupplierReturn.id == return_id)
    )
    row_fin = res_fin.first()
    if not row_fin:
        raise HTTPException(404, "Supplier return not found")

    fr, prov_nom = row_fin
    fr.numero_nota_credito = data.numero.strip()
    fr.timbrado = data.timbrado.strip()
    codigo_dev = fr.numero_factura_origen or f"DEV-{str(fr.id)[:8].upper()}"
    fr.observaciones = f"{(fr.observaciones or '').strip()} [NC {data.numero.strip()}]".strip()

    # Registrar en SupplierCreditNote si no existe ya
    existing_nc = (await db.execute(
        select(SupplierCreditNote).where(
            SupplierCreditNote.company_id == company_id,
            SupplierCreditNote.supplier_id == fr.supplier_id,
            SupplierCreditNote.numero == data.numero.strip(),
            SupplierCreditNote.timbrado == data.timbrado.strip(),
            SupplierCreditNote.cancelado == False,
        )
    )).scalar_one_or_none()

    if not existing_nc:
        new_scn = SupplierCreditNote(
            company_id=company_id,
            supplier_id=fr.supplier_id,
            numero=data.numero.strip(),
            numero_factura_origen=codigo_dev,
            timbrado=data.timbrado.strip(),
            fecha=data.fecha or date.today(),
            fecha_recepcion=date.today(),
            motivo=f"Devolución {codigo_dev} - {data.motivo or 'Mercadería Vencida / Averiada'}"[:150],
            motivo_categoria="devolucion_vencimiento",
            impacto_contable="recuperacion_merma",
            monto=data.monto,
            saldo_disponible=data.monto,
            moneda="PYG",
            observaciones=data.observaciones or f"Generada por acreditación de devolución {codigo_dev}",
        )
        db.add(new_scn)

    await db.commit()
    fecha_dt = datetime.combine(fr.fecha, datetime.min.time()) if isinstance(fr.fecha, date) and not isinstance(fr.fecha, datetime) else (fr.fecha or datetime.utcnow())
    return SupplierReturnResponse(
        id=fr.id,
        proveedor_id=fr.supplier_id,
        proveedor_nombre=prov_nom or "Proveedor",
        codigo=codigo_dev,
        tipo="devolucion_fisica",
        fecha_creacion=fecha_dt,
        fecha_estimada_retiro=None,
        total_items=0,
        valor_total_estimado=fr.monto,
        nota_credito_numero=fr.numero_nota_credito,
        nota_credito_monto=Decimal(str(data.monto)),
        notas_credito=[{"id": str(uuid.uuid4()), "numero": data.numero.strip(), "monto": float(data.monto)}],
        monto_perdida=None,
        motivo_perdida=None,
        enviado_a_perdida=False,
        saldo_pendiente=Decimal(0),
        estado="completado",
        autorizado_por=None,
        autorizado_at=None,
        completado_por=None,
        completado_at=None,
        observaciones=fr.observaciones,
        items=[],
        created_at=fr.created_at or datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


# ---------------------------------------------------------------------------
# RETURN ITEMS
# ---------------------------------------------------------------------------

async def create_return_item(return_id: UUID, data, db: AsyncSession):
    item = SupplierReturnItem(return_id=return_id, **data.model_dump(exclude_none=True))
    if item.valor_unitario and item.cantidad:
        item.valor_total = item.valor_unitario * item.cantidad
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# AUTHORIZATIONS
# ---------------------------------------------------------------------------

async def list_return_authorizations(return_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(ReturnAuthorization)
        .where(ReturnAuthorization.return_id == return_id)
        .order_by(ReturnAuthorization.fecha_autorizacion.desc())
    )
    return result.scalars().all()


async def create_return_authorization(return_id: UUID, data, db: AsyncSession):
    auth = ReturnAuthorization(return_id=return_id, **data.model_dump(exclude_none=True))
    db.add(auth)
    await db.commit()
    await db.refresh(auth)
    return auth


# ---------------------------------------------------------------------------
# BACKHAUL
# ---------------------------------------------------------------------------

async def list_backhauls(company_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = select(BackhaulSchedule).where(BackhaulSchedule.company_id == company_id)
    if estado:
        q = q.where(BackhaulSchedule.estado == estado)
    q = q.order_by(BackhaulSchedule.fecha_programada)
    result = await db.execute(q)
    return result.scalars().all()


async def get_backhaul(backhaul_id: UUID, db: AsyncSession):
    result = await db.execute(select(BackhaulSchedule).where(BackhaulSchedule.id == backhaul_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(404, "Backhaul schedule not found")
    return b


async def create_backhaul(company_id: UUID, data, db: AsyncSession):
    b = BackhaulSchedule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


async def update_backhaul(backhaul_id: UUID, data, db: AsyncSession):
    b = await get_backhaul(backhaul_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(b, k, v)
    await db.commit()
    await db.refresh(b)
    return b


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_returns_dashboard(company_id: UUID, db: AsyncSession):
    pendientes = (await db.execute(
        select(func.count()).select_from(SupplierReturn).where(
            SupplierReturn.company_id == company_id,
            SupplierReturn.estado == "pendiente",
        )
    )).scalar()

    activos = (await db.execute(
        select(func.count()).select_from(SupplierReturn).where(
            SupplierReturn.company_id == company_id,
            SupplierReturn.estado.in_(["autorizado", "en_proceso"]),
        )
    )).scalar()

    completados_mes = (await db.execute(
        select(func.count()).select_from(SupplierReturn).where(
            SupplierReturn.company_id == company_id,
            SupplierReturn.estado == "completado",
            func.extract("month", SupplierReturn.completado_at) == func.extract("month", func.now()),
        )
    )).scalar()

    backhaul_programados = (await db.execute(
        select(func.count()).select_from(BackhaulSchedule).where(
            BackhaulSchedule.company_id == company_id,
            BackhaulSchedule.estado == "pendiente",
        )
    )).scalar()

    backhaul_pendientes = (await db.execute(
        select(func.count()).select_from(BackhaulSchedule).where(
            BackhaulSchedule.company_id == company_id,
            BackhaulSchedule.estado == "en_ruta",
        )
    )).scalar()

    return {
        "returns_pendientes": pendientes,
        "returns_activos": activos,
        "returns_completados_mes": completados_mes,
        "backhaul_programados": backhaul_programados,
        "backhaul_pendientes": backhaul_pendientes,
    }
