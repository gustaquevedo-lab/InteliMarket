"""Reports router — async endpoints for all report types"""

import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.db import get_db
from api.src.reports import service, export_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _excel_response(data: bytes, filename: str):
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(data), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)


@router.get("/sales/summary")
async def sales_summary(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), branch_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_sales_summary(db, fecha_desde, fecha_hasta, branch_id)


@router.get("/sales/by-period")
async def sales_by_period(agrupar_por: str = Query("dia", pattern="^(dia|semana|mes)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), branch_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_sales_by_period(db, agrupar_por, fecha_desde, fecha_hasta, branch_id)


@router.get("/sales/by-category")
async def sales_by_category(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_sales_by_category(db, fecha_desde, fecha_hasta)


@router.get("/sales/by-payment-method")
async def sales_by_payment_method(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_sales_by_payment_method(db, fecha_desde, fecha_hasta)


@router.get("/sales/by-product")
async def sales_by_product(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), limit: int = Query(50, le=200), db: AsyncSession = Depends(get_db)):
    return await service.get_sales_by_product(db, fecha_desde, fecha_hasta, limit)


@router.get("/sales/by-client")
async def sales_by_client(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_sales_by_client(db, fecha_desde, fecha_hasta)


@router.get("/inventory/summary")
async def inventory_summary(warehouse_id: int | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_inventory_summary(db, warehouse_id)


@router.get("/inventory/detail")
async def inventory_detail(warehouse_id: int | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_inventory_detail(db, warehouse_id)


@router.get("/inventory/rotation")
async def inventory_rotation(db: AsyncSession = Depends(get_db)):
    return await service.get_inventory_rotation(db)


@router.get("/fiscal/book")
async def fiscal_book(tipo_libro: str = Query("ventas", pattern="^(ventas|compras)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_fiscal_book(db, tipo_libro, fecha_desde, fecha_hasta)


@router.get("/fiscal/summary")
async def fiscal_summary(tipo_libro: str = Query("ventas", pattern="^(ventas|compras)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_fiscal_summary(db, tipo_libro, fecha_desde, fecha_hasta)


@router.get("/financial/summary")
async def financial_summary(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_financial_summary(db, fecha_desde, fecha_hasta)


@router.get("/financial/by-day")
async def financial_by_day(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_financial_by_day(db, fecha_desde, fecha_hasta)


@router.get("/inventory/fifo")
async def inventory_fifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_fifo_costing(db, product_id, warehouse_id)


@router.get("/inventory/lifo")
async def inventory_lifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_lifo_costing(db, product_id, warehouse_id)


@router.get("/inventory/cost-comparison")
async def inventory_cost_comparison(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_cost_comparison(db, product_id, warehouse_id)


@router.get("/inventory/valuation")
async def inventory_valuation(warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.get_inventory_valuation(db, warehouse_id)


# ==================== EXPORT ENDPOINTS ====================

@router.get("/export/sales-summary")
async def export_sales_summary(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    summary = await service.get_sales_summary(db, fecha_desde, fecha_hasta)
    data = export_service.export_sales_summary(summary, fecha_desde, fecha_hasta)
    return _excel_response(data, "resumen_ventas.xlsx")


@router.get("/export/sales-by-period")
async def export_sales_by_period(agrupar_por: str = Query("dia", pattern="^(dia|semana|mes)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await service.get_sales_by_period(db, agrupar_por, fecha_desde, fecha_hasta)
    xlsx = export_service.export_sales_by_period(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "ventas_por_periodo.xlsx")


@router.get("/export/sales-by-category")
async def export_sales_by_category(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await service.get_sales_by_category(db, fecha_desde, fecha_hasta)
    xlsx = export_service.export_sales_by_category(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "ventas_por_categoria.xlsx")


@router.get("/export/sales-by-product")
async def export_sales_by_product(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), limit: int = Query(100, le=500), db: AsyncSession = Depends(get_db)):
    data = await service.get_sales_by_product(db, fecha_desde, fecha_hasta, limit)
    xlsx = export_service.export_sales_by_product(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "top_productos.xlsx")


@router.get("/export/sales-by-client")
async def export_sales_by_client(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await service.get_sales_by_client(db, fecha_desde, fecha_hasta)
    xlsx = export_service.export_sales_by_client(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "ventas_por_cliente.xlsx")


@router.get("/export/inventory")
async def export_inventory(warehouse_id: int | None = Query(None), db: AsyncSession = Depends(get_db)):
    summary = await service.get_inventory_summary(db, warehouse_id)
    detail = await service.get_inventory_detail(db, warehouse_id)
    xlsx = export_service.export_inventory_summary(summary, detail)
    return _excel_response(xlsx, "inventario.xlsx")


@router.get("/export/inventory-rotation")
async def export_inventory_rotation(db: AsyncSession = Depends(get_db)):
    data = await service.get_inventory_rotation(db)
    xlsx = export_service.export_inventory_rotation(data)
    return _excel_response(xlsx, "rotacion_inventario.xlsx")


@router.get("/export/fiscal-book")
async def export_fiscal_book(tipo_libro: str = Query("ventas", pattern="^(ventas|compras)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await service.get_fiscal_book(db, tipo_libro, fecha_desde, fecha_hasta)
    xlsx = export_service.export_fiscal_book(data, tipo_libro, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, f"libro_{tipo_libro}.xlsx")


@router.get("/export/financial")
async def export_financial(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db)):
    summary = await service.get_financial_summary(db, fecha_desde, fecha_hasta)
    by_day = await service.get_financial_by_day(db, fecha_desde, fecha_hasta)
    xlsx = export_service.export_financial_summary(summary, by_day, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "resumen_financiero.xlsx")


@router.get("/export/fifo")
async def export_fifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await service.get_fifo_costing(db, product_id, warehouse_id)
    xlsx = export_service.export_fifo_costing(data)
    return _excel_response(xlsx, "costeo_fifo.xlsx")


@router.get("/export/lifo")
async def export_lifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await service.get_lifo_costing(db, product_id, warehouse_id)
    xlsx = export_service.export_lifo_costing(data)
    return _excel_response(xlsx, "costeo_lifo.xlsx")


@router.get("/export/cost-comparison")
async def export_cost_comparison(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    data = await service.get_cost_comparison(db, product_id, warehouse_id)
    xlsx = export_service.export_cost_comparison(data)
    return _excel_response(xlsx, "comparacion_costos.xlsx")
