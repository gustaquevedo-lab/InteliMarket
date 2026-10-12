"""Router para Cierre Mensual de Resultados y Exportación Contable."""
import io
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.db import get_db
from api.src.financial.monthly_closing_service import MonthlyClosingService
from api.src.financial.monthly_closing_excel import generate_closing_excel
from api.src.financial.monthly_closing_pdf import generate_closing_pdf

router = APIRouter(prefix="/closing", tags=["monthly-closing"])


@router.get("/summary")
async def get_closing_summary(
    month: int = Query(9, ge=1, le=12),
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
    month: int = Query(9, ge=1, le=12),
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


@router.get("/export/excel")
async def export_closing_excel(
    month: int = Query(9, ge=1, le=12),
    year: int = Query(2026, ge=2020),
    company_id: str = Query("80150377-9"),
    db: AsyncSession = Depends(get_db)
):
    """Descarga el libro Excel (.xlsx) de 8 hojas con fórmulas vivas."""
    service = MonthlyClosingService(db)
    data = await service.get_monthly_closing_summary(company_id=company_id, month=month, year=year)
    excel_bytes = generate_closing_excel(data)
    
    filename = f"Cierre_Resultados_{data['periodo']['mes_nombre']}_{year}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/pdf")
async def export_closing_pdf(
    month: int = Query(9, ge=1, le=12),
    year: int = Query(2026, ge=2020),
    company_id: str = Query("80150377-9"),
    db: AsyncSession = Depends(get_db)
):
    """Descarga el informe ejecutivo en PDF institucional para Directorio."""
    service = MonthlyClosingService(db)
    data = await service.get_monthly_closing_summary(company_id=company_id, month=month, year=year)
    pdf_bytes = generate_closing_pdf(data)
    
    filename = f"Informe_Ejecutivo_{data['periodo']['mes_nombre']}_{year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
