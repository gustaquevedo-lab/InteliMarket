from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.commissions.schemas import (
    CommissionRuleCreate, CommissionRuleUpdate, CommissionRuleResponse,
    SalesCommissionResponse, CommissionSummary,
)
from api.src.commissions import service

router = APIRouter(prefix="/api/v1", tags=["commissions"])


@router.post("/commission-rules", response_model=CommissionRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(body: CommissionRuleCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_rule(db, body)


@router.get("/commission-rules/{rule_id}", response_model=CommissionRuleResponse)
async def get_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_rule(db, rule_id)
    if not result:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return result


@router.get("/companies/{company_id}/commission-rules", response_model=list[CommissionRuleResponse])
async def list_rules(
    company_id: str, activo: bool | None = Query(None), db: AsyncSession = Depends(get_db),
):
    return await service.list_rules(db, company_id, activo)


@router.put("/commission-rules/{rule_id}", response_model=CommissionRuleResponse)
async def update_rule(rule_id: str, body: CommissionRuleUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_rule(db, rule_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return result


@router.delete("/commission-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_rule(db, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Regla no encontrada")


@router.get("/companies/{company_id}/commissions", response_model=list[SalesCommissionResponse])
async def list_commissions(
    company_id: str,
    vendedor_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_commissions(db, company_id, vendedor_id, estado, limit=limit, offset=offset)


@router.post("/commissions/{commission_id}/pay", response_model=SalesCommissionResponse)
async def pay_commission(commission_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.pay_commission(db, commission_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo pagar la comisión")
    return result


@router.get("/companies/{company_id}/commissions/summary")
async def commission_summary(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_commission_summary(db, company_id)
