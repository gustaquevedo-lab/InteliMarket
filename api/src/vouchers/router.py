"""Institutional Vouchers API Router"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.vouchers.schemas import (
    VoucherCheckResponse,
    VoucherRedeemRequest,
    VoucherRedeemResponse,
    VoucherSeedUPRequest,
    ConvenioSummaryResponse,
)
from api.src.vouchers import service

router = APIRouter(prefix="/vouchers", tags=["vouchers"], dependencies=[Depends(require_auth)])


@router.get("/check/{barcode_or_number}", response_model=VoucherCheckResponse)
async def check_voucher_endpoint(
    barcode_or_number: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Consulta ultrarrápida del estado de un vale por código de barras o número.
    Diseñado para el escáner de caja en la pestaña 'Otros' -> 'Vale de Compra'.
    """
    company_id = uuid.UUID(str(user.get("company_id", "00000000-0000-0000-0000-000000000010")))
    return await service.check_voucher(db, company_id, barcode_or_number)


@router.post("/redeem", response_model=VoucherRedeemResponse)
async def redeem_voucher_endpoint(
    payload: VoucherRedeemRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Quema de forma atómica y segura el vale de compra al confirmar la venta en caja."""
    company_id = uuid.UUID(str(user.get("company_id", "00000000-0000-0000-0000-000000000010")))
    user_id = uuid.UUID(str(user["id"])) if user.get("id") else None

    try:
        res = await service.redeem_voucher(
            db=db,
            company_id=company_id,
            barcode_or_number=payload.codigo_barras,
            sale_id=payload.sale_id,
            session_id=payload.caja_session_id,
            caja_numero=payload.caja_numero,
            usuario_id=payload.usuario_id or user_id,
            beneficiario_nombre=payload.beneficiario_nombre,
        )
        await db.commit()
        return res
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al canjear vale: {e}")


@router.post("/seed-up")
async def seed_convenio_up_endpoint(
    payload: VoucherSeedUPRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Siembra o inicializa el lote de 75 vales de la Universidad del Pacífico (Convenio UP)."""
    company_id = uuid.UUID(str(user.get("company_id", "00000000-0000-0000-0000-000000000010")))
    return await service.seed_convenio_up(
        db=db,
        company_id=company_id,
        total_vales=payload.total_vales,
        monto_por_vale=payload.monto_por_vale,
        fecha_vencimiento=payload.fecha_vencimiento,
        factura_numero=payload.factura_numero,
    )


@router.get("/summary", response_model=ConvenioSummaryResponse)
async def get_summary_endpoint(
    convenio: str = Query(default="Universidad del Pacífico"),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Resumen consolidado y detalle de todos los vales emitidos para el convenio."""
    company_id = uuid.UUID(str(user.get("company_id", "00000000-0000-0000-0000-000000000010")))
    return await service.get_convenio_summary(db, company_id, convenio)


@router.post("/link-invoice")
async def link_invoice_endpoint(
    payload: VoucherLinkInvoiceRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Asocia el número de factura legal emitida al lote de vales del convenio."""
    company_id = uuid.UUID(str(user.get("company_id", "00000000-0000-0000-0000-000000000010")))
    return await service.link_invoice_to_convenio(
        db=db,
        company_id=company_id,
        convenio_nombre=payload.convenio_nombre,
        factura_numero=payload.factura_numero,
    )


@router.post("/batch")
async def create_voucher_batch_endpoint(
    payload: VoucherBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Crea un nuevo lote de vales para cualquier convenio institucional."""
    company_id = uuid.UUID(str(user.get("company_id", "00000000-0000-0000-0000-000000000010")))
    return await service.create_voucher_batch(
        db=db,
        company_id=company_id,
        convenio_nombre=payload.convenio_nombre,
        total_vales=payload.total_vales,
        monto_por_vale=payload.monto_por_vale,
        fecha_vencimiento=payload.fecha_vencimiento,
        cliente_ruc=payload.cliente_ruc,
        cliente_razon_social=payload.cliente_razon_social,
        factura_numero=payload.factura_numero,
        prefijo_codigo=payload.prefijo_codigo,
    )

