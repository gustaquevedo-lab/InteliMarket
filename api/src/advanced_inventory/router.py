"""Advanced Inventory router — locations, picking, cycles, FIFO, consignment, auto-replenish"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features import require_feature
from api.src.advanced_inventory import service

router = APIRouter(
    prefix="/api/v1/advanced-inventory",
    tags=["advanced-inventory"],
    dependencies=[Depends(require_feature("advanced_inventory")), Depends(require_auth)],
)


# ═══════════════════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])


# ═══════════════════════════════════════════════════════════════════
#  STORAGE LOCATIONS
# ═══════════════════════════════════════════════════════════════════

@router.get("/locations")
async def list_locations(
    warehouse_id: str = Query(""),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.list_locations(db, user["company_id"], warehouse_id)


@router.post("/locations")
async def create_location(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.create_location(db, user["company_id"], data)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.put("/locations/{loc_id}")
async def update_location(
    loc_id: str, data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.update_location(db, user["company_id"], loc_id, data)
    except ValueError as e:
        raise HTTPException(404, str(e))


# ═══════════════════════════════════════════════════════════════════
#  PICKING LISTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/picking-lists")
async def list_picking_lists(
    estado: str = Query(""),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.list_picking_lists(db, user["company_id"], estado, limit)


@router.post("/picking-lists")
async def create_picking_list(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.create_picking_list(db, user["company_id"], data)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/picking-lists/{pl_id}")
async def get_picking_list(
    pl_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.get_picking_list(db, user["company_id"], pl_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/picking-lists/{pl_id}/assign")
async def assign_picking_list(
    pl_id: str, data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.assign_picking_list(db, user["company_id"], pl_id, data.get("user_id", user["id"]))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/picking-lists/{pl_id}/items/{item_id}/pick")
async def pick_item(
    pl_id: str, item_id: str, data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.pick_item(db, user["company_id"], pl_id, item_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ═══════════════════════════════════════════════════════════════════
#  CYCLE COUNTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/cycle-counts")
async def list_cycle_counts(
    estado: str = Query(""),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.list_cycle_counts(db, user["company_id"], estado)


@router.post("/cycle-counts")
async def create_cycle_count(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.create_cycle_count(db, user["company_id"], data)


@router.post("/cycle-counts/{cc_id}/items")
async def add_cycle_count_item(
    cc_id: str, data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.add_cycle_count_item(db, user["company_id"], cc_id, data)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/cycle-counts/{cc_id}/items/{item_id}/count")
async def record_count(
    cc_id: str, item_id: str, data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.record_count(db, user["company_id"], cc_id, item_id, data)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/cycle-counts/{cc_id}/complete")
async def complete_cycle_count(
    cc_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.complete_cycle_count(db, user["company_id"], cc_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ═══════════════════════════════════════════════════════════════════
#  LOTS / FIFO
# ═══════════════════════════════════════════════════════════════════

@router.get("/lots")
async def list_lots(
    product_id: str = Query(""),
    warehouse_id: str = Query(""),
    expiring_soon_days: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.list_lots(db, user["company_id"], product_id, warehouse_id, expiring_soon_days)


@router.post("/lots/allocate")
async def allocate_fifo(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.allocate_fifo(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ═══════════════════════════════════════════════════════════════════
#  CONSIGNMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/consignment")
async def list_consignment(
    supplier_id: str = Query(""),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.list_consignment(db, user["company_id"], supplier_id)


@router.post("/consignment")
async def create_consignment(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.create_consignment(db, user["company_id"], data)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/consignment/{cons_id}/movements")
async def add_consignment_movement(
    cons_id: str, data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.add_consignment_movement(db, user["company_id"], cons_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ═══════════════════════════════════════════════════════════════════
#  AUTO REPLENISH / ALERTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/replenish-rules")
async def list_replenish_rules(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.list_replenish_rules(db, user["company_id"])


@router.post("/replenish-rules")
async def create_replenish_rule(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.create_replenish_rule(db, user["company_id"], data)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/alerts")
async def check_alerts(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.check_alerts(db, user["company_id"])


@router.delete("/replenish-rules/{rule_id}")
async def delete_replenish_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    ok = await service.delete_replenish_rule(db, user["company_id"], rule_id)
    if not ok:
        raise HTTPException(404, "Regla no encontrada")
    return {"deleted": True}


@router.get("/replenish-suggestions")
async def get_replenish_suggestions(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.get_replenish_suggestions(db, user["company_id"])
