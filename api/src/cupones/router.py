"""FastAPI Router for Cupones Sorteo, Fidelizacion and IA Analysis"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.cupones import service, schemas

DEFAULT_COMPANY_ID = UUID("00000000-0000-0000-0000-000000000010")

router = APIRouter(prefix="/api/v1/cupones", tags=["Cupones Sorteo & Fidelización IA"])


@router.get("/clientes/{documento}", response_model=schemas.ClienteLookupResponse)
async def lookup_cliente_by_documento(
    documento: str,
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """
    Búsqueda instantánea de cliente por documento (C.I. / CPF) para autocompletar en pantalla.
    """
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    res = await service.lookup_cliente(db, cid, documento)
    return res


@router.post("/registrar", response_model=schemas.RegistrarCuponResponse)
async def registrar_cupon_ticket(
    payload: schemas.RegistrarCuponRequest,
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """
    Registra el cupón, hace upsert del cliente, cruza con la venta en DB y despacha WhatsApp.
    """
    if not payload.documento or not payload.nombre or not payload.nro_ticket:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documento, nombre y número de ticket son obligatorios"
        )
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    res = await service.registrar_cupon(db, cid, payload)
    return res


@router.get("/tickets", response_model=List[schemas.CuponTicketOut])
async def list_tickets(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    barrio: Optional[str] = Query(None, description="Filtrar por barrio"),
    documento: Optional[str] = Query(None, description="Filtrar por documento de cliente"),
    sincronizado: Optional[bool] = Query(None, description="Filtrar por sincronización"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Listado paginado de cupones emitidos para sorteos y auditoría."""
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    tickets = await service.list_cupon_tickets(
        db, cid, barrio=barrio, documento=documento,
        sincronizado=sincronizado, limit=limit, offset=offset
    )
    return tickets


@router.get("/clientes", response_model=List[schemas.CuponClienteOut])
async def list_clientes(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    search: Optional[str] = Query(None, description="Buscar por nombre, documento o teléfono"),
    barrio: Optional[str] = Query(None, description="Filtrar por barrio"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Directorio de clientes fidelizados con métricas acumuladas y perfilado IA."""
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    clientes = await service.list_cupon_clientes(
        db, cid, search=search, barrio=barrio, limit=limit, offset=offset
    )
    return clientes


@router.get("/stats", response_model=schemas.CuponStatsResponse)
async def get_cupones_stats(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """KPIs agregados del módulo de cupones (tickets, recaudación, barrios)."""
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    stats = await service.get_stats(db, cid)
    return stats


@router.post("/analisis-ia", response_model=schemas.AnalisisIAResponse)
async def ejecutar_analisis_ia(
    payload: schemas.AnalisisIARequest,
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """
    Ejecuta el perfilado conductual con Gemini 2.5 Flash sobre los clientes seleccionados.
    """
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    res = await service.analizar_perfil_con_gemini(
        db,
        cid,
        cliente_ids=payload.cliente_ids,
        limite=payload.limite,
        forzar_reanalisis=payload.forzar_reanalisis
    )
    return res


@router.get("/config", response_model=schemas.CuponConfigOut)
async def get_config(
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene la configuración actual del sorteo y disparo de cupones."""
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    cfg = await service.get_or_create_config(db, cid)
    return cfg


@router.put("/config", response_model=schemas.CuponConfigOut)
async def update_config(
    payload: schemas.CuponConfigUpdate,
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """Actualiza la configuración del sorteo, monto por cupón y mensaje de WhatsApp."""
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    cfg = await service.update_config(db, cid, payload)
    return cfg


@router.post("/sync/{ticket_id}", response_model=schemas.CuponTicketOut)
async def sync_single_ticket_endpoint(
    ticket_id: UUID,
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """Sincroniza un ticket específico cruzándolo contra ventas."""
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    res = await service.sync_single_ticket(db, cid, ticket_id)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("mensaje", "No se pudo sincronizar"))
    return res["ticket"]


@router.post("/sync-batch", response_model=schemas.SyncBatchProgressResponse)
async def start_sync_batch(
    payload: schemas.SyncBatchRequest,
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """Inicia la sincronización masiva de tickets pendientes."""
    import asyncio
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    asyncio.create_task(service.run_sync_batch(db, cid, payload.limite, payload.delay_ms, payload.force))
    return schemas.SyncBatchProgressResponse(
        activo=True, total=0, procesados=0, exitos=0, fallas=0, porcentaje=0.0
    )


@router.get("/sync-batch/progress", response_model=schemas.SyncBatchProgressResponse)
async def get_sync_batch_progress_endpoint():
    """Consulta el progreso actual del lote de sincronización."""
    return service.get_sync_batch_progress()


@router.post("/generar-campana", response_model=schemas.GenerarCampanaResponse)
async def generar_campana_ia_endpoint(
    payload: schemas.GenerarCampanaRequest,
    company_id: Optional[str] = Query(None, description="UUID de empresa"),
    db: AsyncSession = Depends(get_db)
):
    """Genera mensaje persuasivo para WhatsApp usando Gemini 2.5 Flash enfocado en el segmento."""
    cid = UUID(company_id) if company_id else DEFAULT_COMPANY_ID
    res = await service.generar_campana_ia(
        db, cid, segmento=payload.segmento, tono=payload.tono or "Persuasivo",
        oferta_especifica=payload.oferta_especifica
    )
    return res

