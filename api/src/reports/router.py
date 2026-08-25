"""Reports router — async endpoints for all report types

Fase 1 del overhaul de Reportes Financieros: el modulo entero no filtraba
por company_id (0 ocurrencias en 1.520 lineas) -- cada numero se calculaba
sobre TODA la base de datos, mezclando empresas distintas. Ahora company_id
se deriva del usuario autenticado (Depends(require_auth)), no de un query
param que cualquiera podria falsificar.
"""

import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import date
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.reports import service, export_service, pdf_reports

router = APIRouter(prefix="/api/reports", tags=["reports"])


async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    row = r.first()
    return {"razon_social": row.razon_social, "ruc": row.ruc, "logo_url": row.logo_url} if row else {"razon_social": "Empresa", "ruc": "N/A"}


def _pdf_response(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}", "Content-Length": str(len(pdf_bytes))},
    )


def _excel_response(data: bytes, filename: str):
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(data), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)


@router.get("/sales/summary")
async def sales_summary(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), branch_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_sales_summary(db, user["company_id"], fecha_desde, fecha_hasta, branch_id)


@router.get("/sales/by-period")
async def sales_by_period(agrupar_por: str = Query("dia", pattern="^(hora|dia|semana|mes)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), branch_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_sales_by_period(db, user["company_id"], agrupar_por, fecha_desde, fecha_hasta, branch_id)

@router.get("/sales/chart-comparison")
async def sales_chart_comparison(
    agrupar_por: str = Query("dia", pattern="^(hora|dia|semana|mes)$"),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth)
):
    return await service.get_chart_comparison(db, user["company_id"], agrupar_por, fecha_desde, fecha_hasta)



@router.get("/sales/by-category")
async def sales_by_category(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_sales_by_category(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/sales/by-payment-method")
async def sales_by_payment_method(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_sales_by_payment_method(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/expenses/by-category")
async def expenses_by_category(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_expenses_by_category(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/sales/by-product")
async def sales_by_product(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), limit: int = Query(50, le=200), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_sales_by_product(db, user["company_id"], fecha_desde, fecha_hasta, limit)


@router.get("/sales/by-client")
async def sales_by_client(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_sales_by_client(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/inventory/summary")
async def inventory_summary(warehouse_id: int | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_inventory_summary(db, user["company_id"], warehouse_id)


@router.get("/inventory/detail")
async def inventory_detail(warehouse_id: int | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_inventory_detail(db, user["company_id"], warehouse_id)


@router.get("/inventory/rotation")
async def inventory_rotation(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_inventory_rotation(db, user["company_id"])


@router.get("/fiscal/book")
async def fiscal_book(tipo_libro: str = Query("ventas", pattern="^(ventas|compras)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_fiscal_book(db, user["company_id"], tipo_libro, fecha_desde, fecha_hasta)


@router.get("/fiscal/summary")
async def fiscal_summary(tipo_libro: str = Query("ventas", pattern="^(ventas|compras)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_fiscal_summary(db, user["company_id"], tipo_libro, fecha_desde, fecha_hasta)


@router.get("/financial/summary")
async def financial_summary(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_financial_summary(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/financial/by-day")
async def financial_by_day(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_financial_by_day(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/inventory/fifo")
async def inventory_fifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_fifo_costing(db, user["company_id"], product_id, warehouse_id)


@router.get("/inventory/lifo")
async def inventory_lifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_lifo_costing(db, user["company_id"], product_id, warehouse_id)


@router.get("/inventory/cost-comparison")
async def inventory_cost_comparison(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_cost_comparison(db, user["company_id"], product_id, warehouse_id)


@router.get("/inventory/valuation")
async def inventory_valuation(warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_inventory_valuation(db, user["company_id"], warehouse_id)


# ==================== EXPORT ENDPOINTS ====================

@router.get("/export/sales-summary")
async def export_sales_summary(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    summary = await service.get_sales_summary(db, user["company_id"], fecha_desde, fecha_hasta)
    data = export_service.export_sales_summary(summary, fecha_desde, fecha_hasta)
    return _excel_response(data, "resumen_ventas.xlsx")


@router.get("/export/sales-by-period")
async def export_sales_by_period(agrupar_por: str = Query("dia", pattern="^(hora|dia|semana|mes)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_sales_by_period(db, user["company_id"], agrupar_por, fecha_desde, fecha_hasta)
    xlsx = export_service.export_sales_by_period(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "ventas_por_periodo.xlsx")


@router.get("/export/sales-by-category")
async def export_sales_by_category(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_sales_by_category(db, user["company_id"], fecha_desde, fecha_hasta)
    xlsx = export_service.export_sales_by_category(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "ventas_por_categoria.xlsx")


@router.get("/export/sales-by-product")
async def export_sales_by_product(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), limit: int = Query(100, le=500), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_sales_by_product(db, user["company_id"], fecha_desde, fecha_hasta, limit)
    xlsx = export_service.export_sales_by_product(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "top_productos.xlsx")


@router.get("/export/sales-by-client")
async def export_sales_by_client(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_sales_by_client(db, user["company_id"], fecha_desde, fecha_hasta)
    xlsx = export_service.export_sales_by_client(data, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "ventas_por_cliente.xlsx")


@router.get("/export/inventory")
async def export_inventory(warehouse_id: int | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    summary = await service.get_inventory_summary(db, user["company_id"], warehouse_id)
    detail = await service.get_inventory_detail(db, user["company_id"], warehouse_id)
    xlsx = export_service.export_inventory_summary(summary, detail)
    return _excel_response(xlsx, "inventario.xlsx")


@router.get("/export/inventory-rotation")
async def export_inventory_rotation(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_inventory_rotation(db, user["company_id"])
    xlsx = export_service.export_inventory_rotation(data)
    return _excel_response(xlsx, "rotacion_inventario.xlsx")


@router.get("/export/fiscal-book")
async def export_fiscal_book(tipo_libro: str = Query("ventas", pattern="^(ventas|compras)$"), fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_fiscal_book(db, user["company_id"], tipo_libro, fecha_desde, fecha_hasta)
    xlsx = export_service.export_fiscal_book(data, tipo_libro, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, f"libro_{tipo_libro}.xlsx")


@router.get("/export/financial")
async def export_financial(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    summary = await service.get_financial_summary(db, user["company_id"], fecha_desde, fecha_hasta)
    by_day = await service.get_financial_by_day(db, user["company_id"], fecha_desde, fecha_hasta)
    xlsx = export_service.export_financial_summary(summary, by_day, fecha_desde, fecha_hasta)
    return _excel_response(xlsx, "resumen_financiero.xlsx")


@router.get("/export/fifo")
async def export_fifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_fifo_costing(db, user["company_id"], product_id, warehouse_id)
    xlsx = export_service.export_fifo_costing(data)
    return _excel_response(xlsx, "costeo_fifo.xlsx")


@router.get("/export/lifo")
async def export_lifo(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_lifo_costing(db, user["company_id"], product_id, warehouse_id)
    xlsx = export_service.export_lifo_costing(data)
    return _excel_response(xlsx, "costeo_lifo.xlsx")


@router.get("/export/cost-comparison")
async def export_cost_comparison(product_id: str | None = Query(None), warehouse_id: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    data = await service.get_cost_comparison(db, user["company_id"], product_id, warehouse_id)
    xlsx = export_service.export_cost_comparison(data)
    return _excel_response(xlsx, "comparacion_costos.xlsx")


# ==================== REPORTES FINANCIEROS IMPRIMIBLES (Fase 2) ====================
# Estado de Resultados reusa el motor de datos de Gerencial (ventas + costo +
# gastos reales de caja chica) y la plantilla PDF ya construida en
# Contabilidad Integrada -- no se reinventa un tercer calculo de P&L.
# Flujo de Caja reusa el motor real de proyeccion ya construido para
# Cuentas por Pagar (financial.service._compute_daily_cash_flow).

@router.get("/export/pnl.pdf")
async def export_pnl_pdf(fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from api.src.gerencial.service import get_pnl_data
    from api.src.integrated_finance.pdf_reports import generate_pnl_pdf

    company_id = user["company_id"]
    pnl = await get_pnl_data(db, company_id, fecha_desde, fecha_hasta)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = generate_pnl_pdf(company, pnl, generated_by)
    return _pdf_response(pdf_bytes, "estado_de_resultados.pdf")


@router.get("/export/cash-flow.pdf")
async def export_cash_flow_pdf(dias: int = Query(30, ge=7, le=180), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from api.src.financial.service import _compute_daily_cash_flow

    company_id = user["company_id"]
    dias_calc = await _compute_daily_cash_flow(db, company_id, dias)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_cash_flow_pdf(company, dias_calc, dias, generated_by)
    return _pdf_response(pdf_bytes, "flujo_de_caja.pdf")
