"""InteliEntregas Driver Mobile API — driver-scoped endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.jwt import decode_token
from api.src.intelientregas import service
from api.src.intelientregas.schemas import (
    DriverLoginRequest, DeliveryUpdateStatus, DeliveryProofCreate, TrackingEventCreate,
)

security = HTTPBearer(auto_error=False)


async def require_driver(credentials=Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Token requerido")
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "driver_access":
            raise HTTPException(status_code=403, detail="Token inválido para driver")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


router = APIRouter(
    prefix="/api/v1/intelientregas/driver",
    tags=["intelientregas-driver"],
)


@router.post("/login")
async def driver_login(body: DriverLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await service.driver_login(db, body.telefono, body.pin)
    if not result:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    return result


@router.get("/me")
async def driver_me(driver=Depends(require_driver), db: AsyncSession = Depends(get_db)):
    d = await service.get_driver(db, driver["driver_id"])
    if not d:
        raise HTTPException(status_code=404, detail="Driver no encontrado")
    return d


@router.get("/deliveries")
async def my_deliveries(
    estado: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    driver=Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_driver_deliveries(db, driver["driver_id"], estado, limit, offset)


@router.get("/deliveries/{delivery_id}")
async def delivery_detail(
    delivery_id: str,
    driver=Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    d = await service.get_delivery(db, delivery_id)
    if not d or str(d.driver_id) != driver["driver_id"]:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    return d


@router.patch("/deliveries/{delivery_id}/status")
async def update_delivery_status(
    delivery_id: str,
    data: DeliveryUpdateStatus,
    driver=Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    d = await service.get_delivery(db, delivery_id)
    if not d or str(d.driver_id) != driver["driver_id"]:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    result = await service.update_delivery_status(db, delivery_id, data)
    return result


@router.post("/deliveries/{delivery_id}/proofs", status_code=status.HTTP_201_CREATED)
async def add_proof(
    delivery_id: str,
    data: DeliveryProofCreate,
    driver=Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    d = await service.get_delivery(db, delivery_id)
    if not d or str(d.driver_id) != driver["driver_id"]:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    return await service.add_proof(db, delivery_id, data)


@router.get("/deliveries/{delivery_id}/proofs")
async def get_proofs(
    delivery_id: str,
    driver=Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    d = await service.get_delivery(db, delivery_id)
    if not d or str(d.driver_id) != driver["driver_id"]:
        raise HTTPException(status_code=404, detail="Delivery no encontrado")
    return await service.get_proofs(db, delivery_id)


@router.post("/tracking", status_code=status.HTTP_201_CREATED)
async def send_tracking(
    data: TrackingEventCreate,
    driver=Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_tracking_event(db, data)
