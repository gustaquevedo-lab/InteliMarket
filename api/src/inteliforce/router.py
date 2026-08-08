"""Inteliforce router — API movil consumida por la app unificada (SueldOK)"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import date, timedelta

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.inteliforce import service
from api.src.inteliforce.schemas import (
    AuthExchangeRequest, AuthExchangeResponse, MeResponse,
    RouteStopResponse, Customer360Response, MobileOrderCreate,
    SyncRequest, SyncResponse,
)

router = APIRouter(prefix="/api/v1/inteliforce", tags=["inteliforce"])


@router.post("/auth/exchange", response_model=AuthExchangeResponse)
async def auth_exchange(data: AuthExchangeRequest, db: AsyncSession = Depends(get_db)):
    result = await service.exchange_auth(db, data.api_key, data.cedula)
    if not result:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
    return result


async def _current_rep(db: AsyncSession, user: dict):
    sales_rep_id = user.get("sales_rep_id")
    if not sales_rep_id:
        raise HTTPException(status_code=403, detail="Token no valido para Inteliforce")
    rep = await service.get_rep_by_token_claim(db, sales_rep_id)
    if not rep or not rep.activo:
        raise HTTPException(status_code=403, detail="Vendedor no encontrado o inactivo")
    return rep


@router.get("/me", response_model=MeResponse)
async def get_me(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    rep = await _current_rep(db, user)
    return rep


@router.get("/me/targets")
async def get_my_targets(
    periodo_inicio: date | None = None,
    periodo_fin: date | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.sales_targets.service import get_rep_progress, get_cascade_status

    rep = await _current_rep(db, user)
    if not periodo_inicio or not periodo_fin:
        today = date.today()
        periodo_inicio = today.replace(day=1)
        next_month = (periodo_inicio + timedelta(days=32)).replace(day=1)
        periodo_fin = next_month - timedelta(days=1)

    progress = await get_rep_progress(db, rep, periodo_inicio, periodo_fin)
    response = {"periodo_inicio": periodo_inicio, "periodo_fin": periodo_fin, "progress": progress}
    if rep.rol in ("supervisor", "gerente_comercial", "admin"):
        response["cascade"] = await get_cascade_status(db, rep, periodo_inicio, periodo_fin)
    return response


@router.get("/me/routes/today", response_model=list[RouteStopResponse])
async def get_my_route_today(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    rep = await _current_rep(db, user)
    stops = await service.get_routes_today(db, str(rep.company_id), rep)
    return stops


@router.get("/customers/{customer_id}/360", response_model=Customer360Response)
async def get_customer_360(customer_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    rep = await _current_rep(db, user)
    result = await service.get_customer_360(db, str(rep.company_id), customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return result


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(data: MobileOrderCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from api.src.sales.service import create_sale
    from api.src.sales.schemas import SaleCreate, SaleItemInput
    from api.src.credit_accounts.service import CreditAuthorizationRequired

    rep = await _current_rep(db, user)

    sale_data = SaleCreate(
        company_id=rep.company_id,
        customer_id=data.customer_id,
        tipo_comprobante="factura",
        condicion=data.condicion,
        items=[
            SaleItemInput(
                product_id=item.product_id, cantidad=item.cantidad, precio_unitario=item.precio_unitario,
                descuento_pct=item.descuento_pct, iva_tasa=item.iva_tasa,
            )
            for item in data.items
        ],
        observaciones=data.observaciones or f"Pedido tomado en campo por {rep.nombre}",
        user_id=rep.user_id,
        credit_authorization_id=data.credit_authorization_id,
    )

    try:
        sale = await create_sale(db, sale_data)
    except CreditAuthorizationRequired as e:
        raise HTTPException(status_code=409, detail={"requiere_autorizacion": True, **e.details})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if rep.funcionario_codigo:
        await db.execute(
            text("UPDATE sales SET vendedor_codigo = :codigo WHERE id = :id"),
            {"codigo": rep.funcionario_codigo, "id": sale.id},
        )
        await db.commit()

    return {"id": str(sale.id), "numero": sale.numero, "total": float(sale.total), "estado": sale.estado}


@router.post("/sync", response_model=SyncResponse)
async def sync_from_sueldok(
    data: SyncRequest,
    db: AsyncSession = Depends(get_db),
    x_inteliforce_key: str = Header(..., alias="X-Inteliforce-Key"),
):
    """Llamado por convex/intelimarketSync.js del lado SueldOK — nunca por
    la app movil directamente. Autenticacion server-a-servidor via
    inteliforce_service_keys (misma tabla que /auth/exchange, header
    separado en vez de JWT porque no hay una sesion de empleado detras)."""
    key = await service.get_service_key(db, x_inteliforce_key)
    if not key:
        raise HTTPException(status_code=401, detail="API key invalida")
    result = await service.sync_records(db, str(key.company_id), data.records)
    return result
