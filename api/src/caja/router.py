"""Caja (Cash Register) API router"""

from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.caja.schemas import (
    CashRegisterCreate, CashRegisterUpdate, CashRegisterResponse,
    CashSessionCreate, CashSessionClose, CashSessionResponse, CashDropCreate,
    ConfirmHandoffRequest, DepositVaultEntriesRequest, RejectVaultDepositRequest,
    ConfirmCashDropRequest, RejectCashDropRequest,
)
from api.src.caja import service
from api.src.caja import pdf_reports

router = APIRouter(prefix="/api/v1", tags=["caja"], dependencies=[Depends(require_auth)])


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


@router.get("/cash-registers", response_model=list[CashRegisterResponse])
async def list_registers(
    branch_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_registers(db, user["company_id"], branch_id)


@router.get("/cash-registers/{register_id}", response_model=CashRegisterResponse)
async def get_register(register_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.get_register(db, register_id, user["company_id"])
    if not result:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    return result


@router.post("/cash-registers", response_model=CashRegisterResponse, status_code=status.HTTP_201_CREATED)
async def create_register(body: CashRegisterCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_register(db, {**body.model_dump(), "company_id": user["company_id"]})


@router.put("/cash-registers/{register_id}", response_model=CashRegisterResponse)
async def update_register(register_id: str, body: CashRegisterUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.update_register(db, register_id, user["company_id"], body.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    return result


@router.delete("/cash-registers/{register_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_register(register_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    ok = await service.delete_register(db, register_id, user["company_id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Caja no encontrada")


@router.get("/cash-registers/{register_id}/open-session")
async def get_open_session(register_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_open_session(db, register_id)
    return result


@router.get("/cash-sessions")
async def list_sessions(
    company_id: str = Query(),
    register_id: str | None = Query(None),
    user_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_sessions(db, company_id, register_id, user_id, estado, limit=limit, offset=offset)


@router.get("/cash-sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_session_with_summary(db, session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Sesi\u00f3n no encontrada")
    return result


@router.post("/cash-sessions", response_model=CashSessionResponse, status_code=status.HTTP_201_CREATED)
async def open_session(body: CashSessionCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await service.open_session(db, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cash-sessions/{session_id}/close")
async def close_session(session_id: str, body: CashSessionClose, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.close_session(
        db, session_id, body.monto_cierre_real, body.monto_cierre_usd, body.monto_cierre_brl, body.observaciones,
        tenant_id=user.get("tenant_id"),
    )
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cerrar la sesi\u00f3n")
    return result


@router.get("/cash-register-movements")
async def list_register_movements(company_id: str = Query(), tipo: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.list_register_movements(db, company_id, tipo)


@router.get("/cash-sessions-summary")
async def list_sessions_summary(
    company_id: str = Query(),
    register_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=5000),
    offset: int = Query(0, ge=0),
    fecha_desde: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    parsed_fecha = None
    if fecha_desde:
        from datetime import datetime as _dt
        parsed_fecha = _dt.fromisoformat(fecha_desde)
    return await service.list_sessions_with_totals(db, company_id, register_id, estado, limit=limit, offset=offset, fecha_desde=parsed_fecha)


@router.get("/cash-sessions/{session_id}/payment-breakdown")
async def session_payment_breakdown(session_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_session_payment_breakdown(db, session_id)


@router.post("/cash-sessions/{session_id}/cash-drop", status_code=status.HTTP_201_CREATED)
async def cash_drop(session_id: str, body: CashDropCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.register_cash_drop(
        db, session_id, body.monto, body.monto_usd, body.monto_brl, body.observaciones, registrado_por=user.get("id"),
    )
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo registrar el retiro (¿la sesión está abierta?)")
    return result


@router.get("/cash-drop-requests")
async def list_cash_drop_requests(
    company_id: str = Query(...), estado: str | None = Query("pendiente"), db: AsyncSession = Depends(get_db),
):
    return await service.list_cash_drop_requests(db, company_id, estado)


@router.post("/cash-drop-requests/{request_id}/confirm")
async def confirm_cash_drop_request(request_id: str, body: ConfirmCashDropRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.confirm_cash_drop_request(
        db, request_id, user["company_id"], str(body.confirmado_por), body.confirmado_por_nombre,
        body.monto_confirmado_pyg, body.monto_confirmado_usd, body.monto_confirmado_brl,
    )
    if result == "forbidden":
        raise HTTPException(status_code=403, detail="Solo un supervisor o administrador puede confirmar un retiro")
    if not result:
        raise HTTPException(status_code=400, detail="Retiro no encontrado o ya resuelto")
    return result


@router.post("/cash-drop-requests/{request_id}/reject")
async def reject_cash_drop_request(request_id: str, body: RejectCashDropRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.reject_cash_drop_request(db, request_id, user["company_id"], body.motivo)
    if not result:
        raise HTTPException(status_code=400, detail="Retiro no encontrado o ya resuelto")
    return result


# ── Entregas de efectivo (custodia cajera -> supervisor) ────────────────

@router.get("/cash-handoffs")
async def list_pending_handoffs(estado: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_pending_handoffs(db, user["company_id"], estado)


@router.post("/cash-handoffs/{handoff_id}/confirm")
async def confirm_handoff(handoff_id: str, body: ConfirmHandoffRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.confirm_handoff(
        db, handoff_id, user["company_id"], str(body.recibido_por), body.recibido_por_nombre,
        body.monto_confirmado_pyg, body.monto_confirmado_usd, body.monto_confirmado_brl,
    )
    if result == "forbidden":
        raise HTTPException(status_code=403, detail="Solo un supervisor o administrador puede confirmar una entrega")
    if not result:
        raise HTTPException(status_code=400, detail="Entrega no encontrada o ya confirmada")
    return result


# ── Performance de cajeros ────────────────────────────────────────────

@router.get("/caja/cajeros/performance")
async def cajero_performance(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_cajero_performance(db, user["company_id"])


# ── Bóveda central ────────────────────────────────────────────────────

@router.get("/vault/dashboard")
async def vault_dashboard(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_vault_dashboard(db, user["company_id"])


@router.get("/vault/entries")
async def vault_entries(estado: str | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_vault_entries(db, user["company_id"], estado)


@router.get("/caja/export/arqueo.pdf")
async def export_arqueo_pdf(
    fecha_desde: date = Query(...), fecha_hasta: date = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    company_id = user["company_id"]
    desde_dt = datetime.combine(fecha_desde, time.min, tzinfo=timezone.utc)
    hasta_dt = datetime.combine(fecha_hasta, time.max, tzinfo=timezone.utc)
    sesiones = await service.get_arqueo_diario(db, company_id, desde_dt, hasta_dt)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_arqueo_diario_pdf(company, sesiones, fecha_desde, fecha_hasta, generated_by)
    return _pdf_response(pdf_bytes, "arqueo_de_caja.pdf")


@router.get("/vault/export/movimientos.pdf")
async def export_vault_movimientos_pdf(
    fecha_desde: date = Query(...), fecha_hasta: date = Query(...),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    company_id = user["company_id"]
    desde_dt = datetime.combine(fecha_desde, time.min, tzinfo=timezone.utc)
    hasta_dt = datetime.combine(fecha_hasta, time.max, tzinfo=timezone.utc)
    entries = await service.get_vault_movimientos(db, company_id, desde_dt, hasta_dt)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_boveda_movimientos_pdf(company, entries, fecha_desde, fecha_hasta, generated_by)
    return _pdf_response(pdf_bytes, "movimientos_de_boveda.pdf")


@router.post("/vault/deposit")
async def vault_deposit(body: DepositVaultEntriesRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.request_or_execute_vault_deposit(
        db, user["company_id"], [str(i) for i in body.entry_ids],
        str(body.bank_transaction_id) if body.bank_transaction_id else None,
        user.get("id"),
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/vault/deposit-approvals")
async def vault_deposit_approvals(estado: str | None = Query("pendiente"), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_vault_deposit_approvals(db, user["company_id"], estado)


@router.post("/vault/deposit-approvals/{request_id}/approve")
async def approve_vault_deposit(request_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.approve_vault_deposit(db, request_id, user["company_id"], user.get("id"), user.get("tenant_id"))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/vault/deposit-approvals/{request_id}/reject")
async def reject_vault_deposit(request_id: str, body: RejectVaultDepositRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.reject_vault_deposit(db, request_id, user["company_id"], user.get("id"), user.get("tenant_id"), body.motivo)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
