"""Router de configuracion InteliFact -- listo para el dia de la activacion
de facturacion electronica real, sin ningun enganche a ventas todavia.
company_id se saca siempre del usuario autenticado, nunca de un default
hardcodeado (a diferencia de como quedo en la vertical Distribuidora)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from uuid import UUID

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


# ── Emision de facturas por el servicio actual (POST /v1/documents) ─────────

async def _venta_propia(db: AsyncSession, sale_id: str, company_id) -> None:
    from sqlalchemy import text
    ok = (await db.execute(text("SELECT 1 FROM sales WHERE id = :id AND company_id = :c"),
                           {"id": sale_id, "c": str(company_id)})).first()
    if not ok:
        raise HTTPException(status_code=404, detail="Venta no encontrada")


@router.post("/ventas/{sale_id}/emitir")
async def emitir_venta(sale_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    """Emite (o reintenta) la factura electronica de una venta. Seguro de repetir:
    Intelifact usa el id de la venta como clave y nunca crea un duplicado."""
    from api.src.intelifact import emision
    await _venta_propia(db, str(sale_id), user["company_id"])
    try:
        return await emision.emitir_venta(db, str(sale_id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ventas/con-problemas")
async def ventas_con_problemas(dias: int = 30, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    """Facturas electronicas que no quedaron aprobadas, con el motivo."""
    from sqlalchemy import text
    filas = (await db.execute(text(
        "SELECT s.id, s.numero, s.fecha, s.total, s.sifen_estado, s.cdc, s.factura_numero, "
        "s.sifen_xml_response AS error, s.sifen_fecha_respuesta, c.razon_social AS cliente "
        "FROM sales s LEFT JOIN customers c ON c.id = s.customer_id "
        "WHERE s.company_id = :c AND s.sifen_estado IN ('pendiente','error_envio','error_datos','rechazado') "
        "AND s.fecha > now() - make_interval(days => :d) ORDER BY s.fecha DESC LIMIT 500"),
        {"c": str(user["company_id"]), "d": max(1, min(dias, 365))})).mappings().all()
    return [dict(f) for f in filas]
