"""Fiscal service — preimpresos, timbrados, NC/ND."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from api.src.fiscal.models import FiscalConfig, TimbradoUsage, NotaCreditoDebito, PuntoEmisionSecuencia
from api.src.sifen.models import SifenTimbrado
from api.src.sales.models import Sale


# ─── Fiscal Config ───────────────────────────────────────────────────────────

async def get_fiscal_config(db: AsyncSession, company_id: str) -> Optional[FiscalConfig]:
    result = await db.execute(
        select(FiscalConfig).where(FiscalConfig.company_id == uuid.UUID(company_id))
    )
    return result.scalar_one_or_none()


async def upsert_fiscal_config(db: AsyncSession, company_id: str, modo: str, punto_emision: str = "001", timbrado_id: Optional[str] = None) -> FiscalConfig:
    cid = uuid.UUID(company_id)
    existing = await get_fiscal_config(db, company_id)
    if existing:
        existing.modo_emision = modo
        existing.punto_emision = punto_emision
        if timbrado_id:
            existing.timbrado_id = uuid.UUID(timbrado_id)
    else:
        existing = FiscalConfig(
            company_id=cid,
            modo_emision=modo,
            punto_emision=punto_emision,
            timbrado_id=uuid.UUID(timbrado_id) if timbrado_id else None,
        )
        db.add(existing)
    await db.commit()
    await db.refresh(existing)
    return existing


# ─── Timbrado Operations ─────────────────────────────────────────────────────

async def get_active_timbrados(db: AsyncSession, company_id: str, tipo_comprobante: Optional[str] = None):
    cid = uuid.UUID(company_id)
    query = select(SifenTimbrado).where(
        SifenTimbrado.company_id == cid,
        SifenTimbrado.activo == True,
        SifenTimbrado.fecha_inicio <= date.today(),
        SifenTimbrado.fecha_fin >= date.today(),
    ).order_by(SifenTimbrado.fecha_fin.asc())
    if tipo_comprobante:
        query = query.where(SifenTimbrado.tipo_comprobante == tipo_comprobante)
    result = await db.execute(query)
    timbrados = result.scalars().all()

    # Attach usage info
    enriched = []
    for t in timbrados:
        usados = await _count_used(db, t.id, company_id, tipo_comprobante or "factura")
        total = t.rango_hasta - t.rango_desde + 1
        enriched.append({
            "id": t.id,
            "company_id": t.company_id,
            "numero": t.numero,
            "fecha_inicio": t.fecha_inicio,
            "fecha_fin": t.fecha_fin,
            "rango_desde": t.rango_desde,
            "rango_hasta": t.rango_hasta,
            "tipo_comprobante": t.tipo_comprobante,
            "activo": t.activo,
            "created_at": t.created_at,
            "usados": usados,
            "disponibles": total - usados,
        })
    return enriched


async def _count_used(db: AsyncSession, timbrado_id: uuid.UUID, company_id: str, tipo_documento: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(TimbradoUsage).where(
            TimbradoUsage.timbrado_id == timbrado_id,
            TimbradoUsage.tipo_documento == tipo_documento,
        )
    )
    return result.scalar() or 0


async def reserve_next_number(db: AsyncSession, timbrado_id: uuid.UUID, company_id: str, tipo_documento: str, sale_id: Optional[str] = None) -> int:
    """Reserve and return the next available pre-printed number from a timbrado."""
    cid = uuid.UUID(company_id)
    # Get the timbrado to know the range
    result = await db.execute(select(SifenTimbrado).where(SifenTimbrado.id == timbrado_id))
    timbrado = result.scalar_one_or_none()
    if not timbrado:
        raise ValueError("Timbrado no encontrado")

    # Find the last used number
    last = await db.execute(
        select(func.max(TimbradoUsage.numero_utilizado)).where(
            TimbradoUsage.timbrado_id == timbrado_id,
        )
    )
    last_num = last.scalar() or (timbrado.rango_desde - 1)
    next_num = last_num + 1

    if next_num > timbrado.rango_hasta:
        raise ValueError(f"Timbrado {timbrado.numero} agotado (rango {timbrado.rango_desde}-{timbrado.rango_hasta})")

    usage = TimbradoUsage(
        timbrado_id=timbrado_id,
        company_id=cid,
        numero_utilizado=next_num,
        sale_id=uuid.UUID(sale_id) if sale_id else None,
        tipo_documento=tipo_documento,
    )
    db.add(usage)
    await db.flush()
    return next_num


# ─── Numeracion fiscal real (autoimpresor / preimpreso / electronico) ────────
#
# Misma numeracion sirve para los 3 modos: lo unico que cambia entre
# autoimpresor y electronico es si ademas se genera CDC y se envia a SIFEN
# (eso lo maneja el modulo sifen aparte, todavia no obligatorio para este
# cliente). Este reserve es el que hace que el numero impreso sea el numero
# fiscal real (establecimiento-puntoemision-numero), no un correlativo interno.

class TimbradoAgotadoError(ValueError):
    pass


class TimbradoVencidoError(ValueError):
    pass


async def reserve_fiscal_invoice_number(
    db: AsyncSession,
    company_id: str,
    punto_emision: str,
    tipo_documento: str = "factura",
) -> str:
    cid = uuid.UUID(company_id)
    result = await db.execute(
        select(PuntoEmisionSecuencia)
        .where(
            PuntoEmisionSecuencia.company_id == cid,
            PuntoEmisionSecuencia.punto_emision == punto_emision,
            PuntoEmisionSecuencia.tipo_documento == tipo_documento,
            PuntoEmisionSecuencia.activo == True,
        )
        .with_for_update()
    )
    secuencia = result.scalar_one_or_none()
    if not secuencia:
        raise ValueError(
            f"No hay secuencia de numeracion configurada para punto de emision '{punto_emision}' "
            f"({tipo_documento}) — configurar en Facturación antes de emitir"
        )

    timbrado_result = await db.execute(select(SifenTimbrado).where(SifenTimbrado.id == secuencia.timbrado_id))
    timbrado = timbrado_result.scalar_one_or_none()
    if not timbrado or not timbrado.activo:
        raise ValueError(f"El timbrado de punto de emision '{punto_emision}' no esta activo")
    if timbrado.fecha_fin < date.today():
        raise TimbradoVencidoError(f"El timbrado {timbrado.numero} vencio el {timbrado.fecha_fin} — renovarlo antes de seguir facturando")

    if secuencia.numero_actual > secuencia.numero_final:
        raise TimbradoAgotadoError(
            f"El punto de emision '{punto_emision}' agoto su numeracion (hasta {secuencia.numero_final}) — "
            f"solicitar ampliacion de timbrado"
        )

    numero_asignado = secuencia.numero_actual
    secuencia.numero_actual += 1
    await db.flush()

    return f"{secuencia.establecimiento}-{secuencia.punto_emision}-{numero_asignado:07d}"


async def get_fiscal_status(db: AsyncSession, company_id: str) -> dict:
    """Resumen para mostrar en el panel de configuracion: modo, timbrado
    vigente y disponibilidad por punto de emision."""
    config = await get_fiscal_config(db, company_id)
    cid = uuid.UUID(company_id)

    secuencias_result = await db.execute(
        select(PuntoEmisionSecuencia, SifenTimbrado)
        .join(SifenTimbrado, SifenTimbrado.id == PuntoEmisionSecuencia.timbrado_id)
        .where(PuntoEmisionSecuencia.company_id == cid, PuntoEmisionSecuencia.activo == True)
        .order_by(PuntoEmisionSecuencia.punto_emision)
    )
    puntos = [
        {
            "punto_emision": s.punto_emision,
            "establecimiento": s.establecimiento,
            "tipo_documento": s.tipo_documento,
            "numero_actual": s.numero_actual,
            "numero_final": s.numero_final,
            "disponibles": s.numero_final - s.numero_actual + 1,
            "timbrado_numero": t.numero,
            "timbrado_fecha_fin": t.fecha_fin,
            "timbrado_vencido": t.fecha_fin < date.today(),
        }
        for s, t in secuencias_result.all()
    ]

    return {
        "modo_emision": config.modo_emision if config else "sin_configurar",
        "punto_emision_default": config.punto_emision if config else None,
        "puntos_emision": puntos,
    }


async def list_punto_emision_secuencias(db: AsyncSession, company_id: str) -> list[PuntoEmisionSecuencia]:
    cid = uuid.UUID(company_id)
    result = await db.execute(
        select(PuntoEmisionSecuencia)
        .where(PuntoEmisionSecuencia.company_id == cid)
        .order_by(PuntoEmisionSecuencia.punto_emision, PuntoEmisionSecuencia.tipo_documento)
    )
    return result.scalars().all()


async def create_punto_emision_secuencia(db: AsyncSession, data) -> PuntoEmisionSecuencia:
    existing = await db.execute(
        select(PuntoEmisionSecuencia).where(
            PuntoEmisionSecuencia.company_id == data.company_id,
            PuntoEmisionSecuencia.punto_emision == data.punto_emision,
            PuntoEmisionSecuencia.tipo_documento == data.tipo_documento,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(
            f"Ya existe una numeracion de '{data.tipo_documento}' para el punto de emision '{data.punto_emision}'"
        )

    secuencia = PuntoEmisionSecuencia(**data.model_dump())
    db.add(secuencia)
    await db.commit()
    await db.refresh(secuencia)
    return secuencia


async def update_punto_emision_secuencia(db: AsyncSession, secuencia_id: str, data) -> PuntoEmisionSecuencia | None:
    result = await db.execute(select(PuntoEmisionSecuencia).where(PuntoEmisionSecuencia.id == uuid.UUID(secuencia_id)))
    secuencia = result.scalar_one_or_none()
    if not secuencia:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(secuencia, field, value)
    await db.commit()
    await db.refresh(secuencia)
    return secuencia


# ─── NC / ND ─────────────────────────────────────────────────────────────────

async def create_nota(
    db: AsyncSession,
    company_id: str,
    sale_id: str,
    tipo: str,
    motivo: str,
    total: Decimal,
    user_id: Optional[str] = None,
    items: Optional[list] = None,
) -> NotaCreditoDebito:
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(sale_id)

    # Get original sale
    result = await db.execute(select(Sale).where(Sale.id == sid, Sale.company_id == cid))
    sale = result.scalar_one_or_none()
    if not sale:
        raise ValueError("Venta no encontrada")

    # Build nota number
    count = await db.execute(
        select(func.count()).select_from(NotaCreditoDebito).where(
            NotaCreditoDebito.company_id == cid,
            NotaCreditoDebito.tipo == tipo,
        )
    )
    seq = (count.scalar() or 0) + 1
    prefix = "NC" if tipo == "credito" else "ND"
    numero = f"{prefix}-{sale.numero}-{seq:04d}"

    # Calculate amounts (from items or based on sale)
    if items:
        base_10 = sum(i.get("base_gravada_10", 0) for i in items)
        base_5 = sum(i.get("base_gravada_5", 0) for i in items)
        exenta = sum(i.get("base_exenta", 0) for i in items)
        iva10 = sum(i.get("iva_10", 0) for i in items)
        iva5 = sum(i.get("iva_5", 0) for i in items)
        sub = base_10 + base_5 + exenta
        desc = sum(i.get("descuento", 0) for i in items)
        tot = sub - desc
    else:
        base_10 = sale.base_gravada_10 or 0
        base_5 = sale.base_gravada_5 or 0
        exenta = sale.base_exenta or 0
        iva10 = sale.iva_10 or 0
        iva5 = sale.iva_5 or 0
        sub = sale.subtotal
        desc = 0
        tot = total or sale.total

    nota = NotaCreditoDebito(
        company_id=cid,
        sale_id=sid,
        tipo=tipo,
        numero=numero,
        motivo=motivo,
        subtotal=sub,
        descuento_total=desc,
        base_gravada_10=base_10,
        base_gravada_5=base_5,
        base_exenta=exenta,
        iva_10=iva10,
        iva_5=iva5,
        total=tot,
        estado="pendiente",
        user_id=uuid.UUID(user_id) if user_id else None,
    )
    db.add(nota)
    await db.commit()
    await db.refresh(nota)
    return nota


async def emitir_nota_sifen(db: AsyncSession, nota_id: uuid.UUID) -> NotaCreditoDebito:
    """Submit NC/ND to SIFEN (placeholder — real implementation calls SIFEN API)."""
    result = await db.execute(
        select(NotaCreditoDebito).where(NotaCreditoDebito.id == nota_id)
    )
    nota = result.scalar_one_or_none()
    if not nota:
        raise ValueError("Nota no encontrada")
    nota.estado = "emitido"
    nota.sifen_estado = "pendiente"
    await db.commit()
    await db.refresh(nota)
    return nota


async def list_notas(
    db: AsyncSession,
    company_id: str,
    tipo: Optional[str] = None,
    sale_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    cid = uuid.UUID(company_id)
    query = select(NotaCreditoDebito).where(NotaCreditoDebito.company_id == cid)
    if tipo:
        query = query.where(NotaCreditoDebito.tipo == tipo)
    if sale_id:
        query = query.where(NotaCreditoDebito.sale_id == uuid.UUID(sale_id))
    query = query.order_by(NotaCreditoDebito.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
