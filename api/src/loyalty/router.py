from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.rbac.deps import require_permission
from api.src.loyalty.schemas import (
    LoyaltyConfigCreate, LoyaltyConfigUpdate, LoyaltyConfigResponse,
    PointsCreate, PointsResponse, PointsBalance,
    LoyaltyRewardCreate, LoyaltyRewardUpdate, LoyaltyRewardResponse,
    RewardStockEntryCreate, RewardRedeemCreate, RewardRedemptionResponse,
)
from api.src.loyalty import service

router = APIRouter(prefix="/api/v1/loyalty", tags=["loyalty"])


@router.get("/config/{company_id}", response_model=LoyaltyConfigResponse)
async def get_config(company_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_or_create_config(db, company_id)


@router.put("/config/{company_id}", response_model=LoyaltyConfigResponse)
async def update_config(company_id: str, body: LoyaltyConfigUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("crm:campaigns"))):
    result = await service.update_config(db, company_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Config no encontrada")
    return result


# La acreditacion automatica de puntos por venta NO pasa por aca -- sales/service.py
# llama a loyalty_service.earn_points() directo, sin pasar por este endpoint HTTP.
# Este POST es solo para ajustes manuales (sumar o restar puntos a mano), por eso
# se gatea: antes cualquier token valido podia regalarse puntos a si mismo.
@router.post("/points", response_model=PointsResponse, status_code=status.HTTP_201_CREATED)
async def add_points(body: PointsCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("crm:update"))):
    return await service.earn_points(db, body)


@router.get("/balances-map")
async def get_balances_map(company_id: str = Query(), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_balances_map(db, company_id)


@router.get("/balance/{customer_id}", response_model=PointsBalance)
async def get_balance(customer_id: str, company_id: str = Query(), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_balance(db, customer_id, company_id)


@router.get("/history/{customer_id}", response_model=list[PointsResponse])
async def get_history(customer_id: str, company_id: str = Query(), limit: int = Query(50), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_history(db, customer_id, company_id, limit)


@router.get("/deposito-premios")
async def get_deposito_premios(company_id: str = Query(), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    """Retorna o aprovisiona el depósito dedicado DEP-PREMIOS para custodia de premios de fidelidad."""
    wh = await service.ensure_premios_warehouse(db, company_id)
    return {
        "id": str(wh.id),
        "codigo": wh.codigo,
        "nombre": wh.nombre,
        "tipo": wh.tipo,
        "responsable": wh.responsable,
        "descripcion": wh.descripcion,
    }


@router.post("/rewards", response_model=LoyaltyRewardResponse, status_code=status.HTTP_201_CREATED)
async def create_reward(body: LoyaltyRewardCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("crm:campaigns"))):
    return await service.create_reward(db, body)


@router.get("/rewards/{reward_id}", response_model=LoyaltyRewardResponse)
async def get_reward(reward_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.get_reward(db, reward_id)
    if not result:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")
    return result


@router.get("/rewards", response_model=list[LoyaltyRewardResponse])
async def list_rewards(company_id: str, activo: bool | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_rewards(db, company_id, activo)


@router.put("/rewards/{reward_id}", response_model=LoyaltyRewardResponse)
async def update_reward(reward_id: str, body: LoyaltyRewardUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("crm:campaigns"))):
    result = await service.update_reward(db, reward_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")
    return result


@router.delete("/rewards/{reward_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reward(reward_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("crm:campaigns"))):
    deleted = await service.delete_reward(db, reward_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")


@router.post("/rewards/{reward_id}/stock", response_model=LoyaltyRewardResponse)
async def add_reward_stock(
    reward_id: str,
    body: RewardStockEntryCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("crm:campaigns")),
):
    """Ingresa stock al depósito de premios referenciando la donación o remisión del patrocinador."""
    try:
        user_id = getattr(user, "id", None)
        return await service.add_reward_stock(
            db,
            reward_id=reward_id,
            cantidad=body.cantidad,
            remision_proveedor=body.remision_proveedor,
            costo_unitario=body.costo_unitario,
            notas=body.notas,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rewards/{reward_id}/canjear", response_model=RewardRedemptionResponse)
async def redeem_reward(
    reward_id: str,
    body: RewardRedeemCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("crm:update")),
):
    """Canjea un premio a un socio: debita sus puntos, descuenta del stock de DEP-PREMIOS y emite comprobante."""
    try:
        user_name = getattr(user, "nombre", None) or getattr(user, "email", "Atención al Cliente")
        user_id = getattr(user, "id", None)
        return await service.redeem_reward(
            db,
            reward_id=reward_id,
            customer_id=str(body.customer_id),
            company_id=str(body.company_id),
            cantidad=body.cantidad,
            notas=body.notas,
            user_name=user_name,
            user_id=user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/redemptions", response_model=list[RewardRedemptionResponse])
async def list_redemptions(
    company_id: str = Query(),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Historial auditable de canjes de premios efectuados."""
    return await service.list_redemptions(db, company_id, limit)


@router.get("/solicitudes-tarjetas")
async def list_solicitudes_tarjetas(user=Depends(require_auth)):
    """Obtiene las solicitudes de tarjetas registradas en cPanel y en cola Zebra"""
    import urllib.request, json
    try:
        url = "https://club.superextra.com.py/api.php?action=zebra_cola"
        req = urllib.request.Request(url, headers={"User-Agent": "Intelimarket-Backend/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except Exception as e:
        return {"cola": [], "error": str(e)}


@router.post("/solicitudes-tarjetas/{cola_id}/imprimir")
async def marcar_tarjeta_impresa(cola_id: int, user=Depends(require_auth)):
    """Marca la tarjeta como impresa en la cola de la Zebra ZC300"""
    import urllib.request, json
    try:
        url = "https://club.superextra.com.py/api.php?action=zebra_confirmar"
        payload = json.dumps({"cola_id": cola_id}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "User-Agent": "Intelimarket-Backend/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ── Tarjetas Extra Club (Zebra ZC300) ─────────────────────────────────────

@router.get("/tarjetas/socios")
async def tarjetas_socios(
    q: str | None = None,
    solo_con_numero: bool = False,
    limit: int = Query(500, ge=1, le=10000),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.listar_socios_tarjeta(db, user["company_id"], q, solo_con_numero, limit)


@router.post("/tarjetas/socios/{customer_id}/numero")
async def tarjetas_asignar_numero(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("crm:update")),
):
    import uuid as _uuid
    try:
        _uuid.UUID(customer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Identificador de cliente invalido")
    r = await service.asignar_numero_socio(db, user["company_id"], customer_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return r


@router.get("/tarjetas/impresora/estado")
async def tarjetas_estado_impresora(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.estado_impresora_tarjetas(db, user["company_id"])


@router.post("/audit")
async def auditar_puntos(
    dry_run: bool = Query(True, description="Si es true, solo reporta inconsistencias sin modificar datos"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("crm:update")),
):
    """Auditoría de puntos ExtraClub:
    Verifica que solo clientes con ExtraClub (extra_club_numero) acumulen puntos.
    Permite detectar y opcionalmente neutralizar puntos acumulados indebidamente por clientes sin tarjeta.
    """
    return await service.audit_loyalty_points(db, str(user["company_id"]), dry_run=dry_run)
