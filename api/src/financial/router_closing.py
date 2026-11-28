"""Router para Cierre Mensual de Resultados y Exportación Contable."""
import io
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.db import get_db
from api.src.financial.monthly_closing_service import MonthlyClosingService
from api.src.financial.monthly_closing_excel import generate_closing_excel
from api.src.financial.monthly_closing_pdf import generate_closing_pdf

router = APIRouter(prefix="/closing", tags=["monthly-closing"])


class ExpenseAllocationIn(BaseModel):
    monto: float
    naturaleza_economica: str = "OPEX_GASTO_OPERATIVO"
    cost_center_id: Optional[str] = None
    category_id: Optional[str] = None
    production_area: Optional[str] = None
    notas: Optional[str] = None


class ExpenseReclassifyRequest(BaseModel):
    is_split: bool = False
    naturaleza_economica: str = "OPEX_GASTO_OPERATIVO"
    cost_center_id: Optional[str] = None
    category_id: Optional[str] = None
    production_area: Optional[str] = None
    es_inversion: bool = False
    categoria_activo: Optional[str] = None
    allocations: Optional[List[ExpenseAllocationIn]] = None


@router.get("/summary")
async def get_closing_summary(
    month: int = Query(11, ge=1, le=12),
    year: int = Query(2026, ge=2020),
    company_id: str = Query("80150377-9"),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el resumen ejecutivo consolidado del P&L y KPIs del mes."""
    service = MonthlyClosingService(db)
    return await service.get_monthly_closing_summary(company_id=company_id, month=month, year=year)


@router.get("/details/{magnitude}")
async def get_closing_magnitude_details(
    magnitude: str,
    month: int = Query(11, ge=1, le=12),
    year: int = Query(2026, ge=2020),
    company_id: str = Query("80150377-9"),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene el detalle analítico por comprobante/empleado de una magnitud."""
    service = MonthlyClosingService(db)
    items = await service.get_magnitude_details(company_id=company_id, month=month, year=year, magnitude=magnitude)
    return {
        "magnitude": magnitude,
        "month": month,
        "year": year,
        "count": len(items),
        "items": items
    }


@router.get("/classification-catalogs")
async def get_classification_catalogs(
    company_id: str = Query("80150377-9"),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene los catálogos de centros de costo, categorías contables y naturalezas para redestinación."""
    service = MonthlyClosingService(db)
    return await service.get_classification_catalogs(company_id=company_id)


@router.post("/expenses/{expense_id}/reclassify")
async def reclassify_expense_endpoint(
    expense_id: str,
    body: ExpenseReclassifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """Reclasifica y redestina un comprobante con opción de split por sector."""
    service = MonthlyClosingService(db)
    payload = body.model_dump()
    return await service.reclassify_expense(expense_id=expense_id, payload=payload)


@router.get("/export/excel")
async def export_closing_excel(
    month: int = Query(11, ge=1, le=12),
    year: int = Query(2026, ge=2020),
    company_id: str = Query("80150377-9"),
    db: AsyncSession = Depends(get_db)
):
    """Descarga el libro Excel (.xlsx) de 8 hojas con fórmulas vivas y anexos analíticos."""
    service = MonthlyClosingService(db)
    data = await service.get_monthly_closing_summary(company_id=company_id, month=month, year=year)
    # Cargar detalles analíticos para poblar las hojas secundarias y cuadro puente
    data["details"] = {
        "ingresos": await service.get_magnitude_details(company_id, month, year, "ingresos"),
        "cogs": await service.get_magnitude_details(company_id, month, year, "cogs"),
        "cogs_mp": await service.get_magnitude_details(company_id, month, year, "cogs_mp"),
        "cogs_nc": await service.get_magnitude_details(company_id, month, year, "cogs_nc"),
        "nomina": await service.get_magnitude_details(company_id, month, year, "nomina"),
        "gastos": await service.get_magnitude_details(company_id, month, year, "gastos"),
        "capex": await service.get_magnitude_details(company_id, month, year, "capex"),
        "anticipos": await service.get_magnitude_details(company_id, month, year, "anticipos"),
    }
    excel_bytes = generate_closing_excel(data)
    
    filename = f"Cierre_Resultados_{data['periodo']['mes_nombre']}_{year}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/pdf")
async def export_closing_pdf(
    month: int = Query(11, ge=1, le=12),
    year: int = Query(2026, ge=2020),
    company_id: str = Query("80150377-9"),
    db: AsyncSession = Depends(get_db)
):
    """Descarga el informe ejecutivo en PDF institucional con P&L, cuadro puente y anexos."""
    service = MonthlyClosingService(db)
    data = await service.get_monthly_closing_summary(company_id=company_id, month=month, year=year)
    data["details"] = {
        "ingresos": await service.get_magnitude_details(company_id, month, year, "ingresos"),
        "cogs": await service.get_magnitude_details(company_id, month, year, "cogs"),
        "cogs_mp": await service.get_magnitude_details(company_id, month, year, "cogs_mp"),
        "cogs_nc": await service.get_magnitude_details(company_id, month, year, "cogs_nc"),
        "nomina": await service.get_magnitude_details(company_id, month, year, "nomina"),
        "gastos": await service.get_magnitude_details(company_id, month, year, "gastos"),
        "capex": await service.get_magnitude_details(company_id, month, year, "capex"),
        "anticipos": await service.get_magnitude_details(company_id, month, year, "anticipos"),
    }
    pdf_bytes = generate_closing_pdf(data)
    
    filename = f"Informe_Ejecutivo_{data['periodo']['mes_nombre']}_{year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
