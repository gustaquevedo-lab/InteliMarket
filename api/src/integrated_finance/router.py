"""Integrated Financial Management API — Retenciones, Cierre Contable, Conciliación, Scoring, EBITDA"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.integrated_finance.schemas import (
    WithholdingConfigCreate, WithholdingConfigUpdate, WithholdingConfigResponse,
    WithholdingDocumentCreate, WithholdingDocumentResponse, WithholdingDashboard,
    AccountPlanCreate, AccountPlanResponse,
    AccountingPeriodCreate, AccountingPeriodResponse,
    AccountingEntryCreate, AccountingEntryResponse,
    CollectionActionCreate, CollectionActionResponse,
    CustomerScoreResponse, EbitdaResponse,
    AutoReconcileResult, ConsolidatedDashboard,
)
from api.src.integrated_finance import service, auto_posting, pdf_reports
from datetime import date
from fastapi.responses import StreamingResponse
from sqlalchemy import text
import uuid

router = APIRouter(prefix="/api/v1/integrated-finance", tags=["integrated-finance"])


async def _get_company(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(text("SELECT razon_social, ruc FROM companies WHERE id = :cid"), {"cid": company_id})
    row = r.first()
    return {"razon_social": row.razon_social, "ruc": row.ruc} if row else {"razon_social": "Empresa", "ruc": "N/A"}


def _pdf_response(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/accounting/pnl/{period_id}/pdf")
async def get_pnl_pdf(period_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    pnl = await service.get_pnl(db, company_id, period_id)
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_pnl_pdf(company, pnl)
    return _pdf_response(pdf_bytes, f"estado_resultados_{pnl.get('periodo', period_id[:8])}.pdf")


@router.get("/accounting/trial-balance/{period_id}/pdf")
async def get_trial_balance_pdf(period_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    tb = await service.get_trial_balance(db, company_id, period_id)
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_trial_balance_pdf(company, tb)
    return _pdf_response(pdf_bytes, f"balance_comprobacion_{tb.get('periodo', period_id[:8])}.pdf")


@router.get("/statement/customer/{customer_id}/pdf")
async def get_customer_statement_pdf(customer_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
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
            "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else "-",
            "fecha_vencimiento": r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else "-",
            "monto_original": float(r.monto_original or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": r.dias_mora,
        }
        for r in docs_r.all()
    ]
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_account_statement_pdf(
        company, {"nombre": cust.razon_social, "ruc": cust.ruc}, "cliente", documentos
    )
    return _pdf_response(pdf_bytes, f"estado_cuenta_cliente_{customer_id[:8]}.pdf")


@router.get("/statement/supplier/{supplier_id}/pdf")
async def get_supplier_statement_pdf(supplier_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    sup_r = await db.execute(text("SELECT razon_social, ruc FROM suppliers WHERE id = :id"), {"id": supplier_id})
    sup = sup_r.first()
    if not sup:
        raise HTTPException(404, "Proveedor no encontrado")

    docs_r = await db.execute(
        text("""
            SELECT numero_factura, fecha_emision, fecha_vencimiento, total, saldo_pendiente
            FROM supplier_invoices
            WHERE company_id = :cid AND supplier_id = :sup_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento
        """),
        {"cid": company_id, "sup_id": supplier_id},
    )
    documentos = [
        {
            "numero": r.numero_factura or "-",
            "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else "-",
            "fecha_vencimiento": r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else "-",
            "monto_original": float(r.total or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": None,
        }
        for r in docs_r.all()
    ]
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_account_statement_pdf(
        company, {"nombre": sup.razon_social, "ruc": sup.ruc}, "proveedor", documentos
    )
    return _pdf_response(pdf_bytes, f"estado_cuenta_proveedor_{supplier_id[:8]}.pdf")


@router.post("/accounting/auto-post")
async def run_auto_posting(
    company_id: str = Query(...),
    desde: date = Query(...),
    hasta: date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Postea automaticamente asientos contables desde ventas/compras/pagos/
    cobros/nomina reales para el rango dado. Idempotente: correr de nuevo
    sobre un rango ya posteado no duplica asientos."""
    return await auto_posting.run_auto_posting(db, company_id, desde, hasta)


# ── WITHHOLDING CONFIG ───────────────────────────────────────────────────────

@router.get("/withholding/configs", response_model=list[WithholdingConfigResponse])
async def list_withholding_configs(
    company_id: str = Query(),
    tipo: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_withholding_configs(db, company_id, tipo)


@router.post("/withholding/configs", response_model=WithholdingConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_withholding_config(body: WithholdingConfigCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_withholding_config(db, body)


@router.put("/withholding/configs/{config_id}", response_model=WithholdingConfigResponse)
async def update_withholding_config(config_id: str, body: WithholdingConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_withholding_config(db, config_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return result


@router.get("/withholding/dashboard", response_model=WithholdingDashboard)
async def get_withholding_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_withholding_dashboard(db, company_id)


# ── WITHHOLDING DOCUMENTS ────────────────────────────────────────────────────

@router.get("/withholding/documents", response_model=list[WithholdingDocumentResponse])
async def list_withholding_documents(
    company_id: str = Query(),
    tipo: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_withholding_documents(db, company_id, tipo, estado, limit, offset)


@router.post("/withholding/documents", response_model=WithholdingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_withholding_document(body: WithholdingDocumentCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.create_withholding_document(db, body, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo generar. Verifique configuración de retención para el proveedor")
    return result


@router.post("/withholding/documents/{doc_id}/approve", response_model=WithholdingDocumentResponse)
async def approve_withholding_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.approve_withholding_document(db, doc_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar. El documento debe estar pendiente")
    return result


@router.post("/withholding/documents/{doc_id}/send", response_model=WithholdingDocumentResponse)
async def send_withholding_to_sifen(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.send_withholding_to_sifen(db, doc_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo enviar a SIFEN")
    return result


# ── ACCOUNT PLAN ──────────────────────────────────────────────────────────────

@router.get("/account-plan", response_model=list[AccountPlanResponse])
async def list_account_plans(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_account_plans(db, company_id)


@router.post("/account-plan", response_model=AccountPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_account_plan(body: AccountPlanCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_account_plan(db, body)


# ── ACCOUNTING PERIODS ────────────────────────────────────────────────────────

@router.get("/accounting/periods", response_model=list[AccountingPeriodResponse])
async def list_accounting_periods(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_accounting_periods(db, company_id)


@router.post("/accounting/periods", response_model=AccountingPeriodResponse, status_code=status.HTTP_201_CREATED)
async def open_accounting_period(body: AccountingPeriodCreate, db: AsyncSession = Depends(get_db)):
    return await service.open_accounting_period(db, body)


@router.post("/accounting/periods/{period_id}/close", response_model=AccountingPeriodResponse)
async def close_accounting_period(period_id: str, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.close_accounting_period(db, period_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cerrar. El período debe estar abierto")
    return result


# ── ACCOUNTING ENTRIES ───────────────────────────────────────────────────────

@router.get("/accounting/entries", response_model=list[AccountingEntryResponse])
async def list_accounting_entries(
    company_id: str = Query(),
    period_id: str = Query(),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from api.src.integrated_finance.models import AccountingEntry as AEModel
    import uuid
    q = select(AEModel).where(
        AEModel.company_id == uuid.UUID(company_id),
        AEModel.period_id == uuid.UUID(period_id),
    ).order_by(AEModel.fecha.desc()).offset(offset).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


@router.post("/accounting/entries", response_model=AccountingEntryResponse, status_code=status.HTTP_201_CREATED)
async def post_accounting_entry(body: AccountingEntryCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.post_accounting_entry(db, body, user_id)


@router.get("/accounting/trial-balance", response_model=dict)
async def get_trial_balance(
    company_id: str = Query(),
    period_id: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_trial_balance(db, company_id, period_id)


@router.get("/accounting/pnl", response_model=dict)
async def get_pnl(
    company_id: str = Query(),
    period_id: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_pnl(db, company_id, period_id)


# ── COLLECTION ACTIONS ───────────────────────────────────────────────────────

@router.get("/collection", response_model=list[CollectionActionResponse])
async def list_collection_actions(
    company_id: str = Query(),
    customer_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_collection_actions(db, company_id, customer_id, limit, offset)


@router.post("/collection", response_model=CollectionActionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection_action(body: CollectionActionCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.create_collection_action(db, body, user_id)


@router.get("/collection/dashboard", response_model=dict)
async def get_collection_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_collection_dashboard(db, company_id)


# ── CUSTOMER SCORING ─────────────────────────────────────────────────────────

@router.get("/scoring", response_model=list[CustomerScoreResponse])
async def list_customer_scores(
    company_id: str = Query(),
    min_score: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_customer_scores(db, company_id, min_score)


@router.get("/scoring/{customer_id}", response_model=CustomerScoreResponse)
async def get_customer_score(company_id: str = Query(), customer_id: str = Path(), db: AsyncSession = Depends(get_db)):
    result = await service.get_customer_score(db, company_id, customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Score no encontrado. Recalcule primero")
    return result


@router.post("/scoring/{customer_id}/recalculate", response_model=CustomerScoreResponse)
async def recalculate_score(
    company_id: str = Query(),
    customer_id: str = Path(),
    db: AsyncSession = Depends(get_db),
):
    return await service.recalculate_score(db, company_id, customer_id)


# ── EBITDA ────────────────────────────────────────────────────────────────────

@router.get("/ebitda", response_model=EbitdaResponse)
async def get_ebitda(
    company_id: str = Query(),
    periodo: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.compute_ebitda(db, company_id, periodo)


# ── AUTO RECONCILIATION ──────────────────────────────────────────────────────

@router.post("/reconciliation/auto", response_model=AutoReconcileResult)
async def auto_reconcile(
    company_id: str = Query(),
    bank_account_id: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.auto_reconcile(db, company_id, bank_account_id)


# ── CONSOLIDATED DASHBOARD ────────────────────────────────────────────────────

@router.get("/dashboard", response_model=ConsolidatedDashboard)
async def get_consolidated_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_consolidated_dashboard(db, company_id)


@router.post("/reconciliation/import-statement")
async def import_bank_statement(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    from decimal import Decimal
    from api.src.financial.models import BankTransaction
    company_id = body.get("company_id", "00000000-0000-0000-0000-000000000010")
    bank_account_id = body.get("bank_account_id")
    banco_nombre = body.get("banco_nombre", "Banco Itaú Paraguay")
    lineas = body.get("lineas", [])

    cid = uuid.UUID(company_id)
    baid = uuid.UUID(bank_account_id) if bank_account_id else uuid.UUID("00000000-0000-0000-0000-000000000010")

    imported = 0
    for l in lineas:
        monto = float(l.get("monto", 0))
        tipo = l.get("tipo", "credito") # credito / debito
        concepto = l.get("concepto", "Movimiento de extracto")
        referencia = l.get("referencia")
        fecha = l.get("fecha") or str(date.today())

        db.add(BankTransaction(
            company_id=cid,
            bank_account_id=baid,
            tipo=tipo,
            monto=Decimal(str(abs(monto))),
            moneda="PYG",
            descripcion=concepto,
            referencia=referencia,
            conciliado=False,
            created_at=service._now()
        ))
        imported += 1

    await db.commit()

    # Automatically run auto-reconciliation
    recon_result = await service.auto_reconcile(db, company_id, str(baid))
    recon_result["lineas_importadas"] = imported
    return recon_result
