from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.sales_orders.schemas import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse, SalesOrderWithItems
from api.src.sales_orders import service

router = APIRouter(prefix="/api/v1", tags=["sales-orders"], dependencies=[Depends(require_auth)])


@router.post("/sales-orders", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(body: SalesOrderCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_order(db, body)


@router.get("/sales-orders/{order_id}", response_model=SalesOrderWithItems)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_order_with_items(db, order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return result


@router.get("/companies/{company_id}/sales-orders", response_model=list[SalesOrderResponse])
async def list_orders(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_orders(db, company_id, customer_id, estado, limit=limit, offset=offset)


@router.put("/sales-orders/{order_id}", response_model=SalesOrderResponse)
async def update_order(order_id: str, body: SalesOrderUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_order(db, order_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo actualizar el pedido")
    return result


@router.post("/sales-orders/{order_id}/status")
async def change_order_status(
    order_id: str,
    estado: str = Query(...),
    motivo: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.change_order_status(db, order_id, estado, motivo)
    if not result:
        raise HTTPException(status_code=400, detail="Transición de estado no válida")
    return result


@router.post("/sales-orders/{order_id}/approve", response_model=SalesOrderResponse)
async def approve_order(order_id: str, aprobado_por: str = Query(...), db: AsyncSession = Depends(get_db)):
    result = await service.approve_order(db, order_id, aprobado_por)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar el pedido")
    return result


@router.get("/companies/{company_id}/sales-orders/kpi")
async def orders_kpi(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_orders_kpi(db, company_id)
