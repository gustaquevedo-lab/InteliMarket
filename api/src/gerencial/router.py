import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.gerencial import service
from api.src.gerencial.schemas import GerencialDashboard, DeptoPylItem, ProductoRanking, AlertasNegocio
from api.src.integrated_finance import pdf_reports
from sqlalchemy import text

router = APIRouter(prefix="/api/v1/gerencial", tags=["gerencial"])


def _excel_response(data: bytes, filename: str):
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/dashboard", response_model=GerencialDashboard)
async def get_dashboard(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"], desde, hasta)


@router.get("/deptos", response_model=list[DeptoPylItem])
async def get_deptos(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_depto_pyl(db, user["company_id"], desde, hasta)


@router.get("/ranking", response_model=list[ProductoRanking])
async def get_ranking(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_ranking(db, user["company_id"], desde, hasta, limit)


@router.get("/alertas-negocio", response_model=AlertasNegocio)
async def get_alertas_negocio(
    margen_umbral: float = Query(15.0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_alertas_negocio(db, user["company_id"], margen_umbral)


@router.get("/export/pnl.pdf")
async def export_pnl_pdf(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    pnl = await service.get_pnl_data(db, user["company_id"], desde, hasta)
    comp_r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": user["company_id"]})
    comp = comp_r.first()
    company = {"razon_social": comp.razon_social, "ruc": comp.ruc, "logo_url": comp.logo_url} if comp else {"razon_social": "Empresa", "ruc": "N/A"}
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_pnl_pdf(company, pnl, generated_by)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=estado_resultados.pdf"},
    )


@router.get("/export/{report_type}")
async def export_report(
    report_type: str,
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data = await service.export_excel(db, user["company_id"], report_type, desde, hasta)
    filenames = {"dashboard": "dashboard_gerencial.xlsx", "deptos": "pyl_departamentos.xlsx", "ranking": "ranking_productos.xlsx"}
    return _excel_response(data, filenames.get(report_type, "reporte.xlsx"))
