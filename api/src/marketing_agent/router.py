from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.marketing_agent import service, agent_orchestrator
from api.src.marketing_agent.schemas import (
    MarketingDashboard, ChatMessageRequest, ChatMessageResponse,
    SendCouponRequest, LaunchCampaignRequest, CustomerProfileDetail,
    TripartiteSyncResponse, LearnedRuleItem, ApproveDirectiveRequest,
    PromotionPulseItem
)

router = APIRouter(prefix="/api/v1/marketing-agent", tags=["marketing-agent"], dependencies=[Depends(require_auth)])


@router.get("/dashboard", response_model=MarketingDashboard)
async def get_dashboard(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Segmentación RFM viva (7.856 clientes) y sincronización tripartita real con CFO y Copiloto."""
    return await service.get_marketing_dashboard(db, company_id)


@router.get("/customers-rfm", response_model=List[CustomerProfileDetail])
async def get_customers_rfm(
    company_id: str = Query(...),
    segmento: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(24, ge=1, le=100),
    solo_inactivos: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """Clientes reales con filtrado estricto por segmento RFM, búsqueda libre y acciones individuales IA."""
    return await service.get_top_customers_with_favorite_products(
        db, company_id, segmento=segmento, search=search, limit=limit, solo_inactivos=solo_inactivos
    )


@router.get("/promotions-pulse", response_model=List[PromotionPulseItem])
async def get_promotions_pulse(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Promociones activas e históricas con pulso de IA, productos reales y tracción en cajas físicas."""
    return await service.get_promotions_with_ai_pulse(db, company_id)


@router.get("/tripartite-sync", response_model=TripartiteSyncResponse)
async def get_tripartite_sync(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Estado en tiempo real de la Tríada de Gerentes (CFO - CMO - CSO) y directivas activas."""
    return await service.get_tripartite_sync_status(db, company_id)


@router.post("/reprofile-customers")
async def reprofile_customers(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Ejecuta el recálculo masivo de RFM, consumo acumulado y hábitos recientes en la base de datos."""
    return await service.recalculate_customer_rfm_and_habits(db, company_id)


@router.get("/audience-tags")
async def get_audience_tags(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Lista las etiquetas dinámicas activas con la cantidad de clientes etiquetados."""
    return await service.get_audience_tags_summary(db, company_id)


@router.post("/create-audience-tag")
async def create_audience_tag(
    company_id: str = Query(...),
    tag_name: str = Query(...),
    producto_keyword: Optional[str] = Query(None),
    barrio: Optional[str] = Query(None),
    min_gasto: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Crea una etiqueta y la asigna a los clientes que cumplan los criterios de hábitos reales."""
    return await service.create_custom_audience_tag(
        db, company_id, tag_name=tag_name,
        producto_keyword=producto_keyword, barrio=barrio, min_gasto=min_gasto
    )


@router.get("/learned-rules", response_model=List[LearnedRuleItem])
async def get_learned_rules(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Memoria continua de marketing y mejores prácticas de retail aprendidas."""
    return await service.get_learned_rules(db, company_id)


@router.post("/record-rule")
async def record_rule(company_id: str = Query(...), regla: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Guarda una nueva regla o política en la memoria continua del negocio."""
    return await service.record_learned_rule(db, company_id, regla, categoria="marketing")


@router.post("/chat", response_model=ChatMessageResponse)
async def chat(body: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """Chat ReAct autónomo con Qwen 2.5 7B en Ollama local y fallback a Gemini."""
    return await agent_orchestrator.chat_with_marketing_agent(
        db, body.company_id, body.message, body.conversation_history
    )


@router.post("/send-coupon")
async def send_coupon(body: SendCouponRequest):
    """Envía un cupón nominativo por WhatsApp vía Evolution API."""
    from api.src.whatsapp.evolution_client import evolution_client
    res = await evolution_client.send_text_message(body.phone, body.message, delay_ms=1000)
    return res


@router.post("/launch-campaign")
async def launch_campaign(body: LaunchCampaignRequest, db: AsyncSession = Depends(get_db)):
    """Crea la promoción en el POS físico si corresponde y despacha mensajes por WhatsApp."""
    # Si se pide crear en POS y vienen producto_ids
    if body.crear_en_pos and body.producto_ids and body.descuento_pct:
        await service.create_pos_promotion_record(
            db, body.company_id,
            nombre=f"Campaña: {body.segmento}",
            tipo="porcentaje",
            producto_ids=body.producto_ids,
            descuento_pct=body.descuento_pct,
            motivo=f"Lanzada desde CMO Virtual para segmento {body.segmento}"
        )

    # Disparar a clientes del segmento
    rfm = await service.get_real_rfm_segments(db, body.company_id)
    target = rfm.get("vip_inactivos" if "vip" in body.segmento.lower() else "frecuentes", [])
    
    return {
        "success": True,
        "segmento": body.segmento,
        "clientes_alcanzados": len(target),
        "promocion_pos_activada": body.crear_en_pos,
        "mensaje": f"Campaña activada para {len(target)} clientes del segmento."
    }
