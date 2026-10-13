from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date, timedelta

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.petty_cash import service, pdf_reports, expense_pdf
from api.src.petty_cash.schemas import (
    ExpenseCategoryCreate, ExpenseCategoryResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseSummary,
    CostCenterCreate, CostCenterResponse, ExpenseDashboard,
    PettyCashFundCreate, PettyCashFundUpdate, PettyCashFundResponse, PettyCashFundMovementResponse,
    ExpenseApprovalConfig, ExpenseRejectBody, FundReplenishRequest,
    ExpenseVoidBody, ComprobanteUploadResponse,
    ExpenseRevertPaymentRequest, ExpenseBatchRevertPaymentRequest,
    FundCountCreate, FundCountConfirm, PettyCashFundCountResponse,
    PettyCashRendicionCreate, PettyCashRendicionAuditRequest, PettyCashRendicionReplenishRequest,
    PettyCashRendicionResponse, PettyCashRendicionDetailResponse,
    ExpenseDisburseRequest, ExpenseDisbursementResponse,
)

async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(
        text("SELECT razon_social, nombre_fantasia, ruc, direccion, ciudad, logo_url FROM companies WHERE id = :cid"),
        {"cid": company_id}
    )
    row = r.first()
    if row:
        return {
            "razon_social": row.razon_social or "GRUPO SANTA TERESA E.A.S.",
            "nombre_fantasia": row.nombre_fantasia or "EXTRA SUPERMERCADO MAYORISTA",
            "ruc": row.ruc or "80150377-9",
            "direccion": row.direccion or "Alejo Garcia esq. Carlos Antonio López",
            "ciudad": row.ciudad or "Pedro Juan Caballero",
            "logo_url": row.logo_url,
        }
    return {
        "razon_social": "GRUPO SANTA TERESA E.A.S.",
        "nombre_fantasia": "EXTRA SUPERMERCADO MAYORISTA",
        "ruc": "80150377-9",
        "direccion": "Alejo Garcia esq. Carlos Antonio López",
        "ciudad": "Pedro Juan Caballero",
    }


def _pdf_response(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}", "Content-Length": str(len(pdf_bytes))},
    )


router = APIRouter(
    prefix="/api/v1/expenses",
    tags=["expenses"],
)

funds_router = APIRouter(
    prefix="/api/v1/petty-cash-funds",
    tags=["expenses"],
)


@funds_router.get("", response_model=list[PettyCashFundResponse])
async def list_funds(
    activo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_funds(db, user["company_id"], activo=activo)


@funds_router.post("", response_model=PettyCashFundResponse, status_code=status.HTTP_201_CREATED)
async def create_fund(
    data: PettyCashFundCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_fund(db, user["company_id"], data, user.get("id"))


@funds_router.get("/reports/funds-status")
async def get_funds_status_report_endpoint(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_funds_detailed_summary(db, user["company_id"])


@funds_router.get("/reports/funds-status.pdf")
async def export_funds_status_pdf_endpoint(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    company = await _get_company_info(db, user["company_id"])
    funds = await service.get_funds_detailed_summary(db, user["company_id"])
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_libro_fondos_fijos_pdf(company, funds, generated_by)
    return _pdf_response(pdf_bytes, f"estado_fondos_fijos_{date.today()}.pdf")


@funds_router.get("/{fund_id}/export/rendicion.pdf")
async def export_fund_rendicion_pdf_endpoint(
    fund_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    company = await _get_company_info(db, user["company_id"])
    data = await service.get_fund_rendicion_data(db, user["company_id"], fund_id)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_rendicion_fondo_fijo_pdf(company, data["fund"], data["expenses"], generated_by)
    nombre_limpio = data["fund"]["nombre"].replace(" ", "_").lower()
    return _pdf_response(pdf_bytes, f"acta_rendicion_{nombre_limpio}_{date.today()}.pdf")


# ── Rendición de Cuentas y Solicitud de Reposición Formal ──

@funds_router.post("/rendiciones", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_rendicion_endpoint(
    data: PettyCashRendicionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.create_rendicion(db, user["company_id"], data, user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@funds_router.get("/rendiciones", response_model=list[dict])
async def list_rendiciones_endpoint(
    fund_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_rendiciones(db, user["company_id"], fund_id=fund_id, estado=estado)


@funds_router.get("/rendiciones/{rendicion_id}", response_model=dict)
async def get_rendicion_detail_endpoint(
    rendicion_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.get_rendicion_detail(db, user["company_id"], rendicion_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@funds_router.post("/rendiciones/{rendicion_id}/audit", response_model=dict)
async def audit_rendicion_endpoint(
    rendicion_id: str,
    data: PettyCashRendicionAuditRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.audit_rendicion(db, user["company_id"], rendicion_id, data, user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@funds_router.post("/rendiciones/{rendicion_id}/replenish", response_model=dict)
async def replenish_rendicion_endpoint(
    rendicion_id: str,
    data: PettyCashRendicionReplenishRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.replenish_rendicion(db, user["company_id"], rendicion_id, data, user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@funds_router.post("/rendiciones/{rendicion_id}/expenses/{expense_id}/unlink", response_model=dict)
async def unlink_expense_from_rendicion_endpoint(
    rendicion_id: str,
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.unlink_expense_from_rendicion(db, user["company_id"], rendicion_id, expense_id, user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@funds_router.get("/rendiciones/{rendicion_id}/export.pdf")
async def export_rendicion_pdf_endpoint(
    rendicion_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        data = await service.get_rendicion_pdf_data(db, user["company_id"], rendicion_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    company = await _get_company_info(db, user["company_id"])
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_rendicion_fondo_fijo_pdf(
        company,
        data["fund"],
        data["expenses"],
        generated_by=generated_by,
    )
    nro = data["rendicion"]["numero_rendicion"]
    return _pdf_response(pdf_bytes, f"expediente_{nro}.pdf")


@funds_router.patch("/{fund_id}", response_model=PettyCashFundResponse)
async def update_fund(
    fund_id: str,
    data: PettyCashFundUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_fund(db, fund_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Fondo no encontrado")
    return result


@funds_router.post("/{fund_id}/replenish", response_model=PettyCashFundResponse)
async def replenish_fund(
    fund_id: str,
    data: FundReplenishRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para reponer un fondo de caja chica")

    result = await service.replenish_fund(db, user["company_id"], fund_id, data, user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result["fund"]


@funds_router.get("/{fund_id}/movements", response_model=list[PettyCashFundMovementResponse])
async def list_fund_movements(
    fund_id: str,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_fund_movements(db, fund_id, limit=limit)


# ── Arqueo de caja chica (Fase 5) ──────────────────────────────

@funds_router.get("/counts/pending", response_model=list[PettyCashFundCountResponse])
async def list_pending_fund_counts(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_pending_fund_counts(db, user["company_id"])


@funds_router.post("/{fund_id}/counts", response_model=PettyCashFundCountResponse, status_code=status.HTTP_201_CREATED)
async def create_fund_count(
    fund_id: str,
    data: FundCountCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.create_fund_count(db, user["company_id"], fund_id, data, user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result["count"]


@funds_router.get("/{fund_id}/counts", response_model=list[PettyCashFundCountResponse])
async def list_fund_counts(
    fund_id: str,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_fund_counts(db, fund_id, limit=limit)


@funds_router.post("/counts/{count_id}/confirm", response_model=PettyCashFundCountResponse)
async def confirm_fund_count(
    count_id: str,
    data: FundCountConfirm,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.confirm_fund_count(db, user["company_id"], count_id, user["id"], user["tenant_id"], data)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["count"]


# ── Categories ──────────────────────────────────────────────

@router.get("/categories", response_model=list[ExpenseCategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_categories(db, user["company_id"])


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_category(db, user["company_id"], data)


# ── Cost centers (sectores) ────────────────────────────────

@router.get("/cost-centers", response_model=list[CostCenterResponse])
async def list_cost_centers(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_cost_centers(db, user["company_id"])


@router.post("/cost-centers", response_model=CostCenterResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_center(
    data: CostCenterCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_cost_center(db, user["company_id"], data)


# ── Expenses ────────────────────────────────────────────────

@router.get("", response_model=list[ExpenseResponse])
async def list_expenses(
    branch_id: Optional[str] = Query(None),
    fund_id: Optional[str] = Query(None),
    rendicion_id: Optional[str] = Query(None),
    sin_rendicion: Optional[bool] = Query(None),
    category_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    monto: Optional[float] = Query(None),
    monto_min: Optional[float] = Query(None),
    monto_max: Optional[float] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_expenses(
        db, user["company_id"], branch_id=branch_id, fund_id=fund_id,
        rendicion_id=rendicion_id, sin_rendicion=sin_rendicion,
        category_id=category_id, estado=estado, desde=desde, hasta=hasta,
        search=search, monto=monto, monto_min=monto_min, monto_max=monto_max,
        limit=limit, offset=offset
    )


@router.get("/summary", response_model=ExpenseSummary)
async def expense_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_summary(db, user["company_id"])


@router.get("/dashboard", response_model=ExpenseDashboard)
async def expense_dashboard(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    hasta = fecha_hasta or date.today()
    desde = fecha_desde or (hasta - timedelta(days=29))
    return await service.get_expense_dashboard(db, user["company_id"], desde, hasta)


@router.get("/reports/by-sector")
async def get_expenses_by_sector_report_endpoint(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_expenses_by_sector_report(db, user["company_id"], fecha_desde, fecha_hasta)


@router.get("/reports/by-sector.pdf")
async def export_expenses_by_sector_pdf_endpoint(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    company = await _get_company_info(db, user["company_id"])
    data = await service.get_expenses_by_sector_report(db, user["company_id"], fecha_desde, fecha_hasta)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_gastos_por_sector_pdf(company, data, fecha_desde, fecha_hasta, generated_by)
    return _pdf_response(pdf_bytes, f"gastos_por_sector_{fecha_desde}_{fecha_hasta}.pdf")


@router.get("/reports/fiscal-purchases")
async def get_fiscal_purchases_report_endpoint(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    fund_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_fiscal_purchases_report(db, user["company_id"], fecha_desde, fecha_hasta, fund_id=fund_id)


@router.get("/reports/fiscal-purchases.pdf")
async def export_fiscal_purchases_pdf_endpoint(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    fund_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    company = await _get_company_info(db, user["company_id"])
    data = await service.get_fiscal_purchases_report(db, user["company_id"], fecha_desde, fecha_hasta, fund_id=fund_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_libro_compras_fiscal_pdf(company, data, fecha_desde, fecha_hasta, generated_by)
    return _pdf_response(pdf_bytes, f"libro_compras_fiscal_{fecha_desde}_{fecha_hasta}.pdf")


@router.get("/config/approval", response_model=ExpenseApprovalConfig)
async def get_approval_config(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_approval_config(db, user["company_id"])


@router.patch("/config/approval", response_model=ExpenseApprovalConfig)
async def update_approval_config(
    data: ExpenseApprovalConfig,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para configurar el umbral de aprobación")
    return await service.update_approval_config(db, user["company_id"], data)


@router.post("/{expense_id}/approve", response_model=ExpenseResponse)
async def approve_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.approve_expense(db, expense_id, user["id"], user["tenant_id"])
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["expense"]


@router.post("/{expense_id}/reject", response_model=ExpenseResponse)
async def reject_expense(
    expense_id: str,
    body: ExpenseRejectBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.reject_expense(db, expense_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["expense"]


@router.post("/{expense_id}/void", response_model=ExpenseResponse)
async def void_expense(
    expense_id: str,
    body: ExpenseVoidBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.void_expense(db, expense_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["expense"]


@router.post("/{expense_id}/revert-payment", response_model=ExpenseResponse)
async def revert_expense_payment(
    expense_id: str,
    body: ExpenseRevertPaymentRequest = ExpenseRevertPaymentRequest(),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Revierte la condición de 'pagado' de un gasto (legacy o liquidado)
    para permitir incluirlo en una rendición o gestionarlo con el flujo InteliMarket."""
    return await service.revert_expense_payment(
        db=db,
        expense_id=expense_id,
        user_id=user["id"],
        tenant_id=user["company_id"],
        fund_id=body.fund_id,
        nuevo_estado=body.nuevo_estado or "aprobado",
        motivo=body.motivo,
    )


@router.post("/batch-revert-payments")
async def revert_expenses_batch(
    body: ExpenseBatchRevertPaymentRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Revierte la condición de 'pagado' de múltiples gastos en bloque
    para asignarlos a un fondo fijo o prepararlos para rendición."""
    return await service.revert_expenses_batch(
        db=db,
        company_id=user["company_id"],
        expense_ids=body.expense_ids,
        user_id=user["id"],
        fund_id=body.fund_id,
        nuevo_estado=body.nuevo_estado or "aprobado",
        motivo=body.motivo,
    )



@router.post("/upload-comprobante", response_model=ComprobanteUploadResponse)
async def upload_comprobante(
    file: UploadFile = File(...),
    user=Depends(require_auth),
):
    content = await file.read()
    try:
        url = service.save_comprobante(content, file.filename or "comprobante")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ComprobanteUploadResponse(url=url, filename=file.filename or "comprobante")


@router.get("/export/report.pdf")
async def export_expenses_report_pdf(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    estado: Optional[str] = None,
    fund_id: Optional[str] = None,
    category_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Genera el Reporte Analítico Consolidado de Gastos en PDF con filtros."""
    expenses = await service.list_expenses(
        db=db,
        company_id=user["company_id"],
        branch_id=branch_id,
        fund_id=fund_id,
        category_id=category_id,
        estado=estado,
        desde=desde,
        hasta=hasta,
        limit=500,
    )
    company = await _get_company_info(db, user["company_id"])

    # Mapear nombres de centros de costo y categorías
    cc_res = (await db.execute(text("SELECT id, nombre FROM cost_centers WHERE company_id = :cid"), {"cid": user["company_id"]})).fetchall()
    cc_map = {str(r.id): r.nombre for r in cc_res}
    cat_res = (await db.execute(text("SELECT id, nombre FROM expense_categories WHERE company_id = :cid"), {"cid": user["company_id"]})).fetchall()
    cat_map = {str(r.id): r.nombre for r in cat_res}

    exp_list = []
    for e in expenses:
        exp_list.append({
            "id": str(e.id),
            "fecha_gasto": str(e.fecha_gasto) if e.fecha_gasto else None,
            "tipo_comprobante": e.tipo_comprobante,
            "numero_factura": e.numero_factura,
            "proveedor": e.proveedor,
            "ruc": e.ruc,
            "cost_center_nombre": cc_map.get(str(e.cost_center_id), ""),
            "forma_pago_resumen": e.forma_pago_resumen,
            "tipo_pago": e.tipo_pago,
            "estado": e.estado,
            "monto": float(e.monto or 0),
            "iva_10": float(e.iva_10 or 0),
        })

    filters = {
        "desde": str(desde) if desde else None,
        "hasta": str(hasta) if hasta else None,
        "estado": estado,
        "cost_center_nombre": None,
        "category_nombre": cat_map.get(category_id) if category_id else None,
    }

    pdf_bytes = expense_pdf.generate_expenses_analytical_report_pdf(
        company=company,
        expenses=exp_list,
        filters=filters,
        generated_by=user.get("nombre") or "Tesorería",
    )
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=reporte_gastos_{date.today().isoformat()}.pdf"}
    )


@router.get("/staff-candidates")
async def list_staff_candidates(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_staff_candidates(db, user["company_id"], search)


@router.get("/sueldok-advances")
async def list_sueldok_advances(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_sueldok_approved_advances(db, user["company_id"], search)


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_expense(db, expense_id)
    if not result:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return result


@router.post("/{expense_id}/disburse", response_model=ExpenseResponse)
async def disburse_expense(
    expense_id: str,
    data: ExpenseDisburseRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Paso 3: Liquidar y desembolsar medios de pago para un gasto (Bóveda, Fondo Fijo, Banco, Cheque)."""
    user_nombre = user.get("nombre") or user.get("username") or "Tesorería"
    return await service.disburse_expense(
        db=db,
        company_id=user["company_id"],
        expense_id=expense_id,
        data=data,
        user_id=user["id"],
        user_nombre=user_nombre,
    )


@router.get("/{expense_id}/disbursements", response_model=list[ExpenseDisbursementResponse])
async def get_expense_disbursements(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_expense_disbursements(db, expense_id)


@router.get("/{expense_id}/pdf")
async def get_expense_receipt_pdf(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Genera el Recibo Oficial / Orden de Pago de Gasto en PDF con membrete y firmas."""
    exp = await service.get_expense(db, expense_id)
    if not exp or str(exp.company_id) != user["company_id"]:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")

    disbursements = await service.list_expense_disbursements(db, expense_id)
    company = await _get_company_info(db, user["company_id"])

    exp_dict = {
        "id": str(exp.id),
        "monto": float(exp.monto or 0),
        "estado": exp.estado,
        "descripcion": exp.descripcion,
        "proveedor": exp.proveedor,
        "ruc": exp.ruc,
        "timbrado": exp.timbrado,
        "numero_factura": exp.numero_factura,
        "tipo_comprobante": exp.tipo_comprobante,
        "fecha_gasto": str(exp.fecha_gasto) if exp.fecha_gasto else None,
        "fecha_pago": str(exp.fecha_pago) if exp.fecha_pago else None,
        "forma_pago_resumen": exp.forma_pago_resumen,
        "gravado_10": float(exp.gravado_10 or 0),
        "iva_10": float(exp.iva_10 or 0),
        "gravado_5": float(exp.gravado_5 or 0),
        "iva_5": float(exp.iva_5 or 0),
        "exentas": float(exp.exentas or 0),
    }
    if exp.cost_center_id:
        cc = (await db.execute(text("SELECT nombre FROM cost_centers WHERE id = :id"), {"id": str(exp.cost_center_id)})).scalar()
        exp_dict["cost_center_nombre"] = cc

    disb_list = []
    for d in disbursements:
        disb_list.append({
            "medio_pago": d.medio_pago,
            "monto": float(d.monto or 0),
            "numero_comprobante": d.numero_comprobante,
            "fecha_efectiva": str(d.fecha_efectiva) if d.fecha_efectiva else None,
            "detalles": d.detalles or {},
        })

    pdf_bytes = expense_pdf.generate_expense_receipt_pdf(
        company=company,
        expense=exp_dict,
        disbursements=disb_list,
        generated_by=user.get("nombre") or "Tesorería",
    )
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=recibo_gasto_{str(exp.id)[:8]}.pdf"}
    )



@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.create_expense(db, user["company_id"], data, user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    data: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        result = await service.update_expense(db, expense_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return result


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_expense(db, expense_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
