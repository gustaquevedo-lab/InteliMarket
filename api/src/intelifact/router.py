"""Router de configuracion InteliFact -- listo para el dia de la activacion
de facturacion electronica real, sin ningun enganche a ventas todavia.
company_id se saca siempre del usuario autenticado, nunca de un default
hardcodeado (a diferencia de como quedo en la vertical Distribuidora)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.intelifact import service
from api.src.intelifact.schemas import (
    IntelifactConfigUpsert, IntelifactConfigResponse,
    InvoicePreviewRequest, TelemetryStatusResponse,
)

router = APIRouter(prefix="/api/v1/intelifact", tags=["intelifact"], dependencies=[Depends(require_auth)])


@router.get("/config", response_model=IntelifactConfigResponse | None)
async def get_config(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    row = await service.get_config(db, user["company_id"])
    if not row:
        return None
    return service.to_response_dict(row)


@router.put("/config", response_model=IntelifactConfigResponse)
async def upsert_config(data: IntelifactConfigUpsert, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    row = await service.upsert_config(db, user["company_id"], data)
    return service.to_response_dict(row)


@router.post("/invoices/preview")
async def preview_invoice(data: InvoicePreviewRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    cfg = await service.get_config(db, user["company_id"])
    if not cfg or not cfg.enabled:
        raise HTTPException(status_code=400, detail="InteliFact no esta configurado/habilitado para esta empresa")
    try:
        return await service.preview_invoice(cfg, data)
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="No se pudo conectar con el microservicio InteliFact -- confirmá que esté corriendo")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"El microservicio InteliFact devolvió un error: {e.response.text}")


@router.get("/telemetry/status", response_model=TelemetryStatusResponse)
async def telemetry_status(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    cfg = await service.get_config(db, user["company_id"])
    if not cfg:
        return TelemetryStatusResponse(disponible=False, error="Sin configuración")
    try:
        detalle = await service.get_telemetry_status(cfg)
        return TelemetryStatusResponse(disponible=True, detalle=detalle)
    except httpx.ConnectError:
        return TelemetryStatusResponse(disponible=False, error="Microservicio InteliFact no alcanzable")
    except httpx.HTTPStatusError as e:
        return TelemetryStatusResponse(disponible=False, error=str(e))
