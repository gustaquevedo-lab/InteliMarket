"""Inventory API router — doble aprobación, audit trail, toma física"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.rbac.deps import require_permission
from api.src.inventory.schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StockResponse, MovementCreate, MovementResponse,
    TransferCreate, TransferResponse,
    AdjustmentCreate, AdjustmentResponse,
    ApproveAdjustmentBody, RejectAdjustmentBody,
    PhysicalSessionCreate, PhysicalSessionResponse,
    PhysicalSessionItemCountBody, PhysicalSessionItemReconcileBody,
)
from api.src.inventory import service, export_service, pdf_reports

router = APIRouter(prefix="/api/v1", tags=["inventory"], dependencies=[Depends(require_auth)])


async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    row = r.first()
    return {"razon_social": row.razon_social, "ruc": row.ruc, "logo_url": row.logo_url} if row else {"razon_social": "Empresa", "ruc": "N/A"}


# ---------------------------------------------------------------------------
# Depósitos
# ---------------------------------------------------------------------------

@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    body: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        default_company_id = UUID(user.get("company_id")) if user.get("company_id") else None
        return await service.create_warehouse(db, body, default_company_id=default_company_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/companies/{company_id}/warehouses", response_model=list[WarehouseResponse])
async def list_warehouses(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.list_warehouses(db, company_id)


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
async def update_warehouse(
    warehouse_id: str,
    body: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        company_id = UUID(user.get("company_id"))
        return await service.update_warehouse(
            db=db,
            warehouse_id=warehouse_id,
            data=body.model_dump(exclude_unset=True),
            company_id=company_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/warehouses/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        company_id = UUID(user.get("company_id"))
        await service.delete_warehouse(db=db, warehouse_id=warehouse_id, company_id=company_id)
        return {"ok": True, "message": "Depósito dado de baja correctamente"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------

@router.get("/warehouses/{warehouse_id}/stock", response_model=list[StockResponse])
async def get_warehouse_stock(warehouse_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_stock_by_warehouse(db, warehouse_id)


@router.get("/companies/{company_id}/low-stock")
async def get_low_stock(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_low_stock(db, company_id)


@router.get("/companies/{company_id}/products/{product_id}/stock")
async def get_product_stock(company_id: str, product_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_stock_by_product(db, company_id, product_id)


@router.get("/companies/{company_id}/stock-map")
async def get_stock_map(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_stock_map(db, company_id)


# ---------------------------------------------------------------------------
# Movimientos / Kardex
# ---------------------------------------------------------------------------

@router.post("/inventory/movements", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
async def record_movement(body: MovementCreate, db: AsyncSession = Depends(get_db), _=Depends(require_permission("inventory:adjust"))):
    return await service.record_movement(db, body)


@router.get("/companies/{company_id}/inventory/stats")
async def get_inventory_stats(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_inventory_stats(db, company_id)


@router.get("/companies/{company_id}/inventory/lots/expiries")
async def get_lots_expiries(
    company_id: str,
    warehouse_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_lots_expiries(db, company_id, warehouse_id, estado, limit, offset)


@router.get("/inventory/movements")
async def list_movements(
    company_id: str = "00000000-0000-0000-0000-000000000010",
    product_id: str | None = Query(None),
    warehouse_id: str | None = Query(None),
    tipo: str | None = Query(None),
    search: str | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_movements(db, company_id, product_id, warehouse_id, tipo, fecha_desde, fecha_hasta, limit, offset, search=search)


@router.get("/companies/{company_id}/inventory/movements/summary")
async def get_kardex_summary(
    company_id: str,
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_kardex_summary(db, company_id, fecha_desde, fecha_hasta)


@router.get("/companies/{company_id}/inventory/movements/export.xlsx")
async def export_kardex_xlsx(
    company_id: str,
    product_id: str | None = Query(None),
    warehouse_id: str | None = Query(None),
    tipo: str | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    movements = await service.list_movements(db, company_id, product_id, warehouse_id, tipo, fecha_desde, fecha_hasta, limit=20000, offset=0)
    xlsx = export_service.export_kardex_excel(
        movements,
        date_type.fromisoformat(fecha_desde) if fecha_desde else None,
        date_type.fromisoformat(fecha_hasta) if fecha_hasta else None,
    )
    return StreamingResponse(
        iter([xlsx]), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=kardex.xlsx"},
    )


@router.get("/companies/{company_id}/inventory/movements/export.pdf")
async def export_kardex_pdf(
    company_id: str,
    product_id: str | None = Query(None),
    warehouse_id: str | None = Query(None),
    tipo: str | None = Query(None),
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from datetime import date as date_type
    movements = await service.list_movements(db, company_id, product_id, warehouse_id, tipo, fecha_desde, fecha_hasta, limit=2000, offset=0)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = pdf_reports.generate_kardex_pdf(
        company, movements,
        date_type.fromisoformat(fecha_desde) if fecha_desde else None,
        date_type.fromisoformat(fecha_hasta) if fecha_hasta else None,
        generated_by,
    )
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=kardex.pdf", "Content-Length": str(len(pdf_bytes))},
    )


# ---------------------------------------------------------------------------
# Transferencias
# ---------------------------------------------------------------------------

@router.post("/inventory/transfers", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(body: TransferCreate, db: AsyncSession = Depends(get_db), _=Depends(require_permission("inventory:transfer"))):
    return await service.create_transfer(db, body)


@router.post("/inventory/transfers/{transfer_id}/complete", response_model=TransferResponse)
async def complete_transfer(transfer_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_permission("inventory:transfer"))):
    result = await service.complete_transfer(db, transfer_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo completar la transferencia")
    return result


# ---------------------------------------------------------------------------
# Ajustes de Stock — Catálogo de motivos
# ---------------------------------------------------------------------------

@router.get("/inventory/adjustment-motivos")
async def get_adjustment_motivos():
    """Catálogo de motivos de ajuste con nivel de riesgo. Usado por el formulario del frontend."""
    return await service.get_adjustment_motivos()


# ---------------------------------------------------------------------------
# Ajustes de Stock — CRUD y workflow de doble aprobación
# ---------------------------------------------------------------------------

@router.get("/companies/{company_id}/adjustments")
async def list_adjustments(
    company_id: str,
    warehouse_id: str | None = Query(None),
    estado: str | None = Query(None),
    riesgo: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_adjustments(db, company_id, warehouse_id, estado, riesgo, limit, offset)


@router.post("/inventory/adjustments", response_model=AdjustmentResponse, status_code=status.HTTP_201_CREATED)
async def create_adjustment(
    body: AdjustmentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("inventory:adjust")),
):
    """Crea un nuevo ajuste de stock. Queda en estado 'pendiente_gerencia' hasta ser aprobado."""
    try:
        user_id = UUID(user["id"]) if user.get("id") else None
        user_nombre = user.get("user_nombre") or user.get("nombre") or user.get("user_email")
        ip_address = request.client.host if request.client else None
        return await service.create_adjustment(db, body, user_id=user_id, user_nombre=user_nombre, ip_address=ip_address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/inventory/adjustments/{adjustment_id}")
async def get_adjustment_detail(
    adjustment_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Detalle completo de un ajuste: items + audit log de todas las acciones."""
    result = await service.get_adjustment_detail(db, adjustment_id)
    if not result:
        raise HTTPException(status_code=404, detail="Ajuste no encontrado")
    adj = result["adjustment"]
    return {
        "id": str(adj.id),
        "codigo": adj.codigo,
        "motivo_codigo": adj.motivo_codigo,
        "motivo_label": adj.motivo_label,
        "motivo_detalle": adj.motivo_detalle,
        "motivo": adj.motivo,
        "riesgo": adj.riesgo,
        "estado": adj.estado,
        "impacto_financiero_gs": float(adj.impacto_financiero_gs or 0),
        "evidencia_urls": adj.evidencia_urls or [],
        "aprobado_por_gerencia_nombre": adj.aprobado_por_gerencia_nombre,
        "fecha_aprobacion_gerencia": adj.fecha_aprobacion_gerencia.isoformat() if adj.fecha_aprobacion_gerencia else None,
        "comentario_gerencia": adj.comentario_gerencia,
        "aprobado_por_administracion_nombre": adj.aprobado_por_administracion_nombre,
        "fecha_aprobacion_administracion": adj.fecha_aprobacion_administracion.isoformat() if adj.fecha_aprobacion_administracion else None,
        "comentario_administracion": adj.comentario_administracion,
        "rechazado_por_nombre": adj.rechazado_por_nombre,
        "motivo_rechazo": adj.motivo_rechazo,
        "fecha_rechazo": adj.fecha_rechazo.isoformat() if adj.fecha_rechazo else None,
        "physical_session_id": str(adj.physical_session_id) if adj.physical_session_id else None,
        "created_at": adj.created_at.isoformat(),
        "items": [
            {
                "id": str(i.id),
                "product_id": str(i.product_id),
                "product_nombre": i.product_nombre,
                "product_sku": i.product_sku,
                "cantidad_sistema": float(i.cantidad_sistema),
                "cantidad_fisica": float(i.cantidad_fisica),
                "diferencia": float(i.diferencia),
                "costo_unitario": float(i.costo_unitario or 0),
                "impacto_gs": float(i.impacto_gs or 0),
            }
            for i in result["items"]
        ],
        "audit_logs": [
            {
                "id": str(l.id),
                "accion": l.accion,
                "user_nombre": l.user_nombre,
                "rol_firmante": l.rol_firmante,
                "comentario": l.comentario,
                "created_at": l.created_at.isoformat(),
            }
            for l in result["audit_logs"]
        ],
    }


@router.post("/inventory/adjustments/{adjustment_id}/approve-gerencia")
async def approve_adjustment_gerencia(
    adjustment_id: str,
    body: ApproveAdjustmentBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("inventory:approve_gerencia")),
):
    """Firma de Gerencia (Paso 1). Pasa el ajuste a pendiente_administracion."""
    try:
        user_id = UUID(user["id"])
        user_nombre = user.get("user_nombre") or user.get("nombre")
        ip = request.client.host if request.client else None
        result = await service.approve_adjustment_gerencia(db, adjustment_id, user_id, user_nombre, body, ip)
        await db.commit()
        return {"ok": True, "estado": result.estado, "mensaje": "Aprobado por Gerencia. Pendiente firma de Administración."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory/adjustments/{adjustment_id}/approve-administracion")
async def approve_adjustment_administracion(
    adjustment_id: str,
    body: ApproveAdjustmentBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("inventory:approve_administracion")),
):
    """Firma de Administración (Paso 2). Aprueba definitivamente y ejecuta cambios de stock."""
    try:
        user_id = UUID(user["id"])
        user_nombre = user.get("user_nombre") or user.get("nombre")
        ip = request.client.host if request.client else None
        result = await service.approve_adjustment_administracion(db, adjustment_id, user_id, user_nombre, body, ip)
        await db.commit()
        return {"ok": True, "estado": result.estado, "mensaje": "Ajuste aprobado por Administración. Stock actualizado."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory/adjustments/{adjustment_id}/reject")
async def reject_adjustment(
    adjustment_id: str,
    body: RejectAdjustmentBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Rechaza el ajuste en cualquier etapa. Irreversible."""
    try:
        user_id = UUID(user["id"])
        user_nombre = user.get("user_nombre") or user.get("nombre")
        ip = request.client.host if request.client else None
        result = await service.reject_adjustment(db, adjustment_id, user_id, user_nombre, body, ip)
        await db.commit()
        return {"ok": True, "estado": result.estado, "mensaje": "Ajuste rechazado. Se debe crear uno nuevo si es necesario."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory/adjustments/{adjustment_id}/approve", response_model=AdjustmentResponse)
async def approve_adjustment_legacy(
    adjustment_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("inventory:adjust")),
):
    """Legado: endpoint de aprobación simple. Redirige al nuevo workflow."""
    user_id = UUID(user["id"]) if user.get("id") else None
    result = await service.approve_adjustment(db, adjustment_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar el ajuste")
    return result


@router.post("/inventory/mermas")
async def record_quick_merma(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("inventory:adjust")),
):
    try:
        return await service.record_quick_merma(
            db,
            company_id=body["company_id"],
            warehouse_id=body["warehouse_id"],
            product_id=body["product_id"],
            cantidad=float(body["cantidad"]),
            motivo=body.get("motivo", "General"),
            observaciones=body.get("observaciones", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Toma Física de Inventario
# ---------------------------------------------------------------------------

@router.post("/inventory/physical-sessions", status_code=status.HTTP_201_CREATED)
async def create_physical_session(
    body: PhysicalSessionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("inventory:adjust")),
):
    """Inicia una nueva sesión de toma física y pre-carga los ítems con el stock actual."""
    try:
        user_id = UUID(user["id"]) if user.get("id") else None
        user_nombre = user.get("user_nombre") or user.get("nombre")
        session = await service.create_physical_session(db, body, user_id=user_id, user_nombre=user_nombre)
        await db.commit()
        await db.refresh(session)
        return {
            "id": str(session.id),
            "codigo": session.codigo,
            "tipo": session.tipo,
            "estado": session.estado,
            "total_items": session.total_items,
            "warehouse_id": str(session.warehouse_id),
            "creado_por_nombre": session.creado_por_nombre,
            "fecha_inicio": session.fecha_inicio.isoformat() if session.fecha_inicio else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/companies/{company_id}/inventory/physical-sessions")
async def list_physical_sessions(
    company_id: str,
    warehouse_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_physical_sessions(db, company_id, warehouse_id, estado, limit, offset)


@router.get("/inventory/physical-sessions/{session_id}")
async def get_physical_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    session = await service.get_physical_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return session


@router.put("/inventory/physical-sessions/{session_id}/items/{item_id}/count")
async def register_item_count(
    session_id: str,
    item_id: str,
    body: PhysicalSessionItemCountBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Registra el conteo 1 o 2 de un producto. El contador 2 no ve el conteo 1 (doble ciego)."""
    try:
        user_id = UUID(user["id"]) if user.get("id") else None
        item = await service.register_item_count(db, session_id, item_id, body, user_id=user_id)
        await db.commit()
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/inventory/physical-sessions/{session_id}/items/{item_id}/reconcile")
async def reconcile_item(
    session_id: str,
    item_id: str,
    body: PhysicalSessionItemReconcileBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("inventory:adjust")),
):
    """Supervisor reconcilia diferencia entre conteo 1 y 2 de un ítem."""
    try:
        user_id = UUID(user["id"]) if user.get("id") else None
        item = await service.reconcile_item(db, session_id, item_id, body, user_id=user_id)
        await db.commit()
        return item
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inventory/physical-sessions/{session_id}/close")
async def close_physical_session(
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
    _=Depends(require_permission("inventory:adjust")),
):
    """Cierra la sesión de toma física y genera automáticamente el ajuste de stock."""
    try:
        user_id = UUID(user["id"]) if user.get("id") else None
        user_nombre = user.get("user_nombre") or user.get("nombre")
        ip = request.client.host if request.client else None
        result = await service.close_physical_session(db, session_id, user_id=user_id, user_nombre=user_nombre, ip_address=ip)
        await db.commit()
        return {
            "ok": True,
            "mensaje": f"Sesión cerrada. {result['items_con_diferencia']} productos con diferencia.",
            "adjustment_id": result["adjustment_id"],
            "items_con_diferencia": result["items_con_diferencia"],
            "diferencia_total_gs": result["diferencia_total_gs"],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

