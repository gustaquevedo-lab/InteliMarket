"""Sales targets (metas de venta) — router"""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.auth.rbac import require_role
from api.src.sales_targets import service
from api.src.sales_targets.schemas import (
    SalesRepResponse, SalesRepCreate, SalesRepUpdate,
    ProductLineResponse, CascadeConfigResponse, CascadeConfigUpdate,
    SalesTargetResponse, SalesTargetCreate, SalesTargetUpdate,
    RepProgressResponse, CascadeStatusResponse,
)

router = APIRouter(prefix="/api/v1", tags=["sales-targets"])


@router.get("/companies/{company_id}/sales-reps", response_model=list[SalesRepResponse])
async def list_sales_reps(company_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_auth)):
    return await service.list_sales_reps_scoped(db, company_id, user)


@router.get("/sales-reps/{rep_id}", response_model=SalesRepResponse)
async def get_sales_rep(rep_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_auth)):
    rep = await service.get_sales_rep(db, rep_id)
    if not rep:
        raise HTTPException(status_code=404, detail="No encontrado")
    visibles = await service.list_sales_reps_scoped(db, str(rep.company_id), user)
    if rep.id not in {r.id for r in visibles}:
        raise HTTPException(status_code=403, detail="No autorizado para ver este vendedor")
    return rep


@router.post("/companies/{company_id}/sales-reps", response_model=SalesRepResponse, status_code=201,
             dependencies=[Depends(require_role("admin"))])
async def create_sales_rep(company_id: str, body: SalesRepCreate, db: AsyncSession = Depends(get_db)):
    rep = await service.create_sales_rep(db, company_id, body)
    await db.commit()
    return rep


@router.put("/sales-reps/{rep_id}", response_model=SalesRepResponse, dependencies=[Depends(require_role("admin"))])
async def update_sales_rep(rep_id: str, body: SalesRepUpdate, db: AsyncSession = Depends(get_db)):
    rep = await service.update_sales_rep(db, rep_id, body)
    if not rep:
        raise HTTPException(status_code=404, detail="No encontrado")
    await db.commit()
    return rep


@router.get("/companies/{company_id}/product-lines", response_model=list[ProductLineResponse])
async def list_product_lines(company_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_auth)):
    return await service.list_product_lines(db, company_id)


@router.get("/companies/{company_id}/sales-targets/cascade-config", response_model=CascadeConfigResponse,
            dependencies=[Depends(require_role("admin", "gerente_comercial"))])
async def get_cascade_config(company_id: str, db: AsyncSession = Depends(get_db)):
    config = await service.get_cascade_config(db, company_id)
    return config


@router.put("/companies/{company_id}/sales-targets/cascade-config", response_model=CascadeConfigResponse,
            dependencies=[Depends(require_role("admin"))])
async def update_cascade_config(company_id: str, body: CascadeConfigUpdate, db: AsyncSession = Depends(get_db)):
    config = await service.update_cascade_config(db, company_id, body)
    await db.commit()
    return config


@router.post("/companies/{company_id}/sales-targets", response_model=SalesTargetResponse, status_code=201,
             dependencies=[Depends(require_role("admin"))])
async def create_sales_target(company_id: str, body: SalesTargetCreate, db: AsyncSession = Depends(get_db),
                               user: dict = Depends(require_auth)):
    target = await service.create_sales_target(db, company_id, body, user.get("sub"))
    await db.commit()
    return target


@router.put("/sales-targets/{target_id}", response_model=SalesTargetResponse,
            dependencies=[Depends(require_role("admin"))])
async def update_sales_target(target_id: str, body: SalesTargetUpdate, db: AsyncSession = Depends(get_db)):
    target = await service.update_sales_target(db, target_id, body)
    if not target:
        raise HTTPException(status_code=404, detail="No encontrado")
    await db.commit()
    return target


@router.get("/companies/{company_id}/sales-targets", response_model=list[SalesTargetResponse])
async def list_sales_targets(company_id: str, sales_rep_id: str | None = Query(None),
                              db: AsyncSession = Depends(get_db), user: dict = Depends(require_auth)):
    if sales_rep_id:
        visibles = await service.list_sales_reps_scoped(db, company_id, user)
        if not any(str(r.id) == sales_rep_id for r in visibles):
            raise HTTPException(status_code=403, detail="No autorizado")
    return await service.list_sales_targets(db, company_id, sales_rep_id)


@router.get("/sales-reps/{rep_id}/progress", response_model=RepProgressResponse)
async def get_rep_progress(
    rep_id: str,
    periodo_inicio: date = Query(...),
    periodo_fin: date = Query(...),
    product_line_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    rep = await service.get_sales_rep(db, rep_id)
    if not rep:
        raise HTTPException(status_code=404, detail="No encontrado")
    visibles = await service.list_sales_reps_scoped(db, str(rep.company_id), user)
    if rep.id not in {r.id for r in visibles}:
        raise HTTPException(status_code=403, detail="No autorizado para ver este avance")
    return await service.get_rep_progress(db, rep, periodo_inicio, periodo_fin, product_line_id)


@router.get("/sales-reps/{rep_id}/cascade", response_model=CascadeStatusResponse)
async def get_cascade_status(
    rep_id: str,
    periodo_inicio: date = Query(...),
    periodo_fin: date = Query(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    rep = await service.get_sales_rep(db, rep_id)
    if not rep:
        raise HTTPException(status_code=404, detail="No encontrado")
    visibles = await service.list_sales_reps_scoped(db, str(rep.company_id), user)
    if rep.id not in {r.id for r in visibles}:
        raise HTTPException(status_code=403, detail="No autorizado")
    return await service.get_cascade_status(db, rep, periodo_inicio, periodo_fin)
