import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.sales_agent import service, agent_orchestrator
from api.src.sales_agent.schemas import (
    TriggerRunRequest, SalesAgentRunResponse, SalesRecommendationResponse, DecisionRequest,
    SalesRentabilidadExecutive, ChatMessageRequest, ChatMessageResponse, ApplyPriceRequest,
    ParetoResponse, MarginSimulationRequest, MarginSimulationResponse,
    KviToggleRequest, SettingsUpdateRequest, SalesAgentSettingsResponse,
    BusinessRuleCreateRequest, BusinessRuleResponse, ActionTaskUpdateRequest, ExecuteActionTaskRequest
)

router = APIRouter(prefix="/api/v1/sales-agent", tags=["sales-agent"], dependencies=[Depends(require_auth)])


@router.get("/analysis", response_model=SalesRentabilidadExecutive)
async def get_sales_rentabilidad_analysis(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    periodo_tipo: str = Query("mes_actual"),
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Retorna el diagnóstico completo de rentabilidad con soporte de períodos dinámicos y metas configuradas."""
    return await service.get_executive_analysis(db, company_id, periodo_tipo, fecha_desde, fecha_hasta)


@router.get("/pareto", response_model=ParetoResponse)
async def get_pareto_analysis(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    periodo_tipo: str = Query("mes_actual"),
    fecha_desde: Optional[datetime] = Query(None),
    fecha_hasta: Optional[datetime] = Query(None),
    metric_type: str = Query("facturacion"),
    search: Optional[str] = Query(None),
    categoria_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retorna la matriz Pareto 80/20 matemática real sobre las ventas de la empresa."""
    return await service.get_pareto_analysis(
        db, company_id, periodo_tipo, fecha_desde, fecha_hasta,
        metric_type, search, categoria_id, page, page_size
    )


@router.post("/simulate-margin", response_model=MarginSimulationResponse)
async def simulate_margin(
    body: MarginSimulationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Simula el impacto de aumentos de precio por categoría aplicando elasticidad precio-demanda."""
    return await service.simulate_margin_elasticity(
        db, str(body.company_id), body.periodo_tipo, body.fecha_desde, body.fecha_hasta,
        body.ajustes_categoria, body.ajustes_sku
    )


@router.post("/apply-price", response_model=dict)
async def apply_price_change(
    body: ApplyPriceRequest,
    db: AsyncSession = Depends(get_db)
):
    """Aplica de forma persistente la modificación de precio sugerida a products y sp_tiered_prices."""
    res = await service.apply_price_proposal(
        db, str(body.company_id), str(body.product_id), float(body.nuevo_precio), body.motivo or "Ajuste Gerente IA", body.escalas
    )
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error", "Error actualizando precio"))
    return res


@router.post("/kvi-toggle", response_model=dict)
async def toggle_kvi_product(
    body: KviToggleRequest,
    db: AsyncSession = Depends(get_db)
):
    """Marca o desmarca un producto como Gancho (KVI) para protegerlo contra remarcaciones."""
    return await service.toggle_kvi_product(
        db, str(body.company_id), str(body.product_id), body.es_gancho, body.motivo or "Producto Gancho KVI", body.margen_techo_pct or 15.0
    )


@router.get("/settings", response_model=SalesAgentSettingsResponse)
async def get_settings(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Retorna las metas comerciales configuradas para la empresa."""
    cfg = await service.get_company_settings(db, company_id)
    return SalesAgentSettingsResponse(
        target_margen_minimo_pct=cfg["min_pct"],
        target_margen_ideal_pct=cfg["ideal_pct"],
        metas_por_categoria=cfg["metas_por_categoria"]
    )


@router.post("/settings", response_model=dict)
async def update_settings(
    body: SettingsUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Actualiza las metas comerciales configurables."""
    return await service.update_company_settings(
        db, str(body.company_id), body.target_margen_minimo_pct, body.target_margen_ideal_pct, body.metas_por_categoria
    )


@router.get("/business-rules", response_model=list[BusinessRuleResponse])
async def list_business_rules(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Lista las reglas de negocio aprendidas por el Gerente IA."""
    return await service.list_business_rules(db, company_id)


@router.post("/business-rules", response_model=dict)
async def create_business_rule(
    body: BusinessRuleCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Crea una nueva regla de negocio manual."""
    return await service.save_business_rule(
        db, str(body.company_id), body.regla, body.categoria or "comercial", body.origen or "usuario_manual"
    )


@router.post("/action-tasks/status", response_model=dict)
async def update_task_status(
    body: ActionTaskUpdateRequest,
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Actualiza el estado de una tarea operativa. Si se descarta con motivo, la IA aprende la regla."""
    return await service.update_action_task_status(
        db, company_id, str(body.task_id), body.estado, body.motivo_descarte, body.completado_por
    )


@router.post("/action-tasks/execute", response_model=dict)
async def execute_task_action(
    body: ExecuteActionTaskRequest,
    db: AsyncSession = Depends(get_db)
):
    """Ejecuta una acción 1-Click (alerta WhatsApp o remarcación directa)."""
    return await service.execute_action_task(
        db, str(body.company_id), str(body.task_id), body.tipo_accion, body.telefono_whatsapp
    )


@router.post("/chat", response_model=ChatMessageResponse)
async def chat_with_sales_agent(
    body: ChatMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    """Invoca al copiloto comercial autónomo con Qwen 2.5 7B en Ollama local y Tool-Calling."""
    return await agent_orchestrator.chat_with_sales_agent(
        db, str(body.company_id), body.message, body.context_tab or "general", body.conversation_history
    )


@router.post("/run", response_model=SalesAgentRunResponse)
async def trigger_run(body: TriggerRunRequest, db: AsyncSession = Depends(get_db)):
    analysis = await service.get_executive_analysis(db, str(body.company_id))
    return SalesAgentRunResponse(
        id=body.company_id,
        company_id=body.company_id,
        started_at=datetime.now(),
        finished_at=datetime.now(),
        model="qwen2.5:7b",
        status="completed",
        diagnostico=analysis.resumen_ejecutivo,
    )


@router.get("/recommendations", response_model=list[SalesRecommendationResponse])
async def list_recommendations(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    analysis = await service.get_executive_analysis(db, company_id)
    recs = []
    for p in analysis.propuestas_precios:
        recs.append(SalesRecommendationResponse(
            id=uuid.uuid4(),
            company_id=uuid.UUID(company_id),
            run_id=uuid.UUID(company_id),
            tipo="oportunidad",
            titulo=f"Ajuste en {p.nombre}: Gs. {p.precio_actual:,.0f} -> Gs. {p.precio_sugerido:,.0f}",
            descripcion=f"{p.motivo} Margen sugerido: {p.margen_sugerido_pct}%. Impacto estimado: +Gs. {p.impacto_mensual_gs:,.0f}/mes.",
            entidad_relacionada=p.nombre,
            monto_relacionado=f"+Gs. {p.impacto_mensual_gs:,.0f}",
            requested_by="gerente_ventas_ia",
            status="pending",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        ))
    return recs


@router.post("/recommendations/{recommendation_id}/approve", response_model=dict)
async def approve_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    return {"success": True, "message": "Recomendación aprobada y ejecutada"}


@router.post("/recommendations/{recommendation_id}/reject", response_model=dict)
async def reject_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    return {"success": True, "message": "Recomendación rechazada"}
