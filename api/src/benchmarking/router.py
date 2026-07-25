from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.benchmarking import service
from api.src.benchmarking.schemas import (
    BenchmarkConfigCreate, BenchmarkConfigUpdate,
    BenchmarkRegionCreate, BenchmarkRegionUpdate,
    BenchmarkRecordCreate, BenchmarkRecordUpdate,
    BenchmarkConfigResponse, BenchmarkRegionResponse,
    BenchmarkRecordResponse, BenchmarkScoreResponse,
)

router = APIRouter(
    prefix="/api/v1/benchmarking",
    tags=["benchmarking"],
    dependencies=[Depends(require_feature("benchmarking")), Depends(require_auth)],
)


@router.get("/configs", response_model=list[BenchmarkConfigResponse])
async def list_configs(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_configs(db, user["company_id"])


@router.post("/configs", response_model=BenchmarkConfigResponse)
async def upsert_config(
    data: BenchmarkConfigCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.upsert_config(db, user["company_id"], data)


@router.delete("/configs/{config_id}")
async def delete_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_config(db, user["company_id"], config_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"deleted": True}


@router.get("/regions", response_model=list[BenchmarkRegionResponse])
async def list_regions(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_regions(db, user["company_id"])


@router.post("/regions", response_model=BenchmarkRegionResponse)
async def create_region(
    data: BenchmarkRegionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_region(db, user["company_id"], data)


@router.put("/regions/{region_id}", response_model=BenchmarkRegionResponse)
async def update_region(
    region_id: str,
    data: BenchmarkRegionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_region(db, user["company_id"], region_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Region not found")
    return result


@router.delete("/regions/{region_id}")
async def delete_region(
    region_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_region(db, user["company_id"], region_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Region not found")
    return {"deleted": True}


@router.get("/records", response_model=list[BenchmarkRecordResponse])
async def list_records(
    branch_id: Optional[str] = Query(None),
    period_type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_records(db, user["company_id"], branch_id, period_type, limit, offset)


@router.post("/records", response_model=BenchmarkRecordResponse)
async def create_record(
    data: BenchmarkRecordCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_record(db, user["company_id"], data)


@router.put("/records/{record_id}", response_model=BenchmarkRecordResponse)
async def update_record(
    record_id: str,
    data: BenchmarkRecordUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_record(db, user["company_id"], record_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Record not found")
    return result


@router.delete("/records/{record_id}")
async def delete_record(
    record_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_record(db, user["company_id"], record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"deleted": True}


@router.get("/rankings")
async def get_rankings(
    period_start: Optional[str] = Query(None),
    period_type: str = Query("weekly"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_rankings(db, user["company_id"], period_start, period_type)


@router.get("/scores")
async def get_scores(
    period_start: Optional[str] = Query(None),
    period_type: str = Query("weekly"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_scores(db, user["company_id"], period_start, period_type)


@router.get("/dashboard")
async def get_dashboard(
    period_type: str = Query("weekly"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"], period_type)


@router.get("/comparison")
async def get_regional_comparison(
    period_start: Optional[str] = Query(None),
    period_type: str = Query("weekly"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_regional_comparison(db, user["company_id"], period_start, period_type)


@router.get("/scores/{branch_id}/history")
async def get_scores_history(
    branch_id: str,
    period_type: str = Query("weekly"),
    limit: int = Query(12, le=52),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_scores_history(db, user["company_id"], branch_id, period_type, limit)
