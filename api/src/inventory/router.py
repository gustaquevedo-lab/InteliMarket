"""Inventory API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.inventory.schemas import (
    WarehouseCreate, WarehouseResponse,
    StockResponse, MovementCreate, MovementResponse,
    TransferCreate, TransferResponse,
    AdjustmentCreate, AdjustmentResponse,
)
from api.src.inventory import service, export_service, pdf_reports

router = APIRouter(prefix="/api/v1", tags=["inventory"])


async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    row = r.first()
    return {"razon_social": row.razon_social, "ruc": row.ruc, "logo_url": row.logo_url} if row else {"razon_social": "Empresa", "ruc": "N/A"}


@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
async def create_warehouse(body: WarehouseCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_warehouse(db, body)


@router.get("/companies/{company_id}/warehouses", response_model=list[WarehouseResponse])
async def list_warehouses(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_warehouses(db, company_id)


@router.get("/warehouses/{warehouse_id}/stock", response_model=list[StockResponse])
async def get_warehouse_stock(warehouse_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_stock_by_warehouse(db, warehouse_id)


@router.get("/companies/{company_id}/low-stock")
async def get_low_stock(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_low_stock(db, company_id)


@router.get("/companies/{company_id}/products/{product_id}/stock")
async def get_product_stock(company_id: str, product_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_stock_by_product(db, company_id, product_id)


@router.get("/companies/{company_id}/stock-map")
async def get_stock_map(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_stock_map(db, company_id)


@router.post("/inventory/movements", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
async def record_movement(body: MovementCreate, db: AsyncSession = Depends(get_db)):
    return await service.record_movement(db, body)


@router.get("/companies/{company_id}/inventory/stats")
async def get_inventory_stats(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_inventory_stats(db, company_id)


@router.get("/companies/{company_id}/inventory/lots/expiries")
async def get_lots_expiries(
    company_id: str,
    warehouse_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_lots_expiries(db, company_id, warehouse_id, estado, limit, offset)


@router.get("/inventory/movements")
async def list_movements(
    company_id: str = "00000000-0000-0000-0000-000000000010",
    product_id: str | None = Query(None),
    warehouse_id: str | None = Query(None),
    tipo: str | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_movements(db, company_id, product_id, warehouse_id, tipo, fecha_desde, fecha_hasta, limit, offset)


@router.get("/companies/{company_id}/inventory/movements/summary")
async def get_kardex_summary(
    company_id: str,
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_kardex_summary(db, company_id, fecha_desde, fecha_hasta)


@router.get("/companies/{company_id}/inventory/movements/export.xlsx")
async def export_kardex_xlsx(
    company_id: str,
    product_id: str | None = Query(None),
    warehouse_id: str | None = Query(None),
    tipo: str | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    movements = await service.list_movements(db, company_id, product_id, warehouse_id, tipo, fecha_desde, fecha_hasta, limit=20000, offset=0)
    xlsx = export_service.export_kardex_excel(
        movements,
        date_type.fromisoformat(fecha_desde) if fecha_desde else None,
        date_type.fromisoformat(fecha_hasta) if fecha_hasta else None,
    )
    return StreamingResponse(
        iter([xlsx]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=kardex.xlsx"},
    )


@router.get("/companies/{company_id}/inventory/movements/export.pdf")
async def export_kardex_pdf(
    company_id: str,
    product_id: str | None = Query(None),
    warehouse_id: str | None = Query(None),
    tipo: str | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from datetime import date as date_type
    movements = await service.list_movements(db, company_id, product_id, warehouse_id, tipo, fecha_desde, fecha_hasta, limit=2000, offset=0)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_kardex_pdf(
        company, movements,
        date_type.fromisoformat(fecha_desde) if fecha_desde else None,
        date_type.fromisoformat(fecha_hasta) if fecha_hasta else None,
        generated_by,
    )
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=kardex.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.post("/inventory/transfers", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(body: TransferCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_transfer(db, body)


@router.post("/inventory/transfers/{transfer_id}/complete", response_model=TransferResponse)
async def complete_transfer(transfer_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.complete_transfer(db, transfer_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo completar la transferencia")
    return result


@router.get("/companies/{company_id}/adjustments")
async def list_adjustments(
    company_id: str,
    warehouse_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_adjustments(db, company_id, warehouse_id, estado, limit, offset)


@router.post("/inventory/adjustments", response_model=AdjustmentResponse, status_code=status.HTTP_201_CREATED)
async def create_adjustment(body: AdjustmentCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_adjustment(db, body)


@router.post("/inventory/adjustments/{adjustment_id}/approve", response_model=AdjustmentResponse)
async def approve_adjustment(adjustment_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.approve_adjustment(db, adjustment_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar el ajuste")
    return result


@router.post("/inventory/mermas")
async def record_quick_merma(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.record_quick_merma(
            db,
            company_id=body["company_id"],
            warehouse_id=body["warehouse_id"],
            product_id=body["product_id"],
            cantidad=float(body["cantidad"]),
            motivo=body.get("motivo", "General"),
            observaciones=body.get("observaciones", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
