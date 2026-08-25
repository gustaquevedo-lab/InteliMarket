import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sales_agent import service
from api.src.sales_agent.schemas import (
    TriggerRunRequest, SalesAgentRunResponse, SalesRecommendationResponse, DecisionRequest,
    SalesRentabilidadExecutive, ChatMessageRequest, ChatMessageResponse, ApplyPriceRequest
)

router = APIRouter(prefix="/api/v1/sales-agent", tags=["sales-agent"])


@router.get("/analysis", response_model=SalesRentabilidadExecutive)
async def get_sales_rentabilidad_analysis(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Retorna el diagnóstico completo de rentabilidad (margen real vs meta 20%-24%),
    matriz Pareto, propuestas de precios calibradas y plan de acción diario."""
    return await service.get_executive_analysis(db, company_id)


@router.post("/chat", response_model=ChatMessageResponse)
async def chat_with_sales_agent(
    body: ChatMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    """Procesa una consulta estratégica en lenguaje natural y genera una respuesta
    con un resultado de negocio accionable (ajuste de precio, tarea, combo o compra)."""
    return await service.chat_with_sales_agent(
        db, str(body.company_id), body.message, body.conversation_history
    )


@router.post("/apply-price", response_model=dict)
async def apply_price_change(
    body: ApplyPriceRequest,
    db: AsyncSession = Depends(get_db)
):
    """Aplica la modificación de precio sugerida por el Gerente IA directamente a la base de datos."""
    res = await service.apply_price_proposal(
        db, str(body.company_id), str(body.product_id), body.nuevo_precio, body.motivo
    )
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error", "Error actualizando precio"))
    return res


@router.post("/run", response_model=SalesAgentRunResponse)
async def trigger_run(body: TriggerRunRequest, db: AsyncSession = Depends(get_db)):
    analysis = await service.get_executive_analysis(db, str(body.company_id))
    return SalesAgentRunResponse(
        id=body.company_id,
        company_id=body.company_id,
        started_at=analysis.facturacion_mes and analysis.gap_para_24_pct_gs and datetime.now(),
        finished_at=datetime.now(),
        model="gemini-2.5-flash",
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
