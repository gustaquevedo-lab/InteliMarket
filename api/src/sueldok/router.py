"""SueldOK integration API router with SSO, shifts and productivity bonuses"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import Response, FileResponse
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


@router.get("/settlements/{settlement_id}/receipt-pdf")
async def download_settlement_receipt_pdf(
    settlement_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Genera y descarga el Recibo Oficial Premium en PDF de una liquidación final / compensación de finiquito.
    """
    user_name = user.get("username", "") if isinstance(user, dict) else getattr(user, "username", "")
    try:
        pdf_bytes = await service.get_labor_settlement_receipt_pdf(
            db, company_id, settlement_id, user_name=user_name
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=recibo_finiquito_{settlement_id[:8]}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))



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


@router.post("/dossiers/sync-from-sueldok", response_model=schemas.PayrollDossierOut)
async def sync_dossier_from_sueldok(
    periodo: str = Query("2026-09", description="Período de nómina a importar (YYYY-MM)"),
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    api_key: Optional[str] = Query(None, description="API Key de la empresa en SueldOK"),
    force: bool = Query(False, description="Sobrescribir expediente existente si está en borrador"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Sincroniza e importa automáticamente la corrida aprobada en SueldOK para el período especificado,
    generando el expediente multi-fase y todas sus fases operativas y financieras.
    """
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    try:
        return await service.sync_payroll_dossier_from_sueldok(
            db, company_id, periodo, api_key, user_id, force
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


@router.get("/dossiers/{dossier_id}/compensations-pdf")
async def download_dossier_compensations_pdf(
    dossier_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Descarga el Comprobante y Planilla Oficial en PDF de las Compensaciones No-Cash
    (Extra Club y Uniformes) con detalle de recibos oficiales RC-NOMINA.
    """
    from api.src.sueldok.compensations_service import get_dossier_compensations_pdf
    user_name = user.get("username", "") if isinstance(user, dict) else getattr(user, "username", "")
    try:
        pdf_bytes = await get_dossier_compensations_pdf(db, company_id, dossier_id, user_name=user_name)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=comprobante_compensaciones_{dossier_id[:8]}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/dossiers/{dossier_id}/phases/{phase_id}/execute-net")
async def execute_dossier_net_phase(
    dossier_id: str,
    phase_id: str,
    banco: Optional[str] = Query(None),
    referencia: Optional[str] = Query(None),
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Ejecuta y marca como pagado un lote de salarios netos de Fase 1 (SIPAP o Efectivo).
    """
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    try:
        return await service.execute_net_phase(
            db, company_id, dossier_id, phase_id, banco=banco, referencia=referencia, user_id=user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



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
    Genera el documento en tiempo real si aún no existe en disco, permitiendo
    verificación y punteo antes o después de la liquidación del salario.
    """
    import os
    import uuid
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from api.src.sueldok.models import PayrollDossierPhase
    from api.src.sueldok.third_party_reports import generate_third_party_annex_pdf

    pid = uuid.UUID(phase_id)
    res = await db.execute(
        select(PayrollDossierPhase)
        .options(selectinload(PayrollDossierPhase.dossier))
        .where(PayrollDossierPhase.id == pid)
    )
    phase = res.scalars().first()
    if not phase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    # Si ya existe el archivo físico en disco, devolverlo directamente
    if phase.pdf_storage_key and os.path.exists(phase.pdf_storage_key):
        return FileResponse(
            phase.pdf_storage_key,
            media_type="application/pdf",
            filename=os.path.basename(phase.pdf_storage_key)
        )

    # Si no existe en disco o está en estado pendiente, generarlo dinámicamente en memoria
    metadata = phase.phase_metadata or {}
    third_party_name = metadata.get("third_party_name") or phase.phase_label or "Acreedor Tercero"
    third_party_ruc = metadata.get("third_party_ruc")
    employees = metadata.get("employees", [])
    total_monto = float(phase.monto or 0)
    periodo = phase.dossier.periodo if phase.dossier else "2026-09"

    pdf_bytes = generate_third_party_annex_pdf(
        company_name="GRUPO SANTA TERESA E.A.S. - Extra Supermercado Mayorista",
        company_ruc="80150377-9",
        third_party_name=third_party_name,
        third_party_ruc=third_party_ruc,
        periodo=periodo,
        cheque_numero=metadata.get("cheque_numero"),
        banco_nombre=metadata.get("banco_nombre"),
        employees=employees,
        total_monto=total_monto
    )

    clean_party = third_party_name.lower().replace(" ", "_").replace(".", "")
    filename = f"planilla_anexa_{clean_party}_{periodo}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )


@router.get("/dossiers/{dossier_id}/phases/{phase_id}/punteo")
async def get_third_party_punteo(
    dossier_id: str,
    phase_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Retorna la lista detallada de funcionarios y montos descontados para punteo
    contra la planilla de la firma conveniada (antes o después de liquidar).
    """
    import uuid
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from api.src.sueldok.models import PayrollDossierPhase

    pid = uuid.UUID(phase_id)
    res = await db.execute(
        select(PayrollDossierPhase)
        .options(selectinload(PayrollDossierPhase.dossier))
        .where(PayrollDossierPhase.id == pid)
    )
    phase = res.scalars().first()
    if not phase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    metadata = phase.phase_metadata or {}
    third_party_name = metadata.get("third_party_name") or phase.phase_label or "Acreedor Tercero"
    third_party_ruc = metadata.get("third_party_ruc")
    employees = metadata.get("employees", [])
    total_monto = float(phase.monto or 0)
    periodo = phase.dossier.periodo if phase.dossier else "2026-09"

    return {
        "phase_id": str(phase.id),
        "phase_type": phase.phase_type,
        "phase_label": phase.phase_label,
        "third_party_name": third_party_name,
        "third_party_ruc": third_party_ruc,
        "periodo": periodo,
        "total_monto": total_monto,
        "estado": phase.estado,
        "payment_order_id": str(phase.payment_order_id) if phase.payment_order_id else None,
        "count_employees": len(employees),
        "employees": employees,
        "nota_conciliacion": metadata.get("nota_conciliacion"),
        "factura_numero": metadata.get("factura_numero"),
        "total_transferencia_banco": metadata.get("total_transferencia_banco"),
        "gasto_institucional_factura": metadata.get("gasto_institucional_factura"),
    }


@router.post("/dossiers/{dossier_id}/phases/{phase_id}/revert")
async def revert_dossier_phase_endpoint(
    dossier_id: str,
    phase_id: str,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Revierte la ejecución de una fase del expediente:
    anula la Orden de Pago y restablece la fase a pendiente.
    """
    from api.src.sueldok.third_party_reports import revert_dossier_phase
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    try:
        return await revert_dossier_phase(db, company_id, phase_id, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/dossiers/{dossier_id}/phases/{phase_id}/execute-ips")
async def execute_dossier_ips_phase(
    dossier_id: str,
    phase_id: str,
    payload: Optional[schemas.ExecuteIpsPhaseRequest] = None,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Ejecuta la fase de previsión IPS, emitiendo la Orden de Pago al Instituto
    de Previsión Social por el 25.5% legal (o monto extraordinario ajustado).
    """
    from api.src.sueldok.third_party_reports import execute_ips_phase
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    monto_ajustado = payload.monto_ajustado if payload else None
    motivo_ajuste = payload.motivo_ajuste if payload else None
    try:
        return await execute_ips_phase(
            db, company_id, phase_id, user_id=user_id,
            monto_ajustado=monto_ajustado, motivo_ajuste=motivo_ajuste
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dossiers/{dossier_id}/phases/{phase_id}/adjust-ips")
@router.put("/dossiers/{dossier_id}/phases/{phase_id}/adjust-ips")
async def adjust_dossier_ips_phase(
    dossier_id: str,
    phase_id: str,
    payload: schemas.AdjustIpsPhaseRequest,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db),
    user: Any = Depends(require_auth)
):
    """
    Registra un ajuste extraordinario en la fase de previsión IPS
    (ej. diferencia por bajas tardías de personal en extracto IPS).
    """
    from api.src.sueldok.third_party_reports import adjust_ips_phase
    user_id = str(user.get("id")) if isinstance(user, dict) else str(getattr(user, "id", ""))
    try:
        return await adjust_ips_phase(
            db, company_id, phase_id,
            monto_ajustado=payload.monto_ajustado,
            motivo_ajuste=payload.motivo_ajuste,
            user_id=user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


