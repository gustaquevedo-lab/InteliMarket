"""Fiscal API router — configuración de timbrados, NC/ND."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sifen.models import SifenTimbrado
from api.src.sifen.schemas import TimbradoCreate, TimbradoResponse
from api.src.fiscal.models import TimbradoUsage
from api.src.fiscal.schemas import (
    FiscalConfigCreate, FiscalConfigResponse,
    NotaCreditoDebitoCreate, NotaCreditoDebitoResponse,
)
from api.src.fiscal import service as fiscal_service
from api.src.auth.middleware import require_auth

router = APIRouter(prefix="/api/v1/fiscal", tags=["fiscal"])


@router.get("/config/{company_id}", response_model=FiscalConfigResponse | None)
async def get_fiscal_config(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    config = await fiscal_service.get_fiscal_config(db, company_id)
    if not config:
        return None
    return config


@router.put("/config/{company_id}", response_model=FiscalConfigResponse)
async def upsert_fiscal_config(
    company_id: str,
    body: FiscalConfigCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await fiscal_service.upsert_fiscal_config(
        db, company_id, body.modo_emision, body.punto_emision,
        str(body.timbrado_id) if body.timbrado_id else None,
    )


@router.get("/timbrados/{company_id}")
async def list_timbrados(
    company_id: str,
    tipo_comprobante: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await fiscal_service.get_active_timbrados(db, company_id, tipo_comprobante)


@router.post("/timbrados", response_model=TimbradoResponse)
async def create_timbrado(
    body: TimbradoCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    timbrado = SifenTimbrado(
        company_id=uuid.UUID(body.company_id),
        numero=body.numero,
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        rango_desde=body.rango_desde,
        rango_hasta=body.rango_hasta,
        tipo_comprobante=body.tipo_comprobante,
        activo=getattr(body, "activo", True),
    )
    db.add(timbrado)
    await db.commit()
    await db.refresh(timbrado)
    return timbrado


@router.get("/timbrados/{timbrado_id}/usage")
async def get_timbrado_usage(
    timbrado_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    result = await db.execute(
        select(TimbradoUsage)
        .where(TimbradoUsage.timbrado_id == uuid.UUID(timbrado_id))
        .order_by(TimbradoUsage.numero_utilizado.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.get("/notas/{company_id}")
async def list_notas(
    company_id: str,
    tipo: str | None = Query(None),
    sale_id: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await fiscal_service.list_notas(db, company_id, tipo, sale_id, limit, offset)


@router.post("/notas", response_model=NotaCreditoDebitoResponse, status_code=201)
async def create_nota(
    body: NotaCreditoDebitoCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    from api.src.sales.models import Sale
    result = await db.execute(select(Sale).where(Sale.id == uuid.UUID(body.sale_id)))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(404, "Venta no encontrada")

    nota = await fiscal_service.create_nota(
        db,
        str(sale.company_id),
        body.sale_id,
        body.tipo,
        body.motivo,
        total=body.total or Decimal("0"),
    )
    return nota


@router.post("/notas/{nota_id}/emitir", response_model=NotaCreditoDebitoResponse)
async def emitir_nota(
    nota_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    try:
        nota = await fiscal_service.emitir_nota_sifen(db, uuid.UUID(nota_id))
    except ValueError as e:
        raise HTTPException(404, str(e))
    return nota
