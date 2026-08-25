"""Integrations router — webhooks, ecosystem integration and live POS Bancard/Dinelco"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy import select
from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.integrations import service
from api.src.integrations import pos_service
from api.src.integrations.schemas import IntegrationConfigCreate, IntegrationConfigUpdate, WebhookEvent, PosMatchRequest, PosClaimRequest
from api.src.integrations.models import PosTerminalClaim

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


# ── LIVE POS BANCARD & DINELCO TRANSACTIONS FROM REAL NEMUHA / POSTGRES ──
@router.get("/pos/kpis")
async def get_pos_kpis(_=Depends(require_auth)):
    """Get real-time live metrics of physical POS machines and QR codes."""
    return await pos_service.get_pos_kpis()


@router.get("/pos/transactions")
async def list_pos_transactions(
    limit: int = Query(50, ge=1, le=200),
    procesador: Optional[str] = Query(None),
    _=Depends(require_auth),
):
    """List actual live transactions processed by the supermarket POS terminals."""
    return await pos_service.list_live_pos_transactions(limit=limit, procesador=procesador)


@router.post("/pos/match")
async def find_pos_match(body: PosMatchRequest, db=Depends(get_db), user=Depends(require_auth)):
    """Busca una transacción real de la maquinita física (Bancard/Dinelco)
    que coincida con el cobro que se está procesando en el POS, para
    reemplazar la carga manual de lote/cupón por una verificación real
    contra lo que efectivamente pasó por la terminal."""
    claimed_result = await db.execute(select(PosTerminalClaim.fin_operacao_pos_id))
    claimed_ids = {row[0] for row in claimed_result.all()}
    return await pos_service.find_matching_transactions(
        body.procesador, body.monto, body.desde, claimed_ids,
    )


@router.post("/pos/claim")
async def claim_pos_match(body: PosClaimRequest, db=Depends(get_db), user=Depends(require_auth)):
    """Marca una transacción real de la maquinita como ya usada, para que
    no se le pueda asignar por error a otra venta."""
    existing = await db.execute(
        select(PosTerminalClaim).where(PosTerminalClaim.fin_operacao_pos_id == body.fin_operacao_pos_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Esta transacción ya fue usada para otra venta")
    claim = PosTerminalClaim(
        company_id=user.get("company_id"),
        fin_operacao_pos_id=body.fin_operacao_pos_id,
        sale_id=body.sale_id,
        procesador=body.procesador,
        monto=body.monto,
        voucher=body.voucher,
        tarjeta_marca=body.tarjeta_marca,
    )
    db.add(claim)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Esta transacción ya fue usada para otra venta")
    return {"success": True}


# ── WEBHOOKS & ECOSYSTEM ──
@router.get("/configs")
def list_configs(db=Depends(get_db), _=Depends(require_auth)):
    return service.get_configs(db)


@router.post("/configs", status_code=201)
def create_config(data: IntegrationConfigCreate, db=Depends(get_db), _=Depends(require_auth)):
    return service.create_config(db, data.model_dump())


@router.put("/configs/{config_id}")
def update_config(config_id: str, data: IntegrationConfigUpdate, db=Depends(get_db), _=Depends(require_auth)):
    cfg = service.update_config(db, config_id, data.model_dump(exclude_unset=True))
    if not cfg:
        raise HTTPException(404, "Config no encontrada")
    return cfg


@router.delete("/configs/{config_id}", status_code=204)
def delete_config(config_id: str, db=Depends(get_db), _=Depends(require_auth)):
    if not service.delete_config(db, config_id):
        raise HTTPException(404, "Config no encontrada")


@router.post("/test/{destino}")
async def test_integration(destino: str, db=Depends(get_db), _=Depends(require_auth)):
    return await service.test_connection(db, destino)


@router.get("/deliveries")
def list_deliveries(limit: int = 50, db=Depends(get_db), _=Depends(require_auth)):
    return service.get_recent_deliveries(db, limit)


@router.post("/trigger")
async def trigger_event(data: WebhookEvent, db=Depends(get_db), _=Depends(require_auth)):
    return await service.emit_event(data.evento, data.payload, db=db)
