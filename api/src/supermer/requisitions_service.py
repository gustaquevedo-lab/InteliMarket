"""Servicio de Requisiciones Internas de Salón a Producción (Consumo Interno)
Extra Supermercado Mayorista - Grupo Santa Teresa E.A.S.
"""

import uuid
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict, Any

from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.supermer.models import (
    InternalRequisition,
    InternalRequisitionItem,
    RequisitionStatus,
)
from api.src.supermer.schemas import RequisitionCreate

TZ_ASUNCION = ZoneInfo("America/Asuncion")


def _safe_uuid(val: Any) -> Optional[uuid.UUID]:
    if not val:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return None


async def _generate_requisition_number(db: AsyncSession, company_id: uuid.UUID) -> str:
    """Genera un correlativo único con formato REQ-YYYY-NNNNN."""
    now = datetime.now(TZ_ASUNCION)
    current_year = now.year
    prefix = f"REQ-{current_year}-"

    stmt = (
        select(func.count(InternalRequisition.id))
        .where(
            InternalRequisition.company_id == company_id,
            InternalRequisition.numero_requisicion.like(f"{prefix}%"),
        )
    )
    count = (await db.execute(stmt)).scalar() or 0
    next_num = count + 1
    return f"{prefix}{next_num:05d}"


async def create_requisition(
    db: AsyncSession,
    company_id: str,
    data: RequisitionCreate,
    branch_id: Optional[str] = None,
) -> InternalRequisition:
    cid = _safe_uuid(company_id)
    bid = _safe_uuid(branch_id or data.branch_id)

    num_req = await _generate_requisition_number(db, cid)

    req = InternalRequisition(
        numero_requisicion=num_req,
        company_id=cid,
        branch_id=bid,
        solicitado_por=data.solicitado_por.strip(),
        area_destino=data.area_destino.strip().lower(),
        estado=RequisitionStatus.PENDIENTE.value,
        observaciones=data.observaciones.strip() if data.observaciones else None,
    )
    db.add(req)
    await db.flush()

    for item in data.items:
        it = InternalRequisitionItem(
            requisition_id=req.id,
            product_id=_safe_uuid(item.product_id),
            barcode=item.barcode.strip() if item.barcode else None,
            product_name=item.product_name.strip(),
            cantidad=Decimal(str(item.cantidad)),
            unidad_medida=item.unidad_medida.strip() if item.unidad_medida else "UN",
            costo_unitario_estimado=Decimal(str(item.costo_unitario_estimado or 0)),
            precio_venta_salon=Decimal(str(item.precio_venta_salon or 0)),
        )
        db.add(it)

    await db.commit()

    # Recargar con relaciones
    stmt = (
        select(InternalRequisition)
        .options(selectinload(InternalRequisition.items))
        .where(InternalRequisition.id == req.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


async def list_requisitions(
    db: AsyncSession,
    company_id: str,
    branch_id: Optional[str] = None,
    estado: Optional[str] = None,
    area_destino: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[InternalRequisition]:
    cid = _safe_uuid(company_id)
    query = (
        select(InternalRequisition)
        .options(selectinload(InternalRequisition.items))
        .where(InternalRequisition.company_id == cid)
    )
    if branch_id:
        query = query.where(InternalRequisition.branch_id == _safe_uuid(branch_id))
    if estado:
        query = query.where(InternalRequisition.estado == estado.upper())
    if area_destino:
        query = query.where(InternalRequisition.area_destino == area_destino.lower())

    query = query.order_by(InternalRequisition.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(query)
    return list(res.scalars().all())


async def get_requisition(db: AsyncSession, requisition_id: str) -> Optional[InternalRequisition]:
    rid = _safe_uuid(requisition_id)
    if not rid:
        return None
    stmt = (
        select(InternalRequisition)
        .options(selectinload(InternalRequisition.items))
        .where(InternalRequisition.id == rid)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


def generate_thermal_ticket_text(req: InternalRequisition) -> str:
    """Genera el texto formateado a 40 columnas para impresora térmica de salón (80mm)."""
    line = "=" * 40
    dline = "-" * 40
    fecha_str = req.aprobado_at.strftime("%d/%m/%Y %H:%M") if req.aprobado_at else datetime.now().strftime("%d/%m/%Y %H:%M")
    
    lines = [
        "       EXTRA SUPERMERCADO MAYORISTA    ",
        "         GRUPO SANTA TERESA E.A.S.      ",
        "             RUC: 80150377-9           ",
        line,
        "   VALE DE REQUISICION DE CONSUMO INTERNO ",
        f"   NUMERO: {req.numero_requisicion}",
        line,
        f"FECHA: {fecha_str}",
        f"AREA DESTINO: {req.area_destino.upper()}",
        f"SOLICITADO POR: {req.solicitado_por}",
        f"AUTORIZADO POR: {req.aprobado_por or 'ENCARGADO DE SALON'}",
        dline,
        "CANT  UN  DESCRIPCION",
        dline,
    ]

    total_est = Decimal("0")
    for it in req.items:
        cant_str = f"{it.cantidad:.2f}".rstrip("0").rstrip(".")
        desc = it.product_name[:24]
        lines.append(f"{cant_str:>4}  {it.unidad_medida:<3} {desc}")
        if it.barcode:
            lines.append(f"      EAN: {it.barcode}")
        total_est += Decimal(str(it.cantidad)) * Decimal(str(it.precio_venta_salon or 0))

    lines.extend([
        dline,
        f"TOTAL ESTIMADO VENTA SALON: Gs. {int(total_est):,}".replace(",", "."),
        line,
        "  INSTRUCCION OBLIGATORIA PARA CAJA:   ",
        " 1. Pasar por caja como Venta a Credito ",
        "    a nombre de GRUPO SANTA TERESA EAS  ",
        "    (RUC 80150377-9).                   ",
        " 2. ANEXAR / ABROCHAR este ticket a la  ",
        "    factura emitida.                    ",
        line,
        "\n\n",
        "---------------------   ---------------------",
        "  Firma Encargado Salón   Firma Responsable Cocina",
        "\n\n",
    ])
    return "\n".join(lines)


async def approve_requisition(
    db: AsyncSession,
    requisition_id: str,
    approver_name: str,
) -> Dict[str, Any]:
    req = await get_requisition(db, requisition_id)
    if not req:
        raise ValueError("Requisición no encontrada")
    if req.estado != RequisitionStatus.PENDIENTE.value:
        raise ValueError(f"No se puede aprobar una requisición en estado '{req.estado}'")

    req.estado = RequisitionStatus.APROBADA.value
    req.aprobado_por = approver_name.strip()
    req.aprobado_at = datetime.now(TZ_ASUNCION)
    await db.commit()
    await db.refresh(req)

    ticket_text = generate_thermal_ticket_text(req)
    return {
        "requisition": req,
        "ticket_text": ticket_text,
    }


async def link_pos_sale(
    db: AsyncSession,
    requisition_id: str,
    sale_id: str,
    numero_factura: str,
) -> InternalRequisition:
    req = await get_requisition(db, requisition_id)
    if not req:
        raise ValueError("Requisición no encontrada")

    req.estado = RequisitionStatus.FACTURADA_EN_CAJA.value
    req.sale_id = _safe_uuid(sale_id)
    req.numero_factura = numero_factura.strip()
    await db.commit()
    await db.refresh(req)
    return req


async def mark_compensated(
    db: AsyncSession,
    requisition_id: str,
) -> InternalRequisition:
    req = await get_requisition(db, requisition_id)
    if not req:
        raise ValueError("Requisición no encontrada")

    req.estado = RequisitionStatus.COMPENSADA.value
    await db.commit()
    await db.refresh(req)
    return req
