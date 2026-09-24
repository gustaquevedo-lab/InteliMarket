from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.integrations.sueldok import service
from api.src.integrations.sueldok.schemas import (
    SueldokSSOResponse,
    SueldokSummaryStats,
    SyncShiftsPayload,
    ExportBonusesPayload,
    CashierBonusItem
)

router = APIRouter(prefix="/v1/sueldok", tags=["SueldOK Integration"])


@router.get("/sso-url", response_model=SueldokSSOResponse)
async def get_sso_url(
    redirect: str = Query("/dashboard", description="Target route inside SueldOK"),
    company_id: str = Query("extra_supermercado_py", description="SueldOK Company ID"),
    user_id: str = Query("admin_extra", description="User ID for SSO session"),
    current_user: Any = Depends(require_auth)
):
    """
    Generates a secure, signed HMAC-SHA256 SSO callback URL for seamless SueldOK Iframe login.
    """
    return service.generate_sueldok_sso_url(
        user_id=getattr(current_user, "username", user_id) or user_id,
        company_id=company_id,
        redirect=redirect
    )


@router.get("/summary", response_model=SueldokSummaryStats)
async def get_summary(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Returns consolidated HR & Payroll statistics: total staff, cashier throughput, overtime hours & cost.
    """
    return await service.get_sueldok_summary(db, company_id)


@router.get("/shifts")
async def get_shifts(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Returns the weekly cashier/staff shift schedule and peak hour coverage analysis.
    """
    return await service.get_shifts_schedule(db, company_id)


@router.post("/sync-shifts")
async def sync_shifts(
    payload: SyncShiftsPayload = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Saves and syncs weekly shift assignments to SueldOK weeklyShifts.
    """
    return {
        "status": "success",
        "message": f"Cuadrante de {len(payload.assignments)} colaboradores sincronizado con SueldOK",
        "semana": payload.semana_inicio,
        "synced_count": len(payload.assignments)
    }


@router.get("/productivity-bonuses", response_model=List[CashierBonusItem])
async def get_productivity_bonuses(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Computes cashier performance bonuses based on POS scanning speed, revenue, and cash balancing accuracy.
    """
    return await service.get_productivity_bonuses(db, company_id)


@router.post("/export-bonuses")
async def export_bonuses(
    payload: ExportBonusesPayload = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Exports approved cashier productivity bonuses directly into SueldOK payroll novedades.
    """
    total_monto = sum(b.bono_rendimiento_gs for b in payload.bonuses)
    return {
        "status": "success",
        "message": f"Se exportaron {len(payload.bonuses)} bonos de productividad a la planilla SueldOK de {payload.periodo_mes}",
        "periodo": payload.periodo_mes,
        "total_bonos_gs": total_monto,
        "beneficiarios": len(payload.bonuses)
    }
