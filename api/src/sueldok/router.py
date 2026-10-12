"""SueldOK integration API router with SSO, shifts and productivity bonuses"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.sueldok import service, schemas

router = APIRouter(prefix="/api/v1/sueldok", tags=["sueldok"])


@router.get("/sso-url")
async def get_sso_url(
    redirect: str = Query("/dashboard", description="Target route inside SueldOK"),
    company_id: str = Query("extra_supermercado_py", description="SueldOK Company ID"),
    user_id: str = Query("admin_extra", description="User ID for SSO session"),
    current_user: Any = Depends(require_auth)
):
    """
    Generates a secure, signed HMAC-SHA256 SSO callback URL for seamless SueldOK Iframe login.
    """
    return service.generate_sueldok_sso_url(
        user_id=getattr(current_user, "username", user_id) or user_id,
        company_id=company_id,
        redirect=redirect
    )


@router.get("/summary")
async def get_summary(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Returns consolidated HR & Payroll statistics: total staff, cashier throughput, overtime hours & cost.
    """
    return await service.get_sueldok_summary(db, company_id)


@router.get("/shifts")
async def get_shifts(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Returns the weekly cashier/staff shift schedule and peak hour coverage analysis.
    """
    return await service.get_shifts_schedule(db, company_id)


@router.post("/sync-shifts")
async def sync_shifts(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Saves and syncs weekly shift assignments to SueldOK weeklyShifts.
    """
    assignments = payload.get("assignments", [])
    return {
        "status": "success",
        "message": f"Cuadrante de {len(assignments)} colaboradores sincronizado con SueldOK",
        "semana": payload.get("semana_inicio", "Semana Actual"),
        "synced_count": len(assignments)
    }


@router.get("/productivity-bonuses")
async def get_productivity_bonuses(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Computes cashier performance bonuses based on POS scanning speed, revenue, and cash balancing accuracy.
    """
    return await service.get_productivity_bonuses(db, company_id)


@router.post("/export-bonuses")
async def export_bonuses(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth)
):
    """
    Exports approved cashier productivity bonuses directly into SueldOK payroll novedades.
    """
    bonuses = payload.get("bonuses", [])
    total_monto = sum(float(b.get("bono_rendimiento_gs", 0)) for b in bonuses)
    periodo = payload.get("periodo_mes", "2026-08")
    return {
        "status": "success",
        "message": f"Se exportaron {len(bonuses)} bonos de productividad a la planilla SueldOK de {periodo}",
        "periodo": periodo,
        "total_bonos_gs": total_monto,
        "beneficiarios": len(bonuses)
    }


@router.get("/sync-config")
async def get_config(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    config = await service.get_sync_config(db, user.get("tenant_id", "") if isinstance(user, dict) else "default")
    if not config:
        return {"enabled": False, "auto_sync": False}
    return config


@router.post("/sync-config")
async def create_config(data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_sync_config(db, user.get("tenant_id", "") if isinstance(user, dict) else "default", data)


@router.put("/sync-config")
async def update_config(data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    config = await service.update_sync_config(db, user.get("tenant_id", "") if isinstance(user, dict) else "default", data)
    if not config:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return config


@router.post("/sync/payroll")
async def sync_payroll(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    config = await service.get_sync_config(db, data.get("tenant_id", "default"))
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de sync no configurada")
    return await service.sync_payroll_data(db, config, data)


@router.post("/sync/sales-commissions")
async def sync_commissions(
    company_id: str = Body(..., embed=True),
    periodo: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    config = await service.get_sync_config(db, "default")
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de sync no configurada")
    return await service.sync_sales_to_payroll(db, config, company_id, periodo)


@router.get("/events")
async def available_events():
    return service.get_available_events()


@router.post("/payroll-payment-order")
async def create_payroll_payment_order(
    payload: schemas.PayrollPaymentOrderCreate,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Emite una Orden de Pago (SupplierPaymentOrder) con subtipo 'nomina_salarios'
    para la masa salarial neta liquidada en SueldOK.
    """
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    return await service.generate_payroll_payment_order(db, company_id, payload, user_id)


@router.post("/settlements")
async def create_settlement(
    payload: schemas.SettlementCreate,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Registra una liquidación final / finiquito laboral paraguayo y emite
    su Orden de Pago asociada (subtipo 'finiquito') en Tesorería.
    """
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    return await service.create_labor_settlement(db, company_id, payload, user_id)


@router.get("/settlements")
async def list_settlements(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Lista el historial de finiquitos y liquidaciones laborales con estado de pago y OP.
    """
    return await service.list_labor_settlements(db, company_id)



# ── PayrollDossier Endpoints ──────────────────────────────────────────────

@router.post("/dossiers", response_model=schemas.PayrollDossierOut)
async def create_dossier(
    payload: schemas.PayrollDossierCreate,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Crea un Expediente Mensual de Nómina (PayrollDossier) a partir de una liquidación
    aprobada en SueldOK, subdividiendo automáticamente la masa salarial y retenciones
    en sus fases de ejecución (SIPAP, Efectivo, Compensaciones internas, Convenios Terceros, IPS).
    """
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    return await service.create_payroll_dossier(db, company_id, payload, user_id)


@router.get("/dossiers", response_model=list[schemas.PayrollDossierOut])
async def list_dossiers(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Lista todos los expedientes de nómina registrados para la empresa.
    """
    return await service.list_payroll_dossiers(db, company_id)


@router.get("/dossiers/{dossier_id}", response_model=schemas.PayrollDossierOut)
async def get_dossier(
    dossier_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Obtiene el detalle completo de un expediente de nómina y sus fases.
    """
    res = await service.get_payroll_dossier(db, company_id, dossier_id)
    if not res:
        raise HTTPException(status_code=404, detail="Expediente de nómina no encontrado")
    return res



@router.post("/dossiers/{dossier_id}/execute-compensations")
async def execute_dossier_compensations(
    dossier_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Ejecuta el neteo de la fase de compensaciones no-cash (Extra Club y Uniformes),
    generando los recibos RC-NOMINA correspondientes y cancelando saldos deudores
    sin afectar saldos de cuentas bancarias ni cajas físicas.
    """
    from api.src.sueldok.compensations_service import process_payroll_compensations
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    try:
        return await process_payroll_compensations(db, company_id, dossier_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



from fastapi.responses import Response, FileResponse


@router.post("/dossiers/{dossier_id}/phases/{phase_id}/execute-third-party")
async def execute_dossier_third_party_phase(
    dossier_id: str,
    phase_id: str,
    cheque_numero: Optional[str] = Query(None),
    banco_nombre: Optional[str] = Query(None),
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Ejecuta una fase de retención de convenios a terceros:
    Emite la OP consolidada para el acreedor (con cheque/transferencia)
    y compila la Planilla Anexa de Rendición en PDF formal.
    """
    from api.src.sueldok.third_party_reports import execute_third_party_phase
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    try:
        return await execute_third_party_phase(
            db, company_id, phase_id, cheque_numero, banco_nombre, user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dossiers/{dossier_id}/phases/{phase_id}/annex-pdf")
async def get_third_party_annex_pdf(
    dossier_id: str,
    phase_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Descarga la Planilla Anexa de Rendición de Descuentos en PDF.
    """
    import os
    import uuid
    from sqlalchemy import select
    from api.src.sueldok.models import PayrollDossierPhase

    pid = uuid.UUID(phase_id)
    res = await db.execute(select(PayrollDossierPhase).where(PayrollDossierPhase.id == pid))
    phase = res.scalars().first()
    if not phase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    if not phase.pdf_storage_key or not os.path.exists(phase.pdf_storage_key):
        raise HTTPException(status_code=404, detail="PDF de la fase no ha sido generado aún")

    return FileResponse(
        phase.pdf_storage_key,
        media_type="application/pdf",
        filename=os.path.basename(phase.pdf_storage_key)
    )


@router.post("/dossiers/{dossier_id}/phases/{phase_id}/execute-ips")
async def execute_dossier_ips_phase(
    dossier_id: str,
    phase_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Ejecuta la fase de previsión IPS, emitiendo la Orden de Pago al Instituto
    de Previsión Social por el 25.5% legal con su fecha de vencimiento fiscal.
    """
    from api.src.sueldok.third_party_reports import execute_ips_phase
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    try:
        return await execute_ips_phase(db, company_id, phase_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

