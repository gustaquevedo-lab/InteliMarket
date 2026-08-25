from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.src.db import get_db
from api.src.accounts_receivable import service
from api.src.accounts_receivable import export_service as ar_export_service
from api.src.accounts_receivable import pdf_reports as ar_pdf_reports
from api.src.accounts_receivable.schemas import ReceivablePaymentCreate
from api.src.integrated_finance import pdf_reports
from api.src.auth.middleware import require_auth

router = APIRouter(prefix="/api/v1", tags=["accounts-receivable"])


async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    row = r.first()
    return {"razon_social": row.razon_social, "ruc": row.ruc, "logo_url": row.logo_url} if row else {"razon_social": "Empresa", "ruc": "N/A"}


@router.get("/companies/{company_id}/accounts-receivable")
async def list_receivables(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_accounts_receivable(db, company_id, customer_id, estado, search, limit, offset)


@router.get("/companies/{company_id}/accounts-receivable/count")
async def count_receivables(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return {"total": await service.count_accounts_receivable(db, company_id, customer_id, estado)}


@router.get("/companies/{company_id}/accounts-receivable/aging")
async def aging_report(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_aging_report(db, company_id)


# ── Reportes exportables (Aging y Cobranzas), Excel + PDF, con rango de fechas ──

@router.get("/companies/{company_id}/accounts-receivable/export/aging.xlsx")
async def export_aging_xlsx(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    aging = await service.get_aging_for_report(db, company_id, fecha_desde, fecha_hasta)
    xlsx = ar_export_service.export_aging_excel(aging, fecha_desde, fecha_hasta)
    return StreamingResponse(
        iter([xlsx]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=aging_cuentas_por_cobrar.xlsx"},
    )


@router.get("/companies/{company_id}/accounts-receivable/export/aging.pdf")
async def export_aging_pdf(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    aging = await service.get_aging_for_report(db, company_id, fecha_desde, fecha_hasta)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = ar_pdf_reports.generate_aging_report_pdf(company, aging, fecha_desde, fecha_hasta, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=aging_cuentas_por_cobrar.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/companies/{company_id}/accounts-receivable/export/cobranzas.xlsx")
async def export_cobranzas_xlsx(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    payments = await service.list_payments_period(db, company_id, fecha_desde, fecha_hasta)
    xlsx = ar_export_service.export_cobranzas_excel(payments, fecha_desde, fecha_hasta)
    return StreamingResponse(
        iter([xlsx]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cobranzas.xlsx"},
    )


@router.get("/companies/{company_id}/accounts-receivable/export/cobranzas.pdf")
async def export_cobranzas_pdf(
    company_id: str, fecha_desde: date | None = Query(None), fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    payments = await service.list_payments_period(db, company_id, fecha_desde, fecha_hasta)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = ar_pdf_reports.generate_cobranzas_report_pdf(company, payments, fecha_desde, fecha_hasta, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=cobranzas.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/companies/{company_id}/accounts-receivable/summary")
async def receivable_summary(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_receivable_summary(db, company_id)


@router.get("/companies/{company_id}/accounts-receivable/customers/{customer_id}/pending")
async def customer_pending_documents(company_id: str, customer_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_customer_pending_documents(db, company_id, customer_id)


@router.get("/companies/{company_id}/accounts-receivable/customers/{customer_id}/payments")
async def customer_payment_history(company_id: str, customer_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_payments_for_customer(db, company_id, customer_id)


@router.get("/accounts-receivable/{receivable_id}/payments")
async def document_payment_history(receivable_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_payments_for_document(db, receivable_id)


@router.post("/companies/{company_id}/accounts-receivable/payments")
async def register_payment(company_id: str, body: ReceivablePaymentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.create_receivable_payment(db, company_id, body, user.get("id"))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/companies/{company_id}/accounts-receivable/customers/{customer_id}/statement.pdf")
async def customer_statement_pdf(company_id: str, customer_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    cust_r = await db.execute(text("SELECT razon_social, ruc FROM customers WHERE id = :id"), {"id": customer_id})
    cust = cust_r.first()
    if not cust:
        raise HTTPException(404, "Cliente no encontrado")

    docs_r = await db.execute(
        text("""
            SELECT numero_documento, fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, dias_mora
            FROM accounts_receivable
            WHERE company_id = :cid AND customer_id = :cust_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento
        """),
        {"cid": company_id, "cust_id": customer_id},
    )
    documentos = [
        {
            "numero": r.numero_documento or "-",
            "fecha_emision": r.fecha_emision.strftime("%d/%m/%Y") if r.fecha_emision else "-",
            "fecha_vencimiento": r.fecha_vencimiento.strftime("%d/%m/%Y") if r.fecha_vencimiento else "-",
            "monto_original": float(r.monto_original or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": r.dias_mora,
        }
        for r in docs_r.all()
    ]

    comp_r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    comp = comp_r.first()
    company = {"razon_social": comp.razon_social, "ruc": comp.ruc, "logo_url": comp.logo_url} if comp else {"razon_social": "Empresa", "ruc": "N/A"}
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"

    pdf_bytes = pdf_reports.generate_account_statement_pdf(
        company, {"nombre": cust.razon_social, "ruc": cust.ruc}, "cliente", documentos, generated_by
    )
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=estado_cuenta_{customer_id[:8]}.pdf",
            "Content-Length": str(len(pdf_bytes)),
        },
    )
