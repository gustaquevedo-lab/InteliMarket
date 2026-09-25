"""Inteliforce router — API movil consumida por la app unificada (SueldOK)"""

import os
import shutil
import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import date, timedelta
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.inteliforce import service
from api.src.inteliforce.schemas import (
    AuthExchangeRequest, AuthExchangeResponse, MeResponse,
    RouteStopResponse, Customer360Response, MobileOrderCreate,
    SyncRequest, SyncResponse, ProductSearchResult,
    DirectLoginRequest, SetPinRequest,
    RegisterDeviceRequest,
    CheckInRequest, CheckOutRequest,
    IncidentCreate,
    LotExpiryUpsert,
    AttendancePunchRequest, AttendancePunchResponse,
    AttendanceTodayResponse, TeamAttendanceResponse,
    UpdateCustomerLocationRequest,
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
    desglose = await service.get_targets_breakdown(db, rep, periodo_inicio, periodo_fin)
    response = {
        "periodo_inicio": periodo_inicio, "periodo_fin": periodo_fin,
        "progress": progress, "desglose": desglose,
    }
    if rep.rol in ("supervisor", "gerente_comercial", "admin"):
        response["cascade"] = await get_cascade_status(db, rep, periodo_inicio, periodo_fin)
    return response


@router.get("/products", response_model=list[ProductSearchResult])
async def search_products(
    search: str = "",
    limit: int = 30,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    rep = await _current_rep(db, user)
    return await service.search_products(db, str(rep.company_id), rep.rama, search, limit=limit, offset=offset)


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


@router.put("/customers/{customer_id}/location")
async def update_customer_location(
    customer_id: str,
    data: UpdateCustomerLocationRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Actualiza las coordenadas GPS del cliente con motivo auditado."""
    rep = await _current_rep(db, user)
    return await service.update_customer_location(
        db, str(rep.company_id), customer_id, rep,
        lat=data.lat, lng=data.lng,
        motivo=data.motivo, notas=data.notas, accuracy=data.accuracy,
    )



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


# ── Auth directa (app Inteliforce standalone) ─────────────────────────────────

@router.post("/auth/login")
async def direct_login(data: DirectLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await service.direct_login(db, str(data.company_id), data.cedula, data.pin)
    if not result:
        raise HTTPException(status_code=401, detail="Credenciales invalidas o PIN no configurado")
    return result


@router.post("/auth/set-pin", status_code=status.HTTP_204_NO_CONTENT)
async def set_pin(data: SetPinRequest, db: AsyncSession = Depends(get_db)):
    ok = await service.set_pin(db, data.api_key, data.cedula, data.pin)
    if not ok:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado o clave invalida")


# ── Dispositivos FCM ──────────────────────────────────────────────────────────

@router.post("/devices/register", status_code=status.HTTP_204_NO_CONTENT)
async def register_device(
    data: RegisterDeviceRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    rep = await _current_rep(db, user)
    await service.register_device(db, rep, data.fcm_token, data.platform, data.app_version)


# ── SSE tracking stream ───────────────────────────────────────────────────────

@router.get("/tracking-stream")
async def tracking_stream(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    from sse_starlette.sse import EventSourceResponse
    from api.src.inteliforce import sse as sse_mgr

    company_id = user["company_id"]
    q = sse_mgr.subscribe(company_id)

    async def generator():
        try:
            async for chunk in sse_mgr.event_stream(company_id, q):
                yield chunk
        finally:
            sse_mgr.unsubscribe(company_id, q)

    return EventSourceResponse(generator())


# ── Visitas ───────────────────────────────────────────────────────────────────

@router.post("/visits", status_code=status.HTTP_201_CREATED)
async def checkin(data: CheckInRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    rep = await _current_rep(db, user)
    result = await service.checkin(
        db, user["company_id"], rep,
        str(data.customer_id), data.lat, data.lng, data.accuracy, data.offline_at,
    )
    if not result.get("ok"):
        raise HTTPException(status_code=422, detail=result)
    return result


@router.get("/visits/today")
async def visits_today(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    rep = await _current_rep(db, user)
    return await service.get_visits_today(db, user["company_id"], rep)


@router.patch("/visits/{visit_id}/checkout")
async def checkout(
    visit_id: str,
    data: CheckOutRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    rep = await _current_rep(db, user)
    ok = await service.checkout(db, visit_id, rep, data.lat, data.lng, data.notas, data.estado)
    if not ok:
        raise HTTPException(status_code=404, detail="Visita no encontrada o ya cerrada")
    return {"ok": True}


# ── Media (fotos / videos) ────────────────────────────────────────────────────

MEDIA_DIR = os.getenv("INTELIFORCE_MEDIA_DIR", "/var/intelimarket/media/inteliforce")


@router.post("/visits/{visit_id}/media", status_code=status.HTTP_201_CREATED)
async def upload_media(
    visit_id: str,
    file: UploadFile = File(...),
    tipo: str = Form("foto"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    rep = await _current_rep(db, user)
    os.makedirs(MEDIA_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[-1] or (".jpg" if tipo == "foto" else ".mp4")
    filename = f"{uuid_lib.uuid4()}{ext}"
    dest = os.path.join(MEDIA_DIR, filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size_bytes = os.path.getsize(dest)
    url = f"/static/inteliforce/{filename}"

    from api.src.inteliforce.models import InteliforceMedia
    from api.src.inteliforce.models import InteliforceVisit
    from sqlalchemy import select

    r = await db.execute(select(InteliforceVisit).where(InteliforceVisit.id == uuid_lib.UUID(visit_id)))
    visit = r.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")

    media = InteliforceMedia(
        visit_id=visit.id,
        company_id=visit.company_id,
        sales_rep_id=rep.id,
        tipo=tipo,
        url=url,
        filename=filename,
        size_bytes=size_bytes,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return {"id": str(media.id), "url": url}


# ── Incidencias ───────────────────────────────────────────────────────────────

@router.post("/visits/{visit_id}/incidents", status_code=status.HTTP_201_CREATED)
async def create_incident(
    visit_id: str,
    data: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    rep = await _current_rep(db, user)
    try:
        incident = await service.create_incident(
            db, visit_id, rep,
            data.tipo, data.descripcion, data.urgencia,
            str(data.producto_id) if data.producto_id else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # notifica al supervisor si existe
    if rep.supervisor_id:
        from api.src.inteliforce import notifications
        r = await db.execute(text("SELECT razon_social FROM customers WHERE id = :id"), {"id": str(incident.customer_id)})
        row = r.fetchone()
        customer_nombre = row.razon_social if row else "cliente"
        await notifications.notify_incident(db, rep.supervisor_id, data.tipo, customer_nombre, rep.nombre)
        await db.execute(
            text("UPDATE inteliforce_incidents SET notificado = true WHERE id = :id"),
            {"id": str(incident.id)},
        )
        await db.commit()

    return {"id": str(incident.id)}


# ── Lotes y vencimientos ──────────────────────────────────────────────────────

@router.get("/customers/{customer_id}/lot-expiry")
async def get_lot_expiry(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    await _current_rep(db, user)
    return await service.get_lot_expiry_for_customer(db, user["company_id"], customer_id)


@router.put("/customers/{customer_id}/lot-expiry", status_code=status.HTTP_201_CREATED)
async def upsert_lot_expiry(
    customer_id: str,
    visit_id: str,
    items: list[LotExpiryUpsert],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    rep = await _current_rep(db, user)
    results = []
    for item in items:
        entry = await service.upsert_lot_expiry(
            db, user["company_id"], customer_id, visit_id, rep,
            str(item.product_id), item.lote, item.fecha_vencimiento, item.cantidad_unidades,
        )
        results.append({"id": str(entry.id), "product_id": str(entry.product_id)})
    return results


@router.get("/tracking-logs")
async def get_tracking_logs(
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Puntos de GPS recientes sincronizados desde SueldOK/Inteliforce, para
    el mapa de telemetria en vivo del panel web (InteliforcePage). Lee
    directo de inteliforce_sync_records -- no existia ningun endpoint de
    lectura para esta tabla, solo el /sync que la escribe."""
    result = await db.execute(
        text(
            """
            SELECT employee_convex_id,
                   (payload->'coords'->>'lat')::float AS lat,
                   (payload->'coords'->>'lng')::float AS lng,
                   (payload->>'batteryLevel')::float AS battery,
                   recorded_at
            FROM inteliforce_sync_records
            WHERE company_id = :company_id
              AND record_type = 'tracking_log'
              AND recorded_at >= now() - (:hours || ' hours')::interval
            ORDER BY recorded_at DESC
            LIMIT 500
            """
        ),
        {"company_id": user["company_id"], "hours": str(hours)},
    )
    return [dict(row._mapping) for row in result.fetchall()]


# ── Asistencia y Gestión de Personal ──────────────────────────────────────────

@router.post("/attendance/punch", response_model=AttendancePunchResponse, status_code=status.HTTP_201_CREATED)
async def punch_attendance(
    data: AttendancePunchRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Registra marcación de jornada (Entrada, Salida, Inicio de Almuerzo, Fin de Almuerzo)
    con verificación de geolocalización GPS y estado de sincronización con SueldOK."""
    rep = await _current_rep(db, user)
    return await service.record_attendance_punch(
        db, rep,
        tipo=data.tipo,
        lat=data.lat,
        lng=data.lng,
        accuracy=data.accuracy,
        foto_url=data.foto_url,
        notas=data.notas,
        battery_level=data.battery_level,
    )


@router.get("/attendance/today", response_model=AttendanceTodayResponse)
async def get_my_attendance_today(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Retorna el estado de jornada actual del colaborador conectado, horas trabajadas
    y ficha de personal homologada con SueldOK."""
    rep = await _current_rep(db, user)
    return await service.get_attendance_today(db, rep)


@router.get("/attendance/team", response_model=TeamAttendanceResponse)
async def get_team_attendance(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Retorna el estado de asistencia en vivo de todo el equipo de campo (33 colaboradores
    de Casa Gonzalito) directamente desde el hub de SueldOK."""
    rep = await _current_rep(db, user)
    return await service.get_team_attendance(db, rep)

