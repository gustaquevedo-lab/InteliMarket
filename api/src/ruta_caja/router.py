from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.auth.middleware import require_auth
from api.src.db import get_db
from api.src.ruta_caja import service
from api.src.ruta_caja.schemas import (
    BankDepositCreate,
    BankDepositResponse,
    CloseSessionRequest,
    ObserveRequest,
    RouteSessionCreate,
    RouteSessionDetailResponse,
    RouteSessionResponse,
    RouteLiquidationResponse,
    TreasuryDailySummaryResponse,
)

router = APIRouter(prefix="/api/v1/distribuidora", tags=["ruta-caja"])


# ───────────────────── Route Sessions ─────────────────────────

@router.post("/route-sessions", response_model=RouteSessionResponse)
async def open_session(
    body: RouteSessionCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.open_route_session(
        db,
        company_id=body.company_id,
        cobrador_id=body.cobrador_id,
        route_id=body.route_id,
        fecha=body.fecha,
        fondo_inicial=body.fondo_inicial,
        created_by=body.created_by,
    )


@router.get("/route-sessions", response_model=list[RouteSessionResponse])
async def list_sessions(
    company_id: str,
    fecha: Optional[date] = Query(None),
    cobrador_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_route_sessions(db, company_id, fecha, cobrador_id, estado)


@router.get("/route-sessions/{session_id}", response_model=RouteSessionDetailResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    detail = await service.get_route_session_detail(db, session_id)
    session = detail["session"]
    liq = detail.get("liquidation")
    liq_resp = None
    if liq:
        liq_resp = RouteLiquidationResponse(
            **{c.key: getattr(liq, c.key) for c in liq.__table__.columns},
            diferencia=service.diferencia_liquidacion(liq),
        )
    return RouteSessionDetailResponse(
        **{c.key: getattr(session, c.key) for c in session.__table__.columns},
        liquidation=liq_resp,
        ar_summary=detail.get("ar_summary"),
        rendicion=detail.get("rendicion"),
    )


@router.post("/route-sessions/{session_id}/close", response_model=RouteLiquidationResponse)
async def close_session(
    session_id: str,
    body: CloseSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    liq = await service.close_session(
        db,
        session_id=session_id,
        efectivo_declarado=body.efectivo_declarado,
        cheques_declarado=body.cheques_declarado,
        pagares_declarado=body.pagares_declarado,
        nc_aplicadas=body.nc_aplicadas,
        descuentos_autorizados=body.descuentos_autorizados,
        items=body.items,
        closed_by=current_user["sub"],
    )
    return RouteLiquidationResponse(
        **{c.key: getattr(liq, c.key) for c in liq.__table__.columns},
        diferencia=service.diferencia_liquidacion(liq),
    )


# ───────────────────── Liquidations ───────────────────────────

@router.get("/route-liquidations/{liquidation_id}", response_model=RouteLiquidationResponse)
async def get_liquidation(
    liquidation_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    liq = await service.get_liquidation(db, liquidation_id)
    return RouteLiquidationResponse(
        **{c.key: getattr(liq, c.key) for c in liq.__table__.columns},
        diferencia=service.diferencia_liquidacion(liq),
    )


@router.post("/route-liquidations/{liquidation_id}/authorize", response_model=RouteLiquidationResponse)
async def authorize_liquidation(
    liquidation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    liq = await service.authorize_liquidation(db, liquidation_id, supervisor_id=current_user["sub"])
    return RouteLiquidationResponse(
        **{c.key: getattr(liq, c.key) for c in liq.__table__.columns},
        diferencia=service.diferencia_liquidacion(liq),
    )


@router.post("/route-liquidations/{liquidation_id}/observe", response_model=RouteLiquidationResponse)
async def observe_liquidation(
    liquidation_id: str,
    body: ObserveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    liq = await service.observe_liquidation(db, liquidation_id, current_user["sub"], body.observaciones)
    return RouteLiquidationResponse(
        **{c.key: getattr(liq, c.key) for c in liq.__table__.columns},
        diferencia=service.diferencia_liquidacion(liq),
    )


@router.post("/route-liquidations/{liquidation_id}/reject", response_model=RouteLiquidationResponse)
async def reject_liquidation(
    liquidation_id: str,
    body: ObserveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth),
):
    liq = await service.reject_liquidation(db, liquidation_id, current_user["sub"], body.observaciones)
    return RouteLiquidationResponse(
        **{c.key: getattr(liq, c.key) for c in liq.__table__.columns},
        diferencia=service.diferencia_liquidacion(liq),
    )


# ───────────────────── Treasury ───────────────────────────────

@router.get("/treasury/daily-summary", response_model=TreasuryDailySummaryResponse)
async def treasury_daily_summary(
    company_id: str,
    fecha: date = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.get_treasury_daily_summary(db, company_id, fecha)


@router.post("/treasury/bank-deposit", response_model=BankDepositResponse)
async def create_bank_deposit(
    body: BankDepositCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_bank_deposit(db, body)
